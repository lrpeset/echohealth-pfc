package com.echohealth.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@Document(collection = "consultations")
public class Consultation {

    @Id
    private String id;

    private String userId;
    
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private List<ConsultationField> fields;

    /**
     * @deprecated Use {@link #fields} instead. 
     * Kept for backward compatibility with existing consultations in the database.
     * New code should always use the structured 'fields' format.
     */
    @Deprecated
    private Map<String, Object> content;

    public Consultation() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public static class ConsultationField {
        
        private String id;
        
        private String label;
        
        private String type;
        
        private Object value;
        
        private String conceptId;
        
        private String term;
        
        private String semanticTag;
        
        private boolean snomedVerified;

        private String terminology = "SNOMED";

        public ConsultationField() {}

        public ConsultationField(String id, String label, String type, Object value, 
                                String conceptId, String term, String semanticTag, boolean snomedVerified) {
            this(id, label, type, value, conceptId, term, semanticTag, snomedVerified, "SNOMED");
        }

        public ConsultationField(String id, String label, String type, Object value, 
                                String conceptId, String term, String semanticTag, boolean snomedVerified,
                                String terminology) {
            this.id = id;
            this.label = label;
            this.type = type;
            this.value = value;
            this.conceptId = conceptId;
            this.term = term;
            this.semanticTag = semanticTag;
            this.snomedVerified = snomedVerified;
            this.terminology = terminology != null ? terminology : "SNOMED";
        }

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        
        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
        
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        
        public Object getValue() { return value; }
        public void setValue(Object value) { this.value = value; }
        
        public String getConceptId() { return conceptId; }
        public void setConceptId(String conceptId) { this.conceptId = conceptId; }
        
        public String getTerm() { return term; }
        public void setTerm(String term) { this.term = term; }
        
        public String getSemanticTag() { return semanticTag; }
        public void setSemanticTag(String semanticTag) { this.semanticTag = semanticTag; }
        
        public boolean isSnomedVerified() { return snomedVerified; }
        public void setSnomedVerified(boolean snomedVerified) { this.snomedVerified = snomedVerified; }

        public String getTerminology() { return terminology; }
        public void setTerminology(String terminology) { this.terminology = terminology != null ? terminology : "SNOMED"; }
    }
}