package com.echohealth.backend.controller;

import com.echohealth.backend.model.Consultation;
import com.echohealth.backend.repository.ConsultationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/consultations")
@CrossOrigin(origins = "*")
public class ConsultationController {

    @Autowired
    private ConsultationRepository repository;

    @GetMapping
    public List<Consultation> getAll() {
        return repository.findAllByOrderByCreatedAtDesc();
    }

    @PostMapping
    public Consultation save(@RequestBody String jsonBody) {
        Consultation consultation = new Consultation();
        consultation.setContentJson(jsonBody);
        return repository.save(consultation);
    }
}