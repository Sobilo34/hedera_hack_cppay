import { useTheme } from "@/contexts/ThemeContext";
import { spacing } from "@/constants/Typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface HeaderProps {
  title: string;
  showBack?: boolean;
  rightComponent?: React.ReactNode;
  rightText?: string;
  onRightPress?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showBack = true,
  rightComponent,
  rightText,
  onRightPress,
}) => {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.cardBackground,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.leftSection}>
        {showBack && (
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={colors.textPrimary}
            />
          </TouchableOpacity>
        )}
      </View>

      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>

      <View style={styles.rightSection}>
        {rightText && (
          <TouchableOpacity onPress={onRightPress}>
            <Text style={[styles.rightText, { color: colors.primary }]}>
              {rightText}
            </Text>
          </TouchableOpacity>
        )}
        {rightComponent}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
  },
  leftSection: {
    flex: 1,
    alignItems: "flex-start",
  },
  backButton: {
    padding: spacing.xs,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    flex: 2,
    textAlign: "center",
  },
  rightSection: {
    flex: 1,
    alignItems: "flex-end",
  },
  rightText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
