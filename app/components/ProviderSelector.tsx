import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface ProviderSelectorProps {
  selected: string;
  onSelect: (provider: string) => void;
  providers: string[];
}

export function ProviderSelector({
  selected,
  onSelect,
  providers,
}: ProviderSelectorProps) {
  const providerIcons: Record<string, string> = {
    MTN: 'alpha-m-circle',
    GLO: 'alpha-g-circle',
    AIRTEL: 'alpha-a-circle',
    '9MOBILE': 'numeric-9-circle',
  };

  const providerColors: Record<string, string> = {
    MTN: '#FFCC00',
    GLO: '#00CC66',
    AIRTEL: '#CC0000',
    '9MOBILE': '#006600',
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Select Provider</Text>
      <View style={styles.providersRow}>
        {providers.map((provider) => (
          <TouchableOpacity
            key={provider}
            style={[
              styles.providerButton,
              selected === provider && styles.providerButtonSelected,
              { borderColor: providerColors[provider] || '#DDD' },
            ]}
            onPress={() => onSelect(provider)}
          >
            <MaterialCommunityIcons
              name={providerIcons[provider] as any}
              size={32}
              color={providerColors[provider] || '#666'}
            />
            <Text style={styles.providerText}>{provider}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  providersRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 12,
  },
  providerButton: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#DDD',
    backgroundColor: '#FFF',
    minWidth: 80,
  },
  providerButtonSelected: {
    backgroundColor: '#F0F0F0',
    borderWidth: 3,
  },
  providerText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
});
