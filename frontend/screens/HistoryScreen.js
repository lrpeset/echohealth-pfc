import React, { useState, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { API_URL, MOCK_MODE } from "../config";
import { mockConsultations } from "../mocks/consultationsMock";
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
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function HistoryScreen({ navigation }) {
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAllConsultations = async () => {
    setLoading(true);

    if (MOCK_MODE) {
      console.log("🛠️ Historial: Usando datos de MOCK");
      setTimeout(() => {
        setConsultations(mockConsultations);
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
      setConsultations(data);
    } catch (error) {
      console.error("Error al obtener el historial real:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchAllConsultations();
    }, []),
  );

  const renderItem = ({ item }) => {
    const content =
      item.content || (item.contentJson ? JSON.parse(item.contentJson) : {});

    const iconData = getIconForConsultation(
      content.reasonForVisit,
      content.category,
    );
    const dateObj = new Date(item.createdAt);
    const date = dateObj.toLocaleDateString("es-ES");
    const time = dateObj.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });

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
          <Ionicons name={iconData.name} size={28} color={iconData.color} />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.dateText}>
            {date} - {time}
          </Text>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {content.reasonForVisit || "Sin motivo registrado"}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={18} color="#CCCCCC" />
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
          <Text style={styles.emptyText}>
            No hay registros en el historial.
          </Text>
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
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  listPadding: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20 },

  card: {
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: "#E1E4E8",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F2F4F8",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  dateText: {
    fontSize: 13,
    color: "#7F8C8D",
    fontWeight: "600",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    color: "#2C3E50",
    fontWeight: "500",
    lineHeight: 22,
  },
  emptyText: { color: "#95A5A6", fontSize: 16 },
});
