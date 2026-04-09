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

export default function HistoryScreen({ navigation }) {
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAllConsultations = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/consultations`);
      const data = await response.json();
      // Aquí guardamos TODAS, sin el .slice(0, 3)
      setConsultations(data);
    } catch (error) {
      console.error("Error al obtener el historial:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchAllConsultations();
    }, [])
  );

  const renderItem = ({ item }) => {
    const content = JSON.parse(item.contentJson);
    
    const dateObj = new Date(item.createdAt);
    const date = dateObj.toLocaleDateString("es-ES");
    const time = dateObj.toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' });

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          navigation.navigate("Form", { data: content, isReadOnly: true })
        }
      >
        <View style={styles.cardHeader}>
          <Text style={styles.dateText}>{date} - {time}</Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {content.reasonForVisit || "Sin motivo registrado"}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      ) : consultations.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No hay registros en el historial.</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listPadding}
          data={consultations}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fa" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  listPadding: { padding: 20 },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 15,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderLeftWidth: 5,
    borderLeftColor: "#2196F3",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  dateText: { fontSize: 13, color: "#7f8c8d", fontWeight: "600" },
  cardTitle: { fontSize: 16, color: "#2c3e50", fontWeight: "500", lineHeight: 22 },
  emptyText: { color: "#95a5a6", fontSize: 16 },
}); {
    
}
