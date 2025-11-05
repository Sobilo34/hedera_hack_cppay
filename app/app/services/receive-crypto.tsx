import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  Share,
  Clipboard,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeColors } from "@/constants/Colors";
import { spacing, borderRadius } from "@/constants/Typography";
import { useWalletStore } from "@/store/walletStore";
import QRCode from "react-native-qrcode-svg";
import ReceiveService from "@/services/features/ReceiveService";

export default function ReceiveCryptoScreen() {
  const router = useRouter();
  const { wallet, smartAccount, balances } = useWalletStore();
  const [selectedToken, setSelectedToken] = useState("USDC");
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);
  const [receiveInfo, setReceiveInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReceiveInfo();
  }, [smartAccount, selectedToken]);

  const loadReceiveInfo = async () => {
    if (!smartAccount?.address) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const info = await ReceiveService.getReceiveInfo(
        smartAccount.address as `0x${string}`
      );
      setReceiveInfo(info);
    } catch (error) {
      console.error("Error loading receive info:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAddress = () => {
    const address = smartAccount?.address || wallet?.address;
    if (address) {
      Clipboard.setString(address);
      Alert.alert("Copied!", "Wallet address copied to clipboard");
    }
  };

  const handleShare = async () => {
    const address = smartAccount?.address || wallet?.address;
    if (address) {
      try {
        await Share.share({
          message: `Send ${selectedToken} to this address: ${address}`,
        });
      } catch (error) {
        console.error(error);
      }
    }
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
          <Text style={styles.headerTitle}>Receive Crypto</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Token Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>Select Token</Text>
            <View style={styles.tokenGrid}>
              {["USDC", "USDT", "DAI"].map((token) => (
                <TouchableOpacity
                  key={token}
                  style={[
                    styles.tokenChip,
                    selectedToken === token && styles.tokenChipActive,
                  ]}
                  onPress={() => setSelectedToken(token)}
                >
                  <Text
                    style={[
                      styles.tokenText,
                      selectedToken === token && styles.tokenTextActive,
                    ]}
                  >
                    {token}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* QR Code */}
          <View style={styles.qrContainer}>
            <View style={styles.qrWrapper}>
              {wallet?.address ? (
                <QRCode
                  value={wallet.address}
                  size={200}
                  backgroundColor={colors.cardBackground}
                  color={colors.textPrimary}
                />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <MaterialCommunityIcons
                    name="qrcode"
                    size={100}
                    color={colors.textSecondary}
                  />
                </View>
              )}
            </View>
          </View>

          {/* Address */}
          <View style={styles.section}>
            <Text style={styles.label}>Your Wallet Address</Text>
            <View style={styles.addressCard}>
              <Text
                style={styles.addressText}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {wallet?.address || "No wallet connected"}
              </Text>
              <TouchableOpacity
                onPress={handleCopyAddress}
                style={styles.iconButton}
              >
                <MaterialCommunityIcons
                  name="content-copy"
                  size={20}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Warning */}
          <View style={styles.warningCard}>
            <MaterialCommunityIcons
              name="alert-circle"
              size={24}
              color={colors.warning}
            />
            <View style={styles.warningTextContainer}>
              <Text style={styles.warningTitle}>Important</Text>
              <Text style={styles.warningText}>
                Only send {selectedToken} on the Base network to this address.
                Sending other tokens or using other networks may result in
                permanent loss.
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <MaterialCommunityIcons
              name="share-variant"
              size={20}
              color={colors.textPrimary}
            />
            <Text style={styles.shareButtonText}>Share Address</Text>
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
    content: { flex: 1 },
    contentContainer: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
    },
    section: { marginBottom: spacing.lg },
    label: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    tokenGrid: { flexDirection: "row", gap: spacing.sm },
    tokenChip: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.cardBackground + "10",
      borderWidth: 1,
      borderColor: colors.divider + "20",
      alignItems: "center",
    },
    tokenChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tokenText: { fontSize: 14, color: colors.textSecondary },
    tokenTextActive: { color: colors.textPrimary, fontWeight: "600" },
    qrContainer: { alignItems: "center", marginVertical: spacing.xl },
    qrWrapper: {
      backgroundColor: colors.cardBackground,
      padding: spacing.lg,
      borderRadius: borderRadius.lg,
    },
    qrPlaceholder: {
      width: 200,
      height: 200,
      justifyContent: "center",
      alignItems: "center",
    },
    addressCard: {
      backgroundColor: colors.cardBackground + "10",
      borderRadius: borderRadius.md,
      padding: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    addressText: {
      flex: 1,
      fontSize: 14,
      color: colors.textPrimary,
      fontFamily: "monospace",
    },
    iconButton: { padding: spacing.xs },
    warningCard: {
      backgroundColor: colors.warning + "10",
      borderRadius: borderRadius.md,
      padding: spacing.md,
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.warning + "30",
    },
    warningTextContainer: { flex: 1 },
    warningTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.warning,
      marginBottom: spacing.xs,
    },
    warningText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
    shareButton: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    shareButtonText: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
  });
