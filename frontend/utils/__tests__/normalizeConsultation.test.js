import {
  normalizeConsultation,
  extractReasonForVisit,
} from "../normalizeConsultation";

/**
 * Suite de pruebas unitarias para el motor de normalización de consultas clínicas.
 * Garantiza la convergencia determinista de esquemas estructurados y planos (Legacy),
 * blindando la integridad de los datos ante mutaciones de la UI y protegiendo los
 * flujos transaccionales frente a estados nulos o indefinidos.
 */

describe("normalizeConsultation — Test de Convergencia (Legacy → FHIR)", () => {
  test("should_convert_reasonForVisit_height_weight_pulse_to_structured_fields_when_input_is_legacy_flat", () => {
    const legacy = {
      reasonForVisit: "Paciente con dolor lumbar",
      height: 175,
      weight: 82.5,
      pulse: 72,
    };

    const result = normalizeConsultation(legacy);

    expect(result._normalized).toBe(true);
    expect(Array.isArray(result.fields)).toBe(true);
    expect(result.fields.length).toBe(4);

    const heightField = result.fields.find((f) => f.id === "height");
    expect(heightField.value).toBe(175);
    expect(heightField.conceptId).toBe("8302-2");
    expect(heightField.terminology).toBe("LOINC");

    const reasonField = result.fields.find((f) => f.id === "reasonForVisit");
    expect(reasonField.value).toBe("Paciente con dolor lumbar");
    expect(reasonField.conceptId).toBeNull();
    expect(reasonField.terminology).toBe("SNOMED");
  });

  test("should_preserve_unknown_legacy_keys_as_custom_fields_when_extra_keys_exist", () => {
    const legacy = {
      reasonForVisit: "Control",
      notasMedicas: "Paciente estable",
      presionArterial: "120/80",
    };

    const result = normalizeConsultation(legacy);

    const notaField = result.fields.find((f) => f.id === "notasMedicas");
    expect(notaField).toBeDefined();
    expect(notaField.value).toBe("Paciente estable");
    expect(notaField.terminology).toBe("SNOMED");

    const paField = result.fields.find((f) => f.id === "presionArterial");
    expect(paField).toBeDefined();
    expect(paField.value).toBe("120/80");
  });

  test("should_generate_content_map_from_fields_for_backward_compatibility", () => {
    const legacy = {
      reasonForVisit: "Dolor",
      height: 180,
    };

    const result = normalizeConsultation(legacy);

    expect(result.content.reasonForVisit).toBe("Dolor");
    expect(result.content.height).toBe(180);
  });
});

describe("normalizeConsultation — Test de Integridad (no sobrescribe FHIR-Ready)", () => {
  test("should_not_overwrite_existing_conceptId_when_input_is_already_structured", () => {
    const fhirReady = {
      fields: [
        {
          id: "custom_8867_4",
          label: "Frecuencia Cardíaca",
          type: "loinc-number",
          value: 72,
          conceptId: "8867-4",
          term: "Heart rate",
          terminology: "LOINC",
          semanticTag: "clinical",
          conceptVerified: false,
        },
      ],
    };

    const result = normalizeConsultation(fhirReady);

    expect(result._normalized).toBe(false);
    const field = result.fields[0];
    expect(field.conceptId).toBe("8867-4");
    expect(field.terminology).toBe("LOINC");
    expect(field.value).toBe(72);
  });

  test("should_handle_array_of_fields_input_without_data_loss", () => {
    const geminiArray = [
      {
        id: "reasonForVisit",
        label: "Motivo de la visita",
        type: "snomed-text",
        value: "Dolor de cabeza",
      },
      {
        id: "custom_21522001",
        label: "Dolor abdominal",
        type: "snomed-text",
        value: "Leve",
        conceptId: "21522001",
        term: "Dolor abdominal",
        terminology: "SNOMED",
      },
    ];

    const result = normalizeConsultation(geminiArray);

    expect(result._normalized).toBe(true);
    expect(result.fields.length).toBe(2);
    const customField = result.fields.find((f) => f.id === "custom_21522001");
    expect(customField.conceptId).toBe("21522001");
    expect(customField.terminology).toBe("SNOMED");
  });

  test("should_preserve_4_base_fields_when_input_has_extra_custom_fields", () => {
    const withCustom = {
      fields: [
        {
          id: "reasonForVisit",
          label: "Motivo",
          type: "snomed-text",
          value: "Chequeo",
        },
        {
          id: "height",
          label: "Altura",
          type: "loinc-number",
          value: 170,
          conceptId: "8302-2",
          terminology: "LOINC",
        },
        {
          id: "custom_8867_4",
          label: "FC",
          type: "loinc-number",
          value: 75,
          conceptId: "8867-4",
          terminology: "LOINC",
        },
      ],
    };

    const result = normalizeConsultation(withCustom);

    expect(result.fields.length).toBe(3);
    expect(result.fields.find((f) => f.id === "custom_8867_4").value).toBe(75);
  });
});

describe("normalizeConsultation — Test de Null-Safety", () => {
  test("should_return_empty_fields_when_input_is_null", () => {
    const result = normalizeConsultation(null);

    expect(result).toBeDefined();
    expect(Array.isArray(result.fields)).toBe(true);
    expect(result.fields.length).toBe(0);
    expect(result._normalized).toBe(true);
  });

  test("should_return_empty_fields_when_input_is_undefined", () => {
    const result = normalizeConsultation(undefined);

    expect(result.fields).toEqual([]);
    expect(result.content).toEqual({});
  });

  test("should_handle_partial_field_data_gracefully", () => {
    const partial = {
      fields: [{ id: "reasonForVisit", value: "Dolor" }],
    };

    const result = normalizeConsultation(partial);

    expect(result.fields.length).toBe(1);
    expect(result._normalized).toBe(false);
    expect(result.content.reasonForVisit).toBe("Dolor");
  });
});

describe("extractReasonForVisit — Test de Búsqueda Multi-Formato", () => {
  test("should_extract_from_structured_fields_array", () => {
    const data = {
      fields: [{ id: "reasonForVisit", value: "Paciente con fiebre" }],
    };
    expect(extractReasonForVisit(data)).toBe("Paciente con fiebre");
  });

  test("should_extract_from_legacy_content_map", () => {
    const data = {
      content: { reasonForVisit: "Cefalea" },
    };
    expect(extractReasonForVisit(data)).toBe("Cefalea");
  });

  test("should_extract_from_flat_object", () => {
    expect(extractReasonForVisit({ reasonForVisit: "Mareos" })).toBe("Mareos");
  });

  test("should_return_null_when_no_reason_found", () => {
    expect(extractReasonForVisit({})).toBeNull();
    expect(extractReasonForVisit(null)).toBeNull();
  });
});
