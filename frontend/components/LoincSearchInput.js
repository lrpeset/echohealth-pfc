import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../config";

export default function LoincSearchInput({
  label,
  value,
  conceptId,
  term,
  onSelect,
  editable = true,
  keyboardType = "default",
  placeholder,
  required = false,
}) {
  const [query, setQuery] = useState(value || term || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  const hasConcept = !!conceptId;

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (showResults && inputRef.current) {
      inputRef.current.measureInWindow((x, y, width) => {
        setDropdownPos({ top: y + (Platform.OS === "ios" ? 50 : 55), left: x, width: width || 300 });
      });
    }
  }, [showResults]);

  const handleTextChange = (text) => {
    setQuery(text);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!editable) return;

    debounceRef.current = setTimeout(() => {
      if (text.length >= 2) {
        setShowResults(true);
        searchTerminology(text);
      } else {
        setResults([]);
        setShowResults(false);
      }
    }, 400);
  };

  const searchTerminology = async (searchTerm) => {
    if (!API_URL) {
      console.warn("API_URL not configured");
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("userToken");
      const response = await fetch(
        `${API_URL}/api/terminology/search?q=${encodeURIComponent(searchTerm)}&system=LOINC`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setResults(data || []);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error("LOINC search error:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item) => {
    console.log("Payload LOINC:", item);
    inputRef.current?.blur();
    onSelect({
      value: item.term,
      conceptId: item.conceptId,
      term: item.term,
      semanticTag: item.semanticTag || null,
      system: "LOINC",
    });
    setQuery("");
    setResults([]);
    setShowResults(false);
    Keyboard.dismiss();
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setShowResults(false);
    onSelect({
      value: "",
      conceptId: null,
      term: null,
      semanticTag: null,
      system: "LOINC",
    });
  };

  const renderResultItem = (item, index) => (
    <TouchableOpacity
      key={item.conceptId || index}
      style={styles.resultItem}
      onPress={() => handleSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.resultContent}>
        <View style={styles.conceptIdContainer}>
          <Text style={styles.conceptId}>{item.conceptId}</Text>
        </View>
        <Text style={styles.resultTerm} numberOfLines={2}>
          {item.term}
        </Text>
        <View style={styles.systemBadgeLoinc}>
          <Text style={styles.systemBadgeText}>{item.system || "LOINC"}</Text>
        </View>
        {item.active && (
          <Ionicons name="checkmark-circle" size={16} color="#4CAF50" style={{ marginLeft: 6 }} />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <View style={styles.labelContainer}>
          <Text style={styles.label}>{label}</Text>
          {required && <Text style={styles.required}>*</Text>}
          {hasConcept && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#1565C0" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>

        <View style={[styles.inputWrapper, hasConcept && styles.inputVerified]}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={query}
            onChangeText={handleTextChange}
            editable={editable}
            placeholder={placeholder || "Busca tests, escalas o medidas..."}
            placeholderTextColor="#9CA3AF"
            keyboardType={keyboardType}
            onFocus={() => {
              if (results.length > 0) setShowResults(true);
            }}
          />

          <View style={styles.inputIcons}>
            {loading && (
              <ActivityIndicator size="small" color="#1565C0" style={styles.loader} />
            )}
            {!loading && editable && query.length > 0 && (
              <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
            {!loading && !editable && hasConcept && (
              <Ionicons name="medical" size={18} color="#1565C0" style={styles.medicalIcon} />
            )}
          </View>
        </View>

        {hasConcept && (
          <View style={styles.conceptInfo}>
            <Text style={styles.conceptInfoLabel}>LOINC:</Text>
            <Text style={styles.conceptInfoValue}>{conceptId}</Text>
          </View>
        )}
      </View>

      <Modal transparent visible={showResults && results.length > 0 && editable} animationType="none" onRequestClose={() => setShowResults(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => { setShowResults(false); Keyboard.dismiss(); }}>
          <View style={[styles.resultsContainer, { top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }]}>
            <ScrollView
              style={styles.resultsScroll}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              onScrollBeginDrag={() => Keyboard.dismiss()}
            >
              {results.map((item, index) => renderResultItem(item, index))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    zIndex: 1000,
    marginBottom: 16,
  },
  container: {
    marginBottom: 0,
  },
  labelContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7F8C8D",
    textTransform: "uppercase",
  },
  required: {
    color: "#E74C3C",
    marginLeft: 4,
    fontSize: 14,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 10,
  },
  verifiedText: {
    fontSize: 10,
    color: "#1565C0",
    fontWeight: "600",
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 15,
  },
  inputVerified: {
    borderColor: "#1565C0",
    borderWidth: 2,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: "#2C3E50",
  },
  inputIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loader: {
    marginRight: 4,
  },
  medicalIcon: {
    marginRight: 4,
  },
  clearButton: {
    padding: 2,
  },
  conceptInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    paddingHorizontal: 4,
  },
  conceptInfoLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    marginRight: 4,
  },
  conceptInfoValue: {
    fontSize: 11,
    color: "#1565C0",
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  backdrop: {
    flex: 1,
  },
  resultsContainer: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    maxHeight: 250,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 8,
    zIndex: 10000,
  },
  resultsScroll: {
    maxHeight: 250,
  },
  resultItem: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    backgroundColor: "#FFFFFF",
  },
  resultContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  conceptIdContainer: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
  },
  conceptId: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  resultTerm: {
    flex: 1,
    fontSize: 14,
    color: "#2C3E50",
  },
  systemBadgeLoinc: {
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  systemBadgeText: {
    fontSize: 9,
    color: "#2C3E50",
    fontWeight: "700",
  },
});
