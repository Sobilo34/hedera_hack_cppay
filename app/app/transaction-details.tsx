import { Header } from "@/components/Header";
import { useTheme } from "@/contexts/ThemeContext";
import { borderRadius, spacing } from "@/constants/Typography";
import { transactions } from "@/data/transactions";
import { formatCurrency } from "@/utils/formatters";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemeColors } from "@/constants/Colors";

export default function TransactionDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const transaction = transactions.find((t) => t.id === id);

  const { colors } = useTheme();

  const styles = createStyles(colors);

  if (!transaction) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Transaction Details" />
        <View style={styles.container}>
          <Text style={styles.errorText}>Transaction not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
  };
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.cardBackground}
      />

      <Header
        title="Transaction Details"
        rightComponent={
          <TouchableOpacity>
            <MaterialCommunityIcons
              name="headset"
              size={24}
              color={colors.textPrimary}
            />
          </TouchableOpacity>
        }
      />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${transaction.iconColor}20` },
            ]}
          >
            <MaterialCommunityIcons
              name={transaction.icon as any}
              size={64}
              color={transaction.iconColor}
            />
          </View>

          <Text style={styles.title}>{transaction.title}</Text>

          <Text
            style={[
              styles.amount,
              {
                color:
                  transaction.amount >= 0 ? colors.positive : colors.negative,
              },
            ]}
          >
            {transaction.amount >= 0 ? "+" : "-"}
            {formatCurrency(Math.abs(transaction.amount))}
          </Text>

          <View style={styles.statusContainer}>
            <View style={styles.checkmark}>
              <MaterialCommunityIcons name="check" size={20} color="#FFF" />
            </View>
            <Text style={styles.statusText}>{transaction.status}</Text>
          </View>
        </View>

        {/* Details Section */}
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Transaction Details</Text>

          {transaction.creditedTo && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Credited to</Text>
              <View style={styles.detailValueContainer}>
                <Text style={styles.detailValue}>{transaction.creditedTo}</Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={colors.textSecondary}
                />
              </View>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Transaction No</Text>
            <View style={styles.detailValueContainer}>
              <Text style={styles.detailValue} numberOfLines={1}>
                {transaction.transactionNo}
              </Text>
              <TouchableOpacity
                onPress={() => copyToClipboard(transaction.transactionNo || "")}
              >
                <MaterialCommunityIcons
                  name="content-copy"
                  size={20}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Transaction Date</Text>
            <Text style={styles.detailValue}>{transaction.date}</Text>
          </View>

          {transaction.creditedTo && (
            <TouchableOpacity style={styles.viewDetailsButton}>
              <Text style={styles.viewDetailsText}>View Cashback Details</Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={colors.primary}
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    summaryCard: {
      backgroundColor: colors.cardBackground,
      margin: spacing.lg,
      padding: spacing.xxl,
      borderRadius: borderRadius.lg,
      alignItems: "center",
      elevation: 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    iconContainer: {
      width: 96,
      height: 96,
      borderRadius: borderRadius.full,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: spacing.lg,
    },
    title: {
      fontSize: 16,
      color: colors.textPrimary,
      textAlign: "center",
      marginBottom: spacing.sm,
    },
    amount: {
      fontSize: 32,
      fontWeight: "bold",
      marginBottom: spacing.lg,
    },
    statusContainer: {
      flexDirection: "row",
      alignItems: "center",
    },
    checkmark: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.success,
      justifyContent: "center",
      alignItems: "center",
      marginRight: spacing.sm,
    },
    statusText: {
      fontSize: 14,
      color: colors.success,
      fontWeight: "600",
    },
    detailsSection: {
      backgroundColor: colors.cardBackground,
      marginHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
      overflow: "hidden",
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.textPrimary,
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    detailLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      flex: 1,
    },
    detailValueContainer: {
      flexDirection: "row",
      alignItems: "center",
      flex: 2,
      justifyContent: "flex-end",
    },
    detailValue: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: "600",
      marginRight: spacing.sm,
      textAlign: "right",
    },
    viewDetailsButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
    },
    viewDetailsText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: "600",
      marginRight: spacing.xs,
    },
    errorText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: spacing.xxl,
    },
  });
