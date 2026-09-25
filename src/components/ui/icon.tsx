import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols";

import type { IconProps } from "@/components/ui/types";

import { useTheme } from "./theme-provider";

/**
 * SF Symbol on iOS; `fallback` is a Material Symbol name for Android/web,
 * which expo-symbols renders itself (no `@expo/vector-icons` needed).
 * Names are `string` in the contract, so they are narrowed here - an unknown
 * name renders nothing rather than throwing.
 */
export function Icon({ name, fallback, size = 24, color = "foreground" }: IconProps) {
  const { colors } = useTheme();
  const material = fallback as AndroidSymbol | undefined;

  return (
    <SymbolView
      name={{ ios: name as SFSymbol, android: material, web: material }}
      size={size}
      tintColor={colors[color]}
      style={{ width: size, height: size }}
    />
  );
}
