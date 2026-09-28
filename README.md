# ReadyNative Free: an Expo boilerplate for React Native

A free Expo SDK 57 starter for iOS and Android with the stack already chosen: **Expo Router**, **NativeWind 4**
(Tailwind 3), **TanStack Query** and **Zustand**. TypeScript, dark mode, nothing else.
MIT licensed - this is v1.3.0 of `ready-native-free`, the free tier of [readynative.app](https://readynative.app).

```bash
git clone https://github.com/ReadyNative/ready-native-free my-app && cd my-app
bun install                  # npm / pnpm / yarn work too (delete bun.lock first)
bun run start                # press i / a, or scan the QR code with Expo Go
```

Everything here runs in Expo Go; no dev build, no accounts, no keys. `start` is
`expo start --go`: the tree carries `expo-dev-client` (for when you add native code), so a bare
`expo start` would wait for a development build instead. Need one later? `bun run ios` /
`bun run android` builds it; then `bun run start:dev`. Node 22.18+ required.

## What is inside

| Piece      | What you get                                                                            |
| ---------- | --------------------------------------------------------------------------------------- |
| Navigation | Expo Router: tabs, a settings screen, typed routes, an error boundary                   |
| UI         | NativeWind 4 + Tailwind 3, `src/components/ui` (Screen, Text, Button, Card, List, …)    |
| Data       | TanStack Query with a typed fetch client (`src/lib/api/client.ts`, `src/lib/query.tsx`) |
| State      | Zustand stores persisted through `src/lib/storage.ts` (expo-sqlite/kv-store)            |
| Theme      | Design tokens in `src/theme/tokens.ts`, light / dark / system in the settings screen    |

## Where things are

| Path                | What it is                                                              |
| ------------------- | ----------------------------------------------------------------------- |
| `src/app`           | Routes - every file is a screen, `_layout.tsx` files are navigators     |
| `src/screens`       | Screen bodies; routes stay thin and render one of these                 |
| `src/components/ui` | The UI primitives, plain NativeWind components you own                  |
| `src/lib`           | env, storage, the query client, small helpers                           |
| `src/stores`        | Zustand stores                                                          |
| `src/theme`         | Tokens, colour scheme, navigation theme                                 |
| `readynative.config.ts`   | App name, slug, scheme, bundle ids, brand colour - edit this first      |

## Want the rest?

This repo is one fixed stack. [ReadyNative Starter](https://readynative.app/#pricing) is the same app
with the picker - 5 UI stacks (NativeWind 4, NativeWind 5 RC, Tamagui, Unistyles, StyleSheet),
TanStack Query / Apollo / SWR, Zustand / Jotai, forms, i18n, onboarding, Jest + Maestro
tests - plus EAS build and submit profiles, `doctor`, the icon / splash
generator, deep-link files, and `AGENTS.md` + the architecture graph for your coding agent. <!-- check-refs-ignore: describes Starter -->
[ReadyNative Pro](https://readynative.app/#pricing) adds sign-in (Supabase, Clerk, Better Auth),
subscriptions (RevenueCat, Adapty, Stripe), push, analytics, crash reporting, API routes and
two finished example apps.

Docs: https://readynative.app/docs/
