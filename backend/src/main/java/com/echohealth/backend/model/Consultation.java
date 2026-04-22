package com.echohealth.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.Map;

@Data
@Document(collection = "consultations")
public class Consultation {

    @Id
    private String id;

    private LocalDateTime createdAt;
    
    private Map<String, Object> content; 
    
    public Consultation() {
        this.createdAt = LocalDateTime.now();
    }
}