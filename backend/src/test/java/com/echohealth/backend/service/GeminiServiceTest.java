package com.echohealth.backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

// =============================================================================
// TEST SUITE: GeminiService — Estabilidad de IDs y Prompt
// =============================================================================
// CRÍTICO PARA SEGURIDAD DEL PACIENTE:
//   Si Gemini alucina un ID de campo (ej: devuelve "custom_heart_rate" en lugar
//   de "custom_8867_4"), el mapeo plantilla resultado se rompe, pudiendo
//   asociar un valor clínico al código incorrecto. Estos tests verifican que
//   el sistema de validacion post-procesado corrija cualquier desviacion.
//
// Stack: JUnit 5 + Mockito + ReflectionTestUtils (Spring)
// NOTA: Los metodos privados se invocan via ReflectionTestUtils para mantener
//       el encapsulamiento sin necesidad de exponer la API interna.

@ExtendWith(MockitoExtension.class)
class GeminiServiceTest {

    private GeminiService service;

    @BeforeEach
    void setUp() {
        service = new GeminiService();
        ReflectionTestUtils.setField(service, "apiKey", "test-api-key");
    }

    // =========================================================================
    // Test de Mapeo de IDs (validateFieldIds)
    // =========================================================================

    @Test
    void should_correct_hallucinated_id_when_gemini_returns_wrong_field_id() {
        List<String> targetFields = List.of(
            "custom_8867_4|Frecuencia Cardíaca|8867-4|Heart rate|LOINC"
        );

        String geminiResponse = """
            [
              {
                "id": "reasonForVisit",
                "label": "Motivo de la visita",
                "type": "snomed-text",
                "value": "Paciente con palpitaciones",
                "conceptId": null,
                "term": null,
                "conceptVerified": false,
                "terminology": "SNOMED"
              },
              {
                "id": "height",
                "label": "Altura (cm)",
                "type": "loinc-number",
                "value": 175,
                "conceptId": "8302-2",
                "term": "Body height",
                "conceptVerified": false,
                "terminology": "LOINC"
              },
              {
                "id": "weight",
                "label": "Peso (kg)",
                "type": "loinc-number",
                "value": 82,
                "conceptId": "29463-7",
                "term": "Body weight",
                "conceptVerified": false,
                "terminology": "LOINC"
              },
              {
                "id": "pulse",
                "label": "Pulso (ppm)",
                "type": "loinc-number",
                "value": 72,
                "conceptId": "8867-4",
                "term": "Heart rate",
                "conceptVerified": false,
                "terminology": "LOINC"
              },
              {
                "id": "bloodPressure",
                "label": "Presión arterial (mmHg)",
                "type": "loinc-text",
                "value": "120/80",
                "conceptId": "85354-9",
                "term": "Blood pressure panel",
                "conceptVerified": false,
                "terminology": "LOINC"
              },
              {
                "id": "oxygenSaturation",
                "label": "Saturación de oxígeno (%)",
                "type": "loinc-number",
                "value": 98,
                "conceptId": "2708-6",
                "term": "Oxygen saturation",
                "conceptVerified": false,
                "terminology": "LOINC"
              },
              {
                "id": "painLocation",
                "label": "Localización del dolor",
                "type": "snomed-text",
                "value": "Abdominal",
                "conceptId": "70163-1",
                "term": "Body site",
                "conceptVerified": false,
                "terminology": "LOINC"
              },
              {
                "id": "painNature",
                "label": "Naturaleza del dolor",
                "type": "snomed-text",
                "value": "Cólico",
                "conceptId": "440751004",
                "term": "Type of pain",
                "conceptVerified": true,
                "terminology": "SNOMED"
              },
              {
                "id": "painIntensity",
                "label": "Intensidad del dolor (0-10)",
                "type": "loinc-number",
                "value": 7,
                "conceptId": "72514-3",
                "term": "Pain severity - 0-10",
                "conceptVerified": false,
                "terminology": "LOINC"
              },
              {
                "id": "custom_heart_rate",
                "label": "Frecuencia Cardíaca",
                "type": "loinc-text",
                "value": "72 lpm",
                "conceptId": "8867-4",
                "term": "Heart rate",
                "conceptVerified": false,
                "terminology": "LOINC"
              }
            ]
            """;

        @SuppressWarnings("unchecked")
        var parsed = (List<Object>) ReflectionTestUtils.invokeMethod(
            service, "parseTargetFields", targetFields);

        String result = ReflectionTestUtils.invokeMethod(
            service, "validateFieldIds", geminiResponse, parsed);

        assertNotNull(result);
        assertTrue(result.contains("\"id\": \"custom_8867_4\""),
            "El ID alucinado 'custom_heart_rate' debe corregirse a 'custom_8867_4'");
        assertFalse(result.contains("\"id\": \"custom_heart_rate\""),
            "No debe quedar rastro del ID alucinado");

        assertTrue(result.contains("\"id\": \"reasonForVisit\""),
            "Los IDs de campos base no deben modificarse");
        assertTrue(result.contains("\"id\": \"height\""),
            "Los IDs de campos base no deben modificarse");
    }

