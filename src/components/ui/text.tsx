import { fontWeight } from "@/theme/tokens";
import type { TextProps, TextVariant } from "@/components/ui/types";

import { Text as RnrText } from "./rnr-text";
import { useTheme } from "./theme-provider";

type RnrVariant = NonNullable<React.ComponentProps<typeof RnrText>["variant"]>;

/** Contract variants → RNR typography variants. */
const VARIANT: Record<TextVariant, RnrVariant> = {
  body: "default",
  title: "h3",
  heading: "h4",
  subtitle: "lead",
  caption: "muted",
  label: "small",
  code: "code",
};

export function Text({
  variant = "body",
  color,
  weight,
  align,
  numberOfLines,
  style,
  children,
}: TextProps) {
  const { colors } = useTheme();
  return (
    <RnrText
      variant={VARIANT[variant]}
      numberOfLines={numberOfLines}
      style={[
        color ? { color: colors[color] } : null,
        weight ? { fontWeight: fontWeight[weight] } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    >
      {children}
    </RnrText>
  );
}
