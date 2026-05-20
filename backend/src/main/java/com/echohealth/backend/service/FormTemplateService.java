package com.echohealth.backend.service;

import com.echohealth.backend.model.FormTemplate;
import com.echohealth.backend.model.FormTemplate.FormTemplateField;
import com.echohealth.backend.repository.FormTemplateRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

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

    @EventListener(ApplicationReadyEvent.class)
    public void seedDefaultTemplate() {
        if (repository.count() > 0) {
            log.info("Form templates already exist, skipping seed");
            return;
        }

        log.info("No form templates found. Seeding default 'Consulta General (Sistema)' template...");

        FormTemplate defaultTemplate = new FormTemplate();
        defaultTemplate.setName("Consulta General (Sistema)");
        defaultTemplate.setDescription("Plantilla estándar con campos vitales y motivo de consulta");
        defaultTemplate.setUserId("system");
        defaultTemplate.setDefault(true);
        defaultTemplate.setFields(buildDefaultFields());

        repository.save(defaultTemplate);
        log.info("Default form template 'Consulta General (Sistema)' created successfully");
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

        fields.add(createField("bloodPressure", "Presión arterial (mmHg)", "loinc-text",
                "85354-9", "Blood pressure panel", "clinical", false, "LOINC", false, true));

        fields.add(createField("oxygenSaturation", "Saturación de oxígeno (%)", "loinc-number",
                "2708-6", "Oxygen saturation", "clinical", false, "LOINC", false, true));

        fields.add(createField("painLocation", "Localización del dolor", "snomed-text",
                "70163-1", "Body site", "clinical", false, "LOINC", false, true));

        fields.add(createField("painNature", "Naturaleza del dolor", "snomed-text",
                "440751004", "Type of pain", "clinical", true, "SNOMED", false, true));

        fields.add(createField("painIntensity", "Intensidad del dolor (0-10)", "loinc-number",
                "72514-3", "Pain severity - 0-10", "clinical", false, "LOINC", false, true));

        return fields;
    }

    private FormTemplateField createField(String id, String label, String type,
                                          String conceptId, String term, String semanticTag,
                                          boolean conceptVerified, String terminology,
                                          boolean required, boolean removable) {
        FormTemplateField field = new FormTemplateField();
        field.setId(id);
        field.setLabel(label);
        field.setType(type);
        field.setConceptId(conceptId);
        field.setTerm(term);
        field.setSemanticTag(semanticTag);
        field.setConceptVerified(conceptVerified);
        field.setTerminology(terminology);
        field.setRequired(required);
        field.setRemovable(removable);
        return field;
    }

    public List<FormTemplate> findByUserId(String userId) {
        List<FormTemplate> systemDefaults = repository.findByUserId("system");
        List<FormTemplate> userTemplates = repository.findByUserId(userId);

        if (systemDefaults.isEmpty()) {
            log.warn("No system default templates found! Seeding...");
            seedDefaultTemplate();
            systemDefaults = repository.findByUserId("system");
        }

        List<FormTemplate> result = new ArrayList<>(systemDefaults);
        result.addAll(userTemplates);
        log.info("Returning {} templates for user {} ({} system + {} user)",
                result.size(), userId, systemDefaults.size(), userTemplates.size());
        return result;
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

        List<FormTemplateField> deepCopyFields = new ArrayList<>();
        for (FormTemplateField f : source.getFields()) {
            deepCopyFields.add(createField(f.getId(), f.getLabel(), f.getType(),
                    f.getConceptId(), f.getTerm(), f.getSemanticTag(),
                    f.isConceptVerified(), f.getTerminology(),
                    f.isRequired(), f.isRemovable()));
        }
        copy.setFields(deepCopyFields);

        return repository.save(copy);
    }

    public void delete(String id, String userId) {
        FormTemplate template = repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Template not found"));

        if ("system".equals(template.getUserId())) {
            log.warn("User {} attempted to delete system template {}", userId, id);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "System templates cannot be deleted");
        }

        if (!template.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Template not found");
        }

        repository.deleteById(id);
        log.info("Deleted form template {} for user {}", id, userId);
    }
}
