import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Audio } from "expo-av";

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
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(recording);
    } catch (err) {
      console.error("Error al grabar", err);
    }
  }

  async function stopRecording() {
    setRecording(undefined);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    processAudio(uri);
  }

  async function processAudio(uri) {
    setIsProcessing(true);

    setTimeout(() => {
      const mockData = {
        reasonForVisit: "Dolor lumbar persistente tras cargar peso.",
        height: 180,
        weight: 85.5,
        pulse: 72,
      };
      setIsProcessing(false);
      navigation.navigate("Form", { data: mockData });
    }, 3000);
  }

  return (
    <View style={styles.container}>
      {isProcessing ? (
        <View>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.text}>IA Analizando el audio...</Text>
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
  button: {
    width: 150,
    height: 150,
    borderRadius: 75,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },
  buttonStart: { backgroundColor: "#4CAF50" },
  buttonStop: { backgroundColor: "#F44336" },
  buttonText: { color: "white", fontWeight: "bold", fontSize: 20 },
  text: { marginTop: 20, fontSize: 16, color: "#666" },
});
