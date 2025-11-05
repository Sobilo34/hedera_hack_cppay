import { useTheme } from "@/contexts/ThemeContext";
import { borderRadius, spacing } from "@/constants/Typography";
import { user } from "@/data/user";
import { formatCurrency } from "@/utils/formatters";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function FinanceScreen() {
  const [activeTab, setActiveTab] = useState<"savings" | "loan">("savings");
  const { colors } = useTheme();

  const features = [
    { icon: "cash-multiple", label: "OWealth", color: colors.primary },
    { icon: "target", label: "Target", color: colors.primary },
    { icon: "safe-square", label: "SafeBox", color: colors.primary },
    { icon: "clock-outline", label: "Fixed", color: colors.primary },
    { icon: "wallet", label: "Spend & Save", color: colors.primary },
  ];

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle={colors.textPrimary ? "light-content" : "dark-content"}
        backgroundColor={colors.cardBackground}
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Finance</Text>
        <TouchableOpacity>
          <MaterialCommunityIcons
            name="cog"
            size={24}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "savings" && styles.activeTab]}
          onPress={() => setActiveTab("savings")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "savings" && styles.activeTabText,
            ]}
          >
            Savings
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "loan" && styles.activeTab]}
          onPress={() => setActiveTab("loan")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "loan" && styles.activeTabText,
            ]}
          >
            Loan
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Balance Card */}
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <View style={styles.balanceHeader}>
            <View style={styles.balanceLabelContainer}>
              <Text style={styles.balanceLabel}>Total Balance</Text>
              <MaterialCommunityIcons
                name="information-outline"
                size={16}
                color={colors.textPrimary}
              />
            </View>
          </View>

          <Text style={styles.balanceAmount}>
            {formatCurrency(user.balance)}
          </Text>

          <TouchableOpacity style={styles.interestContainer}>
            <Text style={styles.interestText}>
              Interest Credited Today: {formatCurrency(0)}
            </Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={16}
              color={colors.textPrimary}
            />
          </TouchableOpacity>
        </LinearGradient>

        {/* Available Balance Section */}
        <View style={styles.availableBalanceSection}>
          <TouchableOpacity style={styles.balanceRow}>
            <View style={styles.balanceRowLeft}>
              <MaterialCommunityIcons
                name="wallet"
                size={24}
                color={colors.primary}
              />
              <Text style={styles.balanceRowLabel}>Wallet</Text>
            </View>
            <View style={styles.balanceRowRight}>
              <Text style={styles.balanceRowAmount}>
                {formatCurrency(user.walletBalance)}
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={colors.textSecondary}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.balanceRow}>
            <View style={styles.balanceRowLeft}>
              <MaterialCommunityIcons
                name="cash-multiple"
                size={24}
                color={colors.primary}
              />
              <Text style={styles.balanceRowLabel}>OWealth</Text>
            </View>
            <View style={styles.balanceRowRight}>
              <Text style={styles.balanceRowAmount}>
                {formatCurrency(user.owealthBalance)}
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={colors.textSecondary}
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Features Icons */}
        <View style={styles.featuresContainer}>
          {features.map((feature, index) => (
            <TouchableOpacity key={index} style={styles.featureButton}>
              <View
                style={[
                  styles.featureIcon,
                  { backgroundColor: `${feature.color}20` },
                ]}
              >
                <MaterialCommunityIcons
                  name={feature.icon as any}
                  size={32}
                  color={feature.color}
                />
              </View>
              <Text style={styles.featureLabel}>{feature.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Feature Cards */}
        <View style={styles.featureCardsContainer}>
          {/* Targets Card */}
          <View style={styles.featureCard}>
            <View style={styles.featureCardHeader}>
              <MaterialCommunityIcons
                name="target"
                size={32}
                color={colors.primary}
              />
              <Text style={styles.featureCardTitle}>Targets</Text>
            </View>
            <Text style={styles.featureCardDescription}>
              Save daily, weekly, or monthly towards your goal
            </Text>
            <TouchableOpacity style={styles.featureCardButton}>
              <Text style={styles.featureCardButtonText}>Save</Text>
            </TouchableOpacity>
          </View>

          {/* SafeBox Card */}
          <View style={styles.featureCard}>
            <View style={styles.featureCardHeader}>
              <MaterialCommunityIcons
                name="safe-square"
                size={32}
                color={colors.primary}
              />
              <Text style={styles.featureCardTitle}>SafeBox</Text>
            </View>
            <Text style={styles.featureCardDescription}>
              Your daily, weekly or monthly automatic savings
            </Text>
          </View>

          {/* Fixed Card */}
          <View style={styles.featureCard}>
            <View style={styles.featureCardHeader}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={32}
                color={colors.primary}
              />
              <Text style={styles.featureCardTitle}>Fixed</Text>
            </View>
            <Text style={styles.featureCardDescription}>
              Your set 7-1000 days savings plan
            </Text>
          </View>
        </View>

        {/* Footer Note */}
        <Text style={styles.footerNote}>
          OWealth and Savings are Powered By Blue Ridge MicroFinance Bank Ltd.
        </Text>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.cardBackground,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    tabBar: {
      flexDirection: "row",
      backgroundColor: colors.cardBackground,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.xl,
    },
    activeTab: {
      backgroundColor: colors.primary,
    },
    tabText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    activeTabText: {
      color: colors.textPrimary,
    },
    balanceCard: {
      margin: spacing.lg,
      padding: spacing.xl,
      borderRadius: borderRadius.xl,
      elevation: 4,
      shadowColor: colors.shadow || "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    balanceHeader: {
      marginBottom: spacing.sm,
    },
    balanceLabelContainer: {
      flexDirection: "row",
      alignItems: "center",
    },
    balanceLabel: {
      fontSize: 14,
      color: colors.textPrimary,
      opacity: 0.9,
      marginRight: spacing.xs,
    },
    balanceAmount: {
      fontSize: 32,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    interestContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
    },
    interestText: {
      fontSize: 12,
      color: colors.textPrimary,
      opacity: 0.9,
      marginRight: spacing.xs,
    },
    availableBalanceSection: {
      backgroundColor: colors.cardBackground,
      marginHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
      overflow: "hidden",
    },
    balanceRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    balanceRowLeft: {
      flexDirection: "row",
      alignItems: "center",
    },
    balanceRowLabel: {
      fontSize: 14,
      color: colors.textPrimary,
      marginLeft: spacing.md,
    },
    balanceRowRight: {
      flexDirection: "row",
      alignItems: "center",
    },
    balanceRowAmount: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
      marginRight: spacing.sm,
    },
    featuresContainer: {
      flexDirection: "row",
      justifyContent: "space-around",
      backgroundColor: colors.cardBackground,
      marginHorizontal: spacing.lg,
      marginTop: spacing.lg,
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.md,
    },
    featureButton: {
      alignItems: "center",
    },
    featureIcon: {
      width: 56,
      height: 56,
      borderRadius: borderRadius.md,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    featureLabel: {
      fontSize: 12,
      color: colors.textPrimary,
      textAlign: "center",
    },
    featureCardsContainer: {
      marginTop: spacing.lg,
      paddingHorizontal: spacing.lg,
    },
    featureCard: {
      backgroundColor: colors.cardBackground,
      padding: spacing.lg,
      borderRadius: borderRadius.md,
      marginBottom: spacing.md,
    },
    featureCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    featureCardTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.primary,
      marginLeft: spacing.md,
    },
    featureCardDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: spacing.md,
      lineHeight: 20,
    },
    featureCardButton: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.xl,
      alignSelf: "flex-start",
    },
    featureCardButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    footerNote: {
      fontSize: 10,
      color: colors.textTertiary,
      textAlign: "center",
      marginHorizontal: spacing.lg,
      marginTop: spacing.lg,
      lineHeight: 14,
    },
  });