    @Test
    void should_not_modify_ids_when_gemini_returns_correct_ids() {
        List<String> targetFields = List.of(
            "custom_8867_4|FC|8867-4|Heart rate|LOINC"
        );

        String correctResponse = """
            [
              {
                "id": "reasonForVisit",
                "label": "Motivo",
                "type": "snomed-text",
                "value": "Chequeo",
                "conceptId": null,
                "term": null,
                "conceptVerified": false,
                "terminology": "SNOMED"
              },
              {
                "id": "height",
                "label": "Altura",
                "type": "loinc-number",
                "value": 170,
                "conceptId": "8302-2",
                "term": "Body height",
                "conceptVerified": false,
                "terminology": "LOINC"
              },
              {
                "id": "weight",
                "label": "Peso",
                "type": "loinc-number",
                "value": 70,
                "conceptId": "29463-7",
                "term": "Body weight",
                "conceptVerified": false,
                "terminology": "LOINC"
              },
              {
                "id": "pulse",
                "label": "Pulso",
                "type": "loinc-number",
                "value": 80,
                "conceptId": "8867-4",
                "term": "Heart rate",
                "conceptVerified": false,
                "terminology": "LOINC"
              },
              {
                "id": "bloodPressure",
                "label": "Presión arterial (mmHg)",
                "type": "loinc-text",
                "value": "120/80",
                "conceptId": "85354-9",
                "term": "Blood pressure panel",
                "conceptVerified": false,
                "terminology": "LOINC"
              },
              {
                "id": "oxygenSaturation",
                "label": "Saturación de oxígeno (%)",
                "type": "loinc-number",
                "value": 98,
                "conceptId": "2708-6",
                "term": "Oxygen saturation",
                "conceptVerified": false,
                "terminology": "LOINC"
              },
              {
                "id": "painLocation",
                "label": "Localización del dolor",
                "type": "snomed-text",
                "value": "Abdominal",
                "conceptId": "70163-1",
                "term": "Body site",
                "conceptVerified": false,
                "terminology": "LOINC"
              },
              {
                "id": "painNature",
                "label": "Naturaleza del dolor",
                "type": "snomed-text",
                "value": "Cólico",
                "conceptId": "440751004",
                "term": "Type of pain",
                "conceptVerified": true,
                "terminology": "SNOMED"
              },
              {
                "id": "painIntensity",
                "label": "Intensidad del dolor (0-10)",
                "type": "loinc-number",
                "value": 7,
                "conceptId": "72514-3",
                "term": "Pain severity - 0-10",
                "conceptVerified": false,
                "terminology": "LOINC"
              },
              {
                "id": "custom_8867_4",
                "label": "FC",
                "type": "loinc-text",
                "value": 80,
                "conceptId": "8867-4",
                "term": "Heart rate",
                "conceptVerified": false,
                "terminology": "LOINC"
              }
            ]
            """;

        @SuppressWarnings("unchecked")
        var parsed = (List<Object>) ReflectionTestUtils.invokeMethod(
            service, "parseTargetFields", targetFields);

        String result = ReflectionTestUtils.invokeMethod(
            service, "validateFieldIds", correctResponse, parsed);

        assertNotNull(result);
        assertTrue(result.contains("\"value\": 80"),
            "Los valores correctos no deben modificarse");
        assertTrue(result.contains("\"id\": \"custom_8867_4\""),
            "El ID correcto debe mantenerse");
    }

