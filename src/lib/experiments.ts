/**
 * A/B experiments (core: every analytics option, no module import).
 *
 * `useExperiment(key)` returns a variant of an entry in `@/experiments`, or `undefined` while it is
 * unknown: render the control then. The variant comes from, in order:
 * 1. a dev override (Settings → Developer tools), persisted on this device;
 * 2. with `featureFlagsEnabled` (PostHog) and no `local: true`: the flag `key`, when its value is
 *    one of the variants. Flags not loaded, no analytics consent or no such flag give `undefined`;
 * 3. otherwise a local split: `assignVariant` on a random install id kept in storage.
 *
 * The first time a variant is shown in a session, `experiment_exposure` is tracked with `source`
 * "local" or "override". PostHog records its own `$feature_flag_called` for remote variants, so
 * those are not tracked here.
 */
import { useEffect } from "react";

import { experiments } from "@/experiments";
import {
  analytics,
  featureFlagsEnabled,
  useFeatureFlag as useAnalyticsFeatureFlag,
  type Analytics,
  type FeatureFlagValue,
} from "@/lib/analytics";
import { storage } from "@/lib/storage";
import type { StorageAdapter } from "@/lib/storage-adapter";
import { createPersistedStore } from "@/stores/create-store";

/** One entry of the registry. `variants[0]` is the control. */
export interface ExperimentDefinition {
  readonly variants: readonly [string, ...string[]];
  /** One number per variant; equal split when omitted. */
  readonly weights?: readonly number[];
  /** Keep the split on this device even when a flag provider is selected. */
  readonly local?: boolean;
}

export type ExperimentRegistry = Record<string, ExperimentDefinition>;

export type ExperimentKey<R extends ExperimentRegistry> = keyof R & string;

/** The variant names of experiment `K`, as literal types. */
export type ExperimentVariant<
  R extends ExperimentRegistry,
  K extends ExperimentKey<R>,
> = R[K]["variants"][number] & string;

/** Where a variant came from. `remote` (PostHog flag) is never tracked by this module. */
export type ExperimentSource = "local" | "override" | "remote";

export interface Experiments<R extends ExperimentRegistry> {
  /** The variant for `key` (`undefined` while unknown). Outside React: no re-render, no exposure. */
  getVariant<K extends ExperimentKey<R>>(key: K): ExperimentVariant<R, K> | undefined;
  /**
   * `getVariant` that re-renders when flags load, the install id hydrates or an override changes,
   * and tracks the exposure. Use it where the variant is shown to the user.
   */
  useExperiment<K extends ExperimentKey<R>>(key: K): ExperimentVariant<R, K> | undefined;
  /** `useExperiment` without the exposure event: for tooling that shows a variant, not the test itself. */
  useVariant<K extends ExperimentKey<R>>(key: K): ExperimentVariant<R, K> | undefined;
  /** Force a variant on this device; `undefined` returns to automatic. Persisted. */
  setOverride<K extends ExperimentKey<R>>(
    key: K,
    variant: ExperimentVariant<R, K> | undefined
  ): void;
  /** The forced variant, `undefined` when automatic (or when the stored value no longer exists). */
  getOverride<K extends ExperimentKey<R>>(key: K): ExperimentVariant<R, K> | undefined;
  keys: readonly ExperimentKey<R>[];
}

/** What `createExperiments` reads from the app; tests pass fakes. */
export interface ExperimentDeps {
  analytics: Pick<Analytics, "track" | "getFeatureFlag">;
  featureFlagsEnabled: boolean;
  useFeatureFlag(key: string): FeatureFlagValue | undefined;
  storage: StorageAdapter;
}

/** Identity helper for `@/experiments`: keeps the literal variant names, so keys are typed. */
export function defineExperiments<const R extends ExperimentRegistry>(registry: R): R {
  return registry;
}

/** FNV-1a, 32 bit: the same string gives the same number on every launch and platform. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * The variant this install sees for `key`: a stable bucket of `${installId}:${key}`, split by
 * `weights` (equal when omitted). The same inputs always give the same variant.
 */
