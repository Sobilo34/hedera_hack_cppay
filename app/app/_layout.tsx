import { Stack } from "expo-router";
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { NetworkProvider } from '@/contexts/NetworkContext';
import { useAutoLock } from '@/hooks/useAutoLock';
import { useWalletStore } from '@/store/walletStore';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

function AppContent() {
  // Enable auto-lock functionality
  useAutoLock();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="transactions" options={{ headerShown: false }} />
      <Stack.Screen name="transaction-details" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const initialize = useWalletStore((state) => state.initialize);

  useEffect(() => {
    async function prepare() {
      try {
        console.log('🚀 Initializing app...');
        
        // Initialize wallet store first
        await initialize();
        
        // Add any other app initialization here
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log('✅ App initialization complete');
      } catch (e) {
        console.error('❌ App initialization failed:', e);
        console.warn(e);
      } finally {
        setAppReady(true);
        SplashScreen.hideAsync();
      }
    }

    prepare();
  }, [initialize]);

  if (!appReady) {
    return null;
  }

  return (
    <ThemeProvider>
      <NetworkProvider>
        <AppContent />
      </NetworkProvider>
    </ThemeProvider>
  );
}
