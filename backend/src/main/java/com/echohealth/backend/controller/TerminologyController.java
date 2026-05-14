package com.echohealth.backend.controller;

import com.echohealth.backend.dto.ConceptResponse;
import com.echohealth.backend.exception.TerminologyException;
import com.echohealth.backend.service.TerminologyService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;

@RestController
@RequestMapping("/api/terminology")
@CrossOrigin(origins = "*")
public class TerminologyController {

    private static final Logger log = LoggerFactory.getLogger(TerminologyController.class);

    private final TerminologyService snomedService;
    private final TerminologyService loincService;

    public TerminologyController(
            @Qualifier("snomedService") TerminologyService snomedService,
            @Qualifier("loincService") TerminologyService loincService) {
        this.snomedService = snomedService;
        this.loincService = loincService;
    }

    @GetMapping("/search")
    public ResponseEntity<List<ConceptResponse>> search(
            @RequestParam("q") String query,
            @RequestParam(value = "system", defaultValue = "SNOMED") String system) {

        log.info("Terminology search request for query '{}' with system: {}", query, system);

        if (query == null || query.trim().isEmpty()) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        try {
            List<ConceptResponse> results;
            if ("LOINC".equalsIgnoreCase(system)) {
                results = loincService.searchConcepts(query);
            } else {
                results = snomedService.searchConcepts(query);
            }
            log.info("Found {} concepts for query: {} (system: {})", results.size(), query, system);
            return ResponseEntity.ok(results);
        } catch (TerminologyException e) {
            log.error("Terminology search failed: {}", e.getMessage());
            return ResponseEntity.status(503)
                    .body(Collections.emptyList());
        }
    }
}
