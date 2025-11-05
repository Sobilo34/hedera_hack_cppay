import { BalanceCard } from "@/components/BalanceCard";
import { QuickActionButton } from "@/components/QuickActionButton";
import { TransactionItem } from "@/components/TransactionItem";
import { SmartWalletAddress } from "@/components/SmartWalletAddress";
import { DualWalletAddress } from "@/components/DualWalletAddress";
import { TokenList } from "@/components/TokenList";
import TokenSelector from "@/components/TokenSelector";
import NetworkSelector from "@/components/NetworkSelector";
import { useTheme } from "@/contexts/ThemeContext";
import { useNetwork } from "@/contexts/NetworkContext";
import { borderRadius, spacing } from "@/constants/Typography";
import { transactions } from "@/data/transactions";
import { user } from "@/data/user";
import { useWalletStore } from "@/store/walletStore";
import { fetchTokenBalances, type TokenBalance } from "@/services/TokenBalanceService";
import { useBalances } from "@/hooks/useBalances";
import SecureWalletStorage from "@/services/SecureWalletStorage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { wallet, auth, initializeSmartAccount } = useWalletStore();
  const { currentNetwork, selectedToken, setSelectedToken, isTestnet } = useNetwork();
  
  // Check if wallet is locked and redirect to unlock screen
  useEffect(() => {
    if (auth.hasWallet && wallet.isLocked) {
      console.log('🔒 Wallet is locked, redirecting to unlock screen');
      router.replace('/auth/unlock' as any);
      return;
    }
    
    if (!auth.hasWallet) {
      console.log('📱 No wallet found, redirecting to welcome screen');
      router.replace('/auth/welcome' as any);
      return;
    }
  }, [auth.hasWallet, wallet.isLocked, router]);
  
  // New balance system - always shows cached data, updates in background
  const {
    balances: tokenBalances,
    isUpdating: isLoadingBalances,
    totalUSD,
    totalNGN,
    refresh: refreshBalances,
    lastUpdated,
  } = useBalances({
    address: wallet.address || undefined, // Use EOA address for real balances
    chainId: currentNetwork.chainId,
    autoRefresh: true, // Auto-refresh when stale
    refreshOnMount: true, // Refresh on component mount if needed
  });
  
  // UI state
  const [showAllTokens, setShowAllTokens] = useState(false);
  const [showNetworkSelector, setShowNetworkSelector] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Manual refresh handler - user initiated
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshBalances();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRetrySmartAccount = async () => {
    try {
      // This should only be called when wallet is unlocked
      if (wallet.isLocked) {
        console.log('Cannot retry smart account - wallet is locked');
        return;
      }
      
      // Get private key from secure storage using the current session
      const privateKey = await SecureWalletStorage.getPrivateKey(''); // Empty string for biometric session
      if (privateKey) {
        await initializeSmartAccount(privateKey);
      }
    } catch (error) {
      console.error('Failed to retry smart account:', error);
    }
  };

  const quickActions = [
    {
      icon: "currency-ngn",
      label: "Crypto to ₦",
      badge: "NEW",
      badgeColor: colors.success,
      onPress: () => router.push("/crypto-to-naira" as any),
    },
    {
      icon: "layers",
      label: "Batch Payment",
      onPress: () => router.push("/services/batch-payment" as any),
    },
    {
      icon: "calendar-multiple",
      label: "Scheduled Payment",
      onPress: () => router.push("/services/scheduled-payments" as any),
    },
    {
      icon: "send",
      label: "Send Crypto",
      onPress: () => router.push("/services/send-crypto" as any),
    },
    {
      icon: "arrow-down",
      label: "Receive",
      onPress: () => router.push("/services/receive-crypto" as any),
    },
    {
      icon: "swap-horizontal",
      label: "Swap",
      onPress: () => router.push("/services/swap" as any),
    },
    {
      icon: "phone",
      label: "Airtime",
      onPress: () => router.push("/services/airtime" as any),
    },
    {
      icon: "chart-bar",
      label: "Data",
      badge: "UP to 6%",
      badgeColor: colors.warning,
      onPress: () => router.push("/services/data" as any),
    },
    {
      icon: "dots-grid",
      label: "More",
      onPress: () => router.push("/services/more" as any),
    },
  ];

  const recentTransactions = transactions.slice(0, 2);

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.cardBackground}
      />

      {/* DEBUG: Temporary button to access debug tools */}
      <TouchableOpacity
        style={styles.debugButton}
        onPress={() => router.push("/debug" as any)}
      >
        <MaterialCommunityIcons name="bug" size={20} color="#fff" />
        <Text style={styles.debugButtonText}>Debug Tools</Text>
      </TouchableOpacity>

      <ScrollView 
        style={styles.container} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleManualRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{user.nickname.charAt(0)}</Text>
              </View>
              {/* <View style={styles.upgradeBadge}>
                <Text style={styles.upgradeBadgeText}>1</Text>
              </View> */}
            </View>
            <View style={styles.greetingContainer}>
              <Text style={styles.greeting}>Hi, {user.nickname}</Text>
              {/*  Address - NEW */}
              <DualWalletAddress
                eoaAddress={wallet.address}
                smartAccountAddress={wallet.smartAccountAddress}
                compact={true}
              />
              {/* <TouchableOpacity style={styles.tierButton}>
                <MaterialCommunityIcons name="chevron-right" size={16} color={Colors.warning} />
              </TouchableOpacity> */}
            </View>
          </View>

          <View style={styles.headerRight}>
            {/* Network Indicator */}
            <TouchableOpacity style={styles.headerIcon}>
              <MaterialCommunityIcons
                name="qrcode-scan"
                size={24}
                color={colors.textPrimary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={() => router.push("/notifications" as any)}
            >
              <MaterialCommunityIcons
                name="bell"
                size={24}
                color={colors.textPrimary}
              />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Balance Card */}
        <BalanceCard
          balance={totalNGN}
          isLoading={isLoadingBalances && !totalNGN} // Only show loading if no cached data
          holdings={tokenBalances.map(tb => {
            const balanceNum = parseFloat(tb.balance || '0');
            return {
              token: tb.token,
              network: currentNetwork,
              balance: tb.balance,
              balanceRaw: tb.balanceRaw,
              priceUSD: balanceNum > 0 ? tb.balanceUSD / balanceNum : 0,
              priceNGN: balanceNum > 0 ? tb.balanceNGN / balanceNum : 0,
              valueUSD: tb.balanceUSD,
              valueNGN: tb.balanceNGN,
            };
          })}
          onTransactionHistory={() => router.push("/transactions" as any)}
          onAddMoney={() => {}}
          onRefresh={handleManualRefresh}
          lastUpdated={lastUpdated}
        />

        {/* Recent Transactions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {recentTransactions.map((transaction) => (
            <TransactionItem
              key={transaction.id}
              icon={transaction.icon}
              title={transaction.title}
              date={transaction.date}
              amount={transaction.amount}
              status={transaction.status}
              iconColor={transaction.iconColor}
              onPress={() =>
                router.push({
                  pathname: "/transaction-details" as any,
                  params: { id: transaction.id },
                })
              }
            />
          ))}
        </View>

        <TouchableOpacity
          style={styles.networkIndicator}
          onPress={() => setShowNetworkSelector(true)}
        >
          <View style={[
            styles.networkDot,
            { backgroundColor: isTestnet ? colors.warning : colors.success }
          ]} />
          <Text style={styles.networkText}>{currentNetwork.shortName}</Text>
          <MaterialCommunityIcons
            name="chevron-down"
            size={16}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          {quickActions.map((action, index) => (
            <QuickActionButton
              key={index}
              icon={action.icon}
              label={action.label}
              badge={action.badge}
              badgeColor={action.badgeColor}
              onPress={action.onPress}
            />
          ))}
        </View>

        {/* Token Holdings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Tokens</Text>
            <TouchableOpacity onPress={() => setShowAllTokens(!showAllTokens)}>
              <Text style={[styles.seeAllText, { color: colors.primary }]}>
                {showAllTokens ? 'Show Less' : 'See All'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <TokenList
            balances={tokenBalances}
            isLoading={isLoadingBalances && tokenBalances.length === 0}
            showAllTokens={showAllTokens}
            onTokenPress={(balance) => {
              // Navigate to token details
              console.log('Token pressed:', balance.token.symbol);
            }}
            onRefresh={handleManualRefresh}
          />
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Network Selector Modal */}
      <NetworkSelector
        visible={showNetworkSelector}
        onClose={() => setShowNetworkSelector(false)}
      />
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
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.cardBackground,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    avatarContainer: {
      position: "relative",
      marginRight: spacing.md,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: {
      fontSize: 18,
      fontWeight: "bold",
      color: "#FFF",
    },
    upgradeBadge: {
      position: "absolute",
      bottom: -2,
      right: -2,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.warning,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: colors.cardBackground,
    },
    upgradeBadgeText: {
      fontSize: 10,
      fontWeight: "bold",
      color: "#FFF",
    },
    greetingContainer: {
      justifyContent: "center",
    },
    greeting: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 2,
    },
    tierButton: {
      flexDirection: "row",
      alignItems: "center",
    },
    tierText: {
      fontSize: 12,
      color: colors.warning,
      marginRight: 2,
    },
    headerRight: {
      flexDirection: "row",
      alignItems: "center",
    },
    networkIndicator: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.cardBackground,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      marginLeft: spacing.md,
      marginTop: spacing.md,
      maxWidth: 120,
      gap: 6,
    },
    networkDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    networkText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    headerIcon: {
      marginLeft: spacing.lg,
      position: "relative",
    },
    notificationDot: {
      position: "absolute",
      top: 0,
      right: 0,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.error,
    },
    tokenSelectorContainer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    tokenSelectorLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    section: {
      marginTop: spacing.lg,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.textPrimary,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    viewAllButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    viewAllText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: "600",
    },
    seeAllText: {
      fontSize: 14,
      fontWeight: "600",
    },
    quickActionsContainer: {
      backgroundColor: colors.cardBackground,
      marginTop: spacing.lg,
      paddingVertical: spacing.lg,
      flexDirection: "row",
      flexWrap: "wrap",
    },
    bonusCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.cardBackground,
      marginHorizontal: spacing.lg,
      marginTop: spacing.lg,
      padding: spacing.lg,
      borderRadius: borderRadius.lg,
      elevation: 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    bonusIconContainer: {
      marginRight: spacing.md,
    },
    bonusContent: {
      flex: 1,
    },
    bonusTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    bonusSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    goButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.xl,
    },
    goButtonText: {
      fontSize: 14,
      fontWeight: "bold",
      color: "#FFF",
    },
    debugButton: {
      position: "absolute",
      top: 10,
      left: 10,
      backgroundColor: "#ff5252",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      zIndex: 1000,
    },
    debugButtonText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "bold",
    },
    hotDealCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: `${colors.primary}10`,
      marginHorizontal: spacing.lg,
      marginTop: spacing.lg,
      padding: spacing.lg,
      borderRadius: borderRadius.lg,
    },
    hotDealContent: {
      flex: 1,
      marginLeft: spacing.md,
    },
    hotDealTitle: {
      fontSize: 14,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    hotDealSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
    },
  });
