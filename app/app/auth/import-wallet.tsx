import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import WalletService from "@/services/WalletService";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeColors } from "@/constants/Colors";

export default function ImportWallet() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [importType, setImportType] = useState<"mnemonic" | "privateKey">(
    "mnemonic"
  );
  const [mnemonic, setMnemonic] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [loading, setLoading] = useState(false);

  const validateMnemonic = () => {
    const words = mnemonic.trim().split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      Alert.alert("Invalid Phrase", "Recovery phrase must be 12 or 24 words.");
      return false;
    }
    return true;
  };

  const handleContinue = async () => {
    if (importType === "mnemonic") {
      if (!validateMnemonic()) return;

      setLoading(true);
      try {
        // Validate the mnemonic first
        const wallet = WalletService.createWalletFromMnemonic(mnemonic.trim());
        if (!wallet) throw new Error("Invalid mnemonic phrase");

        // Navigate to PIN setup with mnemonic
        router.push({
          pathname: "/auth/create-pin",
          params: { mnemonic: mnemonic.trim(), isImport: "true" },
        } as any);
      } catch {
        Alert.alert(
          "Invalid Phrase",
          "The recovery phrase you entered is invalid."
        );
      } finally {
        setLoading(false);
      }
    } else {
      if (!privateKey.trim()) {
        Alert.alert("Invalid Key", "Please enter a valid private key.");
        return;
      }

      setLoading(true);
      try {
        // Validate private key
        const wallet = WalletService.importWalletFromPrivateKey(
          privateKey.trim()
        );
        if (!wallet) throw new Error("Invalid private key");

        // Navigate to PIN setup with private key
        router.push({
          pathname: "/auth/create-pin",
          params: { privateKey: privateKey.trim(), isImport: "true" },
        } as any);
      } catch {
        Alert.alert("Invalid Key", "The private key you entered is invalid.");
      } finally {
        setLoading(false);
      }
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
          <Text style={styles.title}>Import Wallet</Text>
          <Text style={styles.subtitle}>
            Import your existing wallet using a recovery phrase or private key.
          </Text>
        </View>

        {/* Import Type Selector */}
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[
              styles.typeButton,
              importType === "mnemonic" && styles.typeButtonActive,
            ]}
            onPress={() => setImportType("mnemonic")}
          >
            <Text
              style={[
                styles.typeButtonText,
                importType === "mnemonic" && styles.typeButtonTextActive,
              ]}
            >
              Recovery Phrase
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeButton,
              importType === "privateKey" && styles.typeButtonActive,
            ]}
            onPress={() => setImportType("privateKey")}
          >
            <Text
              style={[
                styles.typeButtonText,
                importType === "privateKey" && styles.typeButtonTextActive,
              ]}
            >
              Private Key
            </Text>
          </TouchableOpacity>
        </View>

        {/* Import Input */}
        {importType === "mnemonic" ? (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              Recovery Phrase (12 or 24 words)
            </Text>
            <TextInput
              style={styles.textArea}
              placeholder="Enter your recovery phrase separated by spaces"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
              value={mnemonic}
              onChangeText={setMnemonic}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.helperText}>
              {
                mnemonic
                  .trim()
                  .split(/\s+/)
                  .filter((w) => w).length
              }{" "}
              words entered
            </Text>
          </View>
        ) : (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Private Key</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Enter your private key (with or without 0x prefix)"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              value={privateKey}
              onChangeText={setPrivateKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}

        {/* Continue Button */}
        <TouchableOpacity
          style={[
            styles.continueButton,
            loading && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Text style={styles.continueButtonText}>Continue</Text>
          )}
        </TouchableOpacity>

        {/* Warning */}
        <View style={styles.warningBox}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>
            Never share your recovery phrase or private key with anyone. CPPay
            will never ask for it.
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
    content: { padding: 20, paddingTop: 60 },
    header: { marginBottom: 32 },
    backButton: { marginBottom: 20 },
    backButtonText: { color: colors.primary, fontSize: 16 },
    title: {
      fontSize: 32,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    subtitle: { fontSize: 16, color: colors.textSecondary, lineHeight: 24 },
    typeSelector: { flexDirection: "row", gap: 12, marginBottom: 24 },
    typeButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: colors.cardBackground,
      borderWidth: 2,
      borderColor: "transparent",
    },
    typeButtonActive: {
      backgroundColor: colors.success + "12",
      borderColor: colors.success,
    },
    typeButtonText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      fontWeight: "600",
    },
    typeButtonTextActive: { color: colors.success },
    inputGroup: { marginBottom: 20 },
    inputLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
      fontWeight: "600",
    },
    textArea: {
      backgroundColor: colors.cardBackground + "10",
      borderRadius: 12,
      padding: 16,
      color: colors.textPrimary,
      fontSize: 14,
      minHeight: 100,
      textAlignVertical: "top",
      borderWidth: 1,
      borderColor: colors.divider + "20",
    },
    helperText: { fontSize: 12, color: colors.textSecondary, marginTop: 8 },
    continueButton: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: "center",
      marginVertical: 24,
    },
    continueButtonDisabled: { opacity: 0.6 },
    continueButtonText: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "bold",
    },
    warningBox: {
      flexDirection: "row",
      gap: 12,
      padding: 16,
      backgroundColor: colors.warning + "12",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.warning + "30",
    },
    warningIcon: { fontSize: 20 },
    warningText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  });
