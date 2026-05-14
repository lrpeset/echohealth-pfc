package com.echohealth.backend.repository;

import com.echohealth.backend.model.FormTemplate;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FormTemplateRepository extends MongoRepository<FormTemplate, String> {

    List<FormTemplate> findByUserId(String userId);

    long count();
}
