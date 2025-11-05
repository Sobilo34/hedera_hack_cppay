import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeColors } from "@/constants/Colors";
import { spacing, borderRadius } from "@/constants/Typography";
import ThemedInput from "@/components/ThemedInput";
import P2PTransferService from "@/services/features/P2PTransferService";
import SecureWalletStorage from "@/services/SecureWalletStorage";
import { useWalletStore } from "@/store/walletStore";

export default function P2PTransferScreen() {
  const router = useRouter();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const { colors, isDark } = useTheme();
  const { smartAccount } = useWalletStore();
  const styles = createStyles(colors);
  const [loading, setLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");

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
      setProcessingStatus("Validating recipient...");
      
      // Validate recipient address/username
      const validation = await P2PTransferService.validateRecipient(recipient);
      if (!validation.isValid) {
        Alert.alert("Invalid Recipient", "Please enter a valid wallet address or username");
        setLoading(false);
        return;
      }

      setProcessingStatus("Getting credentials...");
      const privateKey = await SecureWalletStorage.getPrivateKey('password');
      
      if (!privateKey) {
        Alert.alert("Error", "Unable to access wallet credentials");
        setLoading(false);
        return;
      }

      setProcessingStatus("Processing transfer...");
      const result = await P2PTransferService.sendP2P({
        smartWalletAddress: smartAccount.address as `0x${string}`,
        privateKey: privateKey as `0x${string}`,
        recipientAddress: validation.resolvedAddress as `0x${string}`,
        amountNGN: parseFloat(amount),
        paymentToken: 'USDT', // Default to USDT
      });

      if (result.success) {
        Alert.alert(
          "Success! 🎉",
          `Transfer completed successfully!\n\nTransaction Hash:\n${result.transactionHash?.slice(0, 10)}...${result.transactionHash?.slice(-8)}`,
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
      console.error("P2P transfer error:", error);
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
          <Text style={styles.headerTitle}>Send to CPPay User</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.label}>Recipient (Username or Phone)</Text>
            <ThemedInput
              placeholder="@username or phone number"
              value={recipient}
              onChangeText={setRecipient}
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
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Note (Optional)</Text>
            <ThemedInput
              placeholder="Add a note"
              multiline
              numberOfLines={3}
              value={note}
              onChangeText={setNote}
              style={styles.textArea}
            />
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
              <Text style={styles.buttonText}>Send Money</Text>
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
    },
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
