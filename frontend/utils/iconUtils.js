/**
 * Resuelve la iconografía y el esquema cromático adaptativo para el historial clínico.
 * Implementa una estrategia de degradación elegante (graceful degradation) evaluando
 * primero la categoría transaccional y, en su defecto, aplicando análisis léxico por palabras clave.
 *
 * @param {string} reasonText - Narrativa textual del motivo de la consulta.
 * @param {string} category - Atributo categórico determinado por el backend o plantilla.
 * @returns {Object} Tupla con el identificador del icono (Ionicons) y su código de color hexadecimal.
 */
export const getIconForConsultation = (reasonText, category) => {
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
      // Mecanismo de contingencia: parseo heurístico de la narrativa clínica si no existe categoría explícita
      const text = reasonText ? reasonText.toLowerCase() : "";
      if (text.includes("dolor"))
        return { name: "bandage-outline", color: "#FF9800" };
      if (text.includes("fiebre"))
        return { name: "thermometer-outline", color: "#F44336" };

      // Estado de degradación final: fallback a iconografía médica genérica del ecosistema
      return { name: "medkit-outline", color: "#4CAF50" };
  }
};