    // =========================================================================
    // Test de Rangos Clinicos (validateClinicalRanges)
    // =========================================================================

    @Test
    void should_force_null_for_height_out_of_clinical_range() {
        String jsonWithImpossibleHeight = """
            [
              {
                "id": "height",
                "label": "Altura (cm)",
                "type": "loinc-number",
                "value": 500,
                "conceptId": "8302-2",
                "term": "Body height",
                "conceptVerified": false,
                "terminology": "LOINC"
              }
            ]
            """;

        String result = ReflectionTestUtils.invokeMethod(
            service, "validateClinicalRanges", jsonWithImpossibleHeight);

        assertNotNull(result);
        assertTrue(result.contains("\"value\": null"),
            "Altura de 500cm debe forzarse a null (rango maximo: 250cm)");
    }

    @Test
    void should_force_null_for_pulse_of_zero() {
        String jsonWithZeroPulse = """
            [
              {
                "id": "pulse",
                "label": "Pulso (ppm)",
                "type": "loinc-number",
                "value": 0,
                "conceptId": "8867-4",
                "term": "Heart rate",
                "conceptVerified": false,
                "terminology": "LOINC"
              }
            ]
            """;

        String result = ReflectionTestUtils.invokeMethod(
            service, "validateClinicalRanges", jsonWithZeroPulse);

        assertNotNull(result);
        assertTrue(result.contains("\"value\": null"),
            "Pulso 0 debe forzarse a null (rango minimo: 30)");
    }

    @Test
    void should_keep_normal_height_value_unchanged() {
        String jsonWithNormalHeight = """
            [
              {
                "id": "height",
                "label": "Altura (cm)",
                "type": "loinc-number",
                "value": 175,
                "conceptId": "8302-2",
                "conceptVerified": false,
                "terminology": "LOINC"
              }
            ]
            """;

        String result = ReflectionTestUtils.invokeMethod(
            service, "validateClinicalRanges", jsonWithNormalHeight);

        assertNotNull(result);
        assertTrue(result.contains("\"value\": 175"),
            "Altura normal de 175cm debe mantenerse");
    }

    // =========================================================================
    // Test de Sanitizacion (sanitizeConceptId)
    // =========================================================================

    @Test
    void should_convert_loinc_code_with_hyphen_to_underscore() {
        String result = ReflectionTestUtils.invokeMethod(
            service, "sanitizeConceptId", "8867-4");

        assertEquals("8867_4", result,
            "LOINC code 8867-4 debe sanearse a 8867_4");
    }

    @Test
    void should_keep_snomed_numeric_code_unchanged() {
        String result = ReflectionTestUtils.invokeMethod(
            service, "sanitizeConceptId", "21522001");

        assertEquals("21522001", result,
            "SNOMED code 21522001 debe permanecer igual");
    }

    @Test
    void should_return_unknown_for_null_conceptId() {
        String result = ReflectionTestUtils.invokeMethod(
            service, "sanitizeConceptId", (String) null);

        assertEquals("unknown", result,
            "conceptId null debe devolver 'unknown' como fallback seguro");
    }

    // =========================================================================
    // Test de Parseo de TargetFields (parseTargetFields)
    // =========================================================================

