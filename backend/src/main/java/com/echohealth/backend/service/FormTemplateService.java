package com.echohealth.backend.service;

import com.echohealth.backend.model.FormTemplate;
import com.echohealth.backend.model.FormTemplate.FormTemplateField;
import com.echohealth.backend.repository.FormTemplateRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class FormTemplateService {

    private static final Logger log = LoggerFactory.getLogger(FormTemplateService.class);

    private final FormTemplateRepository repository;

    public FormTemplateService(FormTemplateRepository repository) {
        this.repository = repository;
    }

    @PostConstruct
    public void seedDefaultTemplate() {
        if (repository.count() > 0) {
            log.info("Form templates already exist, skipping seed");
            return;
        }

        log.info("No form templates found. Seeding default 'Consulta General' template...");

        FormTemplate defaultTemplate = new FormTemplate();
        defaultTemplate.setName("Consulta General");
        defaultTemplate.setDescription("Plantilla estándar con campos vitales y motivo de consulta");
        defaultTemplate.setUserId("system");
        defaultTemplate.setFields(buildDefaultFields());

        repository.save(defaultTemplate);
        log.info("Default form template 'Consulta General' created successfully");
    }

    private List<FormTemplateField> buildDefaultFields() {
        List<FormTemplateField> fields = new ArrayList<>();

        fields.add(createField("reasonForVisit", "Motivo de la visita", "snomed-text",
                null, null, null, false, "SNOMED", true, false));

        fields.add(createField("height", "Altura (cm)", "loinc-number",
                "8302-2", "Body height", "clinical", false, "LOINC", false, true));

        fields.add(createField("weight", "Peso (kg)", "loinc-number",
                "29463-7", "Body weight", "clinical", false, "LOINC", false, true));

        fields.add(createField("pulse", "Pulso (ppm)", "loinc-number",
                "8867-4", "Heart rate", "clinical", false, "LOINC", false, true));

        return fields;
    }

    private FormTemplateField createField(String id, String label, String type,
                                          String conceptId, String term, String semanticTag,
                                          boolean snomedVerified, String terminology,
                                          boolean required, boolean removable) {
        FormTemplateField field = new FormTemplateField();
        field.setId(id);
        field.setLabel(label);
        field.setType(type);
        field.setConceptId(conceptId);
        field.setTerm(term);
        field.setSemanticTag(semanticTag);
        field.setSnomedVerified(snomedVerified);
        field.setTerminology(terminology);
        field.setRequired(required);
        field.setRemovable(removable);
        return field;
    }

    public List<FormTemplate> findByUserId(String userId) {
        List<FormTemplate> userTemplates = repository.findByUserId(userId);
        if (userTemplates.isEmpty()) {
            log.info("User {} has no templates. Returning system default.", userId);
            List<FormTemplate> systemDefaults = repository.findByUserId("system");
            if (!systemDefaults.isEmpty()) {
                return systemDefaults;
            }
        }
        return userTemplates;
    }

    public Optional<FormTemplate> findById(String id) {
        return repository.findById(id);
    }

    public FormTemplate save(FormTemplate template, String userId) {
        template.setUserId(userId);
        template.setUpdatedAt(LocalDateTime.now());
        if (template.getCreatedAt() == null) {
            template.setCreatedAt(LocalDateTime.now());
        }
        return repository.save(template);
    }

    public FormTemplate createFromDefault(String userId) {
        List<FormTemplate> systemDefaults = repository.findByUserId("system");
        if (systemDefaults.isEmpty()) {
            seedDefaultTemplate();
            systemDefaults = repository.findByUserId("system");
        }

        FormTemplate source = systemDefaults.get(0);
        FormTemplate copy = new FormTemplate();
        copy.setName(source.getName());
        copy.setDescription(source.getDescription());
        copy.setUserId(userId);
        copy.setFields(source.getFields());

        return repository.save(copy);
    }

    public boolean delete(String id, String userId) {
        return repository.findById(id)
                .filter(t -> t.getUserId().equals(userId))
                .filter(t -> !"system".equals(t.getUserId()))
                .map(t -> {
                    repository.deleteById(id);
                    log.info("Deleted form template {} for user {}", id, userId);
                    return true;
                })
                .orElseGet(() -> {
                    log.warn("Cannot delete template {}: not owned by {} or is system template", id, userId);
                    return false;
                });
    }
}
