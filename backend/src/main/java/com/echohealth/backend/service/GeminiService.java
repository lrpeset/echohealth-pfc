package com.echohealth.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.google.genai.Client;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import com.google.genai.types.Blob;

import java.util.Arrays;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class GeminiService {

    private static final Logger log = LoggerFactory.getLogger(GeminiService.class);

    @Value("${google.api.key}")
    private String apiKey;

    private static final int MIN_HEIGHT = 50;
    private static final int MAX_HEIGHT = 250;
    private static final double MIN_WEIGHT = 20.0;
    private static final double MAX_WEIGHT = 300.0;
    private static final int MIN_PULSE = 30;
    private static final int MAX_PULSE = 220;

    private String buildMedicalPrompt(List<String> targetFields) {
        List<TargetField> parsed = parseTargetFields(targetFields);

        List<FieldInfo> allFields = buildAllFieldInfos(parsed);

        String fieldTable = allFields.stream()
                .map(f -> String.format(
                        "  - Campo: \"%s\" | Formato: %s | Terminología: %s | Código Sugerido: %s",
                        f.label, f.type, f.terminology, f.conceptId != null ? f.conceptId : "N/A"))
                .collect(Collectors.joining("\n"));

        String jsonTemplate = allFields.stream()
                .map(f -> {
                    boolean isLoinc = "LOINC".equals(f.terminology);
                    boolean isNumeric = f.type != null && f.type.endsWith("-number");
                    String valueType = isNumeric ? "number or null" : "string or null";
                    String conceptIdStr = f.conceptId != null ? "\"" + f.conceptId + "\"" : "null";
                    String termStr = f.term != null ? "\"" + f.term + "\"" : "null";
                    String snomedVerified = isLoinc ? "false" : "boolean";
                    return String.format("""
          {
            "id": "%s",
            "label": "%s",
            "type": "%s",
            "value": %s,
            "conceptId": %s,
            "term": %s,
            "snomedVerified": %s,
            "terminology": "%s"
          }""", f.id, f.label, f.type, valueType, conceptIdStr, termStr, snomedVerified, f.terminology);
                })
                .collect(Collectors.joining(",\n"));

        return String.format("""
        Act as an expert Medical Scribe specialized in international clinical coding (SNOMED CT and LOINC).
        Extract clinical data from the consultation audio and return a structured JSON array.

        The consultation form has the following fields. For each field, use the exact format, terminology,
        and suggested code provided below.

        FIELD DEFINITIONS:
        %s

        ANONYMIZATION: NEVER include patient names, personal identifiers, or specific dates.

        OUTPUT FORMAT (Strict JSON Array — follow this exact structure for every field):
        [
        %s
        ]

        RULES:
        1. Include EVERY field listed above in the output array, in the order shown.
        2. If a value cannot be extracted from audio, use null for value but KEEP all other metadata (conceptId, term, terminology).
        3. Set snomedVerified to true ONLY if terminology is SNOMED and you are confident in the mapping.
        4. Convert units: feet->cm (x30.48), inches->cm (x2.54), lbs->kg (x0.453592).
        5. Return valid JSON only, no additional text.
        6. Use the EXACT conceptId, term, type, and terminology specified for each field. Do NOT guess or substitute codes.
        """, fieldTable, jsonTemplate);
    }

    private List<FieldInfo> buildAllFieldInfos(List<TargetField> customFields) {
        List<FieldInfo> fields = new java.util.ArrayList<>();

        fields.add(new FieldInfo("reasonForVisit", "Motivo de la visita", "snomed-text", null, null, "SNOMED"));
        fields.add(new FieldInfo("height", "Altura (cm)", "loinc-number", "8302-2", "Body height", "LOINC"));
        fields.add(new FieldInfo("weight", "Peso (kg)", "loinc-number", "29463-7", "Body weight", "LOINC"));
        fields.add(new FieldInfo("pulse", "Pulso (ppm)", "loinc-number", "8867-4", "Heart rate", "LOINC"));

        for (TargetField tf : customFields) {
            String type = "LOINC".equals(tf.system()) ? "loinc-text" : "snomed-text";
            String fieldId = "custom_" + sanitizeFieldId(tf.term());
            fields.add(new FieldInfo(fieldId, tf.term(), type, tf.conceptId(), tf.term(), tf.system()));
        }

        return fields;
    }

    private record FieldInfo(String id, String label, String type, String conceptId, String term, String terminology) {}

    private List<TargetField> parseTargetFields(List<String> raw) {
        if (raw == null) return List.of();
        return raw.stream().map(s -> {
            String[] parts = s.split("\\|", 3);
            String conceptId = parts.length > 0 && !parts[0].isEmpty() ? parts[0] : null;
            String term = parts.length > 1 ? parts[1] : "";
            String system = parts.length > 2 ? parts[2] : "SNOMED";
            return new TargetField(conceptId, term, system);
        }).collect(Collectors.toList());
    }

    private record TargetField(String conceptId, String term, String system) {}

    private String sanitizeFieldId(String term) {
        return term.toLowerCase().replaceAll("[^a-z0-9]", "_").replaceAll("_+", "_");
    }

    public String analyzeAudio(MultipartFile file, List<String> targetFields) {
        try (Client client = Client.builder().apiKey(apiKey).build()) {
            String mimeType = file.getContentType();
            if (mimeType == null || mimeType.isEmpty() || mimeType.equals("application/octet-stream")) {
                mimeType = "audio/m4a";
            }

            log.info("Procesando audio con MimeType detectado: {}", mimeType);
            if (targetFields != null && !targetFields.isEmpty()) {
                log.info("Campos adicionales solicitados: {}", targetFields);
            }

            String medicalPrompt = buildMedicalPrompt(targetFields);

            Part textPart = Part.builder()
                    .text(medicalPrompt)
                    .build();

            Part audioPart = Part.builder()
                    .inlineData(Blob.builder()
                            .data(file.getBytes())
                            .mimeType(mimeType)
                            .build())
                    .build();

            Content content = Content.builder()
                    .parts(Arrays.asList(textPart, audioPart))
                    .build();

            GenerateContentConfig config = GenerateContentConfig.builder()
                    .responseMimeType("application/json")
                    .build();

            GenerateContentResponse response = client.models.generateContent(
                    "gemini-2.0-flash",
                    content,
                    config);

            String rawResponse = response.text();
            log.debug("Respuesta cruda de Gemini: {}", rawResponse);

            String cleanedJson = cleanJsonResponse(rawResponse, targetFields);
            log.debug("JSON limpiado: {}", cleanedJson);

            String validatedJson = validateClinicalRanges(cleanedJson);
            log.info("Validación de rangos clínicos completada");

            return validatedJson;

        } catch (Exception e) {
            log.error("Error al procesar audio con Gemini: {}", e.getMessage(), e);
            return buildFallbackResponse(targetFields);
        }
    }

    public String analyzeAudio(MultipartFile file) {
        return analyzeAudio(file, null);
    }

    private String cleanJsonResponse(String rawResponse, List<String> targetFields) {
        if (rawResponse == null || rawResponse.isEmpty()) {
            log.warn("Respuesta vacía de Gemini");
            return buildFallbackResponse(targetFields);
        }

        String trimmed = rawResponse.trim();

        if (trimmed.startsWith("```json")) {
            trimmed = trimmed.substring(7);
        } else if (trimmed.startsWith("```")) {
            trimmed = trimmed.substring(3);
        }

        if (trimmed.endsWith("```")) {
            trimmed = trimmed.substring(0, trimmed.length() - 3);
        }

        trimmed = trimmed.trim();

        int firstBracket = trimmed.indexOf('[');
        int lastBracket = trimmed.lastIndexOf(']');

        if (firstBracket == -1 || lastBracket == -1) {
            log.warn("JSON inválido - no se encontró array delimitado");
            return buildFallbackResponse(targetFields);
        }

        String jsonArray = trimmed.substring(firstBracket, lastBracket + 1);

        if (!jsonArray.startsWith("[") || !jsonArray.endsWith("]")) {
            log.warn("JSON no es un array válido");
            return buildFallbackResponse(targetFields);
        }

        return jsonArray;
    }

    private String validateClinicalRanges(String json) {
        try {
            String validated = json;

            validated = validateFieldInRange(validated, "height", MIN_HEIGHT, MAX_HEIGHT, true);
            validated = validateFieldInRange(validated, "weight", MIN_WEIGHT, MAX_WEIGHT, false);
            validated = validateFieldInRange(validated, "pulse", MIN_PULSE, MAX_PULSE, true);

            return validated;
        } catch (Exception e) {
            log.error("Error en validación de rangos clínicos: {}", e.getMessage());
            return json;
        }
    }

    private String validateFieldInRange(String json, String fieldId, double minVal, double maxVal, boolean isInteger) {
        String regex = String.format(
            "\"id\"\\s*:\\s*\"%s\"\\s*,\\s*\"value\"\\s*:\\s*(%s)",
            fieldId,
            isInteger ? "(\\d+)" : "([\\d.]+)"
        );

        Pattern pattern = Pattern.compile(regex);
        Matcher matcher = pattern.matcher(json);

        if (matcher.find()) {
            String valueStr = matcher.group(1);
            double value = Double.parseDouble(valueStr);

            if (value < minVal || value > maxVal) {
                log.warn("Valor fuera de rango para {}: {}. Forzando a null", fieldId, value);

                String replacement = String.format("\"id\": \"%s\", \"value\": null", fieldId);
                json = json.replaceFirst(regex, replacement);
            }
        }

        return json;
    }

    private String buildFallbackResponse(List<String> targetFields) {
        log.warn("Devolviendo respuesta de fallback con campos vacíos");
        List<TargetField> parsed = parseTargetFields(targetFields);
        List<FieldInfo> allFields = buildAllFieldInfos(parsed);
        StringBuilder sb = new StringBuilder();
        sb.append("[\n");

        for (int i = 0; i < allFields.size(); i++) {
            FieldInfo f = allFields.get(i);
            String conceptIdStr = f.conceptId != null ? "\"" + f.conceptId + "\"" : "null";
            String termStr = f.term != null ? "\"" + f.term + "\"" : "null";
            sb.append(String.format(
                "  {\"id\": \"%s\", \"label\": \"%s\", \"type\": \"%s\", \"value\": null, \"conceptId\": %s, \"term\": %s, \"snomedVerified\": false, \"terminology\": \"%s\"}",
                f.id, f.label, f.type, conceptIdStr, termStr, f.terminology
            ));
            if (i < allFields.size() - 1) {
                sb.append(",\n");
            } else {
                sb.append("\n");
            }
        }

        sb.append("]");
        return sb.toString();
    }

}
