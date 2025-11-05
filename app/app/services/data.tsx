import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ThemedInput from "@/components/ThemedInput";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeColors } from "@/constants/Colors";
import { spacing, borderRadius } from "@/constants/Typography";
import { AirtimeProvider } from "@/types/transaction";
import DataPurchaseService from "@/services/features/DataPurchaseService";
import SecureWalletStorage from "@/services/SecureWalletStorage";
import { useWalletStore } from "@/store/walletStore";

const NETWORKS = [
  {
    id: AirtimeProvider.MTN,
    name: "MTN",
    icon: "alpha-m-circle",
    color: "#FFCC00",
  },
  {
    id: AirtimeProvider.AIRTEL,
    name: "Airtel",
    icon: "alpha-a-circle",
    color: "#FF0000",
  },
  {
    id: AirtimeProvider.GLO,
    name: "Glo",
    icon: "alpha-g-circle",
    color: "#00A95F",
  },
  {
    id: AirtimeProvider.NINE_MOBILE,
    name: "9mobile",
    icon: "alpha-e-circle",
    color: "#006F3E",
  },
];

const DATA_PLANS = {
  [AirtimeProvider.MTN]: [
    { id: "1", amount: 500, data: "100MB", validity: "1 Day" },
    { id: "2", amount: 1000, data: "1GB", validity: "7 Days" },
    { id: "3", amount: 2000, data: "2GB", validity: "30 Days" },
    { id: "4", amount: 3000, data: "3.5GB", validity: "30 Days" },
    { id: "5", amount: 5000, data: "6GB", validity: "30 Days" },
    { id: "6", amount: 10000, data: "15GB", validity: "30 Days" },
    { id: "7", amount: 20000, data: "40GB", validity: "30 Days" },
  ],
  [AirtimeProvider.AIRTEL]: [
    { id: "1", amount: 500, data: "200MB", validity: "3 Days" },
    { id: "2", amount: 1000, data: "1.5GB", validity: "30 Days" },
    { id: "3", amount: 2000, data: "3GB", validity: "30 Days" },
    { id: "4", amount: 3000, data: "4.5GB", validity: "30 Days" },
    { id: "5", amount: 5000, data: "10GB", validity: "30 Days" },
    { id: "6", amount: 10000, data: "20GB", validity: "30 Days" },
  ],
  [AirtimeProvider.GLO]: [
    { id: "1", amount: 500, data: "200MB", validity: "1 Day" },
    { id: "2", amount: 1000, data: "1.6GB", validity: "5 Days" },
    { id: "3", amount: 2000, data: "3.2GB", validity: "30 Days" },
    { id: "4", amount: 2500, data: "5.8GB", validity: "30 Days" },
    { id: "5", amount: 5000, data: "10GB", validity: "30 Days" },
    { id: "6", amount: 10000, data: "25GB", validity: "30 Days" },
  ],
  [AirtimeProvider.NINE_MOBILE]: [
    { id: "1", amount: 500, data: "100MB", validity: "1 Day" },
    { id: "2", amount: 1000, data: "1GB", validity: "7 Days" },
    { id: "3", amount: 2000, data: "2.5GB", validity: "30 Days" },
    { id: "4", amount: 3000, data: "4.5GB", validity: "30 Days" },
    { id: "5", amount: 5000, data: "11.5GB", validity: "30 Days" },
    { id: "6", amount: 10000, data: "30GB", validity: "30 Days" },
  ],
};

