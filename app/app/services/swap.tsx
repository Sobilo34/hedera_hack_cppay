import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeColors } from "@/constants/Colors";
import { spacing, borderRadius } from "@/constants/Typography";
import TokenSwapService from "@/services/features/TokenSwapService";
import SecureWalletStorage from "@/services/SecureWalletStorage";
import { useWalletStore } from "@/store/walletStore";

const TOKENS = [
  { symbol: "USDC", name: "USD Coin", balance: "1,250.00" },
  { symbol: "USDT", name: "Tether", balance: "500.00" },
  { symbol: "DAI", name: "Dai Stablecoin", balance: "0.00" },
];

export default function SwapScreen() {
  const router = useRouter();
  const { smartAccount } = useWalletStore();
  const [fromToken, setFromToken] = useState("USDC");
  const [toToken, setToToken] = useState("USDT");
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);
  const [loading, setLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");

  const handleSwapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const handleProceed = async () => {
    if (!fromAmount || Number(fromAmount) <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount");
      return;
    }

    if (!smartAccount?.address) {
      Alert.alert("Error", "Smart Account not initialized");
      return;
    }

    setLoading(true);
    try {
      setProcessingStatus("Getting credentials...");
      const privateKey = await SecureWalletStorage.getPrivateKey('password');
      
      if (!privateKey) {
        Alert.alert("Error", "Unable to access wallet credentials");
        setLoading(false);
        return;
      }

      setProcessingStatus("Swapping tokens...");
      const result = await TokenSwapService.swapTokens({
        smartWalletAddress: smartAccount.address as `0x${string}`,
        privateKey: privateKey as `0x${string}`,
        fromToken,
        toToken,
        amount: fromAmount,
      });

      if (result.success) {
        Alert.alert(
          "Success! 🎉",
          `Token swap completed!\n\nTransaction Hash:\n${result.transactionHash?.slice(0, 10)}...${result.transactionHash?.slice(-8)}`,
          [
            {
              text: "OK",
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        Alert.alert("Swap Failed", result.error || "Swap failed");
      }
    } catch (error: any) {
      console.error("Token swap error:", error);
      Alert.alert("Error", error.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
      setProcessingStatus("");
    }
  };

  return (
    <LinearGradient
      colors={[
        colors.backgroundGradient1,
        colors.backgroundGradient2,
        colors.backgroundGradient3,
      ]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

        <View style={styles.header}>
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
          <Text style={styles.headerTitle}>Swap Tokens</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* From Token */}
          <View style={styles.section}>
            <Text style={styles.label}>From</Text>
            <View style={styles.swapCard}>
              <TouchableOpacity style={styles.tokenSelector}>
                <Text style={styles.tokenSymbol}>{fromToken}</Text>
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={20}
                  color={colors.textPrimary}
                />
              </TouchableOpacity>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={fromAmount}
                onChangeText={(value) => {
                  setFromAmount(value);
                  // Simulate exchange rate calculation
                  setToAmount((Number(value) * 1.001).toFixed(2));
                }}
              />
            </View>
            <Text style={styles.balance}>
              Balance:{" "}
              {TOKENS.find((t) => t.symbol === fromToken)?.balance || "0.00"}
            </Text>
          </View>

          {/* Swap Button */}
          <View style={styles.swapButtonContainer}>
            <TouchableOpacity
              style={styles.swapIconButton}
              onPress={handleSwapTokens}
            >
              <MaterialCommunityIcons
                name="swap-vertical"
                size={24}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>

          {/* To Token */}
          <View style={styles.section}>
            <Text style={styles.label}>To</Text>
            <View style={styles.swapCard}>
              <TouchableOpacity style={styles.tokenSelector}>
                <Text style={styles.tokenSymbol}>{toToken}</Text>
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={20}
                  color={colors.textPrimary}
                />
              </TouchableOpacity>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={toAmount}
                editable={false}
              />
            </View>
            <Text style={styles.balance}>
              Balance:{" "}
              {TOKENS.find((t) => t.symbol === toToken)?.balance || "0.00"}
            </Text>
          </View>

          {/* Exchange Rate Info */}
          {fromAmount && toAmount && (
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Exchange Rate</Text>
                <Text style={styles.infoValue}>
                  1 {fromToken} = 1.001 {toToken}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Price Impact</Text>
                <Text style={[styles.infoValue, { color: colors.success }]}>
                  {"<"}0.1%
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Est. Gas Fee</Text>
                <Text style={styles.infoValue}>$0.05</Text>
              </View>
              <View style={[styles.infoRow, styles.infoTotal]}>
                <Text style={styles.infoTotalLabel}>You will receive</Text>
                <Text style={styles.infoTotalValue}>
                  {toAmount} {toToken}
                </Text>
              </View>
            </View>
          )}

          {/* Warning */}
          <View style={styles.warningCard}>
            <MaterialCommunityIcons
              name="information"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.warningText}>
              Swaps are executed via Uniswap V3 on Base network
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              (!fromAmount || Number(fromAmount) <= 0 || loading) && styles.buttonDisabled,
            ]}
            onPress={handleProceed}
            disabled={!fromAmount || Number(fromAmount) <= 0 || loading}
          >
            {loading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color="#FFF" />
                {processingStatus && (
                  <Text style={styles.buttonText}>{processingStatus}</Text>
                )}
              </View>
            ) : (
              <Text style={styles.buttonText}>Swap Tokens</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.cardBackground + "10",
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    content: { flex: 1, paddingHorizontal: spacing.lg },
    section: { marginBottom: spacing.md },
    label: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    swapCard: {
      backgroundColor: colors.cardBackground + "10",
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.divider + "20",
    },
    tokenSelector: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    tokenSymbol: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    amountInput: {
      fontSize: 32,
      fontWeight: "bold",
      color: colors.textPrimary,
      padding: 0,
    },
    balance: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    swapButtonContainer: { alignItems: "center", marginVertical: spacing.md },
    swapIconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.cardBackground + "10",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: colors.primary,
    },
    infoCard: {
      backgroundColor: colors.cardBackground + "05",
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: spacing.xs,
    },
    infoLabel: { fontSize: 14, color: colors.textSecondary },
    infoValue: { fontSize: 14, color: colors.textPrimary, fontWeight: "500" },
    infoTotal: {
      borderTopWidth: 1,
      borderTopColor: colors.divider + "20",
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
    },
    infoTotalLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    infoTotalValue: { fontSize: 16, fontWeight: "bold", color: colors.primary },
    warningCard: {
      backgroundColor: colors.primary + "10",
      borderRadius: borderRadius.md,
      padding: spacing.md,
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.primary + "30",
      alignItems: "center",
    },
    warningText: { flex: 1, fontSize: 12, color: colors.textSecondary },
    button: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      alignItems: "center",
      marginTop: spacing.md,
    },
    buttonDisabled: { backgroundColor: colors.primary + "30" },
    buttonText: { fontSize: 16, fontWeight: "bold", color: colors.textPrimary },
  });
