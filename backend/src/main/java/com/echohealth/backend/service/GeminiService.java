package com.echohealth.backend.service;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.google.genai.Client;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import com.google.genai.types.Blob;

import com.echohealth.backend.util.ClinicalConstants;
import java.util.Arrays;
import java.util.List;
import java.util.ArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class GeminiService {

    private static final Logger log = LoggerFactory.getLogger(GeminiService.class);

    @Value("${google.api.key}")
    private String apiKey;

    private Client client;

    @PostConstruct
    public void initClient() {
        if (apiKey == null || apiKey.isEmpty() || apiKey.startsWith("${")) {
            log.error("=== CRÍTICO: google.api.key NO está configurada ===");
            log.error("Valor actual: '{}' - Revisa secrets.properties o variable de entorno GOOGLE_API_KEY", apiKey);
            return;
        }
        String masked = apiKey.length() > 8
                ? apiKey.substring(0, 4) + "..." + apiKey.substring(apiKey.length() - 4)
                : "***";
        log.info("API Key de Google cargada correctamente: {}", masked);
        this.client = Client.builder()
                .apiKey(apiKey)
                .build();
        log.info("Cliente Gemini inicializado como singleton");
    }

    @EventListener(ApplicationReadyEvent.class)
    public void testGeminiConnectivity() {
        if (client == null) {
            log.error("=== TEST DE CONECTIVIDAD: Cliente no inicializado (API Key ausente) ===");
            return;
        }
        try {
            log.info("=== TEST DE CONECTIVIDAD: Enviando ping a Gemini ===");
            GenerateContentConfig config = GenerateContentConfig.builder()
                    .responseMimeType("text/plain")
                    .build();
            Content content = Content.builder()
                    .parts(List.of(Part.builder().text("Responde solo: CONEXION_OK").build()))
                    .build();
            GenerateContentResponse response = client.models.generateContent(
                    "gemini-2.5-flash", content, config);
            String text = response.text();
            log.info("=== CONEXIÓN CON GEMINI EXITOSA ===");
            log.info("Respuesta del test: {}", text != null ? text.trim() : "null");
        } catch (Exception e) {
            log.error("=== ERROR DE CONEXIÓN CON GEMINI ===");
            log.error("Tipo: {}", e.getClass().getName());
            log.error("Mensaje: {}", e.getMessage());
            log.error("Causa: {}", e.getCause() != null ? e.getCause().getMessage() : "desconocida");
            log.error("Stacktrace:", e);
            if (apiKey != null && !apiKey.isEmpty()) {
                String masked = apiKey.length() > 8
                        ? apiKey.substring(0, 4) + "..." + apiKey.substring(apiKey.length() - 4)
                        : "***";
                log.error("API Key usada: {}", masked);
            }
        }
    }

    private static final int MIN_HEIGHT = 50;
    private static final int MAX_HEIGHT = 250;
    private static final double MIN_WEIGHT = 20.0;
    private static final double MAX_WEIGHT = 300.0;
    private static final int MIN_PULSE = 30;
    private static final int MAX_PULSE = 220;
    private static final int MIN_SPO2 = 50;
    private static final int MAX_SPO2 = 100;
    private static final int MIN_PAIN = 0;
    private static final int MAX_PAIN = 10;

    /**
     * Record que representa un campo destino del formulario clínico.
     * Se construye a partir del formato pipe-separado: id|label|conceptId|term|system|type
     */
    private record TargetField(String id, String label, String conceptId, String term, String system, String type) {}

    private record FieldInfo(String id, String label, String type, String conceptId, String term, String terminology) {}

    /**
     * Construye el prompt médico dinámico que se envía a Gemini.
     * Incluye la definición de cada campo con su código terminológico y una instrucción
     * explícita de extracción, forzando a la IA a usar los IDs exactos de la plantilla.
     */
    private String buildMedicalPrompt(List<TargetField> targetFields) {
        List<FieldInfo> allFields = buildAllFieldInfos(targetFields);

        String extractionSection = allFields.stream()
                .map(f -> buildFieldExtractionInstruction(f))
                .collect(Collectors.joining("\n\n"));

        String jsonTemplate = allFields.stream()
                .map(f -> {
                    boolean isLoinc = "LOINC".equals(f.terminology);
                    boolean isNumeric = f.type != null && f.type.endsWith("-number");
                    String valueType = isNumeric ? "number_or_null" : "string_or_null";
                    String conceptIdStr = f.conceptId != null ? "\"" + f.conceptId + "\"" : "null";
                    String termStr = f.term != null ? "\"" + f.term + "\"" : "null";
                    String conceptVerified = isLoinc ? "false" : "boolean";
                    return String.format("""
            {
              "id": "%s",
              "label": "%s",
              "type": "%s",
              "value": %s,
              "conceptId": %s,
              "term": %s,
              "conceptVerified": %s,
              "terminology": "%s"
            }""", f.id, f.label, f.type, valueType, conceptIdStr, termStr, conceptVerified, f.terminology);
                })
                .collect(Collectors.joining(",\n"));

        return String.format("""
        Act as an expert Medical Scribe specialized in international clinical coding (SNOMED CT and LOINC).
        Extract clinical data from the consultation audio and return a structured JSON array.

        ============================================
        CAMPOS A EXTRAER
        ============================================

        %s

        ============================================
        INSTRUCCIONES POR CAMPO
        ============================================

        For each field listed above:
        1. Listen to the audio for the specific clinical concept described.
        2. Extract the EXACT value mentioned (text, number, measurement, etc.).
        3. Use the EXACT "id" value specified for each field. Do NOT modify or guess the id.
        4. Use the EXACT "conceptId" value specified. Do NOT substitute with a different code.
        5. If the concept is NOT mentioned in the audio, set "value" to null but KEEP all other metadata.

        ANONYMIZATION: NEVER include patient names, personal identifiers, or specific dates.

        OUTPUT FORMAT (Strict JSON Array — follow this exact structure for every field):
        [
        %s
        ]

        RULES:
        1. Include EVERY field listed above in the output array, in the order shown.
        2. If a value cannot be extracted from audio, use null for value but KEEP all other metadata (conceptId, term, terminology).
        3. Set conceptVerified to true ONLY if terminology is SNOMED and you are confident in the mapping.
        4. Convert units: feet->cm (x30.48), inches->cm (x2.54), lbs->kg (x0.453592).
        5. Return valid JSON only, no additional text.
        6. The "id" field is CRITICAL. It MUST match exactly one of the ids provided above. Do NOT invent or modify ids.
        7. The "conceptId" field MUST match exactly the code provided. Do NOT guess codes.
        """, extractionSection, jsonTemplate);
    }

    /**
     * Genera la instrucción de extracción para un campo específico.
     * Incluye el label, código terminológico y una orden explícita de extracción.
     */
    private String buildFieldExtractionInstruction(FieldInfo f) {
        StringBuilder sb = new StringBuilder();
        sb.append(String.format("Campo: \"%s\"\n", f.label));
        sb.append(String.format("  ID de campo: %s\n", f.id));
        sb.append(String.format("  Tipo: %s\n", f.type));
        sb.append(String.format("  Terminología: %s\n", f.terminology));

        if (f.conceptId != null && !f.conceptId.isEmpty() && !"null".equals(f.conceptId)) {
            sb.append(String.format("  Código: %s\n", f.conceptId));
            sb.append(String.format("  Término clínico: %s\n", f.term));
            sb.append(String.format("  >> Extrae el valor clínico para \"%s\" (código %s, %s). Si no se menciona en el audio, devuelve null.", f.term, f.conceptId, f.terminology));
        } else {
            sb.append(String.format("  >> Extrae el valor narrativo para \"%s\". Si no se menciona, devuelve null.", f.label));
        }

        return sb.toString();
    }

    /**
     * Construye la lista de FieldInfo exclusivamente a partir de los
     * targetFields enviados por el frontend. No hay campos base hardcodeados:
     * el frontend es la única fuente de verdad sobre qué campos extraer.
     * Los IDs se toman DIRECTAMENTE del targetField, garantizando estabilidad.
     */
    private List<FieldInfo> buildAllFieldInfos(List<TargetField> customTargets) {
        List<FieldInfo> fields = new ArrayList<>();

        for (TargetField tf : customTargets) {
            String type = tf.type();
            if (type == null || type.isEmpty()) {
                if ("LOINC".equals(tf.system())) {
                    String id = tf.id();
                    type = ("height".equals(id) || "weight".equals(id) || "pulse".equals(id)
                            || "oxygenSaturation".equals(id) || "painIntensity".equals(id))
                            ? "loinc-number" : "loinc-text";
                } else {
                    type = "snomed-text";
                }
            }
            String fieldId = (tf.id() != null && !tf.id().isEmpty())
                    ? tf.id()
                    : "custom_" + sanitizeConceptId(tf.conceptId());
            String label = (tf.label() != null && !tf.label().isEmpty()) ? tf.label() : tf.term();
            fields.add(new FieldInfo(fieldId, label, type, tf.conceptId(), tf.term(), tf.system()));
        }

        return fields;
    }

    /**
     * Parsea los targetFields recibidos como strings pipe-separados.
     * Formato esperado: id|label|conceptId|term|system|type
     * Si el formato tiene menos de 6 partes, intenta compatibilidad hacia atrás
     * con formatos legacy (5 partes y 3 partes).
     */
    private List<TargetField> parseTargetFields(List<String> raw) {
        if (raw == null) return List.of();
        return raw.stream().map(s -> {
            String[] parts = s.split("\\|", 6);
            if (parts.length >= 6) {
                return new TargetField(parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]);
            } else if (parts.length >= 5) {
                return new TargetField(parts[0], parts[1], parts[2], parts[3], parts[4], null);
            } else if (parts.length >= 3) {
                return new TargetField(null, null, parts[0], parts[1], parts[2], null);
            } else if (parts.length >= 2) {
                return new TargetField(null, null, parts[0], parts[1], "SNOMED", null);
            }
            return new TargetField(null, null, parts[0], "", "SNOMED", null);
        }).collect(Collectors.toList());
    }

    /**
     * Sanitiza un conceptId para usarlo como parte de un ID de campo.
     * Ej: "8867-4" → "8867_4", "21522001" → "21522001"
     */
    private String sanitizeConceptId(String conceptId) {
        if (conceptId == null) return "unknown";
        return conceptId.replaceAll("[^a-zA-Z0-9_]", "_").replaceAll("_+", "_");
    }

    /**
     * Punto de entrada principal para el análisis de audio.
     * Envía el audio + prompt a Gemini 3 Flash y procesa la respuesta.
     */ 
    public String analyzeAudio(MultipartFile file, List<String> targetFields) {
        if (client == null) {
            log.error("Cliente Gemini no inicializado - apiKey es null o inválida");
            return buildErrorResponse(parseTargetFields(targetFields),
                    "Gemini no configurado: API Key ausente o inválida");
        }
        try {
            String mimeType = resolveMimeType(file);

            // PASO 1: Audio diagnostics
            log.debug("Audio: {} ({} bytes, {})", file.getOriginalFilename(), file.getSize(), file.getContentType());
            log.debug("MimeType resuelto: {}", mimeType);
            if (file.isEmpty()) {
                log.error("¡ARCHIVO DE AUDIO VACÍO! El frontend envió 0 bytes");
            }

            List<TargetField> parsed = parseTargetFields(targetFields);
            log.debug("Campos destino: {} [{}]", parsed.size(),
                    parsed.stream().map(TargetField::id).collect(Collectors.joining(", ")));


            // PASO 2: Build prompt
            String medicalPrompt = buildMedicalPrompt(parsed);
            log.debug("Prompt generado: {} caracteres", medicalPrompt.length());

            // PASO 3: Prepare content
            byte[] audioBytes = file.getBytes();
            log.debug("Audio leído: {} bytes", audioBytes.length);

            Part textPart = Part.builder().text(medicalPrompt).build();
            Part audioPart = Part.builder()
                    .inlineData(Blob.builder()
                            .data(audioBytes)
                            .mimeType(mimeType)
                            .build())
                    .build();

            Content content = Content.builder()
                    .parts(Arrays.asList(textPart, audioPart))
                    .build();
            log.debug("Content: textPrompt + audioBlob ({} bytes, {})", audioBytes.length, mimeType);

            GenerateContentConfig config = GenerateContentConfig.builder()
                    .responseMimeType("application/json")
                    .build();

            // PASO 4: Gemini API call
            log.info("Enviando a Gemini (modelo: gemini-2.5-flash, {} campos)...", parsed.size());

            long startTime = System.currentTimeMillis();
            GenerateContentResponse response = client.models.generateContent(
                    "gemini-2.5-flash", content, config);
            long elapsed = System.currentTimeMillis() - startTime;
            log.info("Respuesta de Gemini recibida en {} ms", elapsed);

            // PASO 5: Raw response
            String rawResponse = response.text();
            if (rawResponse != null) {
                log.info("Respuesta cruda ({} chars): >>>{}<<<", rawResponse.length(), rawResponse);
            } else {
                log.error("¡RESPUESTA DE GEMINI ES NULL!");
                log.error("Posibles causas: (1) API key inválida/vencida, (2) Cuota agotada (429),");
                log.error("  (3) Content blocked por safety settings, (4) Error interno de Gemini");
            }

            // PASO 6: Processing & validation
            String cleanedJson = cleanJsonResponse(rawResponse, parsed);
            log.debug("JSON después de cleanJsonResponse ({} chars): {}", 
                    cleanedJson != null ? cleanedJson.length() : 0, cleanedJson);

            String validatedJson = validateFieldIds(cleanedJson, parsed);
            log.debug("JSON después de validateFieldIds: {}", validatedJson);

            String rangedJson = validateClinicalRanges(validatedJson);
            log.info("Validación de rangos clínicos completada");

            return rangedJson;

        } catch (com.google.genai.errors.ApiException e) {
            String errorType = e.getClass().getName();
            String errorMsg = e.getMessage() != null ? e.getMessage() : "Sin mensaje";
            log.error("========== ¡ERROR DE API DE GEMINI! ==========");
            log.error("Tipo excepción: {}", errorType);
            log.error("Mensaje completo: {}", errorMsg);
            log.error("Stacktrace:", e);
            log.error("Causa: {}", e.getCause() != null ? e.getCause().getMessage() : "N/A");
            String userMessage = String.format("Error de API Gemini: %s", errorMsg);
            List<TargetField> parsed = parseTargetFields(targetFields);
            return buildErrorResponse(parsed, userMessage);

        } catch (Exception e) {
            log.error("========== ERROR EN analyzeAudio ==========");
            log.error("Tipo: {}", e.getClass().getName());
            log.error("Mensaje: {}", e.getMessage());
            log.error("Stacktrace completo:", e);
            List<TargetField> parsed = parseTargetFields(targetFields);
            String userMessage = String.format("Error interno: %s - %s",
                    e.getClass().getSimpleName(), e.getMessage());
            return buildErrorResponse(parsed, userMessage);
        }
    }

    /**
     * Resuelve el MIME type del archivo de audio.
     * Si el content type es genérico o nulo, asume audio/m4a.
     */
    private String resolveMimeType(MultipartFile file) {
        String mimeType = file.getContentType();
        if (mimeType == null || mimeType.isEmpty() || mimeType.equals("application/octet-stream")) {
            return "audio/m4a";
        }
        return mimeType;
    }

    /**
     * Limpia la respuesta de Gemini eliminando marcadores de código
     * y extrayendo exclusivamente el array JSON.
     */
    private String cleanJsonResponse(String rawResponse, List<TargetField> targetFields) {
        if (rawResponse == null || rawResponse.isEmpty()) {
            log.warn("cleanJsonResponse: respuesta vacía/null de Gemini");
            return buildFallbackResponse(targetFields);
        }

        String trimmed = rawResponse.trim();

        if (trimmed.startsWith("```json")) {
            log.info("cleanJsonResponse: eliminando marcador ```json del inicio");
            trimmed = trimmed.substring(7);
        } else if (trimmed.startsWith("```")) {
            log.info("cleanJsonResponse: eliminando marcador ``` del inicio");
            trimmed = trimmed.substring(3);
        }

        if (trimmed.endsWith("```")) {
            log.info("cleanJsonResponse: eliminando marcador ``` del final");
            trimmed = trimmed.substring(0, trimmed.length() - 3);
        }

        trimmed = trimmed.trim();

        int firstBracket = trimmed.indexOf('[');
        int lastBracket = trimmed.lastIndexOf(']');

        if (firstBracket == -1 || lastBracket == -1) {
            log.warn("cleanJsonResponse: no se encontró array JSON delimitado por [ ]");
            log.warn("cleanJsonResponse: contenido tras limpieza ({} chars): >>>{}<<<",
                    trimmed.length(), trimmed);
            return buildFallbackResponse(targetFields);
        }

        String jsonArray = trimmed.substring(firstBracket, lastBracket + 1);
        log.info("cleanJsonResponse: array JSON extraído ({} chars, índices {}-{})",
                jsonArray.length(), firstBracket, lastBracket);

        if (!jsonArray.startsWith("[") || !jsonArray.endsWith("]")) {
            log.warn("cleanJsonResponse: el extracto no es un array válido");
            return buildFallbackResponse(targetFields);
        }

        return jsonArray;
    }

    /**
     * Valida que los IDs devueltos por Gemini coincidan con los IDs solicitados.
     * Si algún ID no coincide, se reemplaza por el ID correcto basado en la posición
     * o en el conceptId. Esto garantiza que el mapeo plantilla → IA → persistencia
     * sea estable y predecible.
     */
    private String validateFieldIds(String json, List<TargetField> targetFields) {
        if (targetFields == null || targetFields.isEmpty()) return json;

        try {
            List<FieldInfo> expectedFields = buildAllFieldInfos(targetFields);

            for (int i = 0; i < expectedFields.size(); i++) {
                FieldInfo expected = expectedFields.get(i);
                String expectedId = expected.id;

                Pattern extractIdPattern = Pattern.compile(
                        "\\{\\s*\"id\"\\s*:\\s*\"([^\"]+)\"");
                Matcher matcher = extractIdPattern.matcher(json);

                int matchIndex = 0;
                StringBuffer sb = new StringBuffer();
                while (matcher.find()) {
                    String actualId = matcher.group(1);
                    String replacement;
                    if (!actualId.equals(expectedId) && matchIndex == i) {
                        log.warn("ID mismatch en posición {}: esperado '{}', recibido '{}'. Corrigiendo...",
                                i, expectedId, actualId);
                        replacement = matcher.group(0).replaceFirst(
                                Pattern.quote(actualId), Matcher.quoteReplacement(expectedId));
                    } else {
                        replacement = matcher.group(0);
                    }
                    matcher.appendReplacement(sb, replacement);
                    matchIndex++;
                }
                matcher.appendTail(sb);
                json = sb.toString();
            }

            return json;
        } catch (Exception e) {
            log.error("Error en validación de IDs: {}", e.getMessage());
            return json;
        }
    }

    /**
     * Valida que los valores numéricos estén dentro de rangos clínicos aceptables.
     * Si un valor está fuera de rango, se fuerza a null para evitar datos aberrantes.
     */
    private String validateClinicalRanges(String json) {
        try {
            String validated = json;
            validated = validateFieldInRange(validated, ClinicalConstants.FieldDefaults.HEIGHT_ID, MIN_HEIGHT, MAX_HEIGHT, true);
            validated = validateFieldInRange(validated, ClinicalConstants.FieldDefaults.WEIGHT_ID, MIN_WEIGHT, MAX_WEIGHT, false);
            validated = validateFieldInRange(validated, ClinicalConstants.FieldDefaults.PULSE_ID, MIN_PULSE, MAX_PULSE, true);
            validated = validateFieldInRange(validated, ClinicalConstants.FieldDefaults.OXYGEN_SATURATION_ID, MIN_SPO2, MAX_SPO2, true);
            validated = validateFieldInRange(validated, ClinicalConstants.FieldDefaults.PAIN_INTENSITY_ID, MIN_PAIN, MAX_PAIN, true);
            return validated;
        } catch (Exception e) {
            log.error("Error en validación de rangos clínicos: {}", e.getMessage());
            return json;
        }
    }

    private String validateFieldInRange(String json, String fieldId, double minVal, double maxVal, boolean isInteger) {
        String valueRegex = String.format(
            "\"value\"\\s*:\\s*(%s)",
            isInteger ? "(\\d+)" : "([\\d.]+)"
        );

        String fieldRegex = String.format(
            "\"id\"\\s*:\\s*\"%s\"", fieldId
        );

        Pattern fieldPattern = Pattern.compile(fieldRegex);
        Matcher fieldMatcher = fieldPattern.matcher(json);

        while (fieldMatcher.find()) {
            int fieldStart = fieldMatcher.start();
            int objectStart = json.lastIndexOf('{', fieldStart);
            if (objectStart < 0) objectStart = 0;
            int objectEnd = json.indexOf('}', fieldStart);
            if (objectEnd < 0) objectEnd = json.length();

            String objectStr = json.substring(objectStart, objectEnd + 1);

            Pattern valuePattern = Pattern.compile(valueRegex);
            Matcher valueMatcher = valuePattern.matcher(objectStr);

            if (valueMatcher.find()) {
                String valueStr = valueMatcher.group(1);
                double value = Double.parseDouble(valueStr);

                if (value < minVal || value > maxVal) {
                    log.warn("Valor fuera de rango para {}: {}. Forzando a null", fieldId, value);
                    int absValueStart = objectStart + valueMatcher.start(1);
                    int absValueEnd = objectStart + valueMatcher.end(1);
                    json = json.substring(0, absValueStart) + "null" + json.substring(absValueEnd);
                }
            }
        }

        return json;
    }

    /**
     * Construye una respuesta de fallback cuando Gemini falla.
     * Devuelve un array JSON con todos los campos solicitados pero con value=null,
     * permitiendo que el flujo continúe sin interrupción.
     */
    private String buildFallbackResponse(List<TargetField> targetFields) {
        log.warn("Devolviendo respuesta de fallback con campos vacíos");
        List<FieldInfo> allFields = buildAllFieldInfos(targetFields);
        StringBuilder sb = new StringBuilder();
        sb.append("[\n");

        for (int i = 0; i < allFields.size(); i++) {
            FieldInfo f = allFields.get(i);
            String conceptIdStr = f.conceptId != null ? "\"" + f.conceptId + "\"" : "null";
            String termStr = f.term != null ? "\"" + f.term + "\"" : "null";
            sb.append(String.format(
                "  {\"id\": \"%s\", \"label\": \"%s\", \"type\": \"%s\", \"value\": null, \"conceptId\": %s, \"term\": %s, \"conceptVerified\": false, \"terminology\": \"%s\"}",
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

    /**
     * Construye una respuesta de error estructurada cuando la API de Gemini
     * devuelve un error HTTP (401, 403, 429, etc.). Incluye el mensaje de error
     * de Google en un campo _error para que el frontend pueda mostrarlo.
     */
    private String buildErrorResponse(List<TargetField> targetFields, String errorMessage) {
        log.error("Devolviendo respuesta de error al frontend: {}", errorMessage);
        List<FieldInfo> allFields = buildAllFieldInfos(targetFields);
        StringBuilder sb = new StringBuilder();
        sb.append("[\n");

        for (int i = 0; i < allFields.size(); i++) {
            FieldInfo f = allFields.get(i);
            String conceptIdStr = f.conceptId != null ? "\"" + f.conceptId + "\"" : "null";
            String termStr = f.term != null ? "\"" + f.term + "\"" : "null";
            sb.append(String.format(
                "  {\"id\": \"%s\", \"label\": \"%s\", \"type\": \"%s\", \"value\": null, \"conceptId\": %s, \"term\": %s, \"conceptVerified\": false, \"terminology\": \"%s\"}",
                f.id, f.label, f.type, conceptIdStr, termStr, f.terminology
            ));
            if (i < allFields.size() - 1) {
                sb.append(",\n");
            } else {
                sb.append("\n");
            }
        }

        sb.append(String.format(",\n  {\"_error\": \"%s\"}\n", escapeJson(errorMessage)));
        sb.append("]");
        return sb.toString();
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

}
