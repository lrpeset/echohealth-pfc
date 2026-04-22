package com.echohealth.backend.controller;

import com.echohealth.backend.model.Consultation;
import com.echohealth.backend.service.ConsultationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/consultations")
@CrossOrigin(origins = "*")
public class ConsultationController {

    @Autowired
    private ConsultationService service;

    @GetMapping
    public List<Consultation> getAll() {
        return service.findAll();
    }

    @PostMapping
    public Consultation save(@RequestBody Map<String, Object> payload) {
        return service.save(payload);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Consultation> update(@PathVariable String id, @RequestBody Map<String, Object> payload) {
        return service.update(id, payload)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}