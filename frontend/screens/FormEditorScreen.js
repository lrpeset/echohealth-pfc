import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import SnomedSearchInput from "../components/SnomedSearchInput";

const STORAGE_KEY = "@form_config";

const BUILT_IN_FIELDS = [
  { id: "reasonForVisit", label: "Motivo de la visita", type: "snomed-text", required: true, removable: false },
  { id: "height", label: "Altura (cm)", type: "snomed-number", required: true, removable: false },
  { id: "weight", label: "Peso (kg)", type: "snomed-number", required: true, removable: false },
  { id: "pulse", label: "Pulso (ppm)", type: "snomed-number", required: true, removable: false },
];

export default function FormEditorScreen() {
  const [customFields, setCustomFields] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadConfig();
    }, [])
  );

  const loadConfig = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setCustomFields(JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Error loading form config:", e);
    }
  };

  const saveConfig = async (fields) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fields));
    } catch (e) {
      console.warn("Error saving form config:", e);
    }
  };

  const handleSelectConcept = (result) => {
    if (!result.conceptId) return;

    const newField = {
      id: `custom_${Date.now()}`,
      label: result.term,
      type: "snomed-text",
      value: null,
      conceptId: result.conceptId,
      term: result.term,
      semanticTag: result.semanticTag || null,
      snomedVerified: true,
      removable: true,
    };

    const updated = [...customFields, newField];
    setCustomFields(updated);
    saveConfig(updated);
  };

  const removeField = (index) => {
    const updated = customFields.filter((_, i) => i !== index);
    setCustomFields(updated);
    saveConfig(updated);
  };

  const resetConfig = () => {
    Alert.alert(
      "Restablecer configuración",
      "¿Eliminar todos los campos personalizados?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Restablecer",
          style: "destructive",
          onPress: () => {
            setCustomFields([]);
            saveConfig([]);
          },
        },
      ]
    );
  };

  const renderCustomField = ({ item, index }) => (
    <View style={styles.fieldCard}>
      <View style={styles.fieldHeader}>
        <View style={styles.fieldInfo}>
          <Ionicons name="pulse-outline" size={18} color="#4CAF50" />
          <Text style={styles.fieldTerm}>{item.term || item.label}</Text>
          {item.semanticTag && (
            <View style={styles.semanticBadge}>
              <Text style={styles.semanticText}>{item.semanticTag}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => removeField(index)} style={styles.removeBtn}>
          <Ionicons name="close-circle" size={22} color="#E74C3C" />
        </TouchableOpacity>
      </View>
      <View style={styles.fieldMeta}>
        <Text style={styles.metaText}>SNOMED CT: {item.conceptId}</Text>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Campos obligatorios</Text>
        <Text style={styles.sectionDesc}>
          Estos campos siempre se extraen del audio de la consulta.
        </Text>
        {BUILT_IN_FIELDS.map((f) => (
          <View key={f.id} style={styles.builtinRow}>
            <Ionicons name="lock-closed" size={16} color="#90A4AE" />
            <Text style={styles.builtinText}>{f.label}</Text>
            <View style={styles.builtinType}>
              <Text style={styles.builtinTypeText}>{f.type}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Añadir concepto SNOMED</Text>
        <Text style={styles.sectionDesc}>
          Busca y selecciona conceptos clínicos adicionales que quieras que la IA
          extraiga automáticamente.
        </Text>
        <SnomedSearchInput
          label="Buscar concepto SNOMED"
          value=""
          conceptId={null}
          term={null}
          onSelect={handleSelectConcept}
          editable={true}
          placeholder="Ej: dolor abdominal, alergia, trauma..."
        />
      </View>

      {customFields.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              Campos personalizados ({customFields.length})
            </Text>
            <TouchableOpacity onPress={resetConfig}>
              <Text style={styles.resetText}>Restablecer</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={customFields}
            keyExtractor={(item, i) => `${item.conceptId}_${i}`}
            renderItem={renderCustomField}
            scrollEnabled={false}
          />
        </View>
      )}

      {customFields.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="flask-outline" size={48} color="#CFD8DC" />
          <Text style={styles.emptyTitle}>Sin campos personalizados</Text>
          <Text style={styles.emptyDesc}>
            Usa el buscador de arriba para añadir conceptos SNOMED que la IA
            deberá extraer del audio además de los campos estándar.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  content: { padding: 20, paddingBottom: 50 },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2C3E50",
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    color: "#7F8C8D",
    marginBottom: 16,
    lineHeight: 18,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  resetText: {
    fontSize: 13,
    color: "#E74C3C",
    fontWeight: "600",
  },
  builtinRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  builtinText: {
    flex: 1,
    fontSize: 14,
    color: "#546E7A",
    marginLeft: 10,
  },
  builtinType: {
    backgroundColor: "#ECEFF1",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  builtinTypeText: {
    fontSize: 10,
    color: "#78909C",
    fontWeight: "600",
  },
  fieldCard: {
    backgroundColor: "#F8FFFE",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E0F2F1",
  },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  fieldTerm: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2C3E50",
    flexShrink: 1,
  },
  semanticBadge: {
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  semanticText: {
    fontSize: 9,
    color: "#1565C0",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  removeBtn: { padding: 4 },
  fieldMeta: {
    marginTop: 6,
    paddingLeft: 26,
  },
  metaText: {
    fontSize: 11,
    color: "#90A4AE",
    fontFamily: "monospace",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#90A4AE",
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 13,
    color: "#B0BEC5",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});
