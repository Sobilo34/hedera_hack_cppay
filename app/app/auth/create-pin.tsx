import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeColors } from "@/constants/Colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function CreatePinScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { mnemonic, privateKey, isImport } = useLocalSearchParams<{
    mnemonic?: string;
    privateKey?: string;
    isImport?: string;
  }>();
  const [pin, setPin] = useState("");
  const PIN_LENGTH = 6;

  const handleNumberPress = (num: string) => {
    if (pin.length < PIN_LENGTH) {
      setPin(pin + num);
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const handleContinue = () => {
    if (pin.length === PIN_LENGTH) {
      const params: any = { pin };

      // If importing, pass along mnemonic or private key
      if (isImport === "true") {
        if (mnemonic) params.mnemonic = mnemonic;
        if (privateKey) params.privateKey = privateKey;
        params.isImport = "true";
      }

      router.push({
        pathname: "/auth/confirm-pin" as any,
        params,
      });
    } else {
      Alert.alert("Incomplete PIN", "Please enter a 6-digit PIN");
    }
  };

  const isImporting = isImport === "true";
  const title = isImporting ? "Secure Your Wallet" : "Create PIN";

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
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
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons
              name="lock-outline"
              size={40}
              color={colors.primary}
            />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {isImporting
              ? "Create a 6-digit PIN to secure your imported wallet"
              : "Set a 6-digit PIN to secure your wallet"}
          </Text>
        </View>

        {/* PIN Display */}
        <View style={styles.pinContainer}>
          {Array.from({ length: PIN_LENGTH }).map((_, index) => (
            <View
              key={index}
              style={[styles.pinDot, index < pin.length && styles.pinDotFilled]}
            >
              {index < pin.length && <View style={styles.pinDotInner} />}
            </View>
          ))}
        </View>

        {/* Number Pad */}
        <View style={styles.numberPad}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <TouchableOpacity
              key={num}
              style={styles.numberButton}
              onPress={() => handleNumberPress(num.toString())}
            >
              <Text style={styles.numberText}>{num}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.numberButton} />
          <TouchableOpacity
            style={styles.numberButton}
            onPress={() => handleNumberPress("0")}
          >
            <Text style={styles.numberText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.numberButton}
            onPress={handleBackspace}
          >
            <MaterialCommunityIcons
              name="backspace-outline"
              size={28}
              color={colors.textPrimary}
            />
          </TouchableOpacity>
        </View>

        {/* Continue Button */}
        {pin.length === PIN_LENGTH && (
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        )}
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
      paddingTop: 60,
      paddingBottom: 40,
    },
    header: { marginBottom: 40 },
    backButton: { width: 40, height: 40, justifyContent: "center" },
    titleContainer: { alignItems: "center", marginBottom: 60 },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary + "20",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 20,
    },
    title: {
      fontSize: 28,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 12,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      paddingHorizontal: 20,
    },
    pinContainer: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 16,
      marginBottom: 60,
    },
    pinDot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.textSecondary,
      justifyContent: "center",
      alignItems: "center",
    },
    pinDotFilled: { borderColor: colors.primary },
    pinDotInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    numberPad: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 20,
      marginBottom: 40,
    },
    numberButton: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: colors.cardBackground,
      justifyContent: "center",
      alignItems: "center",
    },
    numberText: { fontSize: 28, fontWeight: "600", color: colors.textPrimary },
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
  });
