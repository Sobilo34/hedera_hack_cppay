/**
 * Entry point for the app
 * CRITICAL: Polyfills must be imported FIRST before any other code
 */

// Import crypto polyfills FIRST before anything else
import './utils/crypto-polyfill';

// Now import the Expo Router entry point
import 'expo-router/entry';
