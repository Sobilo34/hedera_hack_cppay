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

const PROVIDERS = ["DSTV", "GOtv", "Startimes", "Showmax"];
const PACKAGES = [
  { name: "Basic", price: 2500 },
  { name: "Compact", price: 4500 },
  { name: "Premium", price: 9000 },
];

export default function CableTVScreen() {
  const router = useRouter();
  const [provider, setProvider] = useState("");
  const [smartCardNumber, setSmartCardNumber] = useState("");
  const [selectedPackage, setSelectedPackage] = useState("");
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);

  const handleProceed = () => {
    if (!provider || !smartCardNumber || !selectedPackage) {
      Alert.alert("Missing Information", "Please fill in all required fields");
      return;
    }
    Alert.alert(
      "Coming Soon",
      "Cable TV payment will be processed via TransactionService"
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
          <Text style={styles.headerTitle}>Cable TV</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <SelectInput
              options={PROVIDERS.map((p, i) => ({ key: String(i), label: p }))}
              value={provider}
              onSelect={(o) => setProvider(o.label)}
              placeholder="Select provider"
              label="Provider"
            />
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Smart Card Number</Text>
            <ThemedInput
              placeholder="Enter smart card number"
              value={smartCardNumber}
              onChangeText={setSmartCardNumber}
            />
          </View>
          <View style={styles.section}>
            <SelectInput
              options={PACKAGES.map((p, i) => ({
                key: String(i),
                label: `${p.name} - ₦${p.price}`,
              }))}
              value={selectedPackage}
              onSelect={(o) => setSelectedPackage(o.label)}
              placeholder="Select package"
              label="Package"
            />
          </View>
          <TouchableOpacity
            style={[
              styles.button,
              (!provider || !smartCardNumber || !selectedPackage) &&
                styles.buttonDisabled,
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
      borderColor: colors.cardBackground + "20",
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
    buttonDisabled: { backgroundColor: colors.primary + "30" },
    buttonText: { fontSize: 16, fontWeight: "bold", color: colors.textPrimary },
  });
