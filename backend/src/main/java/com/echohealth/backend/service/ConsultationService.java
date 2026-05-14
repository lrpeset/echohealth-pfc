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

    private static final Map<String, FieldMetadata> LEGACY_FIELD_METADATA = new HashMap<>();
    static {
        LEGACY_FIELD_METADATA.put("reasonForVisit", new FieldMetadata(
                SnomedConstants.FieldDefaults.REASON_FOR_VISIT_ID,
                SnomedConstants.FieldDefaults.REASON_FOR_VISIT_LABEL,
                SnomedConstants.FieldDefaults.REASON_FOR_VISIT_TYPE, null, null, "SNOMED"));
        LEGACY_FIELD_METADATA.put("category", new FieldMetadata("category", "Categoría", "text", null, null, "SNOMED"));
        LEGACY_FIELD_METADATA.put("height", new FieldMetadata(
                ClinicalConstants.FieldDefaults.HEIGHT_ID,
                ClinicalConstants.FieldDefaults.HEIGHT_LABEL,
                ClinicalConstants.FieldDefaults.HEIGHT_TYPE,
                ClinicalConstants.Concepts.HEIGHT, ClinicalConstants.Terms.HEIGHT, "LOINC"));
        LEGACY_FIELD_METADATA.put("weight", new FieldMetadata(
                ClinicalConstants.FieldDefaults.WEIGHT_ID,
                ClinicalConstants.FieldDefaults.WEIGHT_LABEL,
                ClinicalConstants.FieldDefaults.WEIGHT_TYPE,
                ClinicalConstants.Concepts.WEIGHT, ClinicalConstants.Terms.WEIGHT, "LOINC"));
        LEGACY_FIELD_METADATA.put("pulse", new FieldMetadata(
                ClinicalConstants.FieldDefaults.PULSE_ID,
                ClinicalConstants.FieldDefaults.PULSE_LABEL,
                ClinicalConstants.FieldDefaults.PULSE_TYPE,
                ClinicalConstants.Concepts.PULSE, ClinicalConstants.Terms.PULSE, "LOINC"));
        LEGACY_FIELD_METADATA.put("bloodPressure", new FieldMetadata(
                ClinicalConstants.FieldDefaults.BLOOD_PRESSURE_ID,
                ClinicalConstants.FieldDefaults.BLOOD_PRESSURE_LABEL,
                ClinicalConstants.FieldDefaults.BLOOD_PRESSURE_TYPE,
                ClinicalConstants.Concepts.BLOOD_PRESSURE, ClinicalConstants.Terms.BLOOD_PRESSURE, "LOINC"));
        LEGACY_FIELD_METADATA.put("oxygenSaturation", new FieldMetadata(
                ClinicalConstants.FieldDefaults.OXYGEN_SATURATION_ID,
                ClinicalConstants.FieldDefaults.OXYGEN_SATURATION_LABEL,
                ClinicalConstants.FieldDefaults.OXYGEN_SATURATION_TYPE,
                ClinicalConstants.Concepts.OXYGEN_SATURATION, ClinicalConstants.Terms.OXYGEN_SATURATION, "LOINC"));
        LEGACY_FIELD_METADATA.put("painLocation", new FieldMetadata(
                ClinicalConstants.FieldDefaults.PAIN_LOCATION_ID,
                ClinicalConstants.FieldDefaults.PAIN_LOCATION_LABEL,
                ClinicalConstants.FieldDefaults.PAIN_LOCATION_TYPE,
                ClinicalConstants.Concepts.PAIN_LOCATION, ClinicalConstants.Terms.PAIN_LOCATION, "LOINC"));
        LEGACY_FIELD_METADATA.put("painNature", new FieldMetadata(
                ClinicalConstants.FieldDefaults.PAIN_NATURE_ID,
                ClinicalConstants.FieldDefaults.PAIN_NATURE_LABEL,
                ClinicalConstants.FieldDefaults.PAIN_NATURE_TYPE,
                ClinicalConstants.Concepts.PAIN_NATURE, ClinicalConstants.Terms.PAIN_NATURE, "SNOMED"));
        LEGACY_FIELD_METADATA.put("painIntensity", new FieldMetadata(
                ClinicalConstants.FieldDefaults.PAIN_INTENSITY_ID,
                ClinicalConstants.FieldDefaults.PAIN_INTENSITY_LABEL,
                ClinicalConstants.FieldDefaults.PAIN_INTENSITY_TYPE,
                ClinicalConstants.Concepts.PAIN_INTENSITY, ClinicalConstants.Terms.PAIN_INTENSITY, "LOINC"));
    }

    private record FieldMetadata(String id, String label, String type, String conceptId, String term, String terminology) {}

    private List<ConsultationField> convertLegacyToFields(Map<String, Object> content) {
        List<ConsultationField> fields = new ArrayList<>();

        for (Map.Entry<String, Object> entry : content.entrySet()) {
            String key = entry.getKey();
            Object value = entry.getValue();
            if (value == null) continue;

            FieldMetadata meta = LEGACY_FIELD_METADATA.get(key);
            ConsultationField field = new ConsultationField();
            if (meta != null) {
                field.setId(meta.id());
                field.setLabel(meta.label());
                field.setType(meta.type());
                field.setConceptId(meta.conceptId());
                field.setTerm(meta.term());
                field.setTerminology(meta.terminology());
            } else {
                field.setId(key);
                field.setLabel(key);
                field.setType(value instanceof Number ? "loinc-number" : "snomed-text");
                field.setTerminology("SNOMED");
            }
            field.setValue(value);
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