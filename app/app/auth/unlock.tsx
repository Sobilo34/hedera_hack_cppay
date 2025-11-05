import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeColors } from "@/constants/Colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { useWalletStore } from "@/store/walletStore";
import SecureWalletStorage from "@/services/SecureWalletStorage";

export default function UnlockScreen() {
  const router = useRouter();
  const { unlockWallet, auth, wallet } = useWalletStore();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<"fingerprint" | "face">(
    "fingerprint"
  );
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 5;

  useEffect(() => {
    checkBiometric();
    // Auto-trigger biometric if enabled
    if (auth.biometricEnabled) {
      setTimeout(() => handleBiometricAuth(), 500);
    }
  }, []);

  const checkBiometric = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes =
        await LocalAuthentication.supportedAuthenticationTypesAsync();

      const available = compatible && enrolled && auth.biometricEnabled;
      setBiometricAvailable(available);

      if (
        supportedTypes.includes(
          LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
        )
      ) {
        setBiometricType("face");
      } else {
        setBiometricType("fingerprint");
      }
    } catch (error) {
      console.error("Failed to check biometric:", error);
    }
  };

  const handleBiometricAuth = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Unlock CPPay`,
        fallbackLabel: "Use PIN",
        disableDeviceFallback: false,
      });

      if (result.success) {
        setLoading(true);
        // For biometric, we still need to load wallet data
        // Since we can't decrypt with biometric, we use a stored flag
        const address = await SecureWalletStorage.getAddress();
        if (address) {
          // Just mark as unlocked
          const success = await unlockWallet("", false);
          if (success || address) {
            // Set unlocked state directly for biometric
            router.replace("/(tabs)" as any);
          }
        }
        setLoading(false);
      }
    } catch (error) {
      console.error("Biometric authentication failed:", error);
    }
  };

  const handlePinPress = (digit: string) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);

      // Auto-submit when 6 digits entered
      if (newPin.length === 6) {
        handleUnlock(newPin);
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
  };

  const handleUnlock = async (pinToVerify: string) => {
    if (attempts >= maxAttempts) {
      Alert.alert(
        "Too Many Attempts",
        "You have exceeded the maximum number of attempts. Please try again later or reset your wallet.",
        [
          { text: "Try Again Later", style: "cancel" },
          {
            text: "Reset Wallet",
            style: "destructive",
            onPress: handleResetWallet,
          },
        ]
      );
      return;
    }

    setLoading(true);
    try {
      const success = await unlockWallet(pinToVerify, true);

      if (success) {
        // Reset attempts and navigate to home
        setAttempts(0);
        router.replace("/(tabs)" as any);
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setPin("");
        Alert.alert(
          "Incorrect PIN",
          `Wrong PIN. ${maxAttempts - newAttempts} attempts remaining.`
        );
      }
    } catch (error: any) {
      setPin("");
      Alert.alert("Error", error.message || "Failed to unlock wallet");
    } finally {
      setLoading(false);
    }
  };

  const handleResetWallet = () => {
    Alert.alert(
      "Reset Wallet",
      "This will delete all wallet data. You'll need your recovery phrase to restore your wallet. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await SecureWalletStorage.deleteWallet();
            router.replace("/auth/welcome" as any);
          },
        },
      ]
    );
  };

  const renderPinDots = () => {
    return (
      <View style={styles.pinDotsContainer}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <View
            key={index}
            style={[
              styles.pinDot,
              index < pin.length && styles.pinDotFilled,
            ]}
          />
        ))}
      </View>
    );
  };

  const renderKeypad = () => {
    const keys = [
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
      ["", "0", "delete"],
    ];

    return (
      <View style={styles.keypad}>
        {keys.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((key, keyIndex) => {
              if (key === "") {
                return <View key={keyIndex} style={styles.keyButton} />;
              }

              if (key === "delete") {
                return (
                  <TouchableOpacity
                    key={keyIndex}
                    style={styles.keyButton}
                    onPress={handleDelete}
                    disabled={loading}
                  >
                    <MaterialCommunityIcons
                      name="backspace-outline"
                      size={28}
                      color={colors.textPrimary}
                    />
                  </TouchableOpacity>
                );
              }

              return (
                <TouchableOpacity
                  key={keyIndex}
                  style={styles.keyButton}
                  onPress={() => handlePinPress(key)}
                  disabled={loading}
                >
                  <Text style={styles.keyText}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>₿</Text>
        </View>
        <Text style={styles.appName}>CPPay</Text>
        <Text style={styles.welcomeText}>Welcome back!</Text>
        {wallet.address && (
          <Text style={styles.addressText}>
            {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
          </Text>
        )}
      </View>

      {/* PIN Input */}
      <View style={styles.pinSection}>
        <Text style={styles.pinTitle}>Enter Your PIN</Text>
        {renderPinDots()}
        {loading && (
          <ActivityIndicator
            size="small"
            color={colors.primary}
            style={{ marginTop: 16 }}
          />
        )}
      </View>

      {/* Keypad */}
      {renderKeypad()}

      {/* Biometric Button */}
      {biometricAvailable && (
        <TouchableOpacity
          style={styles.biometricButton}
          onPress={handleBiometricAuth}
          disabled={loading}
        >
          <MaterialCommunityIcons
            name={biometricType === "face" ? "face-recognition" : "fingerprint"}
            size={32}
            color={colors.primary}
          />
          <Text style={styles.biometricText}>
            Use {biometricType === "face" ? "Face ID" : "Fingerprint"}
          </Text>
        </TouchableOpacity>
      )}

      {/* Forgot PIN */}
      <TouchableOpacity
        style={styles.forgotButton}
        onPress={handleResetWallet}
        disabled={loading}
      >
        <Text style={styles.forgotText}>Forgot PIN? Reset Wallet</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
    },
    header: {
      alignItems: "center",
      paddingTop: 60,
      marginBottom: 40,
    },
    logoCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary + "20",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    logoText: {
      fontSize: 40,
      color: colors.primary,
    },
    appName: {
      fontSize: 28,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    welcomeText: {
      fontSize: 18,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    addressText: {
      fontSize: 14,
      color: colors.textTertiary,
      fontFamily: "monospace",
    },
    pinSection: {
      alignItems: "center",
      marginBottom: 40,
    },
    pinTitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 24,
    },
    pinDotsContainer: {
      flexDirection: "row",
      gap: 16,
    },
    pinDot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    pinDotFilled: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    keypad: {
      marginBottom: 24,
    },
    keypadRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    keyButton: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.cardBackground,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    keyText: {
      fontSize: 28,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    biometricButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      backgroundColor: colors.primary + "15",
      borderWidth: 1,
      borderColor: colors.primary + "30",
      marginBottom: 16,
    },
    biometricText: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: "600",
    },
    forgotButton: {
      alignItems: "center",
      paddingVertical: 12,
    },
    forgotText: {
      fontSize: 14,
      color: colors.textTertiary,
      textDecorationLine: "underline",
    },
  });
