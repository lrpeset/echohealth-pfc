package com.echohealth.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import com.echohealth.backend.service.GeminiService;

@RestController
@RequestMapping("/api/audio")
public class AudioController {

    private final GeminiService geminiService;

    public AudioController(GeminiService geminiService) {
        this.geminiService = geminiService;
    }

    @PostMapping("/upload")
    public ResponseEntity<String> uploadAudio(@RequestParam("file") MultipartFile file) {
        System.out.println("Enviando audio a Gemini...");
        String jsonResult = geminiService.analyzeAudio(file);
        
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .body(jsonResult);
    }
}