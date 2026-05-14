package com.echohealth.backend.dto;

public record ConceptResponse(
    String conceptId,
    String term,
    boolean active,
    String semanticTag,
    String system
) {

    public ConceptResponse(String conceptId, String term, boolean active, String semanticTag) {
        this(conceptId, term, active, semanticTag, "SNOMED");
    }
}