package com.echohealth.backend.service;

import com.echohealth.backend.dto.SnomedConceptResponse;
import com.echohealth.backend.exception.SnowstormException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.util.List;

@Service
public class TerminologyServiceImpl implements TerminologyService {

    private static final Logger log = LoggerFactory.getLogger(TerminologyServiceImpl.class);

    private final RestClient restClient;

    public TerminologyServiceImpl(RestClient restClient) {
        this.restClient = restClient;
    }

    @Override
    public List<SnomedConceptResponse> searchConcepts(String query) {
        if (query == null || query.trim().isEmpty()) {
            log.warn("Empty query provided to SNOMED search");
            return List.of();
        }

        log.info("Searching SNOMED CT for: {}", query);

        try {
            SnowstormResponse response = restClient.get()
                    .uri(builder -> {
                        URI built = builder
                                .path("/browser/MAIN/SNOMEDCT-ES/descriptions")
                                .queryParam("term", query.trim())
                                .queryParam("active", true)
                                .queryParam("conceptActive", true)
                                .queryParam("language", "es")
                                .queryParam("limit", 10)
                                .build();
                        log.debug("SNOMED request URI: {}", built);
                        return built;
                    })
                    .header("Accept-Language", "es")
                    .retrieve()
                    .body(SnowstormResponse.class);

            if (response == null || response.items() == null) {
                log.warn("No results returned from SNOMED for query: {}", query);
                return List.of();
            }

            return response.items().stream()
                    .map(item -> new SnomedConceptResponse(
                            item.conceptId(),
                            item.term(),
                            item.active(),
                            item.semanticTag()
                    ))
                    .toList();

        } catch (Exception e) {
            log.error("Failed to search SNOMED CT for query '{}': {}", query, e.getMessage());
            throw new SnowstormException(
                    "Failed to search SNOMED CT terminology: " + e.getMessage(),
                    e,
                    true
            );
        }
    }

    private record SnowstormResponse(List<SnowstormItem> items) {}

    private record SnowstormItem(
            String conceptId,
            String term,
            boolean active,
            String semanticTag
    ) {}
}