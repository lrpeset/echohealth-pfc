import React, { useState, useLayoutEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_URL, MOCK_MODE } from "../config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ClinicalValueInput from "../components/ClinicalValueInput";
import { normalizeConsultation } from "../utils/normalizeConsultation";

function parseFieldRedFlags(redFlags) {
  const flags = new Set();
  if (!redFlags || !Array.isArray(redFlags)) return flags;
  redFlags.forEach((msg) => {
    if (msg.includes("Saturación")) flags.add("oxygenSaturation");
    if (msg.includes("Taquicardia") || msg.includes("Bradicardia")) flags.add("pulse");
    if (msg.includes("Presión arterial")) flags.add("bloodPressure");
  });
  return flags;
}

function buildInitialFields(normalizedData) {
  const initial = {};
  const normFields = normalizedData.fields || [];
  normFields.forEach((fd) => {
    initial[fd.id] = {
      id: fd.id,
      label: fd.label || fd.id,
      type: fd.type || "snomed-text",
      value: fd.value != null ? String(fd.value) : "",
      conceptId: fd.conceptId || null,
      term: fd.term || null,
      semanticTag: fd.semanticTag || null,
      conceptVerified: !!fd.conceptId,
      terminology: fd.terminology || "SNOMED",
    };
  });
  return initial;
}

function resetFields(normalizedData) {
  return buildInitialFields(normalizedData);
}

