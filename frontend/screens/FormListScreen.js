import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { API_URL } from "../config";

const MIGRATION_KEY = "@form_config";

export default function FormListScreen({ navigation }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [migrationMsg, setMigrationMsg] = useState(null);
  const migrationAttempted = useRef(false);

  const migrateLegacyConfig = async (token) => {
    if (migrationAttempted.current) return;
    migrationAttempted.current = true;

    try {
      const configJson = await AsyncStorage.getItem(MIGRATION_KEY);
      if (!configJson) return;

      const fields = JSON.parse(configJson);
      if (!Array.isArray(fields) || fields.length === 0) return;

      const payload = {
        name: "Mi Formulario (Migrado)",
        description: `Migrado desde configuración local con ${fields.length} campos`,
        fields: fields.map((f) => ({
          id: f.id || `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          label: f.label || f.term || "Campo",
          type: f.type || "snomed-text",
          conceptId: f.conceptId || null,
          term: f.term || null,
          semanticTag: f.semanticTag || null,
          snomedVerified: f.snomedVerified || false,
          terminology: f.terminology || "SNOMED",
          required: false,
          removable: true,
        })),
      };

      const response = await fetch(`${API_URL}/api/forms`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await AsyncStorage.removeItem(MIGRATION_KEY);
        setMigrationMsg("Tu configuración local ha sido sincronizada con la nube");
        setTimeout(() => setMigrationMsg(null), 4000);
        const data = await response.json();
        return data;
      }
    } catch (e) {
      console.warn("Migration failed (non-blocking):", e);
    }
  };

  const fetchTemplates = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const token = await AsyncStorage.getItem("userToken");
      const migrated = await migrateLegacyConfig(token);
      const response = await fetch(`${API_URL}/api/forms`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        let data = await response.json();
        if (migrated && migrated.id) {
          data = [migrated, ...data.filter((t) => t.id !== migrated.id)];
        }
        setTemplates(data || []);
      }
    } catch (e) {
      console.error("Error fetching templates:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTemplates();
    }, [])
  );

  const getFieldSummary = (fields) => {
    if (!fields || fields.length === 0) return "Sin campos";
    const snomedCount = fields.filter((f) => f.terminology !== "LOINC").length;
    const loincCount = fields.filter((f) => f.terminology === "LOINC").length;
    let summary = `${fields.length} campos`;
    if (snomedCount > 0) summary += ` · ${snomedCount} SNOMED`;
    if (loincCount > 0) summary += ` · ${loincCount} LOINC`;
    return summary;
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate("FormDetail", { templateId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <Ionicons name="document-text" size={22} color="#4CAF50" />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          {item.description && (
            <Text style={styles.cardDesc} numberOfLines={1}>
              {item.description}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.fieldCount}>{getFieldSummary(item.fields)}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {migrationMsg && (
        <View style={styles.migrationBanner}>
          <Ionicons name="cloud-done" size={18} color="#2E7D32" />
          <Text style={styles.migrationText}>{migrationMsg}</Text>
        </View>
      )}
      <FlatList
        data={templates}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTemplates(true); }} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="layers-outline" size={56} color="#CFD8DC" />
            <Text style={styles.emptyTitle}>Sin plantillas</Text>
            <Text style={styles.emptyDesc}>Crea tu primera plantilla de formulario clínico.</Text>
          </View>
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("FormEditor", { templateId: null })}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F5F7FA" },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cardInfo: { flex: 1 },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2C3E50",
  },
  cardDesc: {
    fontSize: 13,
    color: "#90A4AE",
    marginTop: 2,
  },
  cardFooter: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F5F5F5",
  },
  fieldCount: {
    fontSize: 12,
    color: "#90A4AE",
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#90A4AE",
    marginTop: 16,
  },
  emptyDesc: {
    fontSize: 14,
    color: "#B0BEC5",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  migrationBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    gap: 8,
  },
  migrationText: {
    fontSize: 13,
    color: "#2E7D32",
    fontWeight: "600",
    flex: 1,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
});
