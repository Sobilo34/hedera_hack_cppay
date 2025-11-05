import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/contexts/ThemeContext";
import { spacing, borderRadius } from "@/constants/Typography";
import { ThemeColors } from "@/constants/Colors";

interface ServiceItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  route: string;
  badge?: string;
  category: "bills" | "transfers" | "crypto" | "finance";
}

const SERVICES: ServiceItem[] = [
  // Bill Payments
  {
    id: "airtime",
    icon: "phone",
    title: "Airtime",
    description: "Buy airtime for all networks",
    route: "/services/airtime",
    category: "bills",
  },
  {
    id: "data",
    icon: "chart-bar",
    title: "Data Bundle",
    description: "Purchase data bundles",
    route: "/services/data",
    badge: "Popular",
    category: "bills",
  },
  {
    id: "electricity",
    icon: "lightning-bolt",
    title: "Electricity",
    description: "Pay electricity bills",
    route: "/services/electricity",
    category: "bills",
  },
  {
    id: "cable",
    icon: "television",
    title: "Cable TV",
    description: "DSTV, GOtv, Startimes",
    route: "/services/cable-tv",
    category: "bills",
  },
  {
    id: "internet",
    icon: "wifi",
    title: "Internet",
    description: "Pay internet bills",
    route: "/services/internet",
    category: "bills",
  },
  {
    id: "water",
    icon: "water",
    title: "Water",
    description: "Pay water bills",
    route: "/services/water",
    category: "bills",
  },
  {
    id: "education",
    icon: "school",
    title: "Education",
    description: "Pay school fees",
    route: "/services/education",
    category: "bills",
  },

  // Transfers
  {
    id: "p2p",
    icon: "bank-transfer",
    title: "To CPPay User",
    description: "Send money to other users",
    route: "/services/p2p-transfer",
    category: "transfers",
  },
  {
    id: "bank",
    icon: "bank",
    title: "To Bank Account",
    description: "Transfer to bank account",
    route: "/services/bank-transfer",
    category: "transfers",
  },
  {
    id: "send-crypto",
    icon: "send",
    title: "Send Crypto",
    description: "Send cryptocurrency",
    route: "/services/send-crypto",
    category: "crypto",
  },
  {
    id: "receive",
    icon: "arrow-down",
    title: "Receive Crypto",
    description: "Receive cryptocurrency",
    route: "/services/receive-crypto",
    category: "crypto",
  },

  // Finance
  {
    id: "swap",
    icon: "swap-horizontal",
    title: "Swap",
    description: "Exchange cryptocurrencies",
    route: "/services/swap",
    category: "crypto",
  },
  {
    id: "batch",
    icon: "checkbox-multiple-marked",
    title: "Batch Payment",
    description: "Pay multiple bills at once",
    route: "/services/batch-payment",
    badge: "New",
    category: "finance",
  },
  {
    id: "scheduled",
    icon: "calendar-clock",
    title: "Scheduled Payments",
    description: "Set up recurring payments",
    route: "/services/scheduled-payments",
    category: "finance",
  },
  {
    id: "withdraw",
    icon: "cash-multiple",
    title: "Withdraw",
    description: "Withdraw to bank",
    route: "/services/withdraw",
    category: "finance",
  },
];

const CATEGORIES = [
  { id: "all", label: "All Services", icon: "apps" },
  { id: "bills", label: "Bill Payments", icon: "receipt" },
  { id: "transfers", label: "Transfers", icon: "bank-transfer" },
  { id: "crypto", label: "Crypto", icon: "bitcoin" },
  { id: "finance", label: "Finance", icon: "wallet" },
];

export default function MoreServicesScreen() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const filteredServices =
    selectedCategory === "all"
      ? SERVICES
      : SERVICES.filter((s) => s.category === selectedCategory);

  const renderServiceCard = (service: ServiceItem) => (
    <TouchableOpacity
      key={service.id}
      style={styles.serviceCard}
      onPress={() => router.push(service.route as any)}
      activeOpacity={0.7}
    >
      <View style={styles.serviceIconContainer}>
        <MaterialCommunityIcons
          name={service.icon as any}
          size={28}
          color={colors.primary}
        />
      </View>
      <View style={styles.serviceInfo}>
        <View style={styles.serviceTitleRow}>
          <Text style={styles.serviceTitle}>{service.title}</Text>
          {service.badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{service.badge}</Text>
            </View>
          )}
        </View>
        <Text style={styles.serviceDescription}>{service.description}</Text>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={24}
        color={colors.textSecondary}
      />
    </TouchableOpacity>
  );

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
        <StatusBar
          barStyle={colors.textPrimary ? "light-content" : "dark-content"}
        />

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
          <Text style={styles.headerTitle}>All Services</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Category Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryContainer}
        >
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryChip,
                selectedCategory === category.id && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(category.id)}
            >
              <MaterialCommunityIcons
                name={category.icon as any}
                size={20}
                color={
                  selectedCategory === category.id
                    ? colors.textPrimary
                    : colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === category.id &&
                    styles.categoryChipTextActive,
                ]}
              >
                {category.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Services List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.servicesGrid}>
            {filteredServices.map((service) => renderServiceCard(service))}
          </View>
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
      backgroundColor: colors.cardBackground,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    categoryScroll: {
      maxHeight: 60,
    },
    categoryContainer: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    categoryChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.xl,
      backgroundColor: colors.cardBackground,
      marginRight: spacing.sm,
    },
    categoryChipActive: {
      backgroundColor: colors.primary,
    },
    categoryChipText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    categoryChipTextActive: {
      color: colors.textPrimary,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
    },
    servicesGrid: {
      marginTop: spacing.md,
    },
    serviceCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.cardBackground,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    serviceIconContainer: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: colors.success + "20",
      justifyContent: "center",
      alignItems: "center",
      marginRight: spacing.md,
    },
    serviceInfo: {
      flex: 1,
    },
    serviceTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    serviceTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    serviceDescription: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    badge: {
      backgroundColor: colors.warning,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.sm,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
  });
