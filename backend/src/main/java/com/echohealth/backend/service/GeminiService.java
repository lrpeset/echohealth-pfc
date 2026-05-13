package com.echohealth.backend.service;

import com.echohealth.backend.util.SnomedConstants;
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

        String basePrompt = String.format("""
        Act as an expert Medical Scribe specialized in SNOMED CT terminology mapping.
        Extract clinical data from the consultation audio and return a structured JSON array.
        
        FIELD MAPPING (MUST FOLLOW THESE IDs):
        - "reasonForVisit": Clinical summary/primary complaint
        - "height": Body height in CENTIMETERS (convert ft/in to cm if needed)
        - "weight": Body weight in KILOGRAMS (convert lbs to kg if needed)  
        - "pulse": Heart rate in beats per minute (bpm)
        
        SNOMED CT CODES (use these exact codes):
        - Height: %s (%s)
        - Weight: %s (%s)
        - Pulse: %s (%s)
        
        ANONYMIZATION: NEVER include patient names, personal identifiers, or specific dates.
        
        OUTPUT FORMAT (Strict JSON Array):
        [
          {
            "id": "reasonForVisit",
            "label": "Motivo de la visita",
            "type": "snomed-text",
            "value": "string or null",
            "conceptId": "SNOMED code or null",
            "term": "SNOMED term or null",
            "snomedVerified": boolean
          },
          {
            "id": "height",
            "label": "Altura (cm)", 
            "type": "snomed-number",
            "value": number or null,
            "conceptId": "%s",
            "term": "%s",
            "snomedVerified": boolean
          },
          {
            "id": "weight",
            "label": "Peso (kg)",
            "type": "snomed-number",
            "value": number or null,
            "conceptId": "%s", 
            "term": "%s",
            "snomedVerified": boolean
          },
          {
            "id": "pulse",
            "label": "Pulso (ppm)",
            "type": "snomed-number",
            "value": number or null,
            "conceptId": "%s",
            "term": "%s",
            "snomedVerified": boolean
          }
        ]
        
        RULES:
        1. Always include the 4 base fields above AND any additional targetFields provided below
        2. If a value cannot be extracted from audio, use null for value
        3. Set snomedVerified to true ONLY if you are confident in the mapping
        4. Convert units: feet->cm (x30.48), inches->cm (x2.54), lbs->kg (x0.453592)
        5. Return valid JSON only, no additional text
        """,
            SnomedConstants.Concepts.HEIGHT, SnomedConstants.Terms.HEIGHT,
            SnomedConstants.Concepts.WEIGHT, SnomedConstants.Terms.WEIGHT,
            SnomedConstants.Concepts.PULSE, SnomedConstants.Terms.PULSE,
            SnomedConstants.Concepts.HEIGHT, SnomedConstants.Terms.HEIGHT,
            SnomedConstants.Concepts.WEIGHT, SnomedConstants.Terms.WEIGHT,
            SnomedConstants.Concepts.PULSE, SnomedConstants.Terms.PULSE
        );

        if (!parsed.isEmpty()) {
            String customFieldsSection = parsed.stream()
                    .map(tf -> String.format("""
          {
            "id": "custom_%s",
            "label": "%s",
            "type": "snomed-text",
            "value": "string or null",
            "conceptId": "%s",
            "term": "%s",
            "snomedVerified": true
          }""", sanitizeFieldId(tf.term()), tf.term(), tf.conceptId(), tf.term()))
                    .collect(Collectors.joining(",\n"));

            String dynamicInstruction = String.format(
                "\n\nADDITIONAL REQUIRED FIELDS (conceptId PROVIDED — do NOT guess):\n" +
                "In addition to the 4 standard fields above, you MUST also extract and include\n" +
                "these clinical concepts in the output array. Use the exact conceptId provided:\n%s\n\n" +
                "RULE 6: Append these additional field objects after the 4 standard ones.\n" +
                "RULE 7: If a concept is not mentioned in the audio, set value to null but KEEP the conceptId.",

                parsed.stream()
                        .map(tf -> "- \"" + tf.term() + "\" (conceptId: " + tf.conceptId() + ")")
                        .collect(Collectors.joining("\n"))
            );

            basePrompt += dynamicInstruction;
        }

        return basePrompt;
    }

    private List<TargetField> parseTargetFields(List<String> raw) {
        if (raw == null) return List.of();
        return raw.stream().map(s -> {
            int sep = s.indexOf('|');
            if (sep > 0) {
                return new TargetField(s.substring(0, sep), s.substring(sep + 1));
            }
            return new TargetField(null, s);
        }).collect(Collectors.toList());
    }

    private record TargetField(String conceptId, String term) {}

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
        StringBuilder sb = new StringBuilder();
        sb.append(String.format("""
            [
              {"id": "reasonForVisit", "label": "Motivo de la visita", "type": "snomed-text", "value": null, "conceptId": null, "term": null, "snomedVerified": false},
              {"id": "height", "label": "Altura (cm)", "type": "snomed-number", "value": null, "conceptId": "%s", "term": "%s", "snomedVerified": false},
              {"id": "weight", "label": "Peso (kg)", "type": "snomed-number", "value": null, "conceptId": "%s", "term": "%s", "snomedVerified": false},
              {"id": "pulse", "label": "Pulso (ppm)", "type": "snomed-number", "value": null, "conceptId": "%s", "term": "%s", "snomedVerified": false}
            """,
            SnomedConstants.Concepts.HEIGHT, SnomedConstants.Terms.HEIGHT,
            SnomedConstants.Concepts.WEIGHT, SnomedConstants.Terms.WEIGHT,
            SnomedConstants.Concepts.PULSE, SnomedConstants.Terms.PULSE
        ));

        for (TargetField tf : parsed) {
            String fieldId = sanitizeFieldId(tf.term());
            sb.append(String.format(
                ",{\"id\": \"%s\", \"label\": \"%s\", \"type\": \"snomed-text\", \"value\": null, \"conceptId\": \"%s\", \"term\": \"%s\", \"snomedVerified\": false}",
                fieldId, tf.term(), tf.conceptId(), tf.term()
            ));
        }

        sb.append("\n]");
        return sb.toString();
    }

    private String buildFallbackResponse() {
        return buildFallbackResponse(null);
    }
}