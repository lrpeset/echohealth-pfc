package com.echohealth.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Entidad core que encapsula el documento de consulta clínica polimórfica.
 * Implementa una arquitectura NoSQL basada en variaciones del patrón
 * Entidad-Atributo-Valor (EAV)
 * para garantizar un almacenamiento agnóstico a la terminología médica
 * normalizada.
 */
@Data
@Document(collection = "consultations")
public class Consultation {

    @Id
    private String id;

    private String userId;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    /**
     * Colección jerárquica con el linaje completo de codificación clínica
     * internacional
     */
    private List<ConsultationField> fields;

    /**
     * @deprecated Reemplazado por {@link #fields} en los nuevos flujos analíticos.
     *             Conservado bajo un esquema de Persistencia Dual (Mapa Plano
     *             Legacy) para optimizar
     *             la retrocompatibilidad y agilizar el renderizado adaptativo en la
     *             interfaz cliente.
     */
    @Deprecated
    private Map<String, Object> content;

    public Consultation() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * Subclase estructural que representa un metadato indexable de terminología de
     * salud.
     */
    public static class ConsultationField {

        private String id;
        private String label;
        private String type;
        private Object value;
        private String conceptId;
        private String term;
        private String semanticTag;
        private boolean conceptVerified;
        private String terminology = "SNOMED";

        public ConsultationField() {
        }

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public String getLabel() {
            return label;
        }

        public void setLabel(String label) {
            this.label = label;
        }

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public Object getValue() {
            return value;
        }

        public void setValue(Object value) {
            this.value = value;
        }

        public String getConceptId() {
            return conceptId;
        }

        public void setConceptId(String conceptId) {
            this.conceptId = conceptId;
        }

        public String getTerm() {
            return term;
        }

        public void setTerm(String term) {
            this.term = term;
        }

        public String getSemanticTag() {
            return semanticTag;
        }

        public void setSemanticTag(String semanticTag) {
            this.semanticTag = semanticTag;
        }

        public boolean isConceptVerified() {
            return conceptVerified;
        }

        public void setConceptVerified(boolean conceptVerified) {
            this.conceptVerified = conceptVerified;
        }

        public String getTerminology() {
            return terminology;
        }

        public void setTerminology(String terminology) {
            this.terminology = terminology != null ? terminology : "SNOMED";
        }
    }
}