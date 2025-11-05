import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeColors } from "@/constants/Colors";

export default function Welcome() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <LinearGradient
      colors={[
        colors.backgroundGradient1,
        colors.backgroundGradient2,
        colors.backgroundGradient3,
      ]}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Logo/Icon Area */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>₿</Text>
          </View>
          <Text style={styles.appName}>CPPay</Text>
          <Text style={styles.tagline}>Hybrid Crypto-Fiat Wallet</Text>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <FeatureItem icon="🔐" text="Secure Self-Custodial Wallet" />
          <FeatureItem icon="💰" text="Spend Crypto for Everyday Bills" />
          <FeatureItem icon="⚡" text="Instant Crypto-to-Fiat Conversion" />
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push("/auth/create-pin")}
          >
            <Text style={styles.primaryButtonText}>Create New Wallet</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push("/auth/import-wallet")}
          >
            <Text style={styles.secondaryButtonText}>
              Import Existing Wallet
            </Text>
          </TouchableOpacity>
        </View>

        {/* Terms */}
        <Text style={styles.termsText}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </LinearGradient>
  );
}

const FeatureItem = ({ icon, text }: { icon: string; text: string }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1 },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 80,
      paddingBottom: 40,
      justifyContent: "space-between",
    },
    logoContainer: { alignItems: "center", marginBottom: 40 },
    logoCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.primary + "20",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 20,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    logoText: { fontSize: 48, color: colors.primary },
    appName: {
      fontSize: 36,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    tagline: { fontSize: 16, color: colors.textSecondary },
    featuresContainer: { marginBottom: 40 },
    featureItem: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 20,
      backgroundColor: colors.primaryLight + "15",
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primaryLight + "25",
    },
    featureIcon: { fontSize: 24, marginRight: 16 },
    featureText: {
      fontSize: 16,
      color: colors.textPrimary,
      flex: 1,
      fontWeight: "500",
    },
    buttonContainer: { gap: 16 },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingVertical: 18,
      borderRadius: 16,
      alignItems: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    primaryButtonText: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "bold",
    },
    secondaryButton: {
      backgroundColor: colors.primary + "20",
      paddingVertical: 18,
      borderRadius: 16,
      alignItems: "center",
      borderWidth: 2,
      borderColor: colors.primary,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: 18,
      fontWeight: "bold",
    },
    termsText: {
      textAlign: "center",
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 20,
    },
  });
