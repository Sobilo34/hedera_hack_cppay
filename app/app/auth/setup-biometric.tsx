import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeColors } from "@/constants/Colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { useWalletStore } from "@/store/walletStore";

export default function SetupBiometricScreen() {
  const router = useRouter();
  const { pin, mnemonic } = useLocalSearchParams<{
    pin: string;
    mnemonic: string;
  }>();
  const { createWallet, setBiometric } = useWalletStore();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<"fingerprint" | "face">(
    "fingerprint"
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkBiometric();
  }, []);

  const checkBiometric = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes =
      await LocalAuthentication.supportedAuthenticationTypesAsync();

    setBiometricAvailable(compatible && enrolled);

    if (
      supportedTypes.includes(
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
      )
    ) {
      setBiometricType("face");
    } else {
      setBiometricType("fingerprint");
    }
  };

  const handleEnableBiometric = async () => {
    setLoading(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Enable ${
          biometricType === "face" ? "Face ID" : "Fingerprint"
        }`,
        fallbackLabel: "Use PIN",
      });

      if (result.success) {
        // Create wallet with PIN (isPin = true)
        await createWallet(mnemonic, pin, true);
        await setBiometric(true);

        Alert.alert(
          "Wallet Created! 🎉",
          "Your wallet and smart accounts have been created successfully!",
          [
            {
              text: "Continue",
              onPress: () => router.push("/auth/email-registration" as any),
            },
          ]
        );
      }
    } catch {
      Alert.alert("Error", "Failed to enable biometric authentication");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      // Create wallet with PIN only (isPin = true)
      await createWallet(mnemonic, pin, true);

      Alert.alert("Wallet Created! 🎉", "Your wallet and smart accounts have been created successfully!", [
        {
          text: "Continue",
          onPress: () => router.push("/auth/email-registration" as any),
        },
      ]);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create wallet");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons
              name={
                biometricType === "face" ? "face-recognition" : "fingerprint"
              }
              size={60}
              color={colors.primary}
            />
          </View>
        </View>

        {/* Title */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {biometricAvailable
              ? `Enable ${biometricType === "face" ? "Face ID" : "Fingerprint"}`
              : "Biometric Not Available"}
          </Text>
          <Text style={styles.subtitle}>
            {biometricAvailable
              ? `Use your ${
                  biometricType === "face" ? "face" : "fingerprint"
                } to quickly unlock your wallet and authorize transactions`
              : "Your device does not support biometric authentication. You can use PIN instead."}
          </Text>
        </View>

        {/* Benefits */}
        {biometricAvailable && (
          <View style={styles.benefitsContainer}>
            <View style={styles.benefitItem}>
              <MaterialCommunityIcons
                name="flash"
                size={24}
                color={colors.primary}
              />
              <Text style={styles.benefitText}>Quick & Easy Access</Text>
            </View>
            <View style={styles.benefitItem}>
              <MaterialCommunityIcons
                name="shield-check"
                size={24}
                color={colors.primary}
              />
              <Text style={styles.benefitText}>Extra Security Layer</Text>
            </View>
            <View style={styles.benefitItem}>
              <MaterialCommunityIcons
                name="lock-check"
                size={24}
                color={colors.primary}
              />
              <Text style={styles.benefitText}>Secure Transactions</Text>
            </View>
          </View>
        )}

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          {biometricAvailable ? (
            <>
              <TouchableOpacity
                style={styles.enableButton}
                onPress={handleEnableBiometric}
                disabled={loading}
              >
                <Text style={styles.enableButtonText}>
                  {loading
                    ? "Setting up..."
                    : `Enable ${
                        biometricType === "face" ? "Face ID" : "Fingerprint"
                      }`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkip}
                disabled={loading}
              >
                <Text style={styles.skipButtonText}>Skip for Now</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.enableButton}
              onPress={handleSkip}
              disabled={loading}
            >
              <Text style={styles.enableButtonText}>
                {loading ? "Creating Wallet..." : "Continue with PIN"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Note */}
        <Text style={styles.note}>
          You can always change this setting later in your profile
        </Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 80,
      paddingBottom: 40,
      justifyContent: "space-between",
    },
    iconContainer: { alignItems: "center", marginBottom: 40 },
    iconCircle: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.primary + "20",
      justifyContent: "center",
      alignItems: "center",
    },
    textContainer: { alignItems: "center", marginBottom: 40 },
    title: {
      fontSize: 28,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 16,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 24,
      paddingHorizontal: 20,
    },
    benefitsContainer: { gap: 20, marginBottom: 40 },
    benefitItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.cardBackground,
      padding: 16,
      borderRadius: 12,
    },
    benefitText: {
      fontSize: 16,
      color: colors.textPrimary,
      marginLeft: 16,
      fontWeight: "500",
    },
    buttonContainer: { gap: 12 },
    enableButton: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: "center",
    },
    enableButtonText: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    skipButton: {
      backgroundColor: "transparent",
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.textSecondary,
    },
    skipButtonText: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    note: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 20,
    },
  });
