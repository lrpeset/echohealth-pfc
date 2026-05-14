import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
} from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function RecordScreen({ navigation }) {
  const [recording, setRecording] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const token = await AsyncStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/api/forms`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTemplates(data || []);

        const savedId = await AsyncStorage.getItem("@selected_template");
        if (savedId) {
          const found = (data || []).find((t) => t.id === savedId);
          if (found) setSelectedTemplate(found);
        }
      }
    } catch (e) {
      console.warn("Error fetching templates:", e);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleSelectTemplate = async (template) => {
    setSelectedTemplate(template);
    setShowPicker(false);
    if (template) {
      await AsyncStorage.setItem("@selected_template", template.id);
    }
  };

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

    const token = await AsyncStorage.getItem("userToken");
    const template = selectedTemplate;
    const templateName = template?.name || "Consulta General";
    let customConfig = [];

    if (template?.fields) {
      customConfig = template.fields;
    }

    if (customConfig.length === 0) {
      const configJson = await AsyncStorage.getItem("@form_config");
      try {
        if (configJson) {
          customConfig = JSON.parse(configJson);
        }
      } catch (_e) {}
    }

    if (customConfig.length === 0) {
      try {
        const formsRes = await fetch(`${API_URL}/api/forms`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (formsRes.ok) {
          const forms = await formsRes.json();
          const defaultForm = forms.find((f) => f.name === "Consulta General") || forms[0];
          if (defaultForm) {
            templateName = defaultForm.name;
            customConfig = (defaultForm.fields || []);
          }
        }
      } catch (_e) {}
    }

    if (customConfig.length > 0) {
      console.log(`Usando plantilla: ${templateName} (${customConfig.length} campos)`);
    }

    const formData = new FormData();
    formData.append("file", {
      uri: uri,
      name: "audio_paciente.m4a",
      type: "audio/m4a",
    });
    customConfig.forEach((field) => {
      const system = field.terminology || "SNOMED";
      const conceptId = field.conceptId || "";
      const term = field.term || "";
      const fieldId = field.id || `custom_${conceptId.replace(/[^a-zA-Z0-9_]/g, "_")}` || "unknown";
      const fieldLabel = field.label || term || fieldId || "unknown";
      const fieldType = field.type || "snomed-text";
      formData.append("targetFields", `${fieldId}|${fieldLabel}|${conceptId}|${term}|${system}|${fieldType}`);
    });

    try {
      console.log(`Enviando POST a: ${API_URL}/api/audio/upload`);
      const targetFieldsLog = customConfig
        .map(f => `${f.id || "custom_" + (f.conceptId || "unknown").replace(/[^a-zA-Z0-9_]/g, "_")}|${f.label || f.term || f.id || "unknown"}|${f.conceptId || ""}|${f.term || ""}|${f.terminology || "SNOMED"}|${f.type || "snomed-text"}`);
      if (targetFieldsLog.length > 0) {
        console.log(`targetFields enviados: [${targetFieldsLog.join(", ")}]`);
      }

      const response = await fetch(`${API_URL}/api/audio/upload`, {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data",
          "Authorization": `Bearer ${token}`
        },
      });

      const result = await response.json();

      console.log("Respuesta recibida del backend:", JSON.stringify(result, null, 2));

      if (result.error) {
        console.error("Error en respuesta de Gemini:", result.error);
        throw new Error(result.error);
      }

      if (result.fields && Array.isArray(result.fields)) {
        console.log("Formato estructurado recibido - Campos:", result.fields.length);

        const allEmpty = hasAllFieldsEmpty(result);

        result.fields.forEach((field, index) => {
          console.log(`   [${index}] ${field.id}: ${field.value} (SNOMED: ${field.conceptId || 'N/A'})`);
        });

        if (allEmpty) {
          console.warn("Todos los campos están vacíos - Modo fallback detectado");
          setIsProcessing(false);

          Alert.alert(
            "Atención: Datos no extraídos",
            "La IA no pudo extraer los datos con claridad. Por favor, rellena el formulario manualmente.",
            [
              {
                text: "OK",
                onPress: () => {
                  console.log("Navegando a FormScreen (fallback):", JSON.stringify({ data: result }, null, 2));
                  navigation.navigate("Form", { data: result });
                }
              }
            ]
          );
          return;
        } else {
          console.log("Datos clínicos extraídos exitosamente");
        }

        if (result.redFlags && result.redFlags.length > 0) {
          console.warn("Red flags clínicas detectadas por el backend:", result.redFlags);
        }
      } else {
        console.warn("Formato legacy o inesperado recibido");
        console.warn("   keys:", Object.keys(result));
      }

      setIsProcessing(false);

      if (result.redFlags && result.redFlags.length > 0) {
        Alert.alert(
          "⚠️ Alerta Clínica",
          result.redFlags.join("\n\n"),
          [
            {
              text: "Revisar",
              style: "cancel",
            },
            {
              text: "Continuar",
              onPress: () => {
                console.log("Navegando a FormScreen con red flags:", JSON.stringify({ data: result }, null, 2));
                navigation.navigate("Form", { data: result });
              },
            },
          ]
        );
      } else {
        Alert.alert(
          "¡Audio Analizado!",
          "La IA ha extraído los datos correctamente.",
        );

        console.log("Navegando a FormScreen con datos:", JSON.stringify({ data: result }, null, 2));
        navigation.navigate("Form", { data: result });
      }
    } catch (error) {
      console.error("Error en el Fetch:", error);
      Alert.alert("Error", error.message || "No se pudo procesar el audio.");
      setIsProcessing(false);
    }
  }

  const getFieldSummary = (t) => {
    if (!t?.fields) return "0 campos";
    const count = t.fields.filter(f => f.id !== "reasonForVisit").length;
    return `${count} campo${count !== 1 ? "s" : ""}`;
  };

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
        {loadingTemplates ? (
          <ActivityIndicator size="small" color="#4CAF50" />
        ) : (
          <View style={styles.templateSelector}>
            <Text style={styles.templateLabel}>Seleccione protocolo de consulta</Text>
            <TouchableOpacity
              style={styles.templateDropdown}
              onPress={() => setShowPicker(true)}
              activeOpacity={0.7}
            >
              <View style={styles.templateDropdownLeft}>
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color={selectedTemplate ? "#4CAF50" : "#CBD5E1"}
                  style={{ marginRight: 10 }}
                />
                <Text style={[styles.templateText, !selectedTemplate && styles.templatePlaceholder]}>
                  {selectedTemplate ? selectedTemplate.name : "Elegir plantilla..."}
                </Text>
              </View>
              <View style={styles.templateDropdownRight}>
                {selectedTemplate && (
                  <Text style={styles.templateBadge}>{getFieldSummary(selectedTemplate)}</Text>
                )}
                <Ionicons name="chevron-down" size={20} color="#90A4AE" style={{ marginLeft: 6 }} />
              </View>
            </TouchableOpacity>
          </View>
        )}

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

      <View style={styles.bottomSection} />

      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>Seleccionar protocolo</Text>
            <ScrollView style={styles.pickerList}>
              {templates.map((t) => {
                const isSelected = selectedTemplate?.id === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.pickerOption, isSelected && styles.pickerOptionSelected]}
                    onPress={() => handleSelectTemplate(t)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.pickerOptionLeft}>
                      <Ionicons
                        name={isSelected ? "radio-button-on" : "radio-button-off"}
                        size={20}
                        color={isSelected ? "#4CAF50" : "#CBD5E1"}
                      />
                      <View style={styles.pickerOptionInfo}>
                        <Text style={styles.pickerOptionName}>{t.name}</Text>
                        <Text style={styles.pickerOptionMeta}>{getFieldSummary(t)}</Text>
                      </View>
                    </View>
                    {t.userId === "system" && (
                      <View style={styles.systemBadge}>
                        <Text style={styles.systemBadgeText}>Demo</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.pickerCancel} onPress={() => setShowPicker(false)}>
              <Text style={styles.pickerCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
    paddingBottom: 20,
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

  centerSection: { flex: 2, justifyContent: "center", alignItems: "center" },

  templateSelector: {
    width: "85%",
    marginBottom: 30,
  },
  templateLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7F8C8D",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 2,
  },
  templateDropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  templateDropdownLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  templateDropdownRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  templateText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2C3E50",
  },
  templatePlaceholder: {
    color: "#CBD5E1",
    fontWeight: "400",
  },
  templateBadge: {
    fontSize: 11,
    color: "#4CAF50",
    fontWeight: "700",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },

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

  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 8,
    maxHeight: "60%",
  },
  pickerHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#D1D5DB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2C3E50",
    marginBottom: 16,
    textAlign: "center",
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  pickerOptionSelected: {
    backgroundColor: "#F0FDF4",
  },
  pickerOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  pickerOptionInfo: {
    marginLeft: 12,
  },
  pickerOptionName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2C3E50",
  },
  pickerOptionMeta: {
    fontSize: 12,
    color: "#90A4AE",
    marginTop: 2,
  },
  systemBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  systemBadgeText: {
    fontSize: 10,
    color: "#4CAF50",
    fontWeight: "700",
  },
  pickerCancel: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
  },
  pickerCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#90A4AE",
  },
});
