import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import WalletService from "@/services/WalletService";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeColors } from "@/constants/Colors";

export default function CreateWallet() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { pin } = useLocalSearchParams<{ pin: string }>();
  const [mnemonic, setMnemonic] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const generateWallet = () => {
    setLoading(true);
    try {
      const newMnemonic = WalletService.generateMnemonic();
      setMnemonic(newMnemonic);
    } catch {
      Alert.alert("Error", "Failed to generate wallet. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    generateWallet();
  }, []);

  const handleContinue = () => {
    router.push({
      pathname: "/auth/verify-phrase",
      params: { mnemonic, pin },
    });
  };

  const words = mnemonic.split(" ");

  return (
    <LinearGradient
      colors={[
        colors.backgroundGradient1,
        colors.backgroundGradient2,
        colors.backgroundGradient3,
      ]}
      style={styles.container}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Your Secret Recovery Phrase</Text>
          <Text style={styles.subtitle}>
            Write down these 12 words in order and keep them safe. You will need
            them to recover your wallet.
          </Text>
        </View>

        {/* Warning */}
        <View style={styles.warningBox}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <View style={styles.warningTextContainer}>
            <Text style={styles.warningTitle}>
              Never share your recovery phrase!
            </Text>
            <Text style={styles.warningText}>
              Anyone with this phrase can access your funds. CPPay will never
              ask for it.
            </Text>
          </View>
        </View>

        {/* Seed Phrase Grid */}
        <View style={styles.phraseContainer}>
          {words.map((word, index) => (
            <View key={index} style={styles.wordItem}>
              <Text style={styles.wordNumber}>{index + 1}</Text>
              <Text style={styles.wordText}>{word}</Text>
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.regenerateButton}
            onPress={generateWallet}
            disabled={loading}
          >
            <Text style={styles.regenerateButtonText}>
              🔄 Generate New Phrase
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>
              I have written it down
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tips */}
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>Security Tips:</Text>
          <Text style={styles.tipText}>
            • Write it on paper — do not screenshot
          </Text>
          <Text style={styles.tipText}>• Store in multiple safe locations</Text>
          <Text style={styles.tipText}>
            • Never enter it on suspicious websites
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    content: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
    header: { marginBottom: 24 },
    backButton: { marginBottom: 16 },
    backButtonText: { fontSize: 16, color: colors.primary },
    title: {
      fontSize: 28,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 12,
    },
    subtitle: { fontSize: 16, color: colors.textSecondary, lineHeight: 24 },
    warningBox: {
      flexDirection: "row",
      backgroundColor: colors.warning + "10",
      borderLeftWidth: 4,
      borderLeftColor: colors.warning,
      padding: 16,
      borderRadius: 8,
      marginBottom: 24,
    },
    warningIcon: { fontSize: 24, marginRight: 12 },
    warningTextContainer: { flex: 1 },
    warningTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.warning,
      marginBottom: 4,
    },
    warningText: { fontSize: 14, color: colors.textSecondary },
    phraseContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      marginBottom: 24,
    },
    wordItem: {
      width: "48%",
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.cardBackground + "05",
      padding: 12,
      borderRadius: 8,
      marginBottom: 12,
    },
    wordNumber: {
      fontSize: 12,
      color: colors.textTertiary,
      marginRight: 12,
      width: 20,
    },
    wordText: {
      fontSize: 16,
      color: colors.textPrimary,
      fontWeight: "500",
      flex: 1,
    },
    actionsContainer: { gap: 12, marginBottom: 24 },
    regenerateButton: {
      backgroundColor: colors.cardBackground + "08",
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
    },
    regenerateButtonText: {
      fontSize: 16,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    continueButton: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: "center",
    },
    continueButtonText: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    tipsContainer: {
      backgroundColor: colors.cardBackground + "05",
      padding: 16,
      borderRadius: 8,
    },
    tipsTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    tipText: { fontSize: 14, color: colors.textSecondary, marginBottom: 4 },
  });