export function assignVariant<const V extends readonly [string, ...string[]]>(
  installId: string,
  key: string,
  variants: V,
  weights?: readonly number[]
): V[number] {
  const shares = weights ?? variants.map(() => 1);
  const total = shares.reduce((sum, share) => sum + share, 0);
  const point = (fnv1a(`${installId}:${key}`) / 0x1_0000_0000) * total;
  let upTo = 0;
  for (let i = 0; i < variants.length; i += 1) {
    upTo += shares[i];
    if (point < upTo) return variants[i];
  }
  return variants[variants.length - 1];
}

function validate(key: string, def: ExperimentDefinition): void {
  if (new Set(def.variants).size !== def.variants.length) {
    throw new Error(`[experiments] "${key}": variant names must be unique`);
  }
  const { weights } = def;
  if (weights === undefined) return;
  const total = weights.reduce((sum, share) => sum + share, 0);
  if (
    weights.length !== def.variants.length ||
    weights.some((share) => !Number.isFinite(share) || share < 0) ||
    !(total > 0)
  ) {
    throw new Error(
      `[experiments] "${key}": weights need one finite, non-negative number per variant and a sum above 0`
    );
  }
}

const IDENTITY_KEY = "readynative:experiments:id";
const OVERRIDES_KEY = "readynative:experiments:overrides";

interface Identity {
  id: string | null;
}

interface Overrides {
  forced: Record<string, string>;
}

/** Random per install and kept in storage. It only chooses a bucket: no personal data. */
function createInstallId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function defaultDeps(): ExperimentDeps {
  return {
    analytics,
    featureFlagsEnabled,
    useFeatureFlag: useAnalyticsFeatureFlag,
    storage,
  };
}

