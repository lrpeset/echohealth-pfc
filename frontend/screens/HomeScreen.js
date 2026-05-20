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
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getIconForConsultation } from "../utils/iconUtils";
import { extractReasonForVisit } from "../utils/normalizeConsultation";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function HomeScreen({ navigation }) {
  const [recentConsultations, setRecentConsultations] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleLogout = () => {
    Alert.alert(
      "Cerrar Sesión",
      "¿Estás seguro de que quieres salir de tu cuenta?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Salir",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem("userToken");
            navigation.replace("Login");
          },
        },
      ],
    );
  };

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
      const token = await AsyncStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/api/consultations`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setRecentConsultations(data.slice(0, 3));
    } catch (error) {
      console.error("Error en conexión real:", error); // Deshabilitado para producción
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
    const reason = extractReasonForVisit(item);
    const category = item.content?.category || item.category || null;

    const date = new Date(item.createdAt).toLocaleDateString("es-ES");
    const iconData = getIconForConsultation(reason, category);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          navigation.navigate("ConsultationDetail", { consultationId: item.id })
        }
      >
        <View style={styles.iconContainer}>
          <Ionicons name={iconData.name} size={24} color={iconData.color} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.cardDate}>{date}</Text>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {reason || "Consulta sin motivo registrado"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#CCCCCC" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <View>
            <Text style={styles.greeting}>Bienvenido, Dr.</Text>
            <Text style={styles.subtitle}>¿Qué vamos a registrar hoy?</Text>
          </View>

          <TouchableOpacity onPress={handleLogout} style={{ padding: 5 }}>
            <Ionicons name="log-out-outline" size={28} color="#E74C3C" />
          </TouchableOpacity>
        </View>

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
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 1,
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
    shadowOpacity: 0.08,
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
    shadowRadius: 6,
    elevation: 2,
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
    color: "#7F8C8D",
    fontWeight: "600",
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2C3E50",
  },
  emptyText: { textAlign: "center", color: "#7F8C8D", marginTop: 20 },

  secondaryButton: {
    flexDirection: "row",
    marginTop: 10,
    padding: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#4CAF50",
    fontSize: 15,
    fontWeight: "600",
  },
});
