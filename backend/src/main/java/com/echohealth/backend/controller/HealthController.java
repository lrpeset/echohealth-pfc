package com.echohealth.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

@RestController
public class HealthController {

    @GetMapping("/api/health")
    public Map<String, String> healthCheck() {
        return Map.of(
            "status", "up",
            "message", "EchoHealth Backend is alive!",
            "version", "4.0.5"
        );
    }
}