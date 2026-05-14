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
public class AudioController {

    private static final Logger log = LoggerFactory.getLogger(AudioController.class);

    private final GeminiService geminiService;
    private final ObjectMapper objectMapper;

    public AudioController(GeminiService geminiService, ObjectMapper objectMapper) {
        this.geminiService = geminiService;
        this.objectMapper = objectMapper;
    }

    /**
     * Endpoint de subida de audio clínico.
     * Recibe el archivo de audio y la lista de campos destino (targetFields),
     * delega en GeminiService para la extracción por IA y devuelve una respuesta
     * estructurada con los fields extraídos y metadatos de procesamiento.
     *
     * @param file         Archivo de audio (multipart)
     * @param targetFields Lista de strings en formato id|label|conceptId|term|system
     * @return AudioUploadResponse con fields[] + metadata
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

        // Detectar si la respuesta contiene un _error (fallo de API Gemini)
        if (rawJson != null && rawJson.contains("\"_error\"")) {
            log.error("La respuesta contiene _error - propagando al frontend");
            try {
                List<Map<String, Object>> fields = objectMapper.readValue(
                        rawJson, new TypeReference<List<Map<String, Object>>>() {});
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
     * Convierte el JSON array plano devuelto por Gemini en un AudioUploadResponse
     * estructurado con fields y metadatos. Si el parseo falla, devuelve una
     * respuesta vacía con metadatos de error.
     */
    private AudioUploadResponse wrapWithMetadata(String rawJson) {
        try {
            List<Map<String, Object>> fields = objectMapper.readValue(
                    rawJson, new TypeReference<List<Map<String, Object>>>() {});

            AudioUploadResponse.ProcessingMetadata metadata =
                    AudioUploadResponse.ProcessingMetadata.from(fields);

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
