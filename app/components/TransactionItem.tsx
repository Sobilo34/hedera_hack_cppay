import { useTheme } from "@/contexts/ThemeContext";
import { borderRadius, spacing } from "@/constants/Typography";
import { formatAmount } from "@/utils/formatters";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface TransactionItemProps {
  icon: string;
  title: string;
  date: string;
  amount: number;
  status: string;
  iconColor?: string;
  onPress?: () => void;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({
  icon,
  title,
  date,
  amount,
  status,
  iconColor = undefined,
  onPress,
}) => {
  const { colors } = useTheme();
  const resolvedIconColor = iconColor || colors.primary;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: colors.cardBackground,
          borderBottomColor: colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: `${resolvedIconColor}20` },
        ]}
      >
        <MaterialCommunityIcons
          name={icon as any}
          size={24}
          color={resolvedIconColor}
        />
      </View>

      <View style={styles.contentContainer}>
        <Text
          style={[styles.title, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <View style={styles.bottomRow}>
          <Text style={[styles.date, { color: colors.textSecondary }]}>
            {date}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${colors.success}20` },
            ]}
          >
            <Text style={[styles.statusText, { color: colors.success }]}>
              {status}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.amountContainer}>
        <Text
          style={[
            styles.amount,
            { color: amount >= 0 ? colors.positive : colors.negative },
          ]}
        >
          {formatAmount(amount)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  contentContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  date: {
    fontSize: 12,
    marginRight: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "500",
  },
  amountContainer: {
    alignItems: "flex-end",
  },
  amount: {
    fontSize: 16,
    fontWeight: "bold",
  },
});
