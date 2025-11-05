import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useWalletStore } from '@/store/walletStore';
import SecureWalletStorage from '@/services/SecureWalletStorage';

export default function DebugScreen() {
  const router = useRouter();
  const { auth, deleteWallet } = useWalletStore();

  const handleClearWallet = async () => {
    Alert.alert(
      '⚠️ Clear Wallet Data',
      'This will delete all wallet data from secure storage. This action cannot be undone!',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Clear Data',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWallet();
              Alert.alert(
                '✅ Success',
                'Wallet data cleared. App will restart to welcome screen.',
                [
                  {
                    text: 'OK',
                    onPress: () => router.replace('/' as any)
                  }
                ]
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to clear wallet data');
            }
          }
        }
      ]
    );
  };

  const handleCheckStatus = async () => {
    const hasWallet = await SecureWalletStorage.hasWallet();
    const address = await SecureWalletStorage.getAddress();
    const biometric = await SecureWalletStorage.isBiometricEnabled();
    
    Alert.alert(
      '📊 Wallet Status',
      `Has Wallet: ${hasWallet}\n` +
      `Address: ${address ? address.substring(0, 10) + '...' : 'None'}\n` +
      `Biometric: ${biometric}\n` +
      `Store hasWallet: ${auth.hasWallet}`
    );
  };

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f3460']}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.titleContainer}>
          <MaterialCommunityIcons name="bug" size={60} color={Colors.primary} />
          <Text style={styles.title}>Debug Tools</Text>
          <Text style={styles.subtitle}>
            Tools for testing and debugging the app
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={handleCheckStatus}>
            <MaterialCommunityIcons name="information" size={24} color={Colors.primary} />
            <Text style={styles.buttonText}>Check Wallet Status</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.dangerButton]} 
            onPress={handleClearWallet}
          >
            <MaterialCommunityIcons name="delete-forever" size={24} color="#ff5252" />
            <Text style={[styles.buttonText, styles.dangerText]}>Clear Wallet Data</Text>
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <MaterialCommunityIcons name="lightbulb" size={20} color="#FFA726" />
            <Text style={styles.infoText}>
              Use "Clear Wallet Data" to test the first-time user experience
            </Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  header: {
    marginBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 8,
  },
  buttonContainer: {
    gap: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  dangerButton: {
    borderColor: 'rgba(255, 82, 82, 0.3)',
  },
  buttonText: {
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  dangerText: {
    color: '#ff5252',
  },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(255, 167, 38, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 167, 38, 0.3)',
    marginTop: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
  },
});
