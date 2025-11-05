import { useTheme } from "@/contexts/ThemeContext";
import { borderRadius, spacing } from "@/constants/Typography";
import { formatCurrency } from "@/utils/formatters";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  View,
  ActivityIndicator,
  ScrollView,
  Modal,
} from "react-native";
import type { TokenHolding } from "@/services/PortfolioService";

interface BalanceCardProps {
  balance: number;
  label?: string;
  gradient?: boolean;
  gradientColors?: string[];
  showAddMoney?: boolean;
  showTransactionHistory?: boolean;
  onAddMoney?: () => void;
  onTransactionHistory?: () => void;
  onRefresh?: () => void;
  interestToday?: number;
  isLoading?: boolean;
  holdings?: TokenHolding[];
  lastUpdated?: number | null;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  balance,
  label = "Total Portfolio Value",
  gradient = true,
  gradientColors,
  showAddMoney = true,
  showTransactionHistory = true,
  onAddMoney,
  onTransactionHistory,
  onRefresh,
  interestToday,
  isLoading = false,
  holdings = [],
  lastUpdated,
}) => {
  const { colors } = useTheme();
  const [showBreakdown, setShowBreakdown] = useState(false);

  const effectiveGradient =
    gradientColors && gradientColors.length >= 2
      ? gradientColors
      : [colors.primary, colors.primaryDark];

  const formatNGN = (value: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatUSD = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (seconds < 30) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const renderContent = () => (
    <View>
      <View style={styles.header}>
        <View style={styles.labelContainer}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {label}
          </Text>
          {holdings.length > 0 && (
            <TouchableOpacity 
              onPress={() => setShowBreakdown(true)}
              style={styles.infoButton}
            >
              <MaterialCommunityIcons
                name="information-outline"
                size={16}
                color={colors.textPrimary}
              />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.headerRight}>
          {onRefresh && (
            <TouchableOpacity
              onPress={onRefresh}
              style={styles.refreshButton}
              disabled={isLoading}
            >
              <MaterialCommunityIcons
                name="refresh"
                size={18}
                color={colors.textPrimary}
              />
            </TouchableOpacity>
          )}
          {showTransactionHistory && (
            <TouchableOpacity
              onPress={onTransactionHistory}
              style={styles.historyButton}
            >
              <Text
                style={[styles.historyText, { color: colors.textPrimary }]}
              >
                History
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={colors.textPrimary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.textPrimary} />
          <Text style={[styles.loadingText, { color: colors.textPrimary }]}>
            Updating balance...
          </Text>
        </View>
      ) : (
        <>
          <Text style={[styles.amount, { color: colors.textPrimary }]}>
            {formatCurrency(balance)}
          </Text>

          <View style={styles.bottomInfo}>
            {holdings.length > 0 && (
              <Text style={[styles.holdingsCount, { color: colors.textPrimary }]}>
                {holdings.length} token{holdings.length !== 1 ? 's' : ''} across multiple networks
              </Text>
            )}
            
            {lastUpdated && (
              <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>
                Updated {formatRelativeTime(lastUpdated)}
              </Text>
            )}
          </View>
        </>
      )}

      {!isLoading && balance === 0 && holdings.length === 0 && (
        <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
          No tokens found. Add funds to get started! 💰
        </Text>
      )}

      {interestToday !== undefined && (
        <TouchableOpacity style={styles.interestContainer}>
          <Text
            style={[styles.interestText, { color: colors.textPrimary }]}
          >
            Interest Credited Today: {formatCurrency(interestToday)}
          </Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={16}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
      )}

      {showAddMoney && (
        <TouchableOpacity
          style={[
            styles.addMoneyButton,
            { backgroundColor: colors.cardBackground },
          ]}
          onPress={onAddMoney}
        >
          <MaterialCommunityIcons
            name="plus"
            size={16}
            color={colors.primary}
          />
          <Text style={[styles.addMoneyText, { color: colors.primary }]}>
            Add Money
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {gradient ? (
        <LinearGradient
          colors={effectiveGradient as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, { borderRadius: borderRadius.xl }]}
        >
          {renderContent()}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.primaryLight,
              borderRadius: borderRadius.xl,
            },
          ]}
        >
          {renderContent()}
        </View>
      )}

      {showAddMoney && (
        <View
          style={[
            styles.securityBadge,
            { backgroundColor: colors.cardBackground },
          ]}
        >
          <MaterialCommunityIcons
            name="shield-check"
            size={24}
            color={colors.primary}
          />
        </View>
      )}

      <Modal
        visible={showBreakdown}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBreakdown(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Portfolio Breakdown
              </Text>
              <TouchableOpacity onPress={() => setShowBreakdown(false)}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={colors.textPrimary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {holdings.map((holding, index) => (
                <View
                  key={`${holding.network.name}-${holding.token.symbol}-${index}`}
                  style={[styles.holdingItem, { borderBottomColor: colors.border }]}
                >
                  <View style={styles.holdingHeader}>
                    <View style={styles.holdingLeft}>
                      <Text style={[styles.holdingToken, { color: colors.textPrimary }]}>
                        {holding.token.symbol}
                      </Text>
                      <Text style={[styles.holdingNetwork, { color: colors.textSecondary }]}>
                        on {holding.network.name}
                      </Text>
                    </View>
                    <View style={styles.holdingRight}>
                      <Text style={[styles.holdingBalance, { color: colors.textPrimary }]}>
                        {holding.balance} {holding.token.symbol}
                      </Text>
                      <Text style={[styles.holdingPrice, { color: colors.textSecondary }]}>
                        {formatUSD(holding.priceUSD)} per token
                      </Text>
                    </View>
                  </View>
                  <View style={styles.holdingValues}>
                    <View style={styles.valueItem}>
                      <Text style={[styles.valueLabel, { color: colors.textSecondary }]}>
                        USD Value
                      </Text>
                      <Text style={[styles.valueAmount, { color: colors.textPrimary }]}>
                        {formatUSD(holding.valueUSD)}
                      </Text>
                    </View>
                    <View style={styles.valueItem}>
                      <Text style={[styles.valueLabel, { color: colors.textSecondary }]}>
                        NGN Value
                      </Text>
                      <Text style={[styles.valueAmount, { color: colors.success }]}>
                        {formatNGN(holding.valueNGN)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}

              <View style={[styles.totalSection, { borderTopColor: colors.border }]}>
                <Text style={[styles.totalLabel, { color: colors.textPrimary }]}>
                  Total Portfolio Value
                </Text>
                <Text style={[styles.totalAmount, { color: colors.success }]}>
                  {formatNGN(balance)}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginHorizontal: spacing.lg, marginVertical: spacing.md, position: "relative" },
  card: { padding: spacing.xl, elevation: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.sm },
  headerRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  labelContainer: { flexDirection: "row", alignItems: "center" },
  label: { fontSize: 14, opacity: 0.95 },
  infoButton: { marginLeft: spacing.xs, padding: spacing.xs },
  refreshButton: { padding: spacing.xs },
  historyButton: { flexDirection: "row", alignItems: "center" },
  historyText: { fontSize: 12, marginRight: 2 },
  amount: { fontSize: 34, fontWeight: "800", marginBottom: spacing.xs },
  bottomInfo: { marginBottom: spacing.md },
  holdingsCount: { fontSize: 12, opacity: 0.85, marginBottom: spacing.xs },
  lastUpdated: { fontSize: 10, opacity: 0.7 },
  emptyMessage: { fontSize: 14, textAlign: "center", marginTop: spacing.sm, fontStyle: "italic", opacity: 0.7 },
  loadingContainer: { alignItems: "center", paddingVertical: spacing.xl },
  loadingText: { marginTop: spacing.sm, fontSize: 14, opacity: 0.85 },
  interestContainer: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: spacing.sm },
  interestText: { fontSize: 12, opacity: 0.9, marginRight: spacing.xs },
  addMoneyButton: { marginTop: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.xl, elevation: 4 },
  addMoneyText: { fontSize: 14, fontWeight: "700", marginLeft: spacing.xs },
  securityBadge: { position: "absolute", bottom: -12, right: spacing.lg, backgroundColor: "#FFF", borderRadius: borderRadius.full, padding: spacing.sm, elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, maxHeight: "80%", paddingTop: spacing.lg },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  modalTitle: { fontSize: 20, fontWeight: "700" },
  modalScroll: { paddingHorizontal: spacing.lg },
  holdingItem: { paddingVertical: spacing.md, borderBottomWidth: 1 },
  holdingHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  holdingLeft: { flex: 1 },
  holdingRight: { alignItems: "flex-end" },
  holdingToken: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
  holdingNetwork: { fontSize: 12 },
  holdingBalance: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  holdingPrice: { fontSize: 11 },
  holdingValues: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
  valueItem: { flex: 1 },
  valueLabel: { fontSize: 11, marginBottom: 2 },
  valueAmount: { fontSize: 13, fontWeight: "600" },
  totalSection: { paddingVertical: spacing.lg, borderTopWidth: 2, marginTop: spacing.md, marginBottom: spacing.xl, alignItems: "center" },
  totalLabel: { fontSize: 14, marginBottom: spacing.xs },
  totalAmount: { fontSize: 24, fontWeight: "800" },
});