export default function DataScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { smartAccount } = useWalletStore();

  const styles = createStyles(colors);
  const [selectedNetwork, setSelectedNetwork] = useState<AirtimeProvider>(
    AirtimeProvider.MTN
  );
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");

  const handleProceed = async () => {
    if (!phoneNumber || phoneNumber.length !== 11) {
      Alert.alert("Invalid Number", "Please enter a valid phone number");
      return;
    }

    if (!selectedPlan) {
      Alert.alert("No Plan Selected", "Please select a data plan");
      return;
    }

    if (!smartAccount?.address) {
      Alert.alert("Error", "Smart Account not initialized");
      return;
    }

    setLoading(true);
    try {
      setProcessingStatus("Getting credentials...");
      
      // TODO: Implement proper PIN prompt for production
      const privateKey = await SecureWalletStorage.getPrivateKey('password');
      
      if (!privateKey) {
        Alert.alert("Error", "Unable to access wallet credentials");
        setLoading(false);
        return;
      }

      setProcessingStatus("Processing data purchase...");
      
      // selectedPlan already has the structure from DATA_PLANS
      if (!selectedPlan.amount) {
        Alert.alert("Error", "Invalid data plan selected");
        setLoading(false);
        return;
      }

      const result = await DataPurchaseService.purchaseData({
        smartWalletAddress: smartAccount.address as `0x${string}`,
        privateKey: privateKey as `0x${string}`,
        phoneNumber,
        amountNGN: selectedPlan.amount,
        provider: selectedNetwork,
        dataCode: selectedPlan.id, // Use the plan ID as dataCode
        paymentToken: 'USDT', // Default to USDT
      });

      if (result.success) {
        Alert.alert(
          "Success! 🎉",
          `Data bundle purchased successfully!\n\nTransaction Hash:\n${result.transactionHash?.slice(0, 10)}...${result.transactionHash?.slice(-8)}`,
          [
            {
              text: "OK",
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        Alert.alert("Transaction Failed", result.error || "Purchase failed");
      }
    } catch (error: any) {
      console.error("Data purchase error:", error);
      Alert.alert("Error", error.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
      setProcessingStatus("");
    }
  };

  const currentPlans = (DATA_PLANS as any)[selectedNetwork] || [];

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
          <Text style={styles.headerTitle}>Data Bundle</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Network Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Network</Text>
            <View style={styles.networkGrid}>
              {NETWORKS.map((network) => (
                <TouchableOpacity
                  key={network.id}
                  style={[
                    styles.networkCard,
                    selectedNetwork === network.id && styles.networkCardActive,
                  ]}
                  onPress={() => {
                    setSelectedNetwork(network.id);
                    setSelectedPlan(null);
                  }}
                >
                  <MaterialCommunityIcons
                    name={network.icon as any}
                    size={40}
                    color={
                      selectedNetwork === network.id
                        ? network.color
                        : colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.networkName,
                      selectedNetwork === network.id &&
                        styles.networkNameActive,
                    ]}
                  >
                    {network.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Phone Number */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Phone Number</Text>
            <ThemedInput
              placeholder="080XXXXXXXX"
              keyboardType="phone-pad"
              maxLength={11}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
            />
          </View>

          {/* Data Plans */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Data Plan</Text>
            <View style={styles.plansGrid}>
              {currentPlans.map((plan: any) => (
                <TouchableOpacity
                  key={plan.id}
                  style={[
                    styles.planCard,
                    selectedPlan?.id === plan.id && styles.planCardActive,
                  ]}
                  onPress={() => setSelectedPlan(plan)}
                >
                  <View style={styles.planHeader}>
                    <Text style={styles.planData}>{plan.data}</Text>
                    {selectedPlan?.id === plan.id && (
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={20}
                        color={colors.primary}
                      />
                    )}
                  </View>
                  <Text style={styles.planValidity}>{plan.validity}</Text>
                  <Text style={styles.planAmount}>
                    ₦{plan.amount.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Summary */}
          {selectedPlan && phoneNumber.length === 11 && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Network</Text>
                <Text style={styles.summaryValue}>
                  {NETWORKS.find((n) => n.id === selectedNetwork)?.name}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Phone Number</Text>
                <Text style={styles.summaryValue}>{phoneNumber}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Data Bundle</Text>
                <Text style={styles.summaryValue}>{selectedPlan.data}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Validity</Text>
                <Text style={styles.summaryValue}>{selectedPlan.validity}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amount</Text>
                <Text style={styles.summaryValue}>
                  ₦{selectedPlan.amount.toLocaleString()}
                </Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryTotal]}>
                <Text style={styles.summaryTotalLabel}>Total</Text>
                <Text style={styles.summaryTotalValue}>
                  ₦{selectedPlan.amount.toLocaleString()}
                </Text>
              </View>
            </View>
          )}

          {/* Proceed Button */}
          <TouchableOpacity
            style={[
              styles.proceedButton,
              (!phoneNumber || !selectedPlan || phoneNumber.length !== 11 || loading) &&
                styles.proceedButtonDisabled,
            ]}
            onPress={handleProceed}
            disabled={
              !phoneNumber || !selectedPlan || phoneNumber.length !== 11 || loading
            }
          >
            {loading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color="#FFF" />
                {processingStatus && (
                  <Text style={styles.proceedButtonText}>{processingStatus}</Text>
                )}
              </View>
            ) : (
              <Text style={styles.proceedButtonText}>Purchase Data</Text>
            )}
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
    networkGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    networkCard: {
      width: "48%",
      backgroundColor: colors.cardBackground + "10",
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      alignItems: "center",
      borderWidth: 2,
      borderColor: colors.cardBackground + "20",
    },
    networkCardActive: {
      backgroundColor: colors.primary + "10",
      borderColor: colors.primary,
    },
    networkName: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: spacing.sm,
    },
    networkNameActive: {
      color: colors.textPrimary,
      fontWeight: "600",
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
    plansGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    planCard: {
      width: "48%",
      backgroundColor: colors.cardBackground + "10",
      borderRadius: borderRadius.md,
      padding: spacing.md,
      borderWidth: 2,
      borderColor: colors.cardBackground + "20",
    },
    planCardActive: {
      backgroundColor: colors.primary + "10",
      borderColor: colors.primary,
    },
    planHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.xs,
    },
    planData: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    planValidity: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    planAmount: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.primary,
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
