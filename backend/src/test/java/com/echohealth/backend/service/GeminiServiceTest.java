package com.echohealth.backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class GeminiServiceTest {

    private GeminiService service;

    @BeforeEach
    void setUp() {
        service = new GeminiService();
        ReflectionTestUtils.setField(service, "apiKey", "test-api-key");
    }

    @Test
    void should_correct_hallucinated_id_when_gemini_returns_wrong_field_id() {
        List<String> targetFields = List.of(
                "custom_8867_4|Frecuencia Cardíaca|8867-4|Heart rate|LOINC");

        String geminiResponse = """
                [
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
        assertTrue(result.contains("\"id\": \"custom_8867_4\""));
        assertFalse(result.contains("\"id\": \"custom_heart_rate\""));
    }

    @Test
    void should_not_modify_ids_when_gemini_returns_correct_ids() {
        List<String> targetFields = List.of(
                "custom_8867_4|FC|8867-4|Heart rate|LOINC");

        String correctResponse = """
                [
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
        assertTrue(result.contains("\"value\": 80"));
        assertTrue(result.contains("\"id\": \"custom_8867_4\""));
    }

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
        assertTrue(result.contains("\"value\": null"));
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
        assertTrue(result.contains("\"value\": null"));
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
        assertTrue(result.contains("\"value\": 175"));
    }

    @Test
    void should_convert_loinc_code_with_hyphen_to_underscore() {
        String result = ReflectionTestUtils.invokeMethod(
                service, "sanitizeConceptId", "8867-4");

        assertEquals("8867_4", result);
    }

    @Test
    void should_keep_snomed_numeric_code_unchanged() {
        String result = ReflectionTestUtils.invokeMethod(
                service, "sanitizeConceptId", "21522001");

        assertEquals("21522001", result);
    }

    @Test
    void should_return_unknown_for_null_conceptId() {
        String result = ReflectionTestUtils.invokeMethod(
                service, "sanitizeConceptId", (String) null);

        assertEquals("unknown", result);
    }

    @Test
    void should_parse_5_part_format_correctly() {
        List<String> raw = List.of(
                "custom_8867_4|Frecuencia Cardíaca|8867-4|Heart rate|LOINC");

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
                "custom_8867_4|Frecuencia Cardíaca|8867-4|Heart rate|LOINC|loinc-number");

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
        assertTrue(parsedStr.contains("loinc-number"));
    }

    @Test
    void should_use_type_from_target_fields_when_available() {
        List<String> raw = List.of(
                "custom_glucose|Glucosa|2345-7|Glucose|LOINC|loinc-number");

        @SuppressWarnings("unchecked")
        var parsed = (List<Object>) ReflectionTestUtils.invokeMethod(
                service, "parseTargetFields", raw);

        @SuppressWarnings("unchecked")
        var fieldInfos = (List<Object>) ReflectionTestUtils.invokeMethod(
                service, "buildAllFieldInfos", parsed);

        assertNotNull(fieldInfos);
        String infosStr = fieldInfos.toString();
        assertTrue(infosStr.contains("loinc-number"));
        assertTrue(infosStr.contains("custom_glucose"));
    }

    @Test
    void should_fallback_to_legacy_3_part_format() {
        List<String> raw = List.of("21522001|Dolor abdominal|SNOMED");

        @SuppressWarnings("unchecked")
        var parsed = (List<Object>) ReflectionTestUtils.invokeMethod(
                service, "parseTargetFields", raw);

        assertNotNull(parsed);
        assertTrue(parsed.toString().contains("null"));
    }

    @Test
    void should_return_empty_list_when_targetFields_is_null() {
        @SuppressWarnings("unchecked")
        var parsed = (List<Object>) ReflectionTestUtils.invokeMethod(
                service, "parseTargetFields", (List<String>) null);

        assertNotNull(parsed);
        assertTrue(parsed.isEmpty());
    }

    @Test
    void should_build_fallback_with_all_fields_having_null_values() {
        @SuppressWarnings("unchecked")
        var parsed = (List<Object>) ReflectionTestUtils.invokeMethod(
                service, "parseTargetFields",
                List.of("custom_8867_4|FC|8867-4|Heart rate|LOINC"));

        String fallback = ReflectionTestUtils.invokeMethod(
                service, "buildFallbackResponse", parsed);

        assertNotNull(fallback);
        assertTrue(fallback.contains("custom_8867_4"));
        assertTrue(fallback.contains("\"value\": null"));
    }
}