package com.echohealth.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "formTemplates")
public class FormTemplate {

    @Id
    private String id;

    private String name;

    private String description;

    private String userId;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private List<FormTemplateField> fields;

    public FormTemplate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public List<FormTemplateField> getFields() { return fields; }
    public void setFields(List<FormTemplateField> fields) { this.fields = fields; }

    public static class FormTemplateField {

        private String id;
        private String label;
        private String type;
        private String conceptId;
        private String term;
        private String semanticTag;
        private boolean snomedVerified;
        private String terminology;
        private boolean required;
        private boolean removable;

        public FormTemplateField() {}

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }

        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }

        public String getConceptId() { return conceptId; }
        public void setConceptId(String conceptId) { this.conceptId = conceptId; }

        public String getTerm() { return term; }
        public void setTerm(String term) { this.term = term; }

        public String getSemanticTag() { return semanticTag; }
        public void setSemanticTag(String semanticTag) { this.semanticTag = semanticTag; }

        public boolean isSnomedVerified() { return snomedVerified; }
        public void setSnomedVerified(boolean snomedVerified) { this.snomedVerified = snomedVerified; }

        public String getTerminology() { return terminology; }
        public void setTerminology(String terminology) { this.terminology = terminology; }

        public boolean isRequired() { return required; }
        public void setRequired(boolean required) { this.required = required; }

        public boolean isRemovable() { return removable; }
        public void setRemovable(boolean removable) { this.removable = removable; }
    }
}