    @Test
    void should_parse_5_part_format_correctly() {
        List<String> raw = List.of(
            "custom_8867_4|Frecuencia Cardíaca|8867-4|Heart rate|LOINC"
        );

        @SuppressWarnings("unchecked")
        var parsed = (List<Object>) ReflectionTestUtils.invokeMethod(
            service, "parseTargetFields", raw);

        assertNotNull(parsed);
        String parsedStr = parsed.toString();
        assertTrue(parsedStr.contains("custom_8867_4"));
        assertTrue(parsedStr.contains("Frecuencia Cardíaca"));
        assertTrue(parsedStr.contains("8867-4"));
        assertTrue(parsedStr.contains("Heart rate"));
        assertTrue(parsedStr.contains("LOINC"));
    }

    @Test
    void should_parse_6_part_format_with_type() {
        List<String> raw = List.of(
            "custom_8867_4|Frecuencia Cardíaca|8867-4|Heart rate|LOINC|loinc-number"
        );

        @SuppressWarnings("unchecked")
        var parsed = (List<Object>) ReflectionTestUtils.invokeMethod(
            service, "parseTargetFields", raw);

        assertNotNull(parsed);
        String parsedStr = parsed.toString();
        assertTrue(parsedStr.contains("custom_8867_4"));
        assertTrue(parsedStr.contains("Frecuencia Cardíaca"));
        assertTrue(parsedStr.contains("8867-4"));
        assertTrue(parsedStr.contains("Heart rate"));
        assertTrue(parsedStr.contains("LOINC"));
        assertTrue(parsedStr.contains("loinc-number"),
            "El tipo debe propagarse desde el formato de 6 partes");
    }

    @Test
    void should_use_type_from_target_fields_when_available() {
        List<String> raw = List.of(
            "custom_glucose|Glucosa|2345-7|Glucose|LOINC|loinc-number"
        );

        @SuppressWarnings("unchecked")
        var parsed = (List<Object>) ReflectionTestUtils.invokeMethod(
            service, "parseTargetFields", raw);

        @SuppressWarnings("unchecked")
        var fieldInfos = (List<Object>) ReflectionTestUtils.invokeMethod(
            service, "buildAllFieldInfos", parsed);

        assertNotNull(fieldInfos);
        String infosStr = fieldInfos.toString();
        assertTrue(infosStr.contains("loinc-number"),
            "El tipo 'loinc-number' debe propagarse desde el targetField al FieldInfo");
        assertTrue(infosStr.contains("custom_glucose"),
            "El ID custom debe mantenerse");
    }

    @Test
    void should_fallback_to_legacy_3_part_format() {
        List<String> raw = List.of("21522001|Dolor abdominal|SNOMED");

        @SuppressWarnings("unchecked")
        var parsed = (List<Object>) ReflectionTestUtils.invokeMethod(
            service, "parseTargetFields", raw);

        assertNotNull(parsed);
        assertTrue(parsed.toString().contains("null"),
            "Formato legacy de 3 partes debe tener id=null");
    }

    @Test
    void should_return_empty_list_when_targetFields_is_null() {
        @SuppressWarnings("unchecked")
        var parsed = (List<Object>) ReflectionTestUtils.invokeMethod(
            service, "parseTargetFields", (List<String>) null);

        assertNotNull(parsed);
        assertTrue(parsed.isEmpty(),
            "targetFields null debe devolver lista vacia");
    }

    // =========================================================================
    // Test de Construccion de Fallback (buildFallbackResponse)
    // =========================================================================

    @Test
    void should_build_fallback_with_all_fields_having_null_values() {
        @SuppressWarnings("unchecked")
        var parsed = (List<Object>) ReflectionTestUtils.invokeMethod(
            service, "parseTargetFields",
            List.of("custom_8867_4|FC|8867-4|Heart rate|LOINC"));

        String fallback = ReflectionTestUtils.invokeMethod(
            service, "buildFallbackResponse", parsed);

        assertNotNull(fallback);
        assertTrue(fallback.contains("custom_8867_4"),
            "El fallback debe incluir el campo personalizado");
        assertTrue(fallback.contains("\"value\": null"),
            "Todos los valores del fallback deben ser null");
    }
}
