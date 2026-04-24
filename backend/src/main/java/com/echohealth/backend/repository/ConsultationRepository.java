package com.echohealth.backend.repository;

import com.echohealth.backend.model.Consultation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConsultationRepository extends MongoRepository<Consultation, String> {

    List<Consultation> findByUserId(String userId);
}