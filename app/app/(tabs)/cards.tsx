import { spacing } from "@/constants/Typography";
import { useTheme } from "@/contexts/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CardsScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle={colors.textPrimary ? "light-content" : "dark-content"}
        backgroundColor={colors.cardBackground}
      />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cards</Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <MaterialCommunityIcons
          name="credit-card"
          size={120}
          color={colors.primary}
        />
        <Text style={styles.title}>No Cards Yet</Text>
        <Text style={styles.description}>
          Request a CPPay virtual or physical card to enjoy seamless payments
          everywhere.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      backgroundColor: colors.cardBackground,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    content: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginTop: spacing.xl,
      marginBottom: spacing.md,
    },
    description: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 24,
    },
  });
