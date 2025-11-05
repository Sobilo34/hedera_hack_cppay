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
import { useWalletStore } from "@/store/walletStore";
import { ElectricityProvider } from "@/types/transaction";

const PROVIDERS = [
  { id: ElectricityProvider.IKEDC, name: "Ikeja Electric" },
  { id: ElectricityProvider.EKEDC, name: "Eko Electric" },
  { id: ElectricityProvider.AEDC, name: "Abuja Electric" },
  { id: ElectricityProvider.PHED, name: "Port Harcourt Electric" },
  { id: ElectricityProvider.JEDC, name: "Jos Electric" },
  { id: ElectricityProvider.KEDC, name: "Kaduna Electric" },
];

const METER_TYPES = ["prepaid", "postpaid"];
const QUICK_AMOUNTS = [1000, 2000, 3000, 5000, 10000, 20000];

export default function ElectricityScreen() {
  const router = useRouter();
  useWalletStore();

  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);

  const [selectedProvider, setSelectedProvider] = useState(
    ElectricityProvider.IKEDC
  );
  const [meterNumber, setMeterNumber] = useState("");
  const [meterType, setMeterType] = useState<"prepaid" | "postpaid">("prepaid");
  const [amount, setAmount] = useState("");
  const [customerName, setCustomerName] = useState("");

  const handleVerifyMeter = () => {
    if (!meterNumber || meterNumber.length < 10) {
      Alert.alert("Invalid Meter", "Please enter a valid meter number");
      return;
    }

    // Simulate meter verification
    setCustomerName("John Doe"); // This would come from API
    Alert.alert("Meter Verified", `Account: John Doe\nMeter: ${meterNumber}`);
  };

  const handleProceed = () => {
    if (!meterNumber || meterNumber.length < 10) {
      Alert.alert("Invalid Meter", "Please enter a valid meter number");
      return;
    }

    if (!amount || Number(amount) < 500) {
      Alert.alert("Invalid Amount", "Minimum amount is ₦500");
      return;
    }

    // TODO: Navigate to review screen or execute transaction
    Alert.alert(
      "Coming Soon",
      "Electricity payment will be processed via TransactionService.payElectricity()"
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
          <Text style={styles.headerTitle}>Electricity</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Provider Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Provider</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.providerRow}>
                {PROVIDERS.map((provider) => (
                  <TouchableOpacity
                    key={provider.id}
                    style={[
                      styles.providerChip,
                      selectedProvider === provider.id &&
                        styles.providerChipActive,
                    ]}
                    onPress={() => setSelectedProvider(provider.id)}
                  >
                    <Text
                      style={[
                        styles.providerText,
                        selectedProvider === provider.id &&
                          styles.providerTextActive,
                      ]}
                    >
                      {provider.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Meter Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Meter Type</Text>
            <View style={styles.meterTypeRow}>
              {METER_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.meterTypeChip,
                    meterType === type && styles.meterTypeChipActive,
                  ]}
                  onPress={() => setMeterType(type as any)}
                >
                  <Text
                    style={[
                      styles.meterTypeText,
                      meterType === type && styles.meterTypeTextActive,
                    ]}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Meter Number */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Meter Number</Text>
            <View style={styles.inputContainer}>
              <ThemedInput
                placeholder="Enter meter number"
                keyboardType="numeric"
                value={meterNumber}
                onChangeText={setMeterNumber}
              />
              <TouchableOpacity
                style={styles.verifyButton}
                onPress={handleVerifyMeter}
              >
                <Text style={styles.verifyButtonText}>Verify</Text>
              </TouchableOpacity>
            </View>
            {customerName && (
              <Text style={styles.customerName}>✓ {customerName}</Text>
            )}
          </View>

          {/* Amount */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amount (₦)</Text>
            <ThemedInput
              placeholder="Enter amount"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              style={styles.amountInput}
            />
          </View>

          {/* Quick Amounts */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Select</Text>
            <View style={styles.quickAmountsGrid}>
              {QUICK_AMOUNTS.map((quickAmount) => (
                <TouchableOpacity
                  key={quickAmount}
                  style={styles.quickAmountChip}
                  onPress={() => setAmount(quickAmount.toString())}
                >
                  <Text style={styles.quickAmountText}>
                    ₦{quickAmount.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Summary */}
          {amount && meterNumber && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Provider</Text>
                <Text style={styles.summaryValue}>
                  {PROVIDERS.find((p) => p.id === selectedProvider)?.name}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Meter Number</Text>
                <Text style={styles.summaryValue}>{meterNumber}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amount</Text>
                <Text style={styles.summaryValue}>
                  ₦{Number(amount).toLocaleString()}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Service Fee</Text>
                <Text style={styles.summaryValue}>
                  ₦{(Number(amount) * 0.005).toFixed(2)}
                </Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryTotal]}>
                <Text style={styles.summaryTotalLabel}>Total</Text>
                <Text style={styles.summaryTotalValue}>
                  ₦{(Number(amount) + Number(amount) * 0.005).toLocaleString()}
                </Text>
              </View>
            </View>
          )}

          {/* Proceed Button */}
          <TouchableOpacity
            style={[
              styles.proceedButton,
              (!amount || !meterNumber) && styles.proceedButtonDisabled,
            ]}
            onPress={handleProceed}
            disabled={!amount || !meterNumber}
          >
            <Text style={styles.proceedButtonText}>Continue</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
    },
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
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
    },
    section: {
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    providerRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    providerChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      backgroundColor: colors.cardBackground + "10",
      borderWidth: 1,
      borderColor: colors.cardBackground + "20",
    },
    providerChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    providerText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    providerTextActive: {
      color: colors.textPrimary,
      fontWeight: "600",
    },
    meterTypeRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    meterTypeChip: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.cardBackground + "10",
      borderWidth: 1,
      borderColor: colors.cardBackground + "20",
      alignItems: "center",
    },
    meterTypeChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    meterTypeText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    meterTypeTextActive: {
      color: colors.textPrimary,
      fontWeight: "600",
    },
    inputContainer: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    input: {
      flex: 1,
      backgroundColor: colors.cardBackground + "10",
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: 16,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.cardBackground + "20",
    },
    verifyButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
      justifyContent: "center",
    },
    verifyButtonText: {
      color: colors.textPrimary,
      fontWeight: "600",
      fontSize: 14,
    },
    customerName: {
      fontSize: 14,
      color: colors.success,
      marginTop: spacing.sm,
    },
    amountInput: {
      backgroundColor: colors.cardBackground + "10",
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: 24,
      color: colors.textPrimary,
      fontWeight: "bold",
      borderWidth: 1,
      borderColor: colors.cardBackground + "20",
    },
    quickAmountsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    quickAmountChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      backgroundColor: colors.cardBackground + "10",
      borderWidth: 1,
      borderColor: colors.cardBackground + "20",
    },
    quickAmountText: {
      fontSize: 14,
      color: colors.textPrimary,
    },
    summaryCard: {
      backgroundColor: colors.cardBackground + "05",
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.cardBackground + "10",
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: spacing.sm,
    },
    summaryLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    summaryValue: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: "500",
    },
    summaryTotal: {
      borderTopWidth: 1,
      borderTopColor: colors.cardBackground + "20",
      marginTop: spacing.sm,
      paddingTop: spacing.md,
    },
    summaryTotalLabel: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    summaryTotalValue: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.primary,
    },
    proceedButton: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      alignItems: "center",
      marginTop: spacing.md,
    },
    proceedButtonDisabled: {
      backgroundColor: colors.primary + "30",
    },
    proceedButtonText: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
  });
