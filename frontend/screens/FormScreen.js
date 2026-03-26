import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Button,
  Alert,
} from "react-native";

export default function FormScreen({ route, navigation }) {
  const { data } = route.params;

  const [reason, setReason] = useState(data.reasonForVisit);
  const [height, setHeight] = useState(data.height.toString());
  const [weight, setWeight] = useState(data.weight.toString());
  const [pulse, setPulse] = useState(data.pulse.toString());

  const handleSave = () => {
    Alert.alert(
      "Éxito",
      "Historia clínica validada y lista para enviar al backend.",
    );
    navigation.popToTop(); // Volver al inicio
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>Motivo de la visita:</Text>
      <TextInput
        style={[styles.input, { height: 100 }]}
        multiline
        value={reason}
        onChangeText={setReason}
      />

      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text style={styles.label}>Altura (cm):</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={height}
            onChangeText={setHeight}
          />
        </View>
        <View style={styles.flex1}>
          <Text style={styles.label}>Peso (kg):</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={weight}
            onChangeText={setWeight}
          />
        </View>
      </View>

      <Text style={styles.label}>Pulso (ppm):</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={pulse}
        onChangeText={setPulse}
      />

      <View style={{ marginTop: 30 }}>
        <Button
          title="Validar y Guardar"
          onPress={handleSave}
          color="#2196F3"
        />
      </View>
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
  },
  row: { flexDirection: "row", gap: 10 },
  flex1: { flex: 1 },
});
