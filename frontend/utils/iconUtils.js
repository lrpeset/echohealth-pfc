export const getIconForConsultation = (reasonText, category) => {
  // Si category es null o undefined, el switch irá directamente al default
  switch (category) {
    case "DOLOR":
      return { name: "bandage-outline", color: "#FF9800" };
    case "INFECCION":
      return { name: "thermometer-outline", color: "#F44336" };
    case "CARDIO":
      return { name: "pulse-outline", color: "#2196F3" };
    case "TRAUMA":
      return { name: "medical-outline", color: "#673AB7" };
    case "ALERGIA":
      return { name: "warning-outline", color: "#E91E63" };
    case "GENERAL":
      return { name: "medkit-outline", color: "#4CAF50" };
    default:
      // Si la categoría es null, intentamos buscar por texto como
      const text = reasonText ? reasonText.toLowerCase() : "";
      if (text.includes("dolor")) return { name: "bandage-outline", color: "#FF9800" };
      if (text.includes("fiebre")) return { name: "thermometer-outline", color: "#F44336" };
      
      // Si todo falla, icono médico genérico
      return { name: "medkit-outline", color: "#4CAF50" };
  }
};