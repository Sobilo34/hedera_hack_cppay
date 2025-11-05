import { borderRadius, spacing } from "@/constants/Typography";
import { useTheme } from "@/contexts/ThemeContext";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface BadgeProps {
  text: string;
  color?: string;
  backgroundColor?: string;
  size?: "small" | "medium" | "large";
}

export const Badge: React.FC<BadgeProps> = ({
  text,
  color,
  backgroundColor,
  size = "small",
}) => {
  const { colors } = useTheme();
  const resolvedColor = color ?? colors.primary;
  const resolvedBg = backgroundColor ?? `${colors.primary}20`;

  const containerSizeStyle =
    size === "small"
      ? styles.small
      : size === "medium"
      ? styles.medium
      : styles.large;
  const textSizeStyle =
    size === "small"
      ? styles.smallText
      : size === "medium"
      ? styles.mediumText
      : styles.largeText;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: resolvedBg },
        containerSizeStyle,
      ]}
    >
      <Text style={[styles.text, { color: resolvedColor }, textSizeStyle]}>
        {text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: "flex-start",
  },
  text: {
    fontWeight: "600",
  },
  small: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  smallText: {
    fontSize: 10,
  },
  medium: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  mediumText: {
    fontSize: 12,
  },
  large: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  largeText: {
    fontSize: 14,
  },
});
