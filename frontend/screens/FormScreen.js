import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Button,
  Alert,
} from "react-native";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function FormScreen({ route, navigation }) {
  const { data, isReadOnly = false } = route.params;

  const [reason, setReason] = useState(data?.reasonForVisit || "");
  const [height, setHeight] = useState(data?.height?.toString() || "");
  const [weight, setWeight] = useState(data?.weight?.toString() || "");
  const [pulse, setPulse] = useState(data?.pulse?.toString() || "");

  const reasonRef = useRef();
  const heightRef = useRef();
  const weightRef = useRef();
  const pulseRef = useRef();

  const hasChanges = () => {
    return (
      reason !== (data?.reasonForVisit || "") ||
      height !== (data?.height?.toString() || "") ||
      weight !== (data?.weight?.toString() || "") ||
      pulse !== (data?.pulse?.toString() || "")
    );
  };

  const handleSave = () => {
    if (!reason.trim()) {
      Alert.alert(
        "Campo requerido",
        "Por favor, completa el motivo de la visita."
      );
      reasonRef.current.focus();
      return;
    }
    if (!height.trim()) {
      Alert.alert("Campo requerido", "La altura es obligatoria.");
      heightRef.current.focus();
      return;
    }
    if (!weight.trim()) {
      Alert.alert("Campo requerido", "El peso es obligatorio.");
      weightRef.current.focus();
      return;
    }
    if (!pulse.trim()) {
      Alert.alert("Campo requerido", "El pulso es obligatorio.");
      pulseRef.current.focus();
      return;
    }

    if (!hasChanges()) {
      Alert.alert(
        "Verificación de seguridad",
        "No has realizado ninguna modificación en los datos extraídos por la IA. ¿Has revisado que toda la información es correcta?",
        [
          { text: "Revisar de nuevo", style: "cancel" },
          { text: "Sí, es correcto", onPress: () => finalize() },
        ]
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
      validatedAt: new Date().toISOString()
    };

    try {
      console.log("Enviando datos finales al backend...");
      
      const response = await fetch(`${API_URL}/api/consultations`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: JSON.stringify(finalizedData),
      });

      if (response.ok) {
        Alert.alert(
          "Guardado", 
          "La consulta se ha persistido en la base de datos correctamente.",
          [{ text: "OK", onPress: () => navigation.popToTop() }]
        );
      } else {
        throw new Error("Error en la respuesta del servidor");
      }
    } catch (error) {
      console.error("Error al guardar:", error);
      Alert.alert("Error", "No se pudo conectar con el servidor para guardar.");
    }
  };

  return (
    <ScrollView style={styles.container}>
      {isReadOnly && (
        <View style={styles.readOnlyBadge}>
          <Text style={styles.readOnlyText}>HISTORIAL CLÍNICO</Text>
        </View>
      )}

      <Text style={styles.label}>Motivo de la visita:</Text>
      <TextInput
        ref={reasonRef}
        style={[styles.input, { height: 100 }, isReadOnly && styles.readOnlyInput]}
        multiline
        value={reason}
        onChangeText={setReason}
        placeholder="Ej: Dolor de garganta..."
        editable={!isReadOnly}
      />

      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text style={styles.label}>Altura (cm):</Text>
          <TextInput
            ref={heightRef}
            style={[styles.input, isReadOnly && styles.readOnlyInput]}
            keyboardType="numeric"
            value={height}
            onChangeText={setHeight}
            placeholder="170"
            editable={!isReadOnly}
          />
        </View>
        <View style={styles.flex1}>
          <Text style={styles.label}>Peso (kg):</Text>
          <TextInput
            ref={weightRef}
            style={[styles.input, isReadOnly && styles.readOnlyInput]}
            keyboardType="numeric"
            value={weight}
            onChangeText={setWeight}
            placeholder="70"
            editable={!isReadOnly}
          />
        </View>
      </View>

      <Text style={styles.label}>Pulso (ppm):</Text>
      <TextInput
        ref={pulseRef}
        style={[styles.input, isReadOnly && styles.readOnlyInput]}
        keyboardType="numeric"
        value={pulse}
        onChangeText={setPulse}
        placeholder="80"
        editable={!isReadOnly}
      />

      {!isReadOnly && (
        <View style={{ marginTop: 30, marginBottom: 50 }}>
          <Button
            title="Validar y Guardar"
            onPress={handleSave}
            color="#4CAF50"
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  label: { fontSize: 14, fontWeight: "bold", marginBottom: 5, color: "#333" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
    fontSize: 16,
    color: "#000",
  },
  readOnlyInput: {
    backgroundColor: "#f0f0f0",
    color: "#555",
    borderColor: "transparent",
  },
  readOnlyBadge: {
    backgroundColor: "#e0e0e0",
    padding: 8,
    borderRadius: 5,
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  readOnlyText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#555",
  },
  row: { flexDirection: "row", gap: 10 },
  flex1: { flex: 1 },
});