export default function FormScreen({ route, navigation }) {
  const { data: rawData, isReadOnly = false, consultationId = null } = route.params;

  const [isEditing, setIsEditing] = useState(!isReadOnly);

  const normalizedData = React.useMemo(() => normalizeConsultation(rawData), [rawData]);

  const [fields, setFields] = useState(() => buildInitialFields(normalizedData));

  const [fieldRedFlags] = useState(() => parseFieldRedFlags(normalizedData.redFlags));

  const allFieldIds = Object.keys(fields);

  useLayoutEffect(() => {
    if (isReadOnly && !isEditing) {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity onPress={() => setIsEditing(true)} style={{ marginRight: 20 }}>
            <Ionicons name="create-outline" size={26} color="#4CAF50" />
          </TouchableOpacity>
        ),
        title: "Detalle Clínico",
      });
    } else if (isEditing && isReadOnly) {
      navigation.setOptions({
        headerRight: () => null,
        title: "Editando Historial...",
      });
    }
  }, [navigation, isReadOnly, isEditing]);

  const handleFieldChange = (fieldId, newValue) => {
    setFields((prev) => ({
      ...prev,
      [fieldId]: {
        ...prev[fieldId],
        value: newValue,
      },
    }));
  };

  const hasChanges = () => {
    const original = normalizedData.fields || [];
    return allFieldIds.some((fieldId) => {
      const current = fields[fieldId];
      const originalField = original.find((f) => f.id === fieldId);
      const originalValue = originalField?.value != null ? String(originalField.value) : "";
      return String(current.value) !== originalValue;
    });
  };

  const validateFields = () => {
    for (const fieldId of allFieldIds) {
      const field = fields[fieldId];
      const value = field.value;
      const type = field.type || "snomed-text";

      if (!value || (typeof value === "string" && !value.trim())) {
        continue;
      }

      if (type.endsWith("-number")) {
        const num = parseFloat(value);
        if (isNaN(num)) {
          Alert.alert("Inválido", `El campo "${field.label || fieldId}" debe ser un número válido.`);
          return false;
        }
        if (num < 0) {
          Alert.alert("Inválido", `El campo "${field.label || fieldId}" no puede ser negativo.`);
          return false;
        }
        if (fieldId === "oxygenSaturation" && num > 100) {
          Alert.alert("Fuera de rango", "La saturación de oxígeno debe estar entre 0% y 100%.");
          return false;
        }
        if (fieldId === "painIntensity" && num > 10) {
          Alert.alert("Fuera de rango", "La intensidad del dolor debe estar entre 0 y 10.");
          return false;
        }
      }

      if (fieldId === "bloodPressure" && value.length > 0) {
        if (!/^\d{2,3}\/\d{2,3}$/.test(value)) {
          Alert.alert("Formato inválido", "La presión arterial debe tener el formato: 120/80");
          return false;
        }
      }
    }
    return true;
  };

  const handleSave = () => {
    if (!validateFields()) return;
    if (!hasChanges()) {
      if (isReadOnly) {
        setIsEditing(false);
        return;
      }
      Alert.alert(
        "Seguridad",
        "¿Has revisado que la información es correcta?",
        [
          { text: "Revisar", style: "cancel" },
          { text: "Correcto", onPress: () => finalize() },
        ]
      );
    } else {
      finalize();
    }
  };

  const finalize = async () => {
    const structuredFields = allFieldIds.map((fieldId) => {
      const field = fields[fieldId];
      return {
        id: fieldId,
        label: field.label || fieldId,
        type: field.type || "snomed-text",
        value: field.value || null,
        conceptId: field.conceptId || null,
        term: field.term || null,
        semanticTag: field.semanticTag || null,
        conceptVerified: !!field.conceptId,
        terminology: field.terminology || "SNOMED",
      };
    });

    const payload = {
      fields: structuredFields,
      validatedAt: new Date().toISOString(),
    };

    if (MOCK_MODE) {
      Alert.alert("Modo Mock", "Simulación: Datos enviados correctamente.");
      navigation.popToTop();
      return;
    }

    const method = consultationId ? "PUT" : "POST";
    const endpoint = consultationId
      ? `${API_URL}/api/consultations/${consultationId}`
      : `${API_URL}/api/consultations`;

    try {
      const token = await AsyncStorage.getItem("userToken");
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Error en el servidor");
      Alert.alert(
        "Guardado Correctamente",
        consultationId
          ? "El historial ha sido actualizado."
          : "La nueva consulta ha sido creada.",
        [{ text: "OK", onPress: () => navigation.popToTop() }]
      );
    } catch (error) {
      Alert.alert("Error", "No se pudo conectar con el servidor.");
    }
  };

  const handleCancel = () => {
    setFields(resetFields(normalizedData));
    setIsEditing(false);
  };

  const renderField = (fieldId) => {
    const field = fields[fieldId];
    if (!field) return null;

    return (
      <ClinicalValueInput
        key={fieldId}
        label={field.label || fieldId}
        value={field.value}
        type={field.type || "snomed-text"}
        conceptId={field.conceptId || null}
        term={field.term || null}
        terminology={field.terminology || "SNOMED"}
        onChange={(newValue) => handleFieldChange(fieldId, newValue)}
        editable={isEditing}
        placeholder=""
        redFlag={fieldRedFlags.has(fieldId)}
        fieldId={fieldId}
      />
    );
  };

  if (allFieldIds.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="document-text-outline" size={48} color="#CBD5E1" />
        <Text style={styles.emptyTitle}>Sin campos</Text>
        <Text style={styles.emptySubtitle}>
          No se recibieron campos de la plantilla seleccionada.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.paper}>
          {isReadOnly && (
            <View style={[styles.badgeContainer, isEditing && styles.badgeEditing]}>
              <Ionicons
                name={isEditing ? "pencil" : "document-lock"}
                size={16}
                color={isEditing ? "#FF9800" : "#4CAF50"}
              />
              <Text style={[styles.badgeText, isEditing && { color: "#FF9800" }]}>
                {isEditing ? "MODO EDICIÓN ACTIVADO" : "DOCUMENTO CLÍNICO CERRADO"}
              </Text>
            </View>
          )}

          {allFieldIds.map(renderField)}
        </View>

        {isEditing && (
          <View style={styles.actionContainer}>
            {isReadOnly && (
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color="#FFF"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.saveButtonText}>
                {consultationId ? "Actualizar Historial" : "Validar y Guardar"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  scrollContent: { padding: 20, paddingBottom: 50 },
  paper: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 25,
  },
  badgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 25,
  },
  badgeEditing: {
    backgroundColor: "#FFF3E0",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#4CAF50",
    marginLeft: 6,
  },
  actionContainer: { gap: 12 },
  saveButton: {
    backgroundColor: "#4CAF50",
    flexDirection: "row",
    padding: 18,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
  cancelButton: {
    backgroundColor: "#FFF",
    padding: 18,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cancelButtonText: { color: "#7F8C8D", fontSize: 16, fontWeight: "bold" },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2C3E50",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#7F8C8D",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
});
