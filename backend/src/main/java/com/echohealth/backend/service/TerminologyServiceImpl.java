package com.echohealth.backend.service;

import com.echohealth.backend.dto.ConceptResponse;
import com.echohealth.backend.exception.TerminologyException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;

@Service("snomedService")
public class TerminologyServiceImpl implements TerminologyService {

    private static final Logger log = LoggerFactory.getLogger(TerminologyServiceImpl.class);

    private final RestClient fhirRestClient;
    private final String fhirBaseUrl;

    public TerminologyServiceImpl(@Qualifier("snomedFhirRestClient") RestClient fhirRestClient,
                                   @Value("${snomed.fhir-base-url}") String fhirBaseUrl) {
        this.fhirRestClient = fhirRestClient;
        this.fhirBaseUrl = fhirBaseUrl;
    }

    @Override
    public List<ConceptResponse> searchConcepts(String query) {
        if (query == null || query.trim().isEmpty()) {
            log.warn("Empty query provided to SNOMED search");
            return List.of();
        }

        String trimmed = query.trim();
        log.info("Buscando en {} con términos: {} | ValueSet: {} | displayLanguage: es | count: 15",
                fhirBaseUrl, trimmed, "http://snomed.info/sct?fhir_vs");

        List<ConceptResponse> results = searchViaFhir(trimmed);
        log.info("Encontrados {} conceptos SNOMED para '{}'", results.size(), trimmed);
        return results;
    }

    private List<ConceptResponse> searchViaFhir(String query) {
        try {
            log.info("SNOMED FHIR request: filter={}, count=15, displayLanguage=es, edition=SNOMED CT International", query);

            FhirValueSetResponse response = fhirRestClient.get()
                    .uri(builder -> builder
                            .path("/ValueSet/$expand")
                            .queryParam("url", "http://snomed.info/sct?fhir_vs")
                            .queryParam("filter", query)
                            .queryParam("count", 15)
                            .queryParam("displayLanguage", "es")
                            .build())
                    .retrieve()
                    .body(FhirValueSetResponse.class);

            if (response == null || response.expansion() == null
                    || response.expansion().contains() == null
                    || response.expansion().contains().isEmpty()) {
                return List.of();
            }

            return response.expansion().contains().stream()
                    .map(item -> new ConceptResponse(
                            item.code(),
                            item.display() != null ? item.display() : query,
                            true,
                            "clinical",
                            "SNOMED"
                    ))
                    .toList();

        } catch (Exception e) {
            log.error("SNOMED FHIR search failed for query '{}': {}", query, e.getMessage());
            throw new TerminologyException(
                    "Failed to search SNOMED CT terminology: " + e.getMessage(),
                    e
            );
        }
    }

    private record FhirValueSetResponse(FhirExpansion expansion) {}
    private record FhirExpansion(List<FhirContains> contains) {}
    private record FhirContains(String code, String display) {}
}
