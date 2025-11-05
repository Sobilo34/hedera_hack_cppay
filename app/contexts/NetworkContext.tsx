/**
 * Network Context
 * Manages current network selection, testnet/mainnet toggle, and selected token
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Network, Token, DEFAULT_NETWORKS, DEFAULT_TOKENS, getNetworkByChainId } from '@/constants/Tokens';

interface NetworkContextType {
  currentNetwork: Network;
  setCurrentNetwork: (network: Network) => void;
  isTestnet: boolean;
  toggleTestnet: () => void;
  selectedToken: Token;
  setSelectedToken: (token: Token) => void;
  availableNetworks: Network[];
  addCustomNetwork: (network: Network) => void;
  removeCustomNetwork: (chainId: number) => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

const NETWORK_STORAGE_KEY = 'cppay_selected_network';
const TOKEN_STORAGE_KEY = 'cppay_selected_token';
const TESTNET_STORAGE_KEY = 'cppay_is_testnet';

interface NetworkProviderProps {
  children: ReactNode;
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({ children }) => {
  const [currentNetwork, setCurrentNetworkState] = useState<Network>(DEFAULT_NETWORKS[0]); // Default to Ethereum
  const [isTestnet, setIsTestnet] = useState<boolean>(false);
  const [selectedToken, setSelectedTokenState] = useState<Token>(DEFAULT_TOKENS[0]); // Default to cNGN
  const [customNetworks, setCustomNetworks] = useState<Network[]>([]);

  // Load saved preferences on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const savedNetworkId = await SecureStore.getItemAsync(NETWORK_STORAGE_KEY);
      const savedTokenSymbol = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
      const savedTestnetMode = await SecureStore.getItemAsync(TESTNET_STORAGE_KEY);

      // Load testnet mode
      if (savedTestnetMode === 'true' || savedTestnetMode === 'false') {
        setIsTestnet(savedTestnetMode === 'true');
      }

      // Load network
      if (savedNetworkId) {
        const network = getNetworkByChainId(parseInt(savedNetworkId));
        if (network) {
          setCurrentNetworkState(network);
        }
      }

      // Load token
      if (savedTokenSymbol) {
        const token = DEFAULT_TOKENS.find(t => t.symbol === savedTokenSymbol);
        if (token) {
          setSelectedTokenState(token);
        }
      }
    } catch (error) {
      console.error('Error loading network preferences:', error);
    }
  };

  const setCurrentNetwork = async (network: Network) => {
    setCurrentNetworkState(network);
    try {
      await SecureStore.setItemAsync(NETWORK_STORAGE_KEY, network.chainId.toString());
    } catch (error) {
      console.error('Error saving network preference:', error);
    }
  };

  const toggleTestnet = async () => {
    const newTestnetMode = !isTestnet;
    setIsTestnet(newTestnetMode);
    
    try {
      await SecureStore.setItemAsync(TESTNET_STORAGE_KEY, newTestnetMode.toString());
      
      // Switch to equivalent testnet/mainnet
      if (newTestnetMode) {
        // Switch to testnet
        if (currentNetwork.chainId === 1) {
          const sepoliaNetwork = DEFAULT_NETWORKS.find(n => n.chainId === 11155111);
          if (sepoliaNetwork) setCurrentNetworkState(sepoliaNetwork);
        } else if (currentNetwork.chainId === 1135) {
          const liskTestnet = DEFAULT_NETWORKS.find(n => n.chainId === 4202);
          if (liskTestnet) setCurrentNetworkState(liskTestnet);
        }
      } else {
        // Switch to mainnet
        if (currentNetwork.chainId === 11155111) {
          const ethMainnet = DEFAULT_NETWORKS.find(n => n.chainId === 1);
          if (ethMainnet) setCurrentNetworkState(ethMainnet);
        } else if (currentNetwork.chainId === 4202) {
          const liskMainnet = DEFAULT_NETWORKS.find(n => n.chainId === 1135);
          if (liskMainnet) setCurrentNetworkState(liskMainnet);
        }
      }
    } catch (error) {
      console.error('Error toggling testnet mode:', error);
    }
  };

  const setSelectedToken = async (token: Token) => {
    setSelectedTokenState(token);
    try {
      await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token.symbol);
    } catch (error) {
      console.error('Error saving token preference:', error);
    }
  };

  const addCustomNetwork = (network: Network) => {
    setCustomNetworks(prev => [...prev, { ...network, isCustom: true }]);
  };

  const removeCustomNetwork = (chainId: number) => {
    setCustomNetworks(prev => prev.filter(n => n.chainId !== chainId));
  };

  // Show ALL networks (both mainnet and testnet) at once
  // Networks are grouped by testnet flag in the UI
  const availableNetworks = [
    ...DEFAULT_NETWORKS.filter(n => !n.isTestnet), // Mainnets first
    ...DEFAULT_NETWORKS.filter(n => n.isTestnet),  // Then testnets
    ...customNetworks, // Custom networks last
  ];

  return (
    <NetworkContext.Provider
      value={{
        currentNetwork,
        setCurrentNetwork,
        isTestnet,
        toggleTestnet,
        selectedToken,
        setSelectedToken,
        availableNetworks,
        addCustomNetwork,
        removeCustomNetwork,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = (): NetworkContextType => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};