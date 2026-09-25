import { Tabs } from "expo-router";

import { useT } from "@/lib/i18n";
import { Icon, useTheme } from "@/components/ui";

export default function TabsLayout() {
  const { colors } = useTheme();
  const t = useT();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("Home"),
          tabBarIcon: ({ focused, size }) => (
            <Icon
              name="house"
              fallback="home"
              size={size}
              color={focused ? "primary" : "mutedForeground"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("Settings"),
          tabBarIcon: ({ focused, size }) => (
            <Icon
              name="gearshape"
              fallback="settings"
              size={size}
              color={focused ? "primary" : "mutedForeground"}
            />
          ),
        }}
      />
    </Tabs>
  );
}
