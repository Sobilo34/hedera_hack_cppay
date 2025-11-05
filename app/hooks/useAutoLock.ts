import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useWalletStore } from '@/store/walletStore';
import { useRouter, useSegments } from 'expo-router';

/**
 * Hook to handle automatic wallet locking based on:
 * 1. App going to background
 * 2. Inactivity timeout
 * 3. User switching to other apps
 */
export function useAutoLock() {
  const { auth, lockWallet } = useWalletStore();
  const router = useRouter();
  const segments = useSegments();
  const appState = useRef(AppState.currentState);
  const lastActivityTime = useRef(Date.now());
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-lock duration from store (default 5 minutes)
  const autoLockDuration = auth.autoLockDuration || 5 * 60 * 1000;

  // Reset inactivity timer
  const resetInactivityTimer = () => {
    lastActivityTime.current = Date.now();
    
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }

    // Only set timer if authenticated
    if (auth.isAuthenticated) {
      inactivityTimer.current = setTimeout(() => {
        console.log('🔒 Auto-locking due to inactivity...');
        handleLock();
      }, autoLockDuration);
    }
  };

  const handleLock = () => {
    if (auth.isAuthenticated) {
      lockWallet();
      
      // Navigate to unlock screen if not already there
      const inAuthFlow = segments[0] === 'auth';
      if (!inAuthFlow) {
        router.replace('/auth/unlock' as any);
      }
    }
  };

  useEffect(() => {
    // Handle app state changes (background/foreground)
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // App going to background
      if (
        appState.current.match(/active/) &&
        nextAppState === 'background'
      ) {
        console.log('📱 App went to background');
        // Lock immediately when app goes to background (MetaMask behavior)
        handleLock();
      }

      // App coming to foreground
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('📱 App came to foreground');
        // Check if we need to lock due to time elapsed
        const timeSinceLastActivity = Date.now() - lastActivityTime.current;
        if (timeSinceLastActivity > autoLockDuration && auth.isAuthenticated) {
          handleLock();
        } else if (auth.isAuthenticated) {
          // Reset timer if still within window
          resetInactivityTimer();
        }
      }

      appState.current = nextAppState;
    });

    // Start inactivity timer
    resetInactivityTimer();

    return () => {
      subscription.remove();
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
    };
  }, [auth.isAuthenticated, autoLockDuration]);

  // Expose method to reset timer on user interaction
  return {
    resetInactivityTimer,
  };
}
