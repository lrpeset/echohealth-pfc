package com.echohealth.backend.controller;

import com.echohealth.backend.dto.AudioUploadResponse;
import com.echohealth.backend.service.GeminiService;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/audio")
@CrossOrigin(origins = "*")
public class AudioController {

    private static final Logger log = LoggerFactory.getLogger(AudioController.class);

    private final GeminiService geminiService;
    private final ObjectMapper objectMapper;

    public AudioController(GeminiService geminiService, ObjectMapper objectMapper) {
        this.geminiService = geminiService;
        this.objectMapper = objectMapper;
    }

    /**
     * Orquesta la subida del audio clínico transaccional y su parseo semántico.
     * Delega el flujo binario en GeminiService utilizando el protocolo de inyección
     * de plantillas.
     */
    @PostMapping("/upload")
    public ResponseEntity<?> uploadAudio(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "targetFields", required = false) List<String> targetFields) {

        log.info("Recibido archivo de audio - tamaño: {} bytes, tipo: {}",
                file.getSize(), file.getContentType());

        if (targetFields == null || targetFields.isEmpty()) {
            log.error("No se recibieron targetFields - el frontend no envió campos de plantilla");
            return ResponseEntity.badRequest().build();
        }

        log.info("Campos objetivo recibidos: {}", targetFields);

        String rawJson = geminiService.analyzeAudio(file, targetFields);

        // Control defensivo: intercepta quiebres de cuota u obsolescencia de endpoints
        // de la API externa
        if (rawJson != null && rawJson.contains("\"_error\"")) {
            log.error("La respuesta contiene _error - propagando al frontend");
            try {
                List<Map<String, Object>> fields = objectMapper.readValue(
                        rawJson, new TypeReference<List<Map<String, Object>>>() {
                        });
                String errorMsg = fields.stream()
                        .filter(f -> f.containsKey("_error"))
                        .map(f -> (String) f.get("_error"))
                        .findFirst()
                        .orElse("Error desconocido en Gemini API");
                log.error("Error específico devuelto: {}", errorMsg);
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                        .body(Map.of("error", errorMsg));
            } catch (Exception parseEx) {
                log.error("Error al parsear respuesta de error: {}", parseEx.getMessage());
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                        .body(Map.of("error", "Error de comunicación con Gemini API"));
            }
        }

        AudioUploadResponse response = wrapWithMetadata(rawJson);

        log.info("Respuesta procesada - {} campos, {} extraídos, exportReady: {}",
                response.metadata().totalFields(),
                response.metadata().extractedCount(),
                response.metadata().exportReady());

        return ResponseEntity.ok(response);
    }

    /**
     * Reconstruye el JSON simétrico estructurado e inyecta la capa de telemetría
     * médica.
     */
    private AudioUploadResponse wrapWithMetadata(String rawJson) {
        try {
            List<Map<String, Object>> fields = objectMapper.readValue(
                    rawJson, new TypeReference<List<Map<String, Object>>>() {
                    });

            AudioUploadResponse.ProcessingMetadata metadata = AudioUploadResponse.ProcessingMetadata.from(fields);

            List<String> redFlags = AudioUploadResponse.detectRedFlags(fields);
            if (!redFlags.isEmpty()) {
                log.warn("Red flags detectadas: {}", redFlags);
            }

            return new AudioUploadResponse(fields, metadata, redFlags);

        } catch (Exception e) {
            log.error("Error al parsear respuesta de Gemini: {}", e.getMessage());
            List<Map<String, Object>> emptyFields = List.of();
            return new AudioUploadResponse(
                    emptyFields,
                    new AudioUploadResponse.ProcessingMetadata(
                            java.time.Instant.now(), 0, 0, false),
                    List.of());
        }
    }
}