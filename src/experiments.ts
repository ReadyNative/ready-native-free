/**
 * A/B experiments: the registry you edit. Read a variant with `useExperiment(key)` from
 * `@/lib/experiments`; the docs page "Run an A/B test" walks through one.
 *
 * Each entry is `key: { variants, weights?, local? }`:
 * - `variants`: at least one name, unique. The first one is the control.
 * - `weights`: optional, one number per variant. Equal split when omitted.
 * - `local`: `true` keeps the split on this device even when PostHog is selected.
 *
 * ```ts
 * "paywall-copy": { variants: ["control", "short"], weights: [50, 50] },
 * ```
 */
import { defineExperiments } from "@/lib/experiments";

export const experiments = defineExperiments({
  // "paywall-copy": { variants: ["control", "short"] },
});
