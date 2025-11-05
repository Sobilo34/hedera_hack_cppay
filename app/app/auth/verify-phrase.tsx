import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeColors } from "@/constants/Colors";

export default function VerifyPhrase() {
  const router = useRouter();
  const { mnemonic, pin } = useLocalSearchParams<{
    mnemonic: string;
    pin: string;
  }>();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const words = useMemo(() => mnemonic?.split(" ") || [], [mnemonic]);

  // Random positions to verify (e.g., 3rd, 7th, and 11th word)
  const verifyPositions = useMemo(() => [2, 6, 10], []);

  const [selectedWords, setSelectedWords] = useState<{ [key: number]: string }>(
    {}
  );

  // Shuffle all words for selection
  const shuffledWords = useMemo(() => {
    return [...words].sort(() => Math.random() - 0.5);
  }, [words]);

  const handleWordSelect = (position: number, word: string) => {
    setSelectedWords((prev) => ({
      ...prev,
      [position]: word,
    }));
  };

  const handleVerify = () => {
    const isCorrect = verifyPositions.every(
      (pos) => selectedWords[pos] === words[pos]
    );

    if (isCorrect) {
      router.push({
        pathname: "/auth/setup-biometric",
        params: { mnemonic, pin },
      });
    } else {
      Alert.alert(
        "Incorrect Words",
        "The words you selected don't match. Please try again.",
        [{ text: "OK" }]
      );
      setSelectedWords({});
    }
  };

  const isComplete = verifyPositions.every((pos) => selectedWords[pos]);

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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Verify Your Phrase</Text>
          <Text style={styles.subtitle}>
            Select the correct words to verify you have saved your recovery
            phrase.
          </Text>
        </View>

        {/* Verification Slots */}
        <View style={styles.slotsContainer}>
          {verifyPositions.map((position) => (
            <View key={position} style={styles.slotItem}>
              <Text style={styles.slotLabel}>Word #{position + 1}</Text>
              <TouchableOpacity
                style={[
                  styles.slotBox,
                  selectedWords[position] && styles.slotBoxFilled,
                ]}
              >
                <Text style={styles.slotText}>
                  {selectedWords[position] || "Select word"}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Word Selection */}
        <Text style={styles.selectLabel}>Select from these words:</Text>
        <View style={styles.wordsContainer}>
          {shuffledWords.map((word, index) => {
            const isSelected = Object.values(selectedWords).includes(word);
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.wordButton,
                  isSelected && styles.wordButtonDisabled,
                ]}
                onPress={() => {
                  if (!isSelected) {
                    const nextEmptySlot = verifyPositions.find(
                      (pos) => !selectedWords[pos]
                    );
                    if (nextEmptySlot !== undefined) {
                      handleWordSelect(nextEmptySlot, word);
                    }
                  }
                }}
                disabled={isSelected}
              >
                <Text
                  style={[
                    styles.wordButtonText,
                    isSelected && styles.wordButtonTextDisabled,
                  ]}
                >
                  {word}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSelectedWords({})}
          >
            <Text style={styles.clearButtonText}>Clear Selection</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.verifyButton,
              !isComplete && styles.verifyButtonDisabled,
            ]}
            onPress={handleVerify}
            disabled={!isComplete}
          >
            <Text style={styles.verifyButtonText}>Verify & Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1 },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 60,
      paddingBottom: 40,
    },
    header: { marginBottom: 32 },
    backButton: { marginBottom: 16 },
    backButtonText: { fontSize: 16, color: colors.primary },
    title: {
      fontSize: 28,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 12,
    },
    subtitle: { fontSize: 16, color: colors.textSecondary, lineHeight: 24 },
    slotsContainer: { marginBottom: 32 },
    slotItem: { marginBottom: 16 },
    slotLabel: { fontSize: 14, color: colors.textSecondary, marginBottom: 8 },
    slotBox: {
      backgroundColor: colors.cardBackground + "08",
      borderWidth: 2,
      borderColor: colors.divider + "20",
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
    },
    slotBoxFilled: {
      backgroundColor: colors.success + "10",
      borderColor: colors.success,
    },
    slotText: { fontSize: 18, color: colors.textPrimary, fontWeight: "500" },
    selectLabel: {
      fontSize: 16,
      color: colors.textPrimary,
      fontWeight: "600",
      marginBottom: 16,
    },
    wordsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 32,
    },
    wordButton: {
      backgroundColor: colors.cardBackground + "10",
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.divider + "20",
    },
    wordButtonDisabled: {
      backgroundColor: colors.cardBackground + "02",
      borderColor: colors.divider + "10",
    },
    wordButtonText: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: "500",
    },
    wordButtonTextDisabled: { color: colors.textSecondary + "99" },
    actionsContainer: { gap: 12 },
    clearButton: {
      backgroundColor: colors.cardBackground + "10",
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
    },
    clearButtonText: {
      fontSize: 16,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    verifyButton: {
      backgroundColor: colors.success,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: "center",
    },
    verifyButtonDisabled: { backgroundColor: colors.success + "30" },
    verifyButtonText: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.textPrimary,
    },
  });
