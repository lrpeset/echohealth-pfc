package com.echohealth.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.Map;

@RestController
@RequestMapping("/api/audio")
public class AudioController {

    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> uploadAudio(@RequestParam("file") MultipartFile file) {
        System.out.println("======= ARCHIVO RECIBIDO =======");
        System.out.println("Nombre: " + file.getOriginalFilename());
        System.out.println("Tamaño: " + file.getSize() + " bytes");
        System.out.println("Tipo: " + file.getContentType());
        System.out.println("================================");

        return ResponseEntity.ok(Map.of(
            "status", "success",
            "message", "¡Isaac, el audio ha llegado al servidor!",
            "fileName", file.getOriginalFilename()
        ));
    }
}