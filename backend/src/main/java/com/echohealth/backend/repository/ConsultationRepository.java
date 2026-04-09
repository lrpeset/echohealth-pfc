package com.echohealth.backend.repository;

import com.echohealth.backend.model.Consultation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ConsultationRepository extends JpaRepository<Consultation, Long> {
    
    List<Consultation> findAllByOrderByCreatedAtDesc();
}