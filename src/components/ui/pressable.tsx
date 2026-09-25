import * as Haptics from "expo-haptics";
import { Pressable as RNPressable } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { isWeb } from "@/lib/utils";
import type { PressableProps } from "@/components/ui/types";

const SPRING = { damping: 15, stiffness: 300 };

/** Press feedback shared by every tappable primitive: spring scale + light haptic. */
export function Pressable({
  onPress,
  haptic = true,
  scale = 0.97,
  disabled = false,
  style,
  children,
}: PressableProps) {
  const pressed = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressed.get() }] }));

  const handlePress = () => {
    if (haptic && !isWeb) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
        /* haptics unavailable (simulator, permissions) - never block the press */
      });
    }
    onPress();
  };

  return (
    <Animated.View style={animatedStyle}>
      <RNPressable
        disabled={disabled}
        onPress={handlePress}
        onPressIn={() => {
          pressed.set(withSpring(scale, SPRING));
        }}
        onPressOut={() => {
          pressed.set(withSpring(1, SPRING));
        }}
        style={[disabled ? { opacity: 0.5 } : null, style]}
      >
        {children}
      </RNPressable>
    </Animated.View>
  );
}
