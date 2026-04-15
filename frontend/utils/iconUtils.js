import { Ionicons } from "@expo/vector-icons";

export const getIconForConsultation = (reasonText) => {
  const text = reasonText ? reasonText.toLowerCase() : "";

  if (text.includes("dolor") || text.includes("lumbalgia")) {
    return { name: "bandage-outline", color: "#FF9800" };
  }
  if (text.includes("infección") || text.includes("cefalea")) {
    return { name: "thermometer-outline", color: "#F44336" };
  }
  if (text.includes("hipertensión") || text.includes("ansiedad")) {
    return { name: "pulse-outline", color: "#2196F3" };
  }
  if (text.includes("traumatismo") || text.includes("tensional")) {
    return { name: "medical-outline", color: "#673AB7" };
  }
  if (text.includes("alérgica")) {
    return { name: "warning-outline", color: "#E91E63" };
  }

  return { name: "medkit-outline", color: "#4CAF50" };
};