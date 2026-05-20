package com.echohealth.backend.controller;

import com.echohealth.backend.model.Consultation;
import com.echohealth.backend.service.ConsultationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/consultations")
@CrossOrigin(origins = "*")
public class ConsultationController {

    @Autowired
    private ConsultationService service;

    @GetMapping
    public List<Consultation> getAll(Principal principal) {
        return service.findAllByUserId(principal.getName());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Consultation> getById(@PathVariable String id, Principal principal) {
        return service.findById(id)
                .filter(c -> c.getUserId().equals(principal.getName()))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Consultation save(@RequestBody Map<String, Object> payload, Principal principal) {
        return service.save(payload, principal.getName());
    }

    @PutMapping("/{id}")
    public ResponseEntity<Consultation> update(@PathVariable String id, @RequestBody Map<String, Object> payload,
            Principal principal) {
        return service.update(id, payload, principal.getName())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}