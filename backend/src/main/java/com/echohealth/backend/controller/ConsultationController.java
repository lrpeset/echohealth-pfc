package com.echohealth.backend.controller;

import com.echohealth.backend.model.Consultation;
import com.echohealth.backend.service.ConsultationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
    public Consultation save(@RequestBody String jsonBody) {
        return service.save(jsonBody);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Consultation> update(@PathVariable Long id, @RequestBody String jsonBody) {
        return service.update(id, jsonBody)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}