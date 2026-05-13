package com.echohealth.backend.dto;

public record SnomedConceptResponse(
    String conceptId,
    String term,
    boolean active,
    String semanticTag
) {}