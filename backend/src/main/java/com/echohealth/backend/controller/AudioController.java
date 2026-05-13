package com.echohealth.backend.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import com.echohealth.backend.service.GeminiService;

import java.util.List;

@RestController
@RequestMapping("/api/audio")
public class AudioController {

    private static final Logger log = LoggerFactory.getLogger(AudioController.class);

    private final GeminiService geminiService;

    public AudioController(GeminiService geminiService) {
        this.geminiService = geminiService;
    }

    @PostMapping("/upload")
    public ResponseEntity<String> uploadAudio(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "targetFields", required = false) List<String> targetFields) {
        log.info("📥 Recibido archivo de audio - tamaño: {} bytes, tipo: {}", 
                file.getSize(), file.getContentType());
        if (targetFields != null && !targetFields.isEmpty()) {
            log.info("🎯 Campos objetivo recibidos: {}", targetFields);
        }
        
        String jsonResult = geminiService.analyzeAudio(file, targetFields);
        
        log.debug("🔍 Respuesta Gemini (JSON): {}", jsonResult);
        
        log.info("✅ Respuesta procesada, retornando al frontend");
        
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .body(jsonResult);
    }
}