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
import ThemedInput from "@/components/ThemedInput";
import SelectInput from "@/components/SelectInput";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeColors } from "@/constants/Colors";
import { spacing, borderRadius } from "@/constants/Typography";
import { user } from "@/data/user";
import CashWithdrawalService from "@/services/features/CashWithdrawalService";
import SecureWalletStorage from "@/services/SecureWalletStorage";
import { useWalletStore } from "@/store/walletStore";

export default function WithdrawScreen() {
  const router = useRouter();
  const { smartAccount } = useWalletStore();
  const [bankName, setBankName] = useState("");
  const [accountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);
  const [loading, setLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const [location, setLocation] = useState<{latitude: number; longitude: number} | null>(null);

  const handleProceed = async () => {
    if (!amount) {
      Alert.alert("Missing Information", "Please enter withdrawal amount");
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

      setProcessingStatus("Initiating withdrawal...");
      const result = await CashWithdrawalService.initiateWithdrawal({
        smartWalletAddress: smartAccount.address as `0x${string}`,
        privateKey: privateKey as `0x${string}`,
        amountNGN: parseFloat(amount),
        paymentToken: 'USDT',
        location: location || undefined,
      });

      if (result.success) {
        Alert.alert(
          "Success! 🎉",
          `Withdrawal initiated!\n\nWithdrawal Code: ${result.withdrawalCode}\n\nShow this code to the merchant.`,
          [
            {
              text: "OK",
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        Alert.alert("Withdrawal Failed", result.error || "Withdrawal failed");
      }
    } catch (error: any) {
      console.error("Withdrawal error:", error);
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
          <Text style={styles.headerTitle}>Withdraw to Bank</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <Text style={styles.balanceAmount}>
              ₦{user.balance.toLocaleString()}
            </Text>
          </View>

          <View style={styles.section}>
            <SelectInput
              options={[{ key: "0", label: "Saved - Access Bank (****1234)" }]}
              value={bankName}
              onSelect={(o: { key: string; label: string }) => {
                setBankName(o.label);
              }}
              placeholder="Select saved bank account"
              label="Bank Account"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Amount (₦)</Text>
            <ThemedInput
              placeholder="Enter amount"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
            <Text style={styles.hint}>Minimum: ₦100 | Fee: ₦10 + 1%</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              (!amount || loading) && styles.buttonDisabled,
            ]}
            onPress={handleProceed}
            disabled={!amount || loading}
          >
            {loading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color="#FFF" />
                {processingStatus && (
                  <Text style={styles.buttonText}>{processingStatus}</Text>
                )}
              </View>
            ) : (
              <Text style={styles.buttonText}>Initiate Withdrawal</Text>
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
    balanceCard: {
      backgroundColor: colors.cardBackground + "10",
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      alignItems: "center",
    },
    balanceLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    balanceAmount: {
      fontSize: 32,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    section: { marginBottom: spacing.lg },
    label: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    input: {
      backgroundColor: colors.cardBackground + "10",
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: 16,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.divider + "20",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    inputText: { color: colors.textPrimary },
    placeholder: { color: colors.textSecondary },
    hint: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
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
