/**
 * CPPay Theme System
 * Supports Light and Dark modes with Baby Blue as primary color
 */

export type Theme = "light" | "dark";

export interface ThemeColors {
  // Primary Colors
  primary: string;
  primaryDark: string;
  primaryLight: string;

  // Backgrounds
  background: string;
  cardBackground: string;
  modalBackground: string;

  // Text Colors
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  // Status Colors
  success: string;
  positive: string;
  negative: string;
  error: string;
  warning: string;
  info: string;

  // UI Elements
  border: string;
  divider: string;
  shadow: string;
  overlay: string;

  // Special
  purple: string;
  purpleLight: string;

  // Gradients (for dark theme screens)
  backgroundGradient1: string;
  backgroundGradient2: string;
  backgroundGradient3: string;
}

export const LightTheme: ThemeColors = {
  // Primary Colors - Modern Cyan / Indigo gradient
  primary: "#00C2FF", // vibrant cyan
  primaryDark: "#0077D9",
  primaryLight: "#BEEFFF",

  // Backgrounds
  background: "#FAFBFF",
  cardBackground: "#FFFFFF",
  modalBackground: "#FFFFFF",

  // Text Colors
  textPrimary: "#0B2545",
  textSecondary: "#4B627A",
  textTertiary: "#7B93A8",
  textInverse: "#FFFFFF",

  // Status Colors
  success: "#16C784",
  positive: "#16C784",
  negative: "#FF6B6B",
  error: "#FF4D4F",
  warning: "#FFB020",
  info: "#00C2FF",

  // UI Elements
  border: "#E6EEF8",
  divider: "#E9F2FB",
  shadow: "rgba(11, 37, 69, 0.08)",
  overlay: "rgba(11, 37, 69, 0.6)",

  // Special
  purple: "#6F5AFF",
  purpleLight: "#BFB3FF",

  // Gradients (not used in light mode, but defined for consistency)
  backgroundGradient1: "#F7FBFF",
  backgroundGradient2: "#E8F7FF",
  backgroundGradient3: "#DFF3FF",
};

export const DarkTheme: ThemeColors = {
  // Primary Colors - Deep Cyan / Electric Blue
  primary: "#00A3FF",
  primaryDark: "#0080CC",
  primaryLight: "#77D1FF",

  // Backgrounds
  background: "#071225",
  cardBackground: "#081427",
  modalBackground: "#081827",

  // Text Colors
  textPrimary: "#E6F0FF",
  textSecondary: "#A8C1DB",
  textTertiary: "#6F8EA6",
  textInverse: "#071225",

  // Status Colors
  success: "#16D78A",
  positive: "#16D78A",
  negative: "#FF8A8A",
  error: "#FF6B6B",
  warning: "#FFBC57",
  info: "#6FD6FF",

  // UI Elements
  border: "#0D2A3E",
  divider: "#0B2336",
  shadow: "rgba(0, 0, 0, 0.6)",
  overlay: "rgba(2, 6, 23, 0.7)",

  // Special
  purple: "#8C7CFF",
  purpleLight: "#C9C0FF",

  // Gradients (for transaction screens)
  backgroundGradient1: "#061226",
  backgroundGradient2: "#092038",
  backgroundGradient3: "#0B3A5A",
};

// Legacy export for backward compatibility
// This will be replaced by the theme context
export const Colors = LightTheme;

// Additional semantic aliases for easier migration
export const Semantic = {
  accent: LightTheme.primary,
  accentDark: LightTheme.primaryDark,
};
