import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function HomeScreen({ navigation }) {
  const [recentConsultations, setRecentConsultations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchConsultations = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/consultations`);
      const data = await response.json();

      setRecentConsultations(data.slice(0, 3));
    } catch (error) {
      console.error("Error al obtener consultas:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchConsultations();
    }, []),
  );

  const renderItem = ({ item }) => {
    const content = JSON.parse(item.contentJson);

    const date = new Date(item.createdAt).toLocaleDateString("es-ES");

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          navigation.navigate("Form", { data: content, isReadOnly: true })
        }
      >
        <Text style={styles.cardTitle} numberOfLines={1}>
          {content.reasonForVisit || "Consulta sin motivo registrado"}
        </Text>
        <Text style={styles.cardDate}>{date}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.mainButton}
          onPress={() => navigation.navigate("Record")}
        >
          <Text style={styles.mainButtonText}>🎙️ Nueva Consulta</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.listContainer}>
        <Text style={styles.sectionTitle}>Últimas Consultas</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#4CAF50" />
        ) : recentConsultations.length === 0 ? (
          <Text style={styles.emptyText}>No hay consultas recientes.</Text>
        ) : (
          <FlatList
            data={recentConsultations}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
          />
        )}

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate("History")}
        >
          <Text style={styles.secondaryButtonText}>Ver Historial Completo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fa" },
  header: {
    padding: 30,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#e1e4e8",
    alignItems: "center",
  },
  mainButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 30,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  mainButtonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  listContainer: { flex: 1, padding: 20 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
  },
  card: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 12,
    elevation: 1,
    borderLeftWidth: 4,
    borderLeftColor: "#4CAF50",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 5,
  },
  cardDate: { fontSize: 14, color: "#7f8c8d" },
  emptyText: { textAlign: "center", color: "#95a5a6", marginTop: 20 },
  secondaryButton: { marginTop: 15, padding: 15, alignItems: "center" },
  secondaryButtonText: { color: "#0066cc", fontSize: 16, fontWeight: "600" },
});
