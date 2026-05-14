import React, { useState, useLayoutEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { API_URL } from "../config";
import { buildFhirJson, buildFhirCsv } from "../utils/fhirExport";

export default function ConsultationDetailScreen({ route, navigation }) {
  const { consultationId } = route.params;
  const [consultation, setConsultation] = useState(null);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    fetchConsultation();
  }, [consultationId]);

  const fetchConsultation = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/api/consultations/${consultationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setConsultation(await response.json());
      }
    } catch (e) {
      console.error("Error loading consultation:", e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isRedFlag = (field) => {
    if (!field || !field.term) return false;
    const t = field.term.toLowerCase();
    return t.includes("red flag") || t.includes("alerta");
  };

  const loincFields =
    consultation?.fields?.filter((f) => f.terminology === "LOINC" && f.value != null) || [];
  const snomedFields =
    consultation?.fields?.filter(
      (f) => (f.terminology === "SNOMED" || !f.terminology) && f.value != null
    ) || [];

  const reasonField = snomedFields.find((f) => f.id === "reasonForVisit");
  const otherSnomedFields = snomedFields.filter((f) => f.id !== "reasonForVisit");

  const buildReportText = () => {
    const lines = [];
    if (reasonField) {
      lines.push(`Motivo: ${reasonField.value}`);
    }
    loincFields.forEach((f) => {
      lines.push(`${f.label}: ${f.value}`);
    });
    otherSnomedFields.forEach((f) => {
      lines.push(`${f.label}: ${f.value}`);
    });
    return lines.join(" | ");
  };

  const handleCopyReport = async () => {
    const text = buildReportText();
    try {
      await Clipboard.setStringAsync(text);
      alert("Informe copiado al portapapeles");
    } catch (e) {
      alert("No se pudo copiar el texto");
    }
  };

  const handleExportJson = async () => {
    try {
      const fields = consultation?.fields || [];
      await Clipboard.setStringAsync(buildFhirJson(fields));
      alert("JSON clínico copiado al portapapeles");
    } catch (e) {
      alert("No se pudo copiar el JSON");
    }
  };

  const handleExportCsv = async () => {
    try {
      const fields = consultation?.fields || [];
      await Clipboard.setStringAsync(buildFhirCsv(fields));
      alert("CSV clínico copiado al portapapeles");
    } catch (e) {
      alert("No se pudo copiar el CSV");
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  if (!consultation) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#CFD8DC" />
        <Text style={styles.errorText}>No se pudo cargar la consulta</Text>
      </View>
    );
  }

  const hasRedFlag = [...loincFields, ...snomedFields].some(isRedFlag);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerBanner}>
        <View style={styles.headerIconRow}>
          <View style={styles.headerIcon}>
            <Ionicons name="medkit" size={28} color="#FFFFFF" />
          </View>
          <View style={styles.headerTextCol}>
            <Text style={styles.headerTitle}>Resumen de Inteligencia Clínica</Text>
            <Text style={styles.headerSubtitle}>
              {formatDate(consultation.createdAt)} · {formatTime(consultation.createdAt)}
            </Text>
          </View>
        </View>
      </View>

      {hasRedFlag && (
        <View style={styles.redFlagBanner}>
          <Ionicons name="warning" size={20} color="#D32F2F" />
          <Text style={styles.redFlagBannerText}>
            Esta consulta contiene alertas de seguridad clínica
          </Text>
        </View>
      )}

      {reasonField && (
        <View style={styles.reasonCard}>
          <View style={styles.reasonHeader}>
            <Ionicons name="chatbubble-ellipses" size={18} color="#2C3E50" />
            <Text style={styles.reasonLabel}>Motivo de la consulta</Text>
          </View>
          <Text style={styles.reasonValue}>{reasonField.value}</Text>
        </View>
      )}

      {loincFields.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionBadge, { backgroundColor: "#E3F2FD" }]}>
              <Ionicons name="pulse-outline" size={16} color="#1565C0" />
              <Text style={[styles.sectionBadgeText, { color: "#1565C0" }]}>
                Mediciones y Tests
              </Text>
            </View>
            <Text style={styles.sectionCount}>{loincFields.length}</Text>
          </View>
          <View style={styles.metricsGrid}>
            {loincFields.map((field, idx) => {
              const flag = isRedFlag(field);
              return (
                <View
                  key={field.id || idx}
                  style={[styles.metricCard, flag && styles.redFlagCard]}
                >
                  <View style={styles.metricTop}>
                    <Ionicons name="speedometer-outline" size={20} color="#1565C0" />
                    {flag && <Ionicons name="warning" size={18} color="#D32F2F" />}
                  </View>
                  <Text style={styles.metricValue}>{String(field.value)}</Text>
                  <Text style={styles.metricLabel}>{field.label}</Text>
                  {field.conceptId && (
                    <Text style={styles.metricCode}>LOINC: {field.conceptId}</Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {otherSnomedFields.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionBadge, { backgroundColor: "#E8F5E9" }]}>
              <Ionicons name="search-outline" size={16} color="#2E7D32" />
              <Text style={[styles.sectionBadgeText, { color: "#2E7D32" }]}>
                Hallazgos Clínicos
              </Text>
            </View>
            <Text style={styles.sectionCount}>{otherSnomedFields.length}</Text>
          </View>
          {otherSnomedFields.map((field, idx) => {
            const flag = isRedFlag(field);
            return (
              <View key={field.id || idx} style={[styles.findingCard, flag && styles.redFlagCard]}>
                <View style={styles.findingHeader}>
                  <View style={styles.findingLeft}>
                    <Ionicons name="medical" size={16} color="#4CAF50" />
                    <Text style={styles.findingLabel}>{field.label}</Text>
                  </View>
                  {flag && <Ionicons name="warning" size={18} color="#D32F2F" />}
                </View>
                <Text style={styles.findingValue}>{String(field.value)}</Text>
                {field.conceptId && (
                  <Text style={styles.findingCode}>SNOMED: {field.conceptId}</Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      <TouchableOpacity style={styles.copyButton} onPress={handleCopyReport}>
        <Ionicons name="copy-outline" size={20} color="#FFF" />
        <Text style={styles.copyButtonText}>Copiar Informe Médico</Text>
      </TouchableOpacity>

      <View style={styles.exportRow}>
        <TouchableOpacity style={styles.exportButtonJson} onPress={handleExportJson}>
          <Ionicons name="code-slash-outline" size={18} color="#FFF" />
          <Text style={styles.exportButtonText}>Exportar JSON (FHIR)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportButtonCsv} onPress={handleExportCsv}>
          <Ionicons name="grid-outline" size={18} color="#FFF" />
          <Text style={styles.exportButtonText}>Exportar CSV</Text>
        </TouchableOpacity>
      </View>
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
    gap: 12,
  },
  errorText: { fontSize: 15, color: "#90A4AE", fontWeight: "600" },
  content: { paddingBottom: 40 },

  headerBanner: {
    backgroundColor: "#2C3E50",
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTextCol: { flex: 1 },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    fontWeight: "500",
  },

  redFlagBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFEBEE",
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 10,
  },
  redFlagBannerText: {
    fontSize: 13,
    color: "#D32F2F",
    fontWeight: "600",
    flex: 1,
  },

  reasonCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 18,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#4CAF50",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  reasonHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7F8C8D",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  reasonValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2C3E50",
    lineHeight: 26,
  },

  section: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
  },
  sectionBadgeText: {
    fontSize: 13,
    fontWeight: "700",
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#90A4AE",
  },

  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    width: "48%",
    minWidth: 140,
    flexGrow: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  metricTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1565C0",
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: "#546E7A",
    fontWeight: "600",
    marginBottom: 2,
  },
  metricCode: {
    fontSize: 10,
    color: "#90A4AE",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },

  findingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  findingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  findingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  findingLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7F8C8D",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  findingValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2C3E50",
    lineHeight: 22,
  },
  findingCode: {
    fontSize: 10,
    color: "#90A4AE",
    marginTop: 6,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },

  redFlagCard: {
    borderWidth: 2,
    borderColor: "#D32F2F",
  },

  copyButton: {
    backgroundColor: "#2C3E50",
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  copyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  exportRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 20,
    gap: 10,
  },
  exportButtonJson: {
    flex: 1,
    backgroundColor: "#1565C0",
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  exportButtonCsv: {
    flex: 1,
    backgroundColor: "#2E7D32",
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  exportButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
