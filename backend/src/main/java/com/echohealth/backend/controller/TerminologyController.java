package com.echohealth.backend.controller;

import com.echohealth.backend.dto.SnomedConceptResponse;
import com.echohealth.backend.exception.SnowstormException;
import com.echohealth.backend.service.TerminologyService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;

@RestController
@RequestMapping("/api/terminology")
@CrossOrigin(origins = "*")
public class TerminologyController {

    private static final Logger log = LoggerFactory.getLogger(TerminologyController.class);

    private final TerminologyService terminologyService;

    public TerminologyController(TerminologyService terminologyService) {
        this.terminologyService = terminologyService;
    }

    @GetMapping("/search")
    public ResponseEntity<List<SnomedConceptResponse>> search(
            @RequestParam("q") String query) {

        log.info("Terminology search request for query: {}", query);

        if (query == null || query.trim().isEmpty()) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        try {
            List<SnomedConceptResponse> results = terminologyService.searchConcepts(query);
            log.info("Found {} concepts for query: {}", results.size(), query);
            return ResponseEntity.ok(results);
        } catch (SnowstormException e) {
            log.error("SNOMED search failed: {}", e.getMessage());
            return ResponseEntity.status(503)
                    .body(Collections.emptyList());
        }
    }
}