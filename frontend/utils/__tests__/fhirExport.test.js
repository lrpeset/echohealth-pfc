import { buildFhirJson, buildFhirCsv } from "../fhirExport";

// =============================================================================
// TEST SUITE: Exportación FHIR
// =============================================================================
// CRÍTICO PARA INTEROPERABILIDAD:
//   Si la exportación no incluye system/code/display, el JSON no será
//   utilizable por sistemas hospitalarios reales (Epic, Cerner, etc.).
//   Estos tests verifican el contrato FHIR-R4.

const sampleFields = [
  {
    id: "reasonForVisit",
    label: "Motivo de la visita",
    type: "snomed-text",
    value: "Paciente con dolor lumbar",
    conceptId: null,
    term: null,
    terminology: "SNOMED",
    semanticTag: null,
  },
  {
    id: "height",
    label: "Altura (cm)",
    type: "loinc-number",
    value: 175,
    conceptId: "8302-2",
    term: "Body height",
    terminology: "LOINC",
    semanticTag: "clinical",
  },
  {
    id: "custom_21522001",
    label: "Dolor abdominal",
    type: "snomed-text",
    value: "Leve, tipo cólico",
    conceptId: "21522001",
    term: "Dolor abdominal",
    terminology: "SNOMED",
    semanticTag: "finding",
  },
];

describe("buildFhirJson — Test de Contrato FHIR", () => {

  test("should_include_system_code_and_display_for_every_field_with_value", () => {
    const jsonStr = buildFhirJson(sampleFields);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.exportVersion).toBe("FHIR-R4-1.0");
    expect(parsed.fieldCount).toBe(3);

    const loincField = parsed.fields.find((f) => f.id === "height");
    expect(loincField.code).toBe("8302-2");
    expect(loincField.system).toBe("LOINC");
    expect(loincField.display).toBe("Body height");

    const snomedField = parsed.fields.find((f) => f.id === "custom_21522001");
    expect(snomedField.code).toBe("21522001");
    expect(snomedField.system).toBe("SNOMED");
    expect(snomedField.display).toBe("Dolor abdominal");

    const reasonField = parsed.fields.find((f) => f.id === "reasonForVisit");
    expect(reasonField.code).toBeNull();
    expect(reasonField.system).toBe("SNOMED");
  });

  test("should_exclude_fields_with_null_value_from_export", () => {
    const fieldsWithNull = [
      ...sampleFields,
      { id: "weight", label: "Peso", value: null, conceptId: "29463-7", terminology: "LOINC" },
    ];

    const jsonStr = buildFhirJson(fieldsWithNull);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.fieldCount).toBe(3);
    expect(parsed.fields.find((f) => f.id === "weight")).toBeUndefined();
  });

  test("should_generate_valid_json", () => {
    const jsonStr = buildFhirJson(sampleFields);
    expect(() => JSON.parse(jsonStr)).not.toThrow();
  });

  test("should_return_valid_json_for_empty_or_null_fields", () => {
    const jsonStr = buildFhirJson(null);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.fieldCount).toBe(0);
    expect(parsed.fields).toEqual([]);
  });
});

describe("buildFhirCsv — Test de Formato CSV", () => {

  test("should_generate_csv_with_header_and_correct_columns", () => {
    const csv = buildFhirCsv(sampleFields);
    const lines = csv.split("\n");

    expect(lines[0]).toBe("id,label,value,code,system,display,semanticTag");

    const heightRow = lines.find((l) => l.startsWith("height"));
    expect(heightRow).toContain("8302-2");
    expect(heightRow).toContain("LOINC");
    expect(heightRow).toContain("Body height");
  });

  test("should_escape_commas_in_values", () => {
    const csv = buildFhirCsv(sampleFields);
    const painRow = csv.split("\n").find((l) => l.includes("21522001"));

    expect(painRow).toMatch(/"Leve, tipo cólico"/);
  });

  test("should_return_header_only_when_all_fields_have_null_value", () => {
    const nullFields = [
      { id: "height", value: null },
      { id: "weight", value: null },
    ];

    const csv = buildFhirCsv(nullFields);
    const lines = csv.split("\n");

    expect(lines.length).toBe(1);
    expect(lines[0]).toBe("id,label,value,code,system,display,semanticTag");
  });
});
