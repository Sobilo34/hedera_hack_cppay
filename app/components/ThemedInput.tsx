import React from "react";
import {
  TextInput,
  TouchableOpacity,
  View,
  TextInputProps,
  ViewStyle,
  TextStyle,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { spacing, borderRadius } from "@/constants/Typography";
import { ThemeColors } from "@/constants/Colors";

type Props = TextInputProps & {
  pressable?: boolean;
  children?: React.ReactNode;
  onPress?: () => void;
  value?: string | undefined;
};

export default function ThemedInput({
  pressable,
  onPress,
  style,
  children,
  ...rest
}: Props) {
  const { colors } = useTheme();

  if (pressable && onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={[styles.container(colors) as ViewStyle, style as any]}
        activeOpacity={0.8}
      >
        <View style={{ flex: 1 }}>{children}</View>
      </TouchableOpacity>
    );
  }

  return (
    <TextInput
      placeholderTextColor={colors.textSecondary}
      style={[styles.input(colors), style]}
      {...rest}
    />
  );
}

const styles = {
  container: (colors: ThemeColors): ViewStyle => ({
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
  }),
  input: (colors: ThemeColors): TextStyle => ({
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  }),
};
