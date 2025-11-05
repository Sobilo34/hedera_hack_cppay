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
import ThemedInput from "@/components/ThemedInput";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeColors } from "@/constants/Colors";
import { spacing, borderRadius } from "@/constants/Typography";
import { useWalletStore } from "@/store/walletStore";
import CryptoSendService from "@/services/features/CryptoSendService";
import SecureWalletStorage from "@/services/SecureWalletStorage";

export default function SendCryptoScreen() {
  const router = useRouter();
  const { wallet, smartAccount } = useWalletStore();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);
  const walletAny = wallet as any;
  const [selectedToken, setSelectedToken] = useState("USDC");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");

  const handleScanQR = () => {
    Alert.alert("QR Scanner", "QR code scanner will be implemented");
  };

  const handleProceed = async () => {
    if (!recipient || !amount) {
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

      setProcessingStatus("Sending crypto...");
      const result = await CryptoSendService.sendCrypto({
        smartWalletAddress: smartAccount.address as `0x${string}`,
        privateKey: privateKey as `0x${string}`,
        recipientAddress: recipient as `0x${string}`,
        token: selectedToken,
        amount: amount,
      });

      if (result.success) {
        Alert.alert(
          "Success! 🎉",
          `Crypto sent successfully!\n\nTransaction Hash:\n${result.transactionHash?.slice(0, 10)}...${result.transactionHash?.slice(-8)}`,
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
      console.error("Send crypto error:", error);
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
          <Text style={styles.headerTitle}>Send Crypto</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Token Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>Select Token</Text>
            <View style={styles.tokenGrid}>
              {["USDC", "USDT", "DAI"].map((token) => (
                <TouchableOpacity
                  key={token}
                  style={[
                    styles.tokenChip,
                    selectedToken === token && styles.tokenChipActive,
                  ]}
                  onPress={() => setSelectedToken(token)}
                >
                  <Text
                    style={[
                      styles.tokenText,
                      selectedToken === token && styles.tokenTextActive,
                    ]}
                  >
                    {token}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Recipient Address */}
          <View style={styles.section}>
            <Text style={styles.label}>Recipient Address</Text>
            <View style={styles.inputRow}>
              <ThemedInput
                style={{ flex: 1 }}
                placeholder="0x..."
                value={recipient}
                onChangeText={setRecipient}
              />
              <TouchableOpacity
                style={styles.scanButton}
                onPress={handleScanQR}
              >
                <MaterialCommunityIcons
                  name="qrcode-scan"
                  size={24}
                  color={colors.textPrimary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Amount */}
          <View style={styles.section}>
            <Text style={styles.label}>Amount</Text>
            <ThemedInput
              placeholder="0.00"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
            <Text style={styles.hint}>
              Available: {walletAny?.balance ?? 0} {selectedToken}
            </Text>
          </View>

          {/* Network Info */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Network</Text>
              <Text style={styles.infoValue}>Base</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Est. Gas Fee</Text>
              <Text style={styles.infoValue}>$0.01</Text>
            </View>
          </View>

          {/* Warning */}
          <View style={styles.warningCard}>
            <MaterialCommunityIcons
              name="alert-circle"
              size={20}
              color={colors.warning}
            />
            <Text style={styles.warningText}>
              Double-check the recipient address. Transactions cannot be
              reversed.
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              (!recipient || !amount || loading) && styles.buttonDisabled,
            ]}
            onPress={handleProceed}
            disabled={!recipient || !amount || loading}
          >
            {loading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color="#FFF" />
                {processingStatus && (
                  <Text style={styles.buttonText}>{processingStatus}</Text>
                )}
              </View>
            ) : (
              <Text style={styles.buttonText}>Send Crypto</Text>
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
    content: {
      flex: 1,
      paddingHorizontal: spacing.lg,
    },
    section: {
      marginBottom: spacing.lg,
    },
    label: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    tokenGrid: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    tokenChip: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.cardBackground + "10",
      borderWidth: 1,
      borderColor: colors.cardBackground + "20",
      alignItems: "center",
    },
    tokenChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tokenText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    tokenTextActive: {
      color: colors.textPrimary,
      fontWeight: "600",
    },
    inputRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    input: {
      backgroundColor: colors.cardBackground + "10",
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: 16,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.cardBackground + "20",
    },
    scanButton: {
      backgroundColor: colors.primary,
      width: 50,
      borderRadius: borderRadius.md,
      justifyContent: "center",
      alignItems: "center",
    },
    hint: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: spacing.xs,
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
    infoLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    infoValue: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: "500",
    },
    warningCard: {
      backgroundColor: colors.warning + "10",
      borderRadius: borderRadius.md,
      padding: spacing.md,
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.warning + "30",
      alignItems: "center",
    },
    warningText: {
      flex: 1,
      fontSize: 12,
      color: colors.textSecondary,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      alignItems: "center",
      marginTop: spacing.md,
    },
    buttonDisabled: {
      backgroundColor: colors.primary + "30",
    },
    buttonText: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
  });
