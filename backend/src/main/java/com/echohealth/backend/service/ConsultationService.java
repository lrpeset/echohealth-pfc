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

    public List<Consultation> findAllByUserId(String userId) {
        return repository.findByUserId(userId);
    }

    public Consultation save(Map<String, Object> payload, String userId) {
        Consultation consultation = new Consultation();
        consultation.setContent(payload);
        consultation.setUserId(userId);
        return repository.save(consultation);
    }

    public Optional<Consultation> update(String id, Map<String, Object> newPayload, String userId) {
        return repository.findById(id).filter(c -> c.getUserId().equals(userId))
                .map(existingConsultation -> {
                    existingConsultation.setContent(newPayload);
                    return repository.save(existingConsultation);
        });
    }
}