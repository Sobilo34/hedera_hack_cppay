import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/contexts/ThemeContext";
import { spacing, borderRadius } from "@/constants/Typography";
import { ThemeColors } from "@/constants/Colors";
import ThemedInput from "@/components/ThemedInput";
import SelectInput from "@/components/SelectInput";
import BankTransferService from "@/services/features/BankTransferService";
import SecureWalletStorage from "@/services/SecureWalletStorage";
import { useWalletStore } from "@/store/walletStore";

const BANK_OPTIONS = BankTransferService.getNigerianBanks();
type BankOption = (typeof BANK_OPTIONS)[number];

export default function BankTransferScreen() {
  const router = useRouter();
  const { smartAccount } = useWalletStore();
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);
  const [loading, setLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");

  const handleVerifyAccount = async () => {
    if (!selectedBank) {
      Alert.alert("No Bank Selected", "Please choose a destination bank");
      return;
    }

    if (!accountNumber || accountNumber.length !== 10) {
      Alert.alert(
        "Invalid Account",
        "Please enter a valid 10-digit account number"
      );
      return;
    }
    
    try {
      setAccountName("");
      const verified = await BankTransferService.verifyBankAccount(
        accountNumber,
        selectedBank.code
      );

      setAccountName(verified.accountName);
      Alert.alert("Account Verified", verified.accountName);
    } catch (error: any) {
      console.error("Bank account verification failed:", error);
      Alert.alert(
        "Verification Failed",
        error?.message || "Unable to verify the bank account."
      );
    }
  };

  const handleProceed = async () => {
    if (!selectedBank || !accountNumber || !amount) {
      Alert.alert("Missing Information", "Please fill in all required fields");
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

      setProcessingStatus("Processing bank transfer...");
      const result = await BankTransferService.transferToBank({
        smartWalletAddress: smartAccount.address as `0x${string}`,
        privateKey: privateKey as `0x${string}`,
  bankCode: selectedBank.code,
        accountNumber,
        accountName,
        amountNGN: parseFloat(amount),
        narration,
        paymentToken: 'USDT',
      });

      if (result.success) {
        Alert.alert(
          "Success! 🎉",
          `Bank transfer initiated successfully!\n\nTransaction Hash:\n${result.transactionHash?.slice(0, 10)}...${result.transactionHash?.slice(-8)}`,
          [
            {
              text: "OK",
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        Alert.alert("Transfer Failed", result.error || "Transfer failed");
      }
    } catch (error: any) {
      console.error("Bank transfer error:", error);
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
          <Text style={styles.headerTitle}>Bank Transfer</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <SelectInput
              options={BANK_OPTIONS.map((bank) => ({
                key: bank.code,
                label: bank.name,
              }))}
              value={selectedBank?.name}
              onSelect={(option) => {
                const bank = BANK_OPTIONS.find((b) => b.code === option.key);
                setSelectedBank(bank ?? null);
              }}
              placeholder="Select bank"
              label="Select Bank"
              searchable
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Account Number</Text>
            <View style={styles.inputRow}>
              <ThemedInput
                style={{ flex: 1 }}
                placeholder="0000000000"
                keyboardType="numeric"
                maxLength={10}
                value={accountNumber}
                onChangeText={setAccountNumber}
              />
              <TouchableOpacity
                style={styles.verifyButton}
                onPress={handleVerifyAccount}
              >
                <Text style={styles.verifyButtonText}>Verify</Text>
              </TouchableOpacity>
            </View>
            {accountName && (
              <Text style={styles.accountName}>✓ {accountName}</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Amount (₦)</Text>
            <ThemedInput
              placeholder="Enter amount"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Narration (Optional)</Text>
            <ThemedInput
              placeholder="Add a description"
              multiline
              numberOfLines={3}
              value={narration}
              onChangeText={setNarration}
              style={styles.textArea}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              (!selectedBank || !accountNumber || !amount || loading) && styles.buttonDisabled,
            ]}
            onPress={handleProceed}
            disabled={!selectedBank || !accountNumber || !amount || loading}
          >
            {loading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color="#FFF" />
                {processingStatus && (
                  <Text style={styles.buttonText}>{processingStatus}</Text>
                )}
              </View>
            ) : (
              <Text style={styles.buttonText}>Transfer to Bank</Text>
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
      backgroundColor: colors.cardBackground,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    content: { flex: 1, paddingHorizontal: spacing.lg },
    section: { marginBottom: spacing.lg },
    label: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    input: {
      backgroundColor: colors.cardBackground,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: 16,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    inputText: { color: colors.textPrimary },
    placeholder: { color: colors.textSecondary },
    inputRow: { flexDirection: "row", gap: spacing.sm },
    verifyButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
      justifyContent: "center",
    },
    verifyButtonText: {
      color: colors.textPrimary,
      fontWeight: "600",
      fontSize: 14,
    },
    accountName: { fontSize: 14, color: colors.success, marginTop: spacing.sm },
    textArea: { height: 80, textAlignVertical: "top" },
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
