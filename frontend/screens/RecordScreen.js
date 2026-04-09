import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Audio } from "expo-av";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function RecordScreen({ navigation }) {
  const [recording, setRecording] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(newRecording);
    } catch (err) {
      console.error("Error al empezar a grabar:", err);
    }
  }

  async function stopRecording() {
    if (!recording) return;

    console.log("Deteniendo grabación...");
    setIsProcessing(true);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      console.log("Grabación guardada en el móvil en:", uri);

      setRecording(undefined);

      await uploadAudio(uri);
    } catch (error) {
      console.error("Error al detener la grabación:", error);
      setIsProcessing(false);
    }
  }

  async function uploadAudio(uri) {
    if (!API_URL) {
      Alert.alert("Error", "Falta la variable de entorno en el archivo .env");
      setIsProcessing(false);
      return;
    }

    const formData = new FormData();
    formData.append("file", {
      uri: uri,
      name: "audio_paciente.m4a",
      type: "audio/m4a",
    });

    try {
      console.log(`Enviando POST a: ${API_URL}/api/audio/upload`);

      const response = await fetch(`${API_URL}/api/audio/upload`, {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const result = await response.json();
      console.log("Respuesta de Spring Boot:", result);

      if (result.error) {
        throw new Error(result.error);
      }

      setIsProcessing(false);
      Alert.alert(
        "¡Audio Analizado!",
        "La IA ha extraído los datos correctamente.",
      );

      navigation.navigate("Form", { data: result });
    } catch (error) {
      console.error("Error en el Fetch:", error);
      Alert.alert("Error", error.message || "No se pudo procesar el audio.");
      setIsProcessing(false);
    }
  }

  return (
    <View style={styles.container}>
      {isProcessing ? (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.text}>Enviando a Java...</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.button,
            recording ? styles.buttonStop : styles.buttonStart,
          ]}
          onPress={recording ? stopRecording : startRecording}
        >
          <Text style={styles.buttonText}>
            {recording ? "PARAR" : "GRABAR"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  processingContainer: {
    alignItems: "center",
  },
  button: {
    width: 150,
    height: 150,
    borderRadius: 75,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonStart: { backgroundColor: "#4CAF50" },
  buttonStop: { backgroundColor: "#F44336" },
  buttonText: { color: "white", fontWeight: "bold", fontSize: 20 },
  text: { marginTop: 20, fontSize: 16, color: "#666", fontWeight: "600" },
});
