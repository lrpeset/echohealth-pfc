import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const FIELD_RANGES = {
  height: { min: 0, max: 250, unit: "cm", label: "Altura" },
  weight: { min: 0, max: 300, unit: "kg", label: "Peso" },
  pulse: { min: 0, max: 220, unit: "ppm", label: "Pulso" },
  oxygenSaturation: { min: 0, max: 100, unit: "%", label: "Saturación de oxígeno" },
  painIntensity: { min: 0, max: 10, unit: "", label: "Intensidad del dolor" },
};

function getFieldRange(fieldId) {
  return FIELD_RANGES[fieldId] || null;
}

function validateValue(value, type, fieldId) {
  if (!value || (typeof value === "string" && !value.trim())) {
    return null;
  }

  const raw = typeof value === "string" ? value.trim() : String(value);
  const isNumeric = type && type.endsWith("-number");

  if (isNumeric) {
    const num = parseFloat(raw);
    if (isNaN(num)) {
      return "Debe ser un número válido";
    }
    if (num < 0) {
      return "El valor no puede ser negativo";
    }
    const range = getFieldRange(fieldId);
    if (range) {
      if (num > range.max) {
        return `El máximo permitido es ${range.max}${range.unit ? " " + range.unit : ""}`;
      }
    }
  }

  if (fieldId === "bloodPressure" && raw.length > 0) {
    if (!/^\d{2,3}\/\d{2,3}$/.test(raw)) {
      return "Formato requerido: 120/80";
    }
  }

  return null;
}

export default function ClinicalValueInput({
  label,
  value,
  type,
  conceptId,
  term,
  terminology,
  onChange,
  editable = true,
  required = false,
  placeholder,
  redFlag = false,
  fieldId,
}) {
  const [localValue, setLocalValue] = useState(value != null ? String(value) : "");
  const [touched, setTouched] = useState(false);

  const isNumeric = type && type.endsWith("-number");
  const hasConcept = !!conceptId;
  const isLoinc = terminology === "LOINC";
  const badgeColor = isLoinc ? "#1565C0" : "#4CAF50";
  const badgeBg = isLoinc ? "#E3F2FD" : "#E8F5E9";

  const displayValue = localValue;

  const error = touched ? validateValue(displayValue, type, fieldId) : null;
  const showError = touched && error;
  const showRedFlag = redFlag && !error;

  const handleChangeText = useCallback((text) => {
    setLocalValue(text);
    setTouched(true);
    if (onChange) {
      if (isNumeric) {
        const cleaned = text.replace(/[^0-9.]/g, "");
        if (cleaned !== text) {
          setLocalValue(cleaned);
          if (onChange) onChange(cleaned);
          return;
        }
      }
      onChange(text);
    }
  }, [onChange, isNumeric]);

  const handleBlur = useCallback(() => {
    setTouched(true);
  }, []);

  const getBorderColor = () => {
    if (showRedFlag) return "#F44336";
    if (showError) return "#E74C3C";
    if (hasConcept) return badgeColor;
    return "#E2E8F0";
  };

  const getBorderWidth = () => {
    if (showRedFlag || showError || hasConcept) return 2;
    return 1;
  };

  const inputKeyboardType = isNumeric ? "numeric" : "default";

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>{label}</Text>
        {required && <Text style={styles.required}>*</Text>}
        {hasConcept && (
          <View style={[styles.verifiedBadge, { backgroundColor: badgeBg }]}>
            <Ionicons name="checkmark-circle" size={12} color={badgeColor} />
            <Text style={[styles.verifiedText, { color: badgeColor }]}>Verified</Text>
          </View>
        )}
        {redFlag && (
          <View style={styles.redFlagBadge}>
            <Ionicons name="warning" size={12} color="#FFF" />
            <Text style={styles.redFlagText}>Alerta</Text>
          </View>
        )}
      </View>

      <View
        style={[
          styles.inputWrapper,
          {
            borderColor: getBorderColor(),
            borderWidth: getBorderWidth(),
          },
          !editable && styles.inputDisabled,
        ]}
      >
        <TextInput
          style={styles.input}
          value={displayValue}
          onChangeText={handleChangeText}
          onBlur={handleBlur}
          editable={editable}
          placeholder={placeholder || (isNumeric ? "0" : "")}
          placeholderTextColor="#9CA3AF"
          keyboardType={inputKeyboardType}
        />
      </View>

      {showRedFlag && (
        <View style={styles.redFlagContainer}>
          <Ionicons name="warning" size={14} color="#F44336" />
          <Text style={styles.redFlagMessage}>Alerta clínica — revisa este valor</Text>
        </View>
      )}

      {showError && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {hasConcept && (
        <View style={styles.conceptInfo}>
          <Text style={[styles.conceptInfoLabel, { color: badgeColor }]}>
            {terminology}:
          </Text>
          <Text style={[styles.conceptInfoValue, { color: badgeColor }]}>
            {conceptId}{term ? ` · ${term}` : ""}
          </Text>
        </View>
      )}

      {isNumeric && !hasConcept && (
        <View style={styles.typeHint}>
          <Ionicons name="code-working" size={12} color="#9CA3AF" />
          <Text style={styles.typeHintText}>
            Campo numérico{getFieldRange(fieldId) ? ` (${getFieldRange(fieldId).min}-${getFieldRange(fieldId).max}${getFieldRange(fieldId).unit ? " " + getFieldRange(fieldId).unit : ""})` : ""}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 20,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 10,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: "600",
    marginLeft: 4,
  },
  redFlagBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F44336",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 10,
  },
  redFlagText: {
    fontSize: 10,
    color: "#FFF",
    fontWeight: "700",
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 15,
  },
  inputDisabled: {
    backgroundColor: "#F1F5F9",
    opacity: 0.8,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: "#2C3E50",
  },
  redFlagContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    paddingHorizontal: 4,
  },
  redFlagMessage: {
    fontSize: 12,
    color: "#F44336",
    fontWeight: "600",
    marginLeft: 6,
  },
  errorText: {
    fontSize: 12,
    color: "#E74C3C",
    marginTop: 6,
    paddingHorizontal: 4,
    fontWeight: "500",
  },
  conceptInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    paddingHorizontal: 4,
  },
  conceptInfoLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginRight: 4,
  },
  conceptInfoValue: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  typeHint: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    paddingHorizontal: 4,
  },
  typeHintText: {
    fontSize: 10,
    color: "#9CA3AF",
    marginLeft: 4,
  },
});
