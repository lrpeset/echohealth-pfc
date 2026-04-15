import React, { useState, useRef, useLayoutEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function FormScreen({ route, navigation }) {
  const { data, isReadOnly = false, consultationId = null } = route.params;

  const [isEditing, setIsEditing] = useState(!isReadOnly);

  const [reason, setReason] = useState(data?.reasonForVisit || "");
  const [height, setHeight] = useState(data?.height?.toString() || "");
  const [weight, setWeight] = useState(data?.weight?.toString() || "");
  const [pulse, setPulse] = useState(data?.pulse?.toString() || "");

  const reasonRef = useRef();
  const heightRef = useRef();
  const weightRef = useRef();
  const pulseRef = useRef();

  useLayoutEffect(() => {
    if (isReadOnly && !isEditing) {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity
            onPress={() => setIsEditing(true)}
            style={{ marginRight: 20 }}
          >
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

  const hasChanges = () => {
    return (
      reason !== (data?.reasonForVisit || "") ||
      height !== (data?.height?.toString() || "") ||
      weight !== (data?.weight?.toString() || "") ||
      pulse !== (data?.pulse?.toString() || "")
    );
  };

  const handleSave = () => {
    if (!reason.trim()) return Alert.alert("Requerido", "Completa el motivo.");
    if (!height.trim())
      return Alert.alert("Requerido", "La altura es obligatoria.");
    if (!weight.trim())
      return Alert.alert("Requerido", "El peso es obligatorio.");
    if (!pulse.trim())
      return Alert.alert("Requerido", "El pulso es obligatorio.");

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
        ],
      );
    } else {
      finalize();
    }
  };

  const finalize = async () => {
    const finalizedData = {
      reasonForVisit: reason,
      height: parseInt(height),
      weight: parseFloat(weight),
      pulse: parseInt(pulse),
      validatedAt: new Date().toISOString(),
    };

    try {
      const method = consultationId ? "PUT" : "POST";
      const endpoint = consultationId
        ? `${API_URL}/api/consultations/${consultationId}`
        : `${API_URL}/api/consultations`;

      console.log(`Enviando petición ${method} a: ${endpoint}`);

      /* // DESCOMENTAR CUANDO EL BACKEND TENGA EL @PutMapping
      const response = await fetch(endpoint, {
        method: method,
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(finalizedData),
      });

      if (!response.ok) throw new Error("Error en el servidor");
      */

      // Simulación de guardado para el Mock
      Alert.alert(
        "Guardado Correctamente",
        consultationId
          ? "El historial ha sido actualizado."
          : "La nueva consulta ha sido creada.",
        [{ text: "OK", onPress: () => navigation.popToTop() }],
      );
    } catch (error) {
      console.error("Error al guardar:", error);
      Alert.alert("Error", "No se pudo conectar con el servidor.");
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.paper}>
          {isReadOnly && (
            <View
              style={[styles.badgeContainer, isEditing && styles.badgeEditing]}
            >
              <Ionicons
                name={isEditing ? "pencil" : "document-lock"}
                size={16}
                color={isEditing ? "#FF9800" : "#4CAF50"}
              />
              <Text
                style={[styles.badgeText, isEditing && { color: "#FF9800" }]}
              >
                {isEditing
                  ? "MODO EDICIÓN ACTIVADO"
                  : "DOCUMENTO CLÍNICO CERRADO"}
              </Text>
            </View>
          )}

          <Text style={styles.label}>Motivo de la visita</Text>
          <TextInput
            style={[
              styles.input,
              { minHeight: 80 },
              !isEditing && styles.readOnlyInput,
            ]}
            multiline
            value={reason}
            onChangeText={setReason}
            placeholder="Ej: Dolor de garganta..."
            editable={isEditing}
            showsVerticalScrollIndicator={false}
          />

          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.label}>Altura (cm)</Text>
              <TextInput
                style={[styles.input, !isEditing && styles.readOnlyInput]}
                keyboardType="numeric"
                value={height}
                onChangeText={setHeight}
                editable={isEditing}
              />
            </View>
            <View style={styles.spacer} />
            <View style={styles.flex1}>
              <Text style={styles.label}>Peso (kg)</Text>
              <TextInput
                style={[styles.input, !isEditing && styles.readOnlyInput]}
                keyboardType="numeric"
                value={weight}
                onChangeText={setWeight}
                editable={isEditing}
              />
            </View>
          </View>

          <Text style={styles.label}>Pulso (ppm)</Text>
          <TextInput
            style={[styles.input, !isEditing && styles.readOnlyInput]}
            keyboardType="numeric"
            value={pulse}
            onChangeText={setPulse}
            editable={isEditing}
          />
        </View>

        {isEditing && (
          <View style={styles.actionContainer}>
            {isReadOnly && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setReason(data?.reasonForVisit || "");
                  setHeight(data?.height?.toString() || "");
                  setWeight(data?.weight?.toString() || "");
                  setPulse(data?.pulse?.toString() || "");
                  setIsEditing(false);
                }}
              >
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
    </View>
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
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    fontSize: 16,
    color: "#2C3E50",
  },
  readOnlyInput: {
    backgroundColor: "transparent",
    borderWidth: 0,
    padding: 0,
    marginBottom: 25,
    fontSize: 17,
    color: "#2C3E50",
    lineHeight: 24,
  },
  row: { flexDirection: "row" },
  flex1: { flex: 1 },
  spacer: { width: 15 },
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
