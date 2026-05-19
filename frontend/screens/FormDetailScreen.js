import React, { useState, useLayoutEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../config";

export default function FormDetailScreen({ route, navigation }) {
  const { templateId } = route.params;
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    fetchTemplate();
  }, [templateId]);

  const handleDelete = () => {
    Alert.alert(
      "Eliminar plantilla",
      "¿Estás seguro? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: confirmDelete },
      ],
    );
  };

  const confirmDelete = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/api/forms/${template.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        navigation.goBack();
      } else if (response.status === 403) {
        Alert.alert(
          "Error",
          "Las plantillas de sistema no se pueden eliminar.",
        );
      } else {
        Alert.alert("Error", "No se pudo eliminar la plantilla.");
      }
    } catch (e) {
      console.error("Error deleting template:", e);
      Alert.alert("Error", "No se pudo eliminar la plantilla.");
    }
  };

  useLayoutEffect(() => {
    if (template) {
      navigation.setOptions({
        title: template.name || "Plantilla",
        headerRight: () => (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {template.userId !== "system" && (
              <TouchableOpacity
                onPress={handleDelete}
                style={{ marginRight: 12 }}
              >
                <Ionicons name="trash-outline" size={24} color="#FF5252" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                if (template.userId === "system") {
                  Alert.alert(
                    "Plantilla del sistema",
                    "Crea una copia personal para poder editarla.",
                    [
                      { text: "Cancelar", style: "cancel" },
                      { text: "Crear copia", onPress: handleCopyAndEdit },
                    ],
                  );
                } else {
                  navigation.navigate("FormEditor", {
                    templateId: template.id,
                  });
                }
              }}
              style={{ marginRight: 16 }}
            >
              <Ionicons name="create-outline" size={24} color="#4CAF50" />
            </TouchableOpacity>
          </View>
        ),
      });
    }
  }, [template]);

  const fetchTemplate = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/api/forms/${templateId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setTemplate(await response.json());
      }
    } catch (e) {
      console.error("Error fetching template:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAndEdit = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/api/forms/init`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (response.ok) {
        const copy = await response.json();
        navigation.replace("FormEditor", { templateId: copy.id });
      }
    } catch (e) {
      console.error("Error copying template:", e);
    }
  };

  const handleUseForConsultation = async () => {
    try {
      await AsyncStorage.setItem("@selected_template", templateId);
      navigation.navigate("Record");
    } catch (e) {
      console.error("Error selecting template:", e);
    }
  };

  const getTerminologyStyle = (terminology) => {
    return terminology === "LOINC"
      ? { badge: styles.badgeLoinc, text: styles.badgeLoincText }
      : { badge: styles.badgeSnomed, text: styles.badgeSnomedText };
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  if (!template) {
    return (
      <View style={styles.centerContainer}>
        <Text style={{ color: "#7F8C8D" }}>Plantilla no encontrada</Text>
      </View>
    );
  }

  const isSystemTemplate = template.userId === "system";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <View style={styles.headerIcon}>
          <Ionicons name="document-text" size={32} color="#4CAF50" />
        </View>
        <Text style={styles.title}>{template.name}</Text>
        {template.description && (
          <Text style={styles.description}>{template.description}</Text>
        )}
        <Text style={styles.fieldTotal}>
          {template.fields ? template.fields.length : 0} campos configurados
        </Text>
        {isSystemTemplate && (
          <View style={styles.systemBadge}>
            <Ionicons name="cloud-download-outline" size={14} color="#FF9800" />
            <Text style={styles.systemBadgeText}>Plantilla por defecto</Text>
          </View>
        )}
      </View>

      {template.fields &&
        template.fields.map((field, index) => {
          const termStyle = getTerminologyStyle(field.terminology);
          return (
            <View key={field.id || index} style={styles.fieldCard}>
              <View style={styles.fieldHeader}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <View style={termStyle.badge}>
                  <Text style={termStyle.text}>
                    {field.terminology || "SNOMED"}
                  </Text>
                </View>
              </View>
              <Text style={styles.fieldType}>{field.type}</Text>
              {field.conceptId && (
                <Text style={styles.fieldConcept}>
                  {field.terminology || "SNOMED"}: {field.conceptId}
                </Text>
              )}
              {field.required && (
                <View style={styles.requiredBadge}>
                  <Text style={styles.requiredText}>Requerido</Text>
                </View>
              )}
            </View>
          );
        })}

      <TouchableOpacity
        style={styles.useButton}
        onPress={handleUseForConsultation}
      >
        <Ionicons name="mic-outline" size={20} color="#FFF" />
        <Text style={styles.useButtonText}>Usar para consulta</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
  },
  content: { padding: 16, paddingBottom: 40 },

  headerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2C3E50",
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: "#7F8C8D",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 20,
  },
  fieldTotal: {
    fontSize: 13,
    color: "#90A4AE",
    fontWeight: "600",
  },
  systemBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginTop: 10,
    gap: 6,
  },
  systemBadgeText: {
    fontSize: 12,
    color: "#E65100",
    fontWeight: "600",
  },
  fieldCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  fieldHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2C3E50",
    flex: 1,
  },
  fieldType: {
    fontSize: 12,
    color: "#90A4AE",
    marginBottom: 2,
  },
  fieldConcept: {
    fontSize: 11,
    color: "#90A4AE",
    fontFamily: "monospace",
  },
  badgeSnomed: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeSnomedText: {
    fontSize: 10,
    color: "#2E7D32",
    fontWeight: "700",
  },
  badgeLoinc: {
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeLoincText: {
    fontSize: 10,
    color: "#1565C0",
    fontWeight: "700",
  },
  requiredBadge: {
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  requiredText: {
    fontSize: 10,
    color: "#E65100",
    fontWeight: "600",
  },
  useButton: {
    backgroundColor: "#4CAF50",
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  useButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
