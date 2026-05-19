import React, { useState, useEffect, useLayoutEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  FlatList,
  Modal,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import SnomedSearchInput from "../components/SnomedSearchInput";
import LoincSearchInput from "../components/LoincSearchInput";
import { API_URL } from "../config";

const TERMINOLOGY_OPTIONS = ["SNOMED", "LOINC"];

const BUILT_IN_FIELDS = [
  {
    id: "reasonForVisit",
    label: "Motivo de la visita",
    type: "snomed-text",
    required: true,
    removable: false,
  },
];

export default function FormEditorScreen({ route, navigation }) {
  const templateId = route?.params?.templateId || null;
  const [templateName, setTemplateName] = useState("");
  const [customFields, setCustomFields] = useState([]);
  const [activeSystem, setActiveSystem] = useState("SNOMED");
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: templateId ? "Editar plantilla" : "Nueva plantilla",
    });
  }, [templateId]);

  useEffect(() => {
    if (templateId) {
      loadTemplate(templateId);
    }
  }, [templateId]);

  const loadTemplate = async (id) => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/api/forms/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTemplateName(data.name || "");
        const loaded = (data.fields || []).filter(
          (f) => !BUILT_IN_FIELDS.find((b) => b.id === f.id),
        );
        setCustomFields(loaded);
      }
    } catch (e) {
      console.warn("Error loading template:", e);
    }
  };

  const handleSelectConcept = (result) => {
    console.log("Recibido en el Editor:", result);
    if (!result.conceptId) {
      console.warn("Editor: conceptId es nulo, ignorando selección");
      return;
    }

    const system = result.system || activeSystem;
    const isLoinc = system === "LOINC";
    const fieldType = isLoinc ? "loinc-text" : "snomed-text";

    const cleanConceptId = result.conceptId.replace(/[^a-zA-Z0-9_]/g, "_");
    const fieldId = `custom_${cleanConceptId}`;

    const newField = {
      id: fieldId,
      label: result.term,
      type: fieldType,
      value: null,
      conceptId: result.conceptId,
      term: result.term,
      semanticTag: result.semanticTag || null,
      conceptVerified: !isLoinc,
      terminology: system,
      required: false,
      removable: true,
    };

    console.log("Campo añadido con ID estable:", fieldId);
    setCustomFields((prev) => [...prev, newField]);
  };

  const removeField = (index) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!templateName.trim()) {
      Alert.alert("Nombre requerido", "La plantilla debe tener un nombre.");
      return;
    }

    const allFields = [
      {
        id: "reasonForVisit",
        label: "Motivo de la visita",
        type: "snomed-text",
        conceptId: null,
        term: null,
        semanticTag: null,
        conceptVerified: false,
        terminology: "SNOMED",
        required: true,
        removable: false,
      },
      ...customFields.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        conceptId: f.conceptId || null,
        term: f.term || null,
        semanticTag: f.semanticTag || null,
        conceptVerified: f.conceptVerified || false,
        terminology: f.terminology || "SNOMED",
        required: false,
        removable: true,
      })),
    ];

    const payload = {
      id: templateId || undefined,
      name: templateName.trim(),
      description: `Plantilla con ${allFields.length} campos clínicos`,
      fields: allFields,
    };

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/api/forms`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        Alert.alert("Guardado", "Plantilla guardada correctamente.", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      } else {
        throw new Error("Error al guardar");
      }
    } catch (e) {
      Alert.alert("Error", "No se pudo guardar la plantilla.");
      console.error("Save error:", e);
    } finally {
      setSaving(false);
    }
  };

  const renderCustomField = ({ item, index }) => {
    const terminology = item.terminology || "SNOMED";
    const isLoinc = terminology === "LOINC";

    return (
      <View style={styles.fieldCard}>
        <View style={styles.fieldHeader}>
          <View style={styles.fieldInfo}>
            <Ionicons name="pulse-outline" size={18} color="#4CAF50" />
            <Text style={styles.fieldTerm}>{item.term || item.label}</Text>
            <View
              style={
                isLoinc ? styles.systemBadgeLoinc : styles.systemBadgeSnomed
              }
            >
              <Text style={styles.systemBadgeText}>{terminology}</Text>
            </View>
            {item.semanticTag && (
              <View style={styles.semanticBadge}>
                <Text style={styles.semanticText}>{item.semanticTag}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={() => removeField(index)}
            style={styles.removeBtn}
          >
            <Ionicons name="close-circle" size={22} color="#E74C3C" />
          </TouchableOpacity>
        </View>
        <View style={styles.fieldMeta}>
          <Text style={styles.metaText}>
            {terminology}: {item.conceptId}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nombre de la plantilla</Text>
        <TextInput
          style={styles.nameInput}
          value={templateName}
          onChangeText={setTemplateName}
          placeholder="Ej: Consulta General, Fisioterapia, Pediátrica..."
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Campo obligatorio</Text>
        <Text style={styles.sectionDesc}>
          Solo el motivo de la visita es obligatorio. Añade campos clínicos
          adicionales según necesites.
        </Text>
        <View style={styles.builtinRow}>
          <Ionicons name="lock-closed" size={16} color="#90A4AE" />
          <Text style={styles.builtinText}>Motivo de la visita</Text>
          <View style={styles.builtinType}>
            <Text style={styles.builtinTypeText}>snomed-text</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.terminologyHeader}>
          <Text style={styles.sectionTitle}>Seleccionar terminología</Text>
          <TouchableOpacity
            onPress={() => setShowInfoModal(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="information-circle-outline"
              size={22}
              color="#90A4AE"
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionDesc}>
          Elige la terminología para el campo que vas a añadir.
        </Text>
        <View style={styles.segmentedControl}>
          {TERMINOLOGY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[
                styles.segmentOption,
                activeSystem === opt && styles.segmentOptionActive,
              ]}
              onPress={() => setActiveSystem(opt)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.segmentText,
                  activeSystem === opt && styles.segmentTextActive,
                ]}
              >
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Añadir concepto {activeSystem === "LOINC" ? "LOINC" : "SNOMED"}
        </Text>
        <Text style={styles.sectionDesc}>
          Busca y selecciona conceptos clínicos adicionales que quieras que la
          IA extraiga automáticamente.
        </Text>
        {activeSystem === "LOINC" ? (
          <LoincSearchInput
            label="Buscar concepto LOINC"
            value=""
            conceptId={null}
            term={null}
            onSelect={handleSelectConcept}
            editable={true}
            placeholder="Busca tests, escalas o medidas..."
          />
        ) : (
          <SnomedSearchInput
            label="Buscar concepto SNOMED"
            value=""
            conceptId={null}
            term={null}
            onSelect={handleSelectConcept}
            editable={true}
            placeholder="Busca síntomas o diagnósticos..."
          />
        )}
      </View>

      {customFields.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              Campos personalizados ({customFields.length})
            </Text>
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  "Restablecer",
                  "¿Eliminar todos los campos personalizados?",
                  [
                    { text: "Cancelar", style: "cancel" },
                    {
                      text: "Restablecer",
                      style: "destructive",
                      onPress: () => setCustomFields([]),
                    },
                  ],
                );
              }}
            >
              <Text style={styles.resetText}>Restablecer</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={customFields}
            keyExtractor={(item, i) => `${item.conceptId}_${i}`}
            renderItem={renderCustomField}
            scrollEnabled={false}
          />
        </View>
      )}

      {customFields.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="flask-outline" size={48} color="#7F8C8D" />
          <Text style={styles.emptyTitle}>Sin campos personalizados</Text>
          <Text style={styles.emptyDesc}>
            Usa el buscador de arriba para añadir conceptos clínicos (SNOMED o
            LOINC).
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.saveButton, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Ionicons
          name={saving ? "hourglass" : "checkmark-circle"}
          size={20}
          color="#FFF"
        />
        <Text style={styles.saveButtonText}>
          {saving ? "Guardando..." : "Guardar plantilla"}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={showInfoModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowInfoModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={styles.modalContainer}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIcon}>
                <Ionicons name="information-circle" size={28} color="#4CAF50" />
              </View>
              <Text style={styles.modalTitle}>¿Qué terminología usar?</Text>
              <Text style={styles.modalSubtitle}>
                Cada estándar cubre un tipo de información clínica distinta.
              </Text>
            </View>
            <View style={styles.modalDivider} />
            <View style={styles.modalBody}>
              <View style={styles.infoCard}>
                <View style={styles.infoCardHeader}>
                  <View style={styles.infoCardBadgeSnomed}>
                    <Ionicons name="medkit-outline" size={14} color="#2E7D32" />
                    <Text style={styles.infoCardBadgeText}>SNOMED CT</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                </View>
                <Text style={styles.infoCardTitle}>Hallazgos clínicos</Text>
                <Text style={styles.infoCardDesc}>
                  Úsalo para Diagnósticos y Síntomas
                </Text>
                <Text style={styles.infoCardExample}>
                  Dolor lumbar, Fractura de fémur, Contractura cervical,
                  Tabaquismo
                </Text>
              </View>
              <View style={styles.infoCard}>
                <View style={styles.infoCardHeader}>
                  <View style={styles.infoCardBadgeLoinc}>
                    <Ionicons name="pulse-outline" size={14} color="#1565C0" />
                    <Text style={styles.infoCardBadgeText}>LOINC</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={18} color="#1565C0" />
                </View>
                <Text style={styles.infoCardTitle}>Mediciones y tests</Text>
                <Text style={styles.infoCardDesc}>
                  Úsalo para Constantes Vitales y Tests
                </Text>
                <Text style={styles.infoCardExample}>
                  Tensión arterial, IMC, Escala de dolor, Test de 6 minutos
                  marcha
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowInfoModal(false)}
            >
              <Text style={styles.modalButtonText}>Entendido</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  content: { padding: 20, paddingBottom: 50 },

  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2C3E50",
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    color: "#7F8C8D",
    marginBottom: 16,
    lineHeight: 18,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  resetText: {
    fontSize: 13,
    color: "#E74C3C",
    fontWeight: "600",
  },
  nameInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 16,
    color: "#2C3E50",
    marginTop: 4,
  },

  builtinRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  builtinText: {
    flex: 1,
    fontSize: 14,
    color: "#7F8C8D",
    marginLeft: 10,
  },
  builtinType: {
    backgroundColor: "#ECEFF1",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  builtinTypeText: {
    fontSize: 10,
    color: "#78909C",
    fontWeight: "600",
  },

  fieldCard: {
    backgroundColor: "#F8FFFE",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E0F2F1",
  },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  fieldTerm: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2C3E50",
    flexShrink: 1,
  },
  semanticBadge: {
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  semanticText: {
    fontSize: 9,
    color: "#1565C0",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  removeBtn: { padding: 4 },
  fieldMeta: {
    marginTop: 6,
    paddingLeft: 26,
  },
  metaText: {
    fontSize: 11,
    color: "#90A4AE",
    fontFamily: "monospace",
  },
  systemBadgeSnomed: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  systemBadgeLoinc: {
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  systemBadgeText: {
    fontSize: 9,
    color: "#2C3E50",
    fontWeight: "700",
  },

  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 4,
  },
  segmentOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  segmentOptionActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  segmentTextActive: {
    color: "#2C3E50",
  },
  terminologyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },

  saveButton: {
    backgroundColor: "#4CAF50",
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 15,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#D1D5DB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 4,
    gap: 4,
  },
  modalHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2C3E50",
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#7F8C8D",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 4,
  },
  modalDivider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginVertical: 20,
  },
  modalBody: {
    gap: 14,
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E8ECF0",
  },
  infoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  infoCardBadgeSnomed: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
  },
  infoCardBadgeLoinc: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
  },
  infoCardBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2C3E50",
    letterSpacing: 0.5,
  },
  infoCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2C3E50",
    marginBottom: 4,
  },
  infoCardDesc: {
    fontSize: 13,
    color: "#7F8C8D",
    marginBottom: 6,
    lineHeight: 18,
  },
  infoCardExample: {
    fontSize: 12,
    color: "#90A4AE",
    lineHeight: 17,
    fontStyle: "italic",
  },
  modalButton: {
    backgroundColor: "#4CAF50",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#7F8C8D",
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 13,
    color: "#7F8C8D",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});
