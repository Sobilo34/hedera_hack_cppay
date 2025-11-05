import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeColors } from "@/constants/Colors";
import { spacing, borderRadius } from "@/constants/Typography";
import ThemedInput from "@/components/ThemedInput";
import SelectInput from "@/components/SelectInput";

export default function EducationScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);
  const [institution] = useState("");
  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [purpose] = useState("");

  const handleProceed = () => {
    if (!institution || !studentId || !amount) {
      Alert.alert("Missing Information", "Please fill in all required fields");
      return;
    }
    Alert.alert(
      "Coming Soon",
      "Education payment will be processed via TransactionService"
    );
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
          <Text style={styles.headerTitle}>Education Payment</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <SelectInput
              options={[
                { key: "0", label: "University A" },
                { key: "1", label: "College B" },
              ]}
              value={institution}
              onSelect={(o) => {}}
              placeholder="Select institution"
              label="Institution"
              searchable
            />
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Student ID / Matric Number</Text>
            <ThemedInput
              placeholder="Enter student ID"
              value={studentId}
              onChangeText={setStudentId}
            />
          </View>
          <View style={styles.section}>
            <SelectInput
              options={[
                { key: "0", label: "Tuition" },
                { key: "1", label: "Exam Fees" },
                { key: "2", label: "Accommodation" },
              ]}
              value={purpose}
              onSelect={(o) => {}}
              placeholder="School fees, Exam fees, etc."
              label="Purpose"
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
          <TouchableOpacity
            style={[
              styles.button,
              (!institution || !studentId || !amount) && styles.buttonDisabled,
            ]}
            onPress={handleProceed}
          >
            <Text style={styles.buttonText}>Continue</Text>
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
      backgroundColor: colors.cardBackground,
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
      backgroundColor: colors.cardBackground,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: 16,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.divider,
    },
    text: { color: colors.textPrimary },
    placeholder: { color: colors.textSecondary },
    button: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      alignItems: "center",
      marginTop: spacing.md,
    },
    buttonDisabled: { backgroundColor: colors.primaryLight },
    buttonText: { fontSize: 16, fontWeight: "bold", color: colors.textPrimary },
  });
