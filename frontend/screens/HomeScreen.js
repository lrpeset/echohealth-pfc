import React, { useState, useCallback } from "react";
import { API_URL, MOCK_MODE } from "../config";
import { mockConsultations } from "../mocks/consultationsMock";
import { Ionicons } from "@expo/vector-icons";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getIconForConsultation } from "../utils/iconUtils";

export default function HomeScreen({ navigation }) {
  const [recentConsultations, setRecentConsultations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchConsultations = async () => {
    setLoading(true);

    if (MOCK_MODE) {
      console.log("🛠️ Usando datos de MOCK");
      setTimeout(() => {
        setRecentConsultations(mockConsultations.slice(0, 3));
        setLoading(false);
      }, 500);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/consultations`);
      const data = await response.json();
      setRecentConsultations(data.slice(0, 3));
    } catch (error) {
      console.error("Error en conexión real:", error);
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
    const content =
      item.content || (item.contentJson ? JSON.parse(item.contentJson) : {});
      
    const date = new Date(item.createdAt).toLocaleDateString("es-ES");
    const iconData = getIconForConsultation(
      content.reasonForVisit,
      content.category,
    );

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          navigation.navigate("Form", {
            data: content,
            isReadOnly: true,
            consultationId: item.id,
          })
        }
      >
        <View style={styles.iconContainer}>
          <Ionicons name={iconData.name} size={24} color={iconData.color} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.cardDate}>{date}</Text>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {content.reasonForVisit || "Consulta sin motivo registrado"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#CCCCCC" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Bienvenido, Dr.</Text>
        <Text style={styles.subtitle}>¿Qué vamos a registrar hoy?</Text>

        <TouchableOpacity
          style={styles.mainButton}
          onPress={() => navigation.navigate("Record")}
        >
          <Ionicons
            name="mic"
            size={24}
            color="#FFF"
            style={{ marginRight: 10 }}
          />
          <Text style={styles.mainButtonText}>Nueva Consulta</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.listContainer}>
        <Text style={styles.sectionTitle}>Actividad Reciente</Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#4CAF50"
            style={{ marginTop: 20 }}
          />
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
          onPress={() => navigation.navigate("HistoryTab")}
        >
          <Text style={styles.secondaryButtonText}>Ver todo el historial</Text>
          <Ionicons
            name="arrow-forward"
            size={16}
            color="#0066cc"
            style={{ marginLeft: 5 }}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: {
    paddingTop: 20,
    paddingHorizontal: 25,
    paddingBottom: 30,
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    zIndex: 10,
  },
  greeting: { fontSize: 28, fontWeight: "bold", color: "#2C3E50" },
  subtitle: { fontSize: 16, color: "#7F8C8D", marginTop: 5, marginBottom: 25 },
  mainButton: {
    backgroundColor: "#4CAF50",
    flexDirection: "row",
    paddingVertical: 18,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  mainButtonText: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  listContainer: { flex: 1, padding: 20 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2C3E50",
    marginBottom: 15,
  },
  card: {
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F2F4F8",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  textContainer: { flex: 1 },
  cardDate: {
    fontSize: 12,
    color: "#95A5A6",
    fontWeight: "600",
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2C3E50",
  },
  emptyText: { textAlign: "center", color: "#95A5A6", marginTop: 20 },
  secondaryButton: {
    flexDirection: "row",
    marginTop: 10,
    padding: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryButtonText: { color: "#0066cc", fontSize: 15, fontWeight: "600" },
});
