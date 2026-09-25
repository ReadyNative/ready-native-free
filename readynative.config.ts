import type { ReadyNativeConfig } from "./src/lib/readynative-config";

/**
 * THE file a buyer edits: app identity, brand, urls, store ids, deep-link domain, feature toggles.
 *
 * Read by `app.config.ts` (bundle ids / names per APP_VARIANT), `src/theme/tokens.ts`
 * (brand → tokens), the settings screen (urls) and `bun doctor` (placeholder warnings).
 * Must stay importable under plain Node: only import types from `src/`.
 */
export default {
  app: {
    name: "ReadyNative",
    slug: "readynative",
    scheme: "readynative",
    owner: "",
    easProjectId: "",
    ios: { bundleId: "com.acme.app" },
    android: { package: "com.acme.app" },
  },
  brand: { primary: "#171717", accent: "#2563eb", radius: 12, font: "Inter" },
  urls: { website: "", support: "mailto:", privacy: "", terms: "" },
  store: { appStoreId: "", playPackage: "" },
  links: { domain: "", appleTeamId: "", androidCertFingerprints: [] },
  privacy: { askEverywhere: false },
} satisfies ReadyNativeConfig;
