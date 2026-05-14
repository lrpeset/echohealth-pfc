package com.echohealth.backend.controller;

import com.echohealth.backend.model.FormTemplate;
import com.echohealth.backend.model.FormTemplate.FormTemplateField;
import com.echohealth.backend.repository.FormTemplateRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/validate")
@CrossOrigin(origins = "*")
public class ValidationController {

    private final FormTemplateRepository repository;

    public ValidationController(FormTemplateRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/seed")
    public ResponseEntity<Map<String, Object>> validateSeed() {
        Map<String, Object> report = new LinkedHashMap<>();
        List<String> errors = new ArrayList<>();
        List<String> passes = new ArrayList<>();

        List<FormTemplate> systemTemplates = repository.findByUserId("system");
        if (systemTemplates.isEmpty()) {
            errors.add("No se encontró plantilla del sistema. El seeder no se ejecutó.");
            report.put("status", "FAIL");
            report.put("errors", errors);
            return ResponseEntity.ok(report);
        }

        FormTemplate general = systemTemplates.stream()
                .filter(t -> "Consulta General".equals(t.getName()))
                .findFirst()
                .orElse(null);

        if (general == null) {
            errors.add("Plantilla 'Consulta General' no encontrada.");
            report.put("status", "FAIL");
            report.put("errors", errors);
            return ResponseEntity.ok(report);
        }

        passes.add("Plantilla 'Consulta General' encontrada (id: " + general.getId() + ")");

        List<FormTemplateField> fields = general.getFields();
        if (fields == null || fields.isEmpty()) {
            errors.add("La plantilla 'Consulta General' no tiene campos.");
        } else {
            passes.add("Tiene " + fields.size() + " campos definidos");

            if (fields.size() == 4) {
                passes.add("Número de campos correcto: 4");
            } else {
                errors.add("Se esperaban 4 campos, se encontraron " + fields.size());
            }

            for (FormTemplateField f : fields) {
                if (!"SNOMED".equals(f.getTerminology())) {
                    errors.add("Campo '" + f.getId() + "' tiene terminology='" + f.getTerminology() + "', se esperaba 'SNOMED'");
                } else {
                    passes.add("Campo '" + f.getId() + "' → terminology=SNOMED ✓");
                }
            }

            boolean allSnomed = fields.stream().allMatch(f -> "SNOMED".equals(f.getTerminology()));
            if (allSnomed) passes.add("Todos los campos son SNOMED ✓");
        }

        report.put("status", errors.isEmpty() ? "PASS" : "PARTIAL");
        report.put("passes", passes);
        report.put("errors", errors);
        report.put("templateName", general.getName());
        report.put("fieldCount", fields != null ? fields.size() : 0);
        return ResponseEntity.ok(report);
    }

    @GetMapping("/interop")
    public ResponseEntity<Map<String, Object>> validateInteroperability() {
        Map<String, Object> report = new LinkedHashMap<>();
        List<String> steps = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        FormTemplate testTemplate = new FormTemplate();
        testTemplate.setName("Test Interoperabilidad");
        testTemplate.setDescription("Verificación multi-terminología");
        testTemplate.setUserId("validation");
        testTemplate.setCreatedAt(LocalDateTime.now());
        testTemplate.setUpdatedAt(LocalDateTime.now());

        List<FormTemplateField> fields = new ArrayList<>();

        FormTemplateField loincField = new FormTemplateField();
        loincField.setId("test_loinc_85354");
        loincField.setLabel("Tensión Arterial");
        loincField.setType("loinc-text");
        loincField.setConceptId("85354-9");
        loincField.setTerm("Blood pressure panel");
        loincField.setSnomedVerified(false);
        loincField.setTerminology("LOINC");
        loincField.setRequired(false);
        loincField.setRemovable(true);
        fields.add(loincField);
        steps.add("Creado campo LOINC: conceptId=85354-9, terminology=" + loincField.getTerminology());

        FormTemplateField snomedField = new FormTemplateField();
        snomedField.setId("test_snomed_21522001");
        snomedField.setLabel("Dolor abdominal");
        snomedField.setType("snomed-text");
        snomedField.setConceptId("21522001");
        snomedField.setTerm("Dolor abdominal");
        snomedField.setSemanticTag("finding");
        snomedField.setSnomedVerified(true);
        snomedField.setTerminology("SNOMED");
        snomedField.setRequired(false);
        snomedField.setRemovable(true);
        fields.add(snomedField);
        steps.add("Creado campo SNOMED: conceptId=21522001, terminology=" + snomedField.getTerminology());

        testTemplate.setFields(fields);

        FormTemplate saved = repository.save(testTemplate);
        steps.add("Plantilla 'Test Interoperabilidad' guardada (id: " + saved.getId() + ")");

        FormTemplate reloaded = repository.findById(saved.getId()).orElse(null);
        if (reloaded == null) {
            errors.add("No se pudo recargar la plantilla guardada");
        } else {
            steps.add("Plantilla recargada correctamente");

            FormTemplateField reloadedLoinc = reloaded.getFields().stream()
                    .filter(f -> "test_loinc_85354".equals(f.getId()))
                    .findFirst().orElse(null);
            if (reloadedLoinc == null) {
                errors.add("Campo LOINC no encontrado tras recarga");
            } else {
                if ("85354-9".equals(reloadedLoinc.getConceptId())) {
                    steps.add("LOINC conceptId=85354-9 persistido correctamente ✓");
                } else {
                    errors.add("LOINC conceptId esperado 85354-9, obtenido " + reloadedLoinc.getConceptId());
                }
                if ("LOINC".equals(reloadedLoinc.getTerminology())) {
                    steps.add("LOINC terminology=LOINC persistido correctamente ✓");
                } else {
                    errors.add("LOINC terminology esperado 'LOINC', obtenido '" + reloadedLoinc.getTerminology() + "'");
                }
            }

            FormTemplateField reloadedSnomed = reloaded.getFields().stream()
                    .filter(f -> "test_snomed_21522001".equals(f.getId()))
                    .findFirst().orElse(null);
            if (reloadedSnomed == null) {
                errors.add("Campo SNOMED no encontrado tras recarga");
            } else {
                if ("21522001".equals(reloadedSnomed.getConceptId())) {
                    steps.add("SNOMED conceptId=21522001 persistido correctamente ✓");
                } else {
                    errors.add("SNOMED conceptId esperado 21522001, obtenido " + reloadedSnomed.getConceptId());
                }
                if ("SNOMED".equals(reloadedSnomed.getTerminology())) {
                    steps.add("SNOMED terminology=SNOMED persistido correctamente ✓");
                } else {
                    errors.add("SNOMED terminology esperado 'SNOMED', obtenido '" + reloadedSnomed.getTerminology() + "'");
                }
            }
        }

        repository.deleteById(saved.getId());
        steps.add("Plantilla de test eliminada (limpieza)");

        report.put("status", errors.isEmpty() ? "PASS" : "FAIL");
        report.put("steps", steps);
        report.put("errors", errors);
        report.put("summary", errors.isEmpty()
                ? "Interoperabilidad LOINC+SNOMED verificada: ambas terminologías se persisten y recuperan correctamente"
                : "Fallos detectados en la persistencia de terminología");
        return ResponseEntity.ok(report);
    }
}
