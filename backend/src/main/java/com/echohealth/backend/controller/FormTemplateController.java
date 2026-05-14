package com.echohealth.backend.controller;

import com.echohealth.backend.model.FormTemplate;
import com.echohealth.backend.service.FormTemplateService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/forms")
@CrossOrigin(origins = "*")
public class FormTemplateController {

    private static final Logger log = LoggerFactory.getLogger(FormTemplateController.class);

    private final FormTemplateService service;

    public FormTemplateController(FormTemplateService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<FormTemplate>> getAll(Principal principal) {
        String userId = principal.getName();
        log.info("Fetching form templates for user: {}", userId);
        List<FormTemplate> templates = service.findByUserId(userId);
        return ResponseEntity.ok(templates);
    }

    @GetMapping("/{id}")
    public ResponseEntity<FormTemplate> getById(@PathVariable String id, Principal principal) {
        log.info("Fetching form template {} for user {}", id, principal.getName());
        return service.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<FormTemplate> save(@RequestBody FormTemplate payload, Principal principal) {
        String userId = principal.getName();
        log.info("Saving form template '{}' for user {}", payload.getName(), userId);
        FormTemplate saved = service.save(payload, userId);
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/init")
    public ResponseEntity<FormTemplate> initFromDefault(Principal principal) {
        String userId = principal.getName();
        log.info("Initializing default template for user {}", userId);
        FormTemplate template = service.createFromDefault(userId);
        return ResponseEntity.ok(template);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id, Principal principal) {
        String userId = principal.getName();
        log.info("Deleting form template {} for user {}", id, userId);
        if (service.delete(id, userId)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
