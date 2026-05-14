import React, { useState, useRef, useLayoutEffect } from "react";
import {
  View,
  Text,
  TextInput,
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
import SnomedSearchInput from "../components/SnomedSearchInput";
import LoincSearchInput from "../components/LoincSearchInput";
import { normalizeConsultation } from "../utils/normalizeConsultation";

const BASE_FIELD_CONFIG = [
  {
    id: "reasonForVisit",
    label: "Motivo de la visita",
    type: "snomed-text",
    keyboardType: "default",
    required: true,
    placeholder: "Ej: Dolor de garganta, cefalea...",
    defaultConceptId: null,
    terminology: "SNOMED",
  },
  {
    id: "height",
    label: "Altura (cm)",
    type: "loinc-number",
    keyboardType: "numeric",
    required: true,
    placeholder: "175",
    defaultConceptId: "8302-2",
    defaultTerm: "Body height",
    terminology: "LOINC",
  },
  {
    id: "weight",
    label: "Peso (kg)",
    type: "loinc-number",
    keyboardType: "numeric",
    required: true,
    placeholder: "72.5",
    defaultConceptId: "29463-7",
    defaultTerm: "Body weight",
    terminology: "LOINC",
  },
  {
    id: "pulse",
    label: "Pulso (ppm)",
    type: "loinc-number",
    keyboardType: "numeric",
    required: true,
    placeholder: "72",
    defaultConceptId: "8867-4",
    defaultTerm: "Heart rate",
    terminology: "LOINC",
  },
  {
    id: "bloodPressure",
    label: "Presión arterial (mmHg)",
    type: "loinc-text",
    keyboardType: "default",
    required: false,
    placeholder: "Ej: 120/80",
    defaultConceptId: "85354-9",
    defaultTerm: "Blood pressure panel",
    terminology: "LOINC",
  },
  {
    id: "oxygenSaturation",
    label: "Saturación de oxígeno (%)",
    type: "loinc-number",
    keyboardType: "numeric",
    required: false,
    placeholder: "98",
    defaultConceptId: "2708-6",
    defaultTerm: "Oxygen saturation",
    terminology: "LOINC",
  },
  {
    id: "painLocation",
    label: "Localización del dolor",
    type: "snomed-text",
    keyboardType: "default",
    required: false,
    placeholder: "Ej: Lumbar, cervical, abdominal...",
    defaultConceptId: "70163-1",
    defaultTerm: "Body site",
    terminology: "LOINC",
  },
  {
    id: "painNature",
    label: "Naturaleza del dolor",
    type: "snomed-text",
    keyboardType: "default",
    required: false,
    placeholder: "Ej: Punzante, opresivo, quemante...",
    defaultConceptId: "440751004",
    defaultTerm: "Type of pain",
    terminology: "SNOMED",
  },
  {
    id: "painIntensity",
    label: "Intensidad del dolor (0-10)",
    type: "loinc-number",
    keyboardType: "numeric",
    required: false,
    placeholder: "7",
    defaultConceptId: "72514-3",
    defaultTerm: "Pain severity - 0-10",
    terminology: "LOINC",
  },
];

export default function FormScreen({ route, navigation }) {
  const { data: rawData, isReadOnly = false, consultationId = null } = route.params;

  const [isEditing, setIsEditing] = useState(!isReadOnly);

  const normalizedData = React.useMemo(() => normalizeConsultation(rawData), [rawData]);

  const [clinicalFields, setClinicalFields] = useState(() => {
    const initial = {};
    const normFields = normalizedData.fields || [];

    normFields.forEach((fd) => {
      initial[fd.id] = {
        value: fd.value ?? "",
        conceptId: fd.conceptId || null,
        term: fd.term || null,
        type: fd.type || "snomed-text",
        label: fd.label || "",
        semanticTag: fd.semanticTag || null,
        conceptVerified: !!fd.conceptId,
        terminology: fd.terminology || "SNOMED",
      };
    });

    BASE_FIELD_CONFIG.forEach((cfg) => {
      if (!initial[cfg.id]) {
        const legacyValue = normalizedData.content?.[cfg.id] ?? rawData?.[cfg.id];
        initial[cfg.id] = {
          value: legacyValue ?? "",
          conceptId: cfg.defaultConceptId || null,
          term: cfg.defaultTerm || null,
          type: cfg.type,
          label: cfg.label,
          semanticTag: null,
          conceptVerified: false,
          terminology: cfg.terminology || "SNOMED",
        };
      } else {
        initial[cfg.id].label = cfg.label;
        initial[cfg.id].type = cfg.type;
      }
    });

    return initial;
  });

  const fieldRefs = useRef({});

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

  const getConfig = (fieldId) => BASE_FIELD_CONFIG.find((c) => c.id === fieldId);

  const handleFieldChange = (fieldId, update) => {
    setClinicalFields((prev) => ({
      ...prev,
      [fieldId]: {
        ...prev[fieldId],
        ...update,
        conceptVerified: !!update.conceptId,
      },
    }));
  };

  const baseFieldIds = BASE_FIELD_CONFIG.map((c) => c.id);
  const customFieldIds = Object.keys(clinicalFields).filter(
    (id) => !baseFieldIds.includes(id)
  );
  const allFieldIds = [...baseFieldIds, ...customFieldIds];

  const hasChanges = () => {
    const originalFields = normalizedData.fields || [];
    return Object.keys(clinicalFields).some((fieldId) => {
      const currentValue = clinicalFields[fieldId]?.value;
      const originalField = originalFields.find((f) => f.id === fieldId);
      const legacyValue = normalizedData.content?.[fieldId] ?? rawData?.[fieldId];
      const originalValue = originalField?.value ?? legacyValue ?? "";
      return String(currentValue) !== String(originalValue);
    });
  };

  const validateFields = () => {
    for (const cfg of BASE_FIELD_CONFIG) {
      const value = clinicalFields[cfg.id]?.value;
      const fieldValue = value ?? "";

      if (cfg.required) {
        if (!fieldValue || (typeof fieldValue === "string" && !fieldValue.trim())) {
          Alert.alert("Requerido", `El campo "${cfg.label}" es obligatorio.`);
          return false;
        }
      }

      if (!fieldValue || (typeof fieldValue === "string" && !fieldValue.trim())) {
        continue;
      }

      const raw = typeof fieldValue === "string" ? fieldValue.trim() : String(fieldValue);

      if (cfg.type === "loinc-number" || cfg.type === "snomed-number") {
        const numValue = parseFloat(raw);
        if (isNaN(numValue) || numValue < 0) {
          Alert.alert("Inválido", `El campo "${cfg.label}" debe ser un número válido.`);
          return false;
        }

        if (cfg.id === "oxygenSaturation" && (numValue < 0 || numValue > 100)) {
          Alert.alert("Fuera de rango", `La saturación de oxígeno debe estar entre 0% y 100%.`);
          return false;
        }

        if (cfg.id === "painIntensity" && (numValue < 0 || numValue > 10)) {
          Alert.alert("Fuera de rango", `La intensidad del dolor debe estar entre 0 y 10.`);
          return false;
        }

        if (cfg.required && numValue <= 0) {
          Alert.alert("Inválido", `El campo "${cfg.label}" debe ser un número positivo.`);
          return false;
        }
      }

      if (cfg.id === "bloodPressure" && raw.length > 0) {
        const bpRegex = /^\d{2,3}\/\d{2,3}$/;
        if (!bpRegex.test(raw)) {
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
    const structuredFields = Object.entries(clinicalFields).map(
      ([fieldId, field]) => ({
        id: fieldId,
        label: field.label,
        type: field.type,
        value: field.value,
        conceptId: field.conceptId || null,
        term: field.term || null,
        semanticTag: field.semanticTag || null,
        conceptVerified: field.conceptVerified,
        terminology: field.terminology || "SNOMED",
      })
    );

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
      console.log(`Enviando petición ${method} a: ${endpoint}`);
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
      console.error("Error al guardar:", error);
      Alert.alert("Error", "No se pudo conectar con el servidor.");
    }
  };

  const handleCancel = () => {
    const reset = {};
    const normFields = normalizedData.fields || [];
    normFields.forEach((fd) => {
      reset[fd.id] = {
        value: fd.value ?? "",
        conceptId: fd.conceptId || null,
        term: fd.term || null,
        type: fd.type || "snomed-text",
        label: fd.label || "",
        semanticTag: fd.semanticTag || null,
        conceptVerified: !!fd.conceptId,
        terminology: fd.terminology || "SNOMED",
      };
    });
    BASE_FIELD_CONFIG.forEach((cfg) => {
      if (!reset[cfg.id]) {
        const legacyValue = normalizedData.content?.[cfg.id] ?? rawData?.[cfg.id];
        reset[cfg.id] = {
          value: legacyValue ?? "",
          conceptId: cfg.defaultConceptId || null,
          term: cfg.defaultTerm || null,
          type: cfg.type,
          label: cfg.label,
          semanticTag: null,
          conceptVerified: !!cfg.defaultConceptId,
        };
      }
    });
    setClinicalFields(reset);
    setIsEditing(false);
  };

  const renderField = (fieldId) => {
    const field = clinicalFields[fieldId];
    if (!field) return null;

    const cfg = getConfig(fieldId);
    const label = cfg?.label || field.label || fieldId;
    const fieldType = cfg?.type || field.type || "snomed-text";
    const isTerminologyField = fieldType.startsWith("snomed-") || fieldType.startsWith("loinc-");
    const terminology = field.terminology || (fieldType.startsWith("loinc-") ? "LOINC" : "SNOMED");
    const required = cfg?.required || false;
    const placeholder = cfg?.placeholder || "";

    if (isTerminologyField && isEditing) {
      const SearchComponent = terminology === "LOINC" ? LoincSearchInput : SnomedSearchInput;
      return (
        <SearchComponent
          key={fieldId}
          label={label}
          value={field.value}
          conceptId={field.conceptId}
          term={field.term}
          onSelect={(result) =>
            handleFieldChange(fieldId, {
              value: result.value,
              conceptId: result.conceptId,
              term: result.term,
              semanticTag: result.semanticTag,
              terminology: result.system || terminology,
            })
          }
          editable={isEditing}
          keyboardType={fieldType === "snomed-number" || fieldType === "loinc-number" ? "numeric" : "default"}
          placeholder={placeholder}
          required={required}
        />
      );
    }

    if (isTerminologyField && !isEditing) {
      const isLoinc = terminology === "LOINC";
      return (
        <View key={fieldId} style={styles.staticField}>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.staticValueContainer}>
            <Text style={styles.staticValue}>{field.value || "-"}</Text>
            {field.conceptId && (
              <View style={isLoinc ? styles.verifiedBadgeStaticLoinc : styles.verifiedBadgeStatic}>
                <Ionicons name="checkmark-circle" size={14} color={isLoinc ? "#1565C0" : "#4CAF50"} />
                <Text style={[styles.verifiedTextStatic, isLoinc && { color: "#1565C0" }]}>
                  {terminology}: {field.conceptId}
                </Text>
              </View>
            )}
          </View>
        </View>
      );
    }

    return null;
  };

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
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7F8C8D",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  staticField: {
    marginBottom: 20,
  },
  staticValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  staticValue: {
    fontSize: 17,
    color: "#2C3E50",
    lineHeight: 24,
  },
  verifiedBadgeStatic: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedBadgeStaticLoinc: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedTextStatic: {
    fontSize: 10,
    color: "#4CAF50",
    fontWeight: "600",
    marginLeft: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
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
});
