import React from "react";
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  TextInput,
  ActionSheetIOS,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import ThemedInput from "@/components/ThemedInput";
import { spacing, borderRadius } from "@/constants/Typography";

type Option = { key: string; label: string };

type Props = {
  options: Option[];
  value?: string;
  placeholder?: string;
  onSelect: (option: Option) => void;
  label?: string;
  searchable?: boolean;
  useActionSheetOnIOS?: boolean;
};

export default function SelectInput({
  options,
  value,
  placeholder = "Select",
  onSelect,
  label,
  searchable = false,
  useActionSheetOnIOS = true,
}: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!query) return options;
    return options.filter((o) =>
      o.label.toLowerCase().includes(query.toLowerCase())
    );
  }, [options, query]);

  const renderItem = ({ item }: { item: Option }) => (
    <TouchableOpacity
      style={[styles.option, { borderBottomColor: colors.divider + "20" }]}
      onPress={() => {
        onSelect(item);
        setOpen(false);
      }}
    >
      <Text style={{ color: colors.textPrimary }}>{item.label}</Text>
    </TouchableOpacity>
  );

  return (
    <>
      {label && (
        <Text style={{ color: colors.textSecondary, marginBottom: 6 }}>
          {label}
        </Text>
      )}
      <ThemedInput
        pressable
        onPress={() => {
          if (
            Platform.OS === "ios" &&
            useActionSheetOnIOS &&
            options.length <= 6
          ) {
            ActionSheetIOS.showActionSheetWithOptions(
              {
                options: [...options.map((o) => o.label), "Cancel"],
                cancelButtonIndex: options.length,
              },
              (index) => {
                if (index >= 0 && index < options.length) {
                  onSelect(options[index]);
                }
              }
            );
            return;
          }
          setOpen(true);
        }}
      >
        <Text
          style={{ color: value ? colors.textPrimary : colors.textSecondary }}
        >
          {value || placeholder}
        </Text>
      </ThemedInput>

      <Modal
        visible={open}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPressOut={() => setOpen(false)}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.cardBackground },
            ]}
          >
            {searchable && (
              <TextInput
                placeholder="Search..."
                placeholderTextColor={colors.textSecondary}
                value={query}
                onChangeText={setQuery}
                style={{
                  backgroundColor: colors.cardBackground,
                  borderWidth: 1,
                  borderColor: colors.divider + "20",
                  borderRadius: 8,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  color: colors.textPrimary,
                  marginBottom: spacing.sm,
                }}
              />
            )}
            <FlatList
              data={filtered}
              keyExtractor={(i) => i.key}
              renderItem={renderItem}
              ItemSeparatorComponent={() => (
                <View
                  style={{ height: 1, backgroundColor: colors.divider + "10" }}
                />
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    maxHeight: Platform.OS === "ios" ? 360 : 420,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.md,
  },
  option: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
});
