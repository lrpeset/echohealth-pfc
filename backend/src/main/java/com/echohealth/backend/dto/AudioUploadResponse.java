package com.echohealth.backend.dto;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * DTO de respuesta estructurada para el endpoint /api/audio/upload.
 * Envuelve el array de campos extraídos por Gemini junto con metadatos
 * de procesamiento y alertas clínicas (redFlags).
 */
public record AudioUploadResponse(

    /** Array de objetos campo, cada uno con id, label, type, value, conceptId, term, terminology, etc. */
    List<Map<String, Object>> fields,

    /** Metadatos del procesamiento de la IA */
    ProcessingMetadata metadata,

    /** Alertas clínicas (red flags) detectadas por umbrales de seguridad */
    List<String> redFlags
) {

    /**
     * Metadatos del proceso de extracción por IA.
     */
    public record ProcessingMetadata(
        Instant processedAt,
        int totalFields,
        int extractedCount,
        boolean exportReady
    ) {

        public static ProcessingMetadata from(List<Map<String, Object>> fields) {
            int total = fields.size();
            int extracted = (int) fields.stream()
                    .filter(f -> f.get("value") != null)
                    .count();
            boolean hasCodes = fields.stream()
                    .anyMatch(f -> f.get("conceptId") != null);

            return new ProcessingMetadata(
                Instant.now(),
                total,
                extracted,
                hasCodes
            );
        }
    }

    /**
     * Detecta banderas rojas clínicas basadas en umbrales de seguridad.
     * Se ejecuta post-extracción para alertar al clínico.
     */
    public static List<String> detectRedFlags(List<Map<String, Object>> fields) {
        List<String> flags = new ArrayList<>();

        for (Map<String, Object> field : fields) {
            String id = (String) field.get("id");
            Object value = field.get("value");
            if (id == null || value == null) continue;

            try {
                switch (id) {
                    case "oxygenSaturation" -> {
                        double spo2 = Double.parseDouble(value.toString());
                        if (spo2 < 90.0) {
                            flags.add("RED FLAG: Saturación de oxígeno baja (" + spo2 + "%). Umbral: < 90%.");
                        }
                    }
                    case "pulse" -> {
                        double pulse = Double.parseDouble(value.toString());
                        if (pulse > 120.0) {
                            flags.add("RED FLAG: Taquicardia (" + pulse + " ppm). Umbral: > 120 ppm.");
                        } else if (pulse < 40.0) {
                            flags.add("RED FLAG: Bradicardia (" + pulse + " ppm). Umbral: < 40 ppm.");
                        }
                    }
                    case "bloodPressure" -> {
                        String bp = value.toString();
                        if (bp.contains("/")) {
                            int systolic = Integer.parseInt(bp.split("/")[0].trim());
                            if (systolic > 160) {
                                flags.add("RED FLAG: Presión arterial sistólica elevada (" + systolic + " mmHg). Umbral: > 160 mmHg.");
                            }
                        }
                    }
                }
            } catch (NumberFormatException e) {
                // non-numeric value for a numeric field — skip
            }
        }

        return flags;
    }
}
