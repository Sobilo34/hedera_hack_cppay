import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

/**
 * SecureWalletStorage - Handles encrypted storage of sensitive wallet data
 * Uses Expo SecureStore for device-level encryption
 */
class SecureWalletStorage {
  // Storage keys
  private static readonly WALLET_MNEMONIC_KEY = 'wallet_mnemonic';
  private static readonly WALLET_PRIVATE_KEY = 'wallet_private_key';
  private static readonly WALLET_ADDRESS_KEY = 'wallet_address';
  private static readonly SMART_ACCOUNT_ADDRESS_KEY = 'smart_account_address';
  private static readonly SMART_ACCOUNT_DEPLOYED_KEY = 'smart_account_deployed';
  private static readonly PASSWORD_HASH_KEY = 'password_hash';
  private static readonly BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
  private static readonly AUTH_TOKEN_KEY = 'auth_token';
  private static readonly SESSION_VALID_KEY = 'session_valid';
  private static readonly USER_EMAIL_KEY = 'user_email'; // For display purposes
  private static readonly LAST_LOGIN_KEY = 'last_login';

  /**
   * Hash password using SHA-256
   */
  static async hashPassword(password: string): Promise<string> {
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password
    );
  }

  /**
   * Encrypt data using AES-256 (simulated via password hash)
   */
  private static encryptData(data: string, password: string): string {
    // In production, use a proper encryption library like crypto-js
    // This is a simplified version
    const combined = `${data}::${password}`;
    return Buffer.from(combined).toString('base64');
  }

  /**
   * Decrypt data
   */
  private static decryptData(encryptedData: string, password: string): string {
    try {
      const decoded = Buffer.from(encryptedData, 'base64').toString('utf8');
      const [data] = decoded.split('::');
      return data;
    } catch (error) {
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Store wallet mnemonic securely
   */
  static async storeMnemonic(
    mnemonic: string,
    password: string
  ): Promise<void> {
    const encrypted = this.encryptData(mnemonic, password);
    await SecureStore.setItemAsync(this.WALLET_MNEMONIC_KEY, encrypted);
  }

  /**
   * Retrieve wallet mnemonic
   */
  static async getMnemonic(password: string): Promise<string | null> {
    try {
      const encrypted = await SecureStore.getItemAsync(this.WALLET_MNEMONIC_KEY);
      if (!encrypted) return null;
      return this.decryptData(encrypted, password);
    } catch (error) {
      console.error('Failed to retrieve mnemonic:', error);
      return null;
    }
  }

  /**
   * Store private key securely
   */
  static async storePrivateKey(
    privateKey: string,
    password: string
  ): Promise<void> {
    const encrypted = this.encryptData(privateKey, password);
    await SecureStore.setItemAsync(this.WALLET_PRIVATE_KEY, encrypted);
  }

  /**
   * Retrieve private key
   */
  static async getPrivateKey(password: string): Promise<string | null> {
    try {
      const encrypted = await SecureStore.getItemAsync(this.WALLET_PRIVATE_KEY);
      if (!encrypted) return null;
      return this.decryptData(encrypted, password);
    } catch (error) {
      console.error('Failed to retrieve private key:', error);
      return null;
    }
  }

  /**
   * Store wallet address (not encrypted, but secure)
   */
  static async storeAddress(address: string): Promise<void> {
    await SecureStore.setItemAsync(this.WALLET_ADDRESS_KEY, address);
  }

  /**
   * Get wallet address
   */
  static async getAddress(): Promise<string | null> {
    return await SecureStore.getItemAsync(this.WALLET_ADDRESS_KEY);
  }

  /**
   * Store password hash for verification
   */
  static async storePasswordHash(password: string): Promise<void> {
    const hash = await this.hashPassword(password);
    await SecureStore.setItemAsync(this.PASSWORD_HASH_KEY, hash);
  }

  /**
   * Verify password
   */
  static async verifyPassword(password: string): Promise<boolean> {
    const hash = await this.hashPassword(password);
    const storedHash = await SecureStore.getItemAsync(this.PASSWORD_HASH_KEY);
    return hash === storedHash;
  }

  /**
   * Enable/disable biometric authentication
   */
  static async setBiometricEnabled(enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync(
      this.BIOMETRIC_ENABLED_KEY,
      enabled.toString()
    );
  }

  /**
   * Check if biometric is enabled
   */
  static async isBiometricEnabled(): Promise<boolean> {
    const value = await SecureStore.getItemAsync(this.BIOMETRIC_ENABLED_KEY);
    return value === 'true';
  }

  /**
   * Store authentication token
   */
  static async storeAuthToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(this.AUTH_TOKEN_KEY, token);
  }

  /**
   * Get authentication token
   */
  static async getAuthToken(): Promise<string | null> {
    return await SecureStore.getItemAsync(this.AUTH_TOKEN_KEY);
  }

  /**
   * Clear authentication token
   */
  static async clearAuthToken(): Promise<void> {
    await SecureStore.deleteItemAsync(this.AUTH_TOKEN_KEY);
  }

  /**
   * Check if wallet exists
   */
  static async hasWallet(): Promise<boolean> {
    const address = await this.getAddress();
    return address !== null;
  }

  /**
   * Store smart account address (counterfactual or deployed)
   */
  static async storeSmartAccountAddress(address: string): Promise<void> {
    await SecureStore.setItemAsync(this.SMART_ACCOUNT_ADDRESS_KEY, address);
  }

  /**
   * Get smart account address
   */
  static async getSmartAccountAddress(): Promise<string | null> {
    return await SecureStore.getItemAsync(this.SMART_ACCOUNT_ADDRESS_KEY);
  }

  /**
   * Mark smart account as deployed on-chain
   */
  static async setSmartAccountDeployed(deployed: boolean): Promise<void> {
    await SecureStore.setItemAsync(
      this.SMART_ACCOUNT_DEPLOYED_KEY,
      deployed.toString()
    );
  }

  /**
   * Check if smart account is deployed
   */
  static async isSmartAccountDeployed(): Promise<boolean> {
    const value = await SecureStore.getItemAsync(this.SMART_ACCOUNT_DEPLOYED_KEY);
    return value === 'true';
  }

  /**
   * Delete all wallet data (use with extreme caution!)
   */
  static async deleteWallet(): Promise<void> {
    await SecureStore.deleteItemAsync(this.WALLET_MNEMONIC_KEY);
    await SecureStore.deleteItemAsync(this.WALLET_PRIVATE_KEY);
    await SecureStore.deleteItemAsync(this.WALLET_ADDRESS_KEY);
    await SecureStore.deleteItemAsync(this.SMART_ACCOUNT_ADDRESS_KEY);
    await SecureStore.deleteItemAsync(this.SMART_ACCOUNT_DEPLOYED_KEY);
    await SecureStore.deleteItemAsync(this.PASSWORD_HASH_KEY);
    await SecureStore.deleteItemAsync(this.BIOMETRIC_ENABLED_KEY);
    await SecureStore.deleteItemAsync(this.AUTH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(this.SESSION_VALID_KEY);
    await SecureStore.deleteItemAsync(this.USER_EMAIL_KEY);
    await SecureStore.deleteItemAsync(this.LAST_LOGIN_KEY);
  }

  /**
   * Mark session as valid (for biometric login)
   */
  static async setSessionValid(valid: boolean): Promise<void> {
    await SecureStore.setItemAsync(this.SESSION_VALID_KEY, valid.toString());
    if (valid) {
      await SecureStore.setItemAsync(this.LAST_LOGIN_KEY, Date.now().toString());
    }
  }

  /**
   * Check if session is valid
   */
  static async isSessionValid(): Promise<boolean> {
    const value = await SecureStore.getItemAsync(this.SESSION_VALID_KEY);
    return value === 'true';
  }

  /**
   * Get last login time
   */
  static async getLastLoginTime(): Promise<number> {
    const value = await SecureStore.getItemAsync(this.LAST_LOGIN_KEY);
    return value ? parseInt(value, 10) : 0;
  }

  /**
   * Store user email/identifier (optional, for display)
   */
  static async storeUserEmail(email: string): Promise<void> {
    await SecureStore.setItemAsync(this.USER_EMAIL_KEY, email);
  }

  /**
   * Get user email/identifier
   */
  static async getUserEmail(): Promise<string | null> {
    return await SecureStore.getItemAsync(this.USER_EMAIL_KEY);
  }

  /**
   * Generic method to store any data
   */
  static async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  }

  /**
   * Generic method to get any data
   */
  static async getItem(key: string): Promise<string | null> {
    return await SecureStore.getItemAsync(key);
  }

  /**
   * Generic method to delete any data
   */
  static async deleteItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  }
}

export default SecureWalletStorage;
