import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

  const hasAllFieldsEmpty = (result) => {
    if (!result.fields || !Array.isArray(result.fields)) {
      return false;
    }
    return result.fields.every(field => field.value === null || field.value === undefined);
  };

  async function uploadAudio(uri) {
    if (!API_URL) {
      Alert.alert("Error", "Falta la variable de entorno en el archivo .env");
      setIsProcessing(false);
      return;
    }

    const configJson = await AsyncStorage.getItem("@form_config");
    let customConfig = [];
    try {
      if (configJson) customConfig = JSON.parse(configJson);
    } catch (_e) {}

    const formData = new FormData();
    formData.append("file", {
      uri: uri,
      name: "audio_paciente.m4a",
      type: "audio/m4a",
    });
    customConfig.forEach((field) => {
      if (field.term && field.conceptId) {
        formData.append("targetFields", `${field.conceptId}|${field.term}`);
      }
    });

    try {
      console.log(`📤 Enviando POST a: ${API_URL}/api/audio/upload`);
      if (customConfig.length > 0) {
        console.log(`🎯 Campos personalizados incluidos: ${customConfig.map(f => `${f.term} (${f.conceptId})`).join(", ")}`);
      }

      const token = await AsyncStorage.getItem("userToken");

      const response = await fetch(`${API_URL}/api/audio/upload`, {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data",
          "Authorization": `Bearer ${token}`
        },
      });

      const result = await response.json();
      
      console.log("📥 Respuesta recibida del backend:", JSON.stringify(result, null, 2));

      if (result.error) {
        console.error("❌ Error en respuesta de Gemini:", result.error);
        throw new Error(result.error);
      }

      if (result.fields && Array.isArray(result.fields)) {
        console.log("✅ Formato estructurado recibido - Campos:", result.fields.length);
        
        const allEmpty = hasAllFieldsEmpty(result);
        
        result.fields.forEach((field, index) => {
          console.log(`   [${index}] ${field.id}: ${field.value} (SNOMED: ${field.conceptId || 'N/A'})`);
        });

        if (allEmpty) {
          console.warn("⚠️ Todos los campos están vacíos - Modo fallback detectado");
          setIsProcessing(false);
          
          Alert.alert(
            "Atención: Datos no extraídos",
            "La IA no pudo extraer los datos con claridad. Por favor, rellena el formulario manualmente.",
            [
              { 
                text: "OK", 
                onPress: () => {
                  console.log("🔄 Navegando a FormScreen (fallback):", JSON.stringify({ data: result }, null, 2));
                  navigation.navigate("Form", { data: result });
                }
              }
            ]
          );
          return;
        } else {
          console.log("✅ Datos clínicos extraídos exitosamente");
        }
      } else {
        console.warn("⚠️ Formato legacy o inesperado recibido");
        console.warn("   keys:", Object.keys(result));
      }

      setIsProcessing(false);
      Alert.alert(
        "¡Audio Analizado!",
        "La IA ha extraído los datos correctamente.",
      );

      console.log("🔄 Navegando a FormScreen con datos:", JSON.stringify({ data: result }, null, 2));
      navigation.navigate("Form", { data: result });
    } catch (error) {
      console.error("❌ Error en el Fetch:", error);
      Alert.alert("Error", error.message || "No se pudo procesar el audio.");
      setIsProcessing(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <Text style={styles.title}>
          {isProcessing
            ? "Analizando audio..."
            : recording
              ? "Escuchando..."
              : "Listo para grabar"}
        </Text>
        <Text style={styles.subtitle}>
          {isProcessing
            ? "Nuestra IA está extrayendo los datos clínicos."
            : "Habla con naturalidad. La IA filtrará la información relevante."}
        </Text>
      </View>

      <View style={styles.centerSection}>
        {isProcessing ? (
          <View style={styles.processingCircle}>
            <ActivityIndicator size="large" color="#4CAF50" />
          </View>
        ) : (
          <View style={[styles.outerRing, recording && styles.outerRingActive]}>
            <TouchableOpacity
              style={[
                styles.recordButton,
                recording && styles.recordButtonActive,
              ]}
              onPress={recording ? stopRecording : startRecording}
              activeOpacity={0.8}
            >
              {!recording && <Ionicons name="mic" size={40} color="#FFF" />}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.bottomSection}>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  topSection: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 30,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#7F8C8D",
    textAlign: "center",
    lineHeight: 22,
  },

  centerSection: { flex: 1.5, justifyContent: "center", alignItems: "center" },

  outerRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 5,
  },
  outerRingActive: { borderColor: "#FFCDD2" },
  recordButton: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#F44336",
    justifyContent: "center",
    alignItems: "center",
  },
  recordButtonActive: {
    width: 50,
    height: 50,
    borderRadius: 10,
  },

  processingCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 5,
  },
  bottomSection: { flex: 1 },
});