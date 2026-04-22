package com.echohealth.backend.service;

import com.echohealth.backend.model.Consultation;
import com.echohealth.backend.repository.ConsultationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class ConsultationService {

    @Autowired
    private ConsultationRepository repository;

    public List<Consultation> findAll() {
        return repository.findAllByOrderByCreatedAtDesc();
    }

    public Consultation save(Map<String, Object> payload) {
        Consultation consultation = new Consultation();
        consultation.setContent(payload);
        return repository.save(consultation);
    }

    public Optional<Consultation> update(String id, Map<String, Object> newPayload) {
        return repository.findById(id).map(existingConsultation -> {
            existingConsultation.setContent(newPayload);
            return repository.save(existingConsultation);
        });
    }
}