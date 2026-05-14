package com.echohealth.backend.service;

import com.echohealth.backend.model.Consultation;
import com.echohealth.backend.model.Consultation.ConsultationField;
import com.echohealth.backend.repository.ConsultationRepository;
import com.echohealth.backend.util.ClinicalConstants;
import com.echohealth.backend.util.SnomedConstants;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class ConsultationService {

    private static final Logger log = LoggerFactory.getLogger(ConsultationService.class);

    @Autowired
    private ConsultationRepository repository;

    public List<Consultation> findAllByUserId(String userId) {
        return repository.findByUserId(userId);
    }

    public Optional<Consultation> findById(String id) {
        return repository.findById(id);
    }

    @SuppressWarnings("deprecation")
    public Consultation save(Map<String, Object> payload, String userId) {
        Consultation consultation = new Consultation();
        consultation.setUserId(userId);
        consultation.setCreatedAt(LocalDateTime.now());
        consultation.setUpdatedAt(LocalDateTime.now());

        if (payload.containsKey("fields") && payload.get("fields") instanceof List) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> fieldsData = (List<Map<String, Object>>) payload.get("fields");
            List<ConsultationField> fields = mapToFields(fieldsData);
            consultation.setFields(fields);
            consultation.setContent(convertFieldsToContent(fields));
            log.info("Saved consultation with {} structured fields", fieldsData.size());
        } else {
            Map<String, Object> contentPayload = (Map<String, Object>) payload;
            List<ConsultationField> fields = convertLegacyToFields(contentPayload);
            consultation.setFields(fields);
            consultation.setContent(contentPayload);
            log.info("Saved consultation with legacy content (converted to structured fields)");
        }

        return repository.save(consultation);
    }

    @SuppressWarnings("deprecation")
    public Optional<Consultation> update(String id, Map<String, Object> newPayload, String userId) {
        return repository.findById(id)
                .filter(c -> c.getUserId().equals(userId))
                .map(existingConsultation -> {
                    existingConsultation.setUpdatedAt(LocalDateTime.now());

                    if (newPayload.containsKey("fields") && newPayload.get("fields") instanceof List) {
                        @SuppressWarnings("unchecked")
                        List<Map<String, Object>> fieldsData = (List<Map<String, Object>>) newPayload.get("fields");
                        List<ConsultationField> fields = mapToFields(fieldsData);
                        existingConsultation.setFields(fields);
                        existingConsultation.setContent(convertFieldsToContent(fields));
                        log.info("Updated consultation {} with {} structured fields", id, fieldsData.size());
                    } else if (newPayload.containsKey("content") && newPayload.get("content") instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> contentPayload = (Map<String, Object>) newPayload.get("content");
                        List<ConsultationField> fields = convertLegacyToFields(contentPayload);
                        existingConsultation.setFields(fields);
                        existingConsultation.setContent(contentPayload);
                        log.info("Updated consultation {} with legacy content", id);
                    }

                    return repository.save(existingConsultation);
                });
    }

    private List<ConsultationField> mapToFields(List<Map<String, Object>> fieldsData) {
        List<ConsultationField> fields = new ArrayList<>();

        for (Map<String, Object> fieldData : fieldsData) {
            ConsultationField field = new ConsultationField();
            field.setId((String) fieldData.get("id"));
            field.setLabel((String) fieldData.get("label"));
            field.setType((String) fieldData.get("type"));
            field.setValue(fieldData.get("value"));
            field.setConceptId((String) fieldData.get("conceptId"));
            field.setTerm((String) fieldData.get("term"));
            field.setSemanticTag((String) fieldData.get("semanticTag"));
            field.setConceptVerified(fieldData.get("conceptVerified") != null 
                    && (Boolean) fieldData.get("conceptVerified"));
            field.setTerminology((String) fieldData.get("terminology"));
            fields.add(field);
        }

        return fields;
    }

    private List<ConsultationField> convertLegacyToFields(Map<String, Object> content) {
        List<ConsultationField> fields = new ArrayList<>();

        if (content.containsKey("reasonForVisit")) {
            ConsultationField field = new ConsultationField();
            field.setId(SnomedConstants.FieldDefaults.REASON_FOR_VISIT_ID);
            field.setLabel(SnomedConstants.FieldDefaults.REASON_FOR_VISIT_LABEL);
            field.setType(SnomedConstants.FieldDefaults.REASON_FOR_VISIT_TYPE);
            field.setValue(content.get("reasonForVisit"));
            fields.add(field);
        }

        if (content.containsKey("category")) {
            ConsultationField field = new ConsultationField();
            field.setId("category");
            field.setLabel("Categoría");
            field.setType("text");
            field.setValue(content.get("category"));
            fields.add(field);
        }

        if (content.containsKey("height")) {
            ConsultationField field = new ConsultationField();
            field.setId(ClinicalConstants.FieldDefaults.HEIGHT_ID);
            field.setLabel(ClinicalConstants.FieldDefaults.HEIGHT_LABEL);
            field.setType(ClinicalConstants.FieldDefaults.HEIGHT_TYPE);
            field.setValue(content.get("height"));
            field.setConceptId(ClinicalConstants.Concepts.HEIGHT);
            field.setTerm(ClinicalConstants.Terms.HEIGHT);
            field.setTerminology("LOINC");
            fields.add(field);
        }

        if (content.containsKey("weight")) {
            ConsultationField field = new ConsultationField();
            field.setId(ClinicalConstants.FieldDefaults.WEIGHT_ID);
            field.setLabel(ClinicalConstants.FieldDefaults.WEIGHT_LABEL);
            field.setType(ClinicalConstants.FieldDefaults.WEIGHT_TYPE);
            field.setValue(content.get("weight"));
            field.setConceptId(ClinicalConstants.Concepts.WEIGHT);
            field.setTerm(ClinicalConstants.Terms.WEIGHT);
            field.setTerminology("LOINC");
            fields.add(field);
        }

        if (content.containsKey("pulse")) {
            ConsultationField field = new ConsultationField();
            field.setId(ClinicalConstants.FieldDefaults.PULSE_ID);
            field.setLabel(ClinicalConstants.FieldDefaults.PULSE_LABEL);
            field.setType(ClinicalConstants.FieldDefaults.PULSE_TYPE);
            field.setValue(content.get("pulse"));
            field.setConceptId(ClinicalConstants.Concepts.PULSE);
            field.setTerm(ClinicalConstants.Terms.PULSE);
            field.setTerminology("LOINC");
            fields.add(field);
        }

        if (content.containsKey("bloodPressure")) {
            ConsultationField field = new ConsultationField();
            field.setId(ClinicalConstants.FieldDefaults.BLOOD_PRESSURE_ID);
            field.setLabel(ClinicalConstants.FieldDefaults.BLOOD_PRESSURE_LABEL);
            field.setType(ClinicalConstants.FieldDefaults.BLOOD_PRESSURE_TYPE);
            field.setValue(content.get("bloodPressure"));
            field.setConceptId(ClinicalConstants.Concepts.BLOOD_PRESSURE);
            field.setTerm(ClinicalConstants.Terms.BLOOD_PRESSURE);
            field.setTerminology("LOINC");
            fields.add(field);
        }

        if (content.containsKey("oxygenSaturation")) {
            ConsultationField field = new ConsultationField();
            field.setId(ClinicalConstants.FieldDefaults.OXYGEN_SATURATION_ID);
            field.setLabel(ClinicalConstants.FieldDefaults.OXYGEN_SATURATION_LABEL);
            field.setType(ClinicalConstants.FieldDefaults.OXYGEN_SATURATION_TYPE);
            field.setValue(content.get("oxygenSaturation"));
            field.setConceptId(ClinicalConstants.Concepts.OXYGEN_SATURATION);
            field.setTerm(ClinicalConstants.Terms.OXYGEN_SATURATION);
            field.setTerminology("LOINC");
            fields.add(field);
        }

        if (content.containsKey("painLocation")) {
            ConsultationField field = new ConsultationField();
            field.setId(ClinicalConstants.FieldDefaults.PAIN_LOCATION_ID);
            field.setLabel(ClinicalConstants.FieldDefaults.PAIN_LOCATION_LABEL);
            field.setType(ClinicalConstants.FieldDefaults.PAIN_LOCATION_TYPE);
            field.setValue(content.get("painLocation"));
            field.setConceptId(ClinicalConstants.Concepts.PAIN_LOCATION);
            field.setTerm(ClinicalConstants.Terms.PAIN_LOCATION);
            field.setTerminology("LOINC");
            fields.add(field);
        }

        if (content.containsKey("painNature")) {
            ConsultationField field = new ConsultationField();
            field.setId(ClinicalConstants.FieldDefaults.PAIN_NATURE_ID);
            field.setLabel(ClinicalConstants.FieldDefaults.PAIN_NATURE_LABEL);
            field.setType(ClinicalConstants.FieldDefaults.PAIN_NATURE_TYPE);
            field.setValue(content.get("painNature"));
            field.setConceptId(ClinicalConstants.Concepts.PAIN_NATURE);
            field.setTerm(ClinicalConstants.Terms.PAIN_NATURE);
            field.setTerminology("SNOMED");
            fields.add(field);
        }

        if (content.containsKey("painIntensity")) {
            ConsultationField field = new ConsultationField();
            field.setId(ClinicalConstants.FieldDefaults.PAIN_INTENSITY_ID);
            field.setLabel(ClinicalConstants.FieldDefaults.PAIN_INTENSITY_LABEL);
            field.setType(ClinicalConstants.FieldDefaults.PAIN_INTENSITY_TYPE);
            field.setValue(content.get("painIntensity"));
            field.setConceptId(ClinicalConstants.Concepts.PAIN_INTENSITY);
            field.setTerm(ClinicalConstants.Terms.PAIN_INTENSITY);
            field.setTerminology("LOINC");
            fields.add(field);
        }

        return fields;
    }

    private Map<String, Object> convertFieldsToContent(List<ConsultationField> fields) {
        Map<String, Object> content = new HashMap<>();
        for (ConsultationField field : fields) {
            if (field.getId() != null && field.getValue() != null) {
                content.put(field.getId(), field.getValue());
            }
        }
        return content;
    }
}