package com.echohealth.backend.service;

import com.echohealth.backend.dto.ConceptResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Collections;
import java.util.List;

@Service("loincService")
public class LoincServiceImpl implements TerminologyService {

    private static final Logger log = LoggerFactory.getLogger(LoincServiceImpl.class);

    private final RestClient fhirRestClient;

    public LoincServiceImpl(@Qualifier("loincFhirRestClient") RestClient fhirRestClient) {
        this.fhirRestClient = fhirRestClient;
    }

    @Override
    public List<ConceptResponse> searchConcepts(String query) {
        if (query == null || query.trim().isEmpty()) {
            log.warn("Empty query provided to LOINC FHIR search");
            return List.of();
        }

        log.info("Searching LOINC via FHIR ValueSet/$expand for: {}", query);

        try {
            FhirValueSetResponse response = fhirRestClient.get()
                    .uri(builder -> builder
                            .path("/ValueSet/$expand")
                            .queryParam("url", "http://loinc.org/vs")
                            .queryParam("filter", query.trim())
                            .queryParam("count", 15)
                            .queryParam("displayLanguage", "es")
                            .build())
                    .retrieve()
                    .body(FhirValueSetResponse.class);

            if (response == null || response.expansion() == null
                    || response.expansion().contains() == null) {
                log.warn("No LOINC results from FHIR for query: {}", query);
                return List.of();
            }

            List<ConceptResponse> results = response.expansion().contains().stream()
                    .map(item -> new ConceptResponse(
                            item.code(),
                            item.display(),
                            true,
                            "clinical",
                            "LOINC"
                    ))
                    .toList();

            log.info("Found {} LOINC concepts for query: {}", results.size(), query);
            return results;

        } catch (Exception e) {
            log.error("LOINC FHIR search failed for query '{}': {}", query, e.getMessage());
            return Collections.emptyList();
        }
    }

    private record FhirValueSetResponse(FhirExpansion expansion) {}
    private record FhirExpansion(List<FhirContains> contains) {}
    private record FhirContains(String code, String display) {}
}
