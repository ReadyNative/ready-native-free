import * as Haptics from "expo-haptics";
import { Pressable as RNPressable, View } from "react-native";

import { isWeb } from "@/lib/utils";
import { space } from "@/theme/tokens";
import type { RowProps } from "@/components/ui/types";

import { Icon } from "./icon";
import { Text } from "./text";
import { useTheme } from "./theme-provider";

/** Apple's minimum tap target; the leading slot is sized to match `Icon`'s box. */
const MIN_HEIGHT = 44;
const LEADING_SIZE = 28;

/**
 * One line of a settings-style list. Draws no divider - `List` (or a `Divider`
 * between Rows in a `Card`) owns the separators.
 */
export function Row({
  title,
  subtitle,
  leading,
  trailing,
  chevron,
  onPress,
  onLongPress,
  destructive = false,
  disabled = false,
  testID,
  style,
}: RowProps) {
  const { colors } = useTheme();
  const pressable = onPress !== undefined || onLongPress !== undefined;
  const showChevron = chevron ?? (onPress !== undefined && trailing === undefined);

  const handlePress = () => {
    if (!isWeb) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
        /* haptics unavailable (simulator, permissions) - never block the press */
      });
    }
    onPress?.();
  };

  const body = (
    <>
      {leading !== undefined && leading !== null ? (
        <View
          className="items-center justify-center"
          style={{ width: LEADING_SIZE, height: LEADING_SIZE }}
        >
          {typeof leading === "string" ? (
            <Icon name={leading} size={22} color={destructive ? "destructive" : "foreground"} />
          ) : (
            leading
          )}
        </View>
      ) : null}

      <View className="flex-1 justify-center" style={{ gap: 2 }}>
        <Text numberOfLines={1} color={destructive ? "destructive" : undefined}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing}
      {showChevron ? (
        <Icon name="chevron.right" fallback="chevron_right" size={18} color="mutedForeground" />
      ) : null}
    </>
  );

  const layout = { minHeight: MIN_HEIGHT, paddingHorizontal: space[4], paddingVertical: space[2] };

  if (!pressable) {
    return (
      <View testID={testID} className="flex-row items-center gap-3" style={[layout, style]}>
        {body}
      </View>
    );
  }

  return (
    <RNPressable
      testID={testID}
      role="button"
      disabled={disabled}
      onPress={handlePress}
      onLongPress={onLongPress}
      className="flex-row items-center gap-3"
      style={({ pressed }) => [
        layout,
        pressed ? { backgroundColor: colors.accent } : null,
        disabled ? { opacity: 0.5 } : null,
        style,
      ]}
    >
      {body}
    </RNPressable>
  );
}
