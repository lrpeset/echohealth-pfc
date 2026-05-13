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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../config";

export default function SnomedSearchInput({
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
  const [isFocused, setIsFocused] = useState(false);
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

  const handleTextChange = (text) => {
    setQuery(text);
    setShowResults(true);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!editable) return;

    debounceRef.current = setTimeout(() => {
      if (text.length >= 2) {
        searchSnomed(text);
      } else {
        setResults([]);
      }
    }, 400);
  };

  const searchSnomed = async (searchTerm) => {
    if (!API_URL) {
      console.warn("API_URL not configured");
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("userToken");
      const response = await fetch(
        `${API_URL}/api/terminology/search?q=${encodeURIComponent(searchTerm)}`,
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
        if (data && data.length > 0) {
          Keyboard.dismiss();
        }
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error("SNOMED search error:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item) => {
    setQuery(item.term);
    setShowResults(false);
    Keyboard.dismiss();
    onSelect({
      value: item.term,
      conceptId: item.conceptId,
      term: item.term,
      active: item.active,
      semanticTag: item.semanticTag || null,
    });
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
        {item.active && (
          <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>{label}</Text>
        {required && <Text style={styles.required}>*</Text>}
        {hasConcept && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={12} color="#4CAF50" />
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
          placeholder={placeholder || "Buscar término médico..."}
          placeholderTextColor="#9CA3AF"
          keyboardType={keyboardType}
          onFocus={() => {
            setIsFocused(true);
            if (results.length > 0) setShowResults(true);
          }}
          onBlur={() => {
            setTimeout(() => {
              setIsFocused(false);
              setShowResults(false);
            }, 200);
          }}
        />

        <View style={styles.inputIcons}>
          {loading && (
            <ActivityIndicator size="small" color="#4CAF50" style={styles.loader} />
          )}
          {!loading && hasConcept && (
            <Ionicons name="medical" size={18} color="#4CAF50" style={styles.medicalIcon} />
          )}
          {!loading && editable && query.length > 0 && (
            <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {hasConcept && (
        <View style={styles.conceptInfo}>
          <Text style={styles.conceptInfoLabel}>SNOMED CT:</Text>
          <Text style={styles.conceptInfoValue}>{conceptId}</Text>
        </View>
      )}

      {showResults && results.length > 0 && editable && (
        <View style={styles.resultsContainer}>
          <View style={styles.resultsList}>
            {results.map((item, index) => renderResultItem(item, index))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    zIndex: 9999,
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
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 10,
  },
  verifiedText: {
    fontSize: 10,
    color: "#4CAF50",
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
    borderColor: "#4CAF50",
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
    color: "#4CAF50",
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  resultsContainer: {
    position: "absolute",
    top: 70,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    maxHeight: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 9999,
  },
  resultsList: {
    maxHeight: 200,
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
  emptyResult: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    color: "#9CA3AF",
    fontSize: 14,
  },
});