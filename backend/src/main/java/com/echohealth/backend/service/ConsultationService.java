package com.echohealth.backend.service;

import com.echohealth.backend.model.Consultation;
import com.echohealth.backend.repository.ConsultationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class ConsultationService {

    @Autowired
    private ConsultationRepository repository;

    public List<Consultation> findAll() {
        return repository.findAllByOrderByCreatedAtDesc();
    }

    public Consultation save(String jsonBody) {
        Consultation consultation = new Consultation();
        consultation.setContentJson(jsonBody);
        return repository.save(consultation);
    }

    public Optional<Consultation> update(Long id, String newJsonBody) {
        return repository.findById(id).map(existingConsultation -> {
            existingConsultation.setContentJson(newJsonBody);
            return repository.save(existingConsultation);
        });
    }
}