/** The experiments of one registry, with their own storage and exposure record. */
export function createExperiments<const R extends ExperimentRegistry>(
  registry: R,
  deps: ExperimentDeps = defaultDeps()
): Experiments<R> {
  for (const [key, def] of Object.entries(registry)) validate(key, def);

  const identity = createPersistedStore<Identity>({
    key: IDENTITY_KEY,
    initial: { id: null },
    storage: deps.storage,
    parse: (raw) => {
      const parsed = JSON.parse(raw) as Partial<Identity>;
      return typeof parsed.id === "string" ? { id: parsed.id } : undefined;
    },
  });
  const overrides = createPersistedStore<Overrides>({
    key: OVERRIDES_KEY,
    initial: { forced: {} },
    storage: deps.storage,
    parse: (raw) => {
      const parsed = JSON.parse(raw) as { forced?: Record<string, unknown> };
      const forced: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed.forced ?? {})) {
        if (typeof value === "string") forced[key] = value;
      }
      return { forced };
    },
  });

  // Sync storage (kv-store, MMKV) hydrates at once; async storage (web, AsyncStorage) later.
  // A failed read never writes a new id over the stored one.
  const ensureInstallId = (): void => {
    if (!identity.isHydrated() || identity.hydrationFailed()) return;
    if (identity.getState().id === null) identity.setState({ id: createInstallId() });
  };
  void identity.hydrate().then(ensureInstallId);
  void overrides.hydrate();
  ensureInstallId();

  /** Last exposure per key (`source:variant`), so each one is tracked once per session. */
  const exposed = new Map<string, string>();

  const isVariantOf = (key: string, value: unknown): value is string =>
    typeof value === "string" && registry[key].variants.includes(value);

  /** The remote flag decides this experiment: PostHog is selected and the entry is not `local`. */
  const usesRemote = (key: string): boolean =>
    deps.featureFlagsEnabled && registry[key].local !== true;

  function assign(
    key: string,
    input: { forced: unknown; flag: FeatureFlagValue | undefined; installId: string | null }
  ): { variant: string; source: ExperimentSource } | undefined {
    if (isVariantOf(key, input.forced)) return { variant: input.forced, source: "override" };
    if (usesRemote(key)) {
      return isVariantOf(key, input.flag) ? { variant: input.flag, source: "remote" } : undefined;
    }
    if (input.installId === null) return undefined;
    const def = registry[key];
    return {
      variant: assignVariant(input.installId, key, def.variants, def.weights),
      source: "local",
    };
  }

  function getVariant<K extends ExperimentKey<R>>(key: K): ExperimentVariant<R, K> | undefined {
    const assignment = assign(key, {
      forced: overrides.getState().forced[key],
      // Read only on the remote path: the provider may record a call for every read.
      flag: usesRemote(key) ? deps.analytics.getFeatureFlag(key) : undefined,
      installId: identity.getState().id,
    });
    return assignment?.variant as ExperimentVariant<R, K> | undefined;
  }

  function useAssignment(key: string): ReturnType<typeof assign> {
    const flag = deps.useFeatureFlag(key);
    const forced = overrides.useStore((state) => state.forced[key]);
    const installId = identity.useStore((state) => state.id);
    return assign(key, {
      forced,
      flag: usesRemote(key) ? flag : undefined,
      installId,
    });
  }

  function useVariant<K extends ExperimentKey<R>>(key: K): ExperimentVariant<R, K> | undefined {
    return useAssignment(key)?.variant as ExperimentVariant<R, K> | undefined;
  }

  function useExperiment<K extends ExperimentKey<R>>(key: K): ExperimentVariant<R, K> | undefined {
    const assignment = useAssignment(key);
    const variant = assignment?.variant;
    const source = assignment?.source;

    useEffect(() => {
      if (variant === undefined || source === undefined) return;
      const seen = `${source}:${variant}`;
      if (exposed.get(key) === seen) return;
      exposed.set(key, seen);
      if (source === "remote") return;
      deps.analytics.track("experiment_exposure", { experiment: key, variant, source });
    }, [key, variant, source]);

    return variant as ExperimentVariant<R, K> | undefined;
  }

  function getOverride<K extends ExperimentKey<R>>(key: K): ExperimentVariant<R, K> | undefined {
    const value = overrides.getState().forced[key];
    return isVariantOf(key, value) ? (value as ExperimentVariant<R, K>) : undefined;
  }

  function setOverride<K extends ExperimentKey<R>>(
    key: K,
    variant: ExperimentVariant<R, K> | undefined
  ): void {
    overrides.setState((prev) => {
      const forced = { ...prev.forced };
      if (variant === undefined) delete forced[key];
      else forced[key] = variant;
      return { forced };
    });
  }

  return {
    getVariant,
    useExperiment,
    useVariant,
    setOverride,
    getOverride,
    keys: Object.keys(registry) as ExperimentKey<R>[],
  };
}

type Registry = typeof experiments;
type Key = ExperimentKey<Registry>;
type Variant<K extends Key> = ExperimentVariant<Registry, K>;

let defaults: Experiments<Registry> | undefined;

/**
 * Built on first use, not at import: `@/experiments` imports `defineExperiments` from this file,
 * so reading `experiments` while this module is still loading would see nothing.
 */
function defaultInstance(): Experiments<Registry> {
  defaults ??= createExperiments(experiments);
  return defaults;
}

export function getVariant<K extends Key>(key: K): Variant<K> | undefined {
  return defaultInstance().getVariant(key);
}

export function useExperiment<K extends Key>(key: K): Variant<K> | undefined {
  return defaultInstance().useExperiment(key);
}

/** `useExperiment` without the exposure event (Developer tools). */
export function useVariant<K extends Key>(key: K): Variant<K> | undefined {
  return defaultInstance().useVariant(key);
}

export function setOverride<K extends Key>(key: K, variant: Variant<K> | undefined): void {
  defaultInstance().setOverride(key, variant);
}

export function getOverride<K extends Key>(key: K): Variant<K> | undefined {
  return defaultInstance().getOverride(key);
}
