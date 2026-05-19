import {
  buildFhirR4Bundle,
  buildLongFormatCsv,
} from "../fhirExport";

// =============================================================================
// DATA MOCK — Consulta clínica dinámica con 5 campos de prueba extremos
// =============================================================================
// Casos cubiertos:
//   1. reasonForVisit — texto libre sin códigos (comprueba comas escapadas)
//   2. LOINC numérico — altura 8302-2, valueQuantity con UCUM
//   3. Panel compuesto — PA 85354-9 "120/80" → component systolic/diastolic
//   4. Hallazgo SNOMED — 21522001 semanticTag="finding" → Condition
//   5. Valor null — peso 29463-7 value=null → debe excluirse

const mockConsultation = {
  id: "test-cons-123",
  userId: "dr_test_01",
  createdAt: "2026-05-16T10:00:00Z",
  fields: [
    {
      id: "reasonForVisit",
      label: "Motivo de la visita",
      type: "snomed-text",
      value: "Paciente con dolor lumbar, irradiado a pierna derecha",
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
      id: "custom_85354_9",
      label: "Presión arterial",
      type: "loinc-text",
      value: "120/80",
      conceptId: "85354-9",
      term: "Blood pressure panel",
      terminology: "LOINC",
      semanticTag: "clinical",
    },
    {
      id: "custom_21522001",
      label: "Dolor abdominal",
      type: "snomed-text",
      value: "Leve",
      conceptId: "21522001",
      term: "Dolor abdominal",
      terminology: "SNOMED",
      semanticTag: "finding",
    },
    {
      id: "weight",
      label: "Peso (kg)",
      type: "loinc-number",
      value: null,
      conceptId: "29463-7",
      term: "Body weight",
      terminology: "LOINC",
      semanticTag: "clinical",
    },
  ],
};

// =============================================================================
// buildFhirR4Bundle (Bundle FHIR R4 tipo document)
// =============================================================================

describe("buildFhirR4Bundle — Test de Interoperabilidad FHIR R4", () => {
  const parsed = JSON.parse(buildFhirR4Bundle(mockConsultation));
  const composition = parsed.entry[0].resource;
  const patientEntry = parsed.entry.find(
    (e) => e.resource.resourceType === "Patient"
  );
  const patientUuid = composition.subject.reference;
  const allResources = parsed.entry.slice(1).map((e) => e.resource);
  const resources = allResources.filter((r) => r.resourceType !== "Patient");

  test("T1 — Estructura de Contenedor: Bundle type=document con identifier", () => {
    expect(parsed.resourceType).toBe("Bundle");
    expect(parsed.type).toBe("document");
    expect(parsed.identifier.value).toBe("test-cons-123");
    expect(parsed.identifier.system).toBe(
      "https://echohealth.app/consultations"
    );
  });

  test("T2 — Composición Principal: Composition final con LOINC 34108-1", () => {
    expect(composition.resourceType).toBe("Composition");
    expect(composition.id).toBe("composition-1");
    expect(composition.status).toBe("final");
    expect(composition.type.coding[0].code).toBe("34108-1");
    expect(composition.type.coding[0].system).toBe("http://loinc.org");
    expect(composition.type.coding[0].display).toBe("Outpatient Note");
    expect(composition.title).toBe("EchoHealth - Resumen Clínico");
    expect(composition.text).toBeDefined();
    expect(composition.text.status).toBe("generated");
    expect(composition.text.div).toContain(
      "EchoHealth Clinical Summary Composition"
    );
    expect(typeof composition.subject).toBe('object');
    expect(composition.subject.reference).toMatch(/^urn:uuid:/);
    expect(composition.subject.reference).toBe(patientUuid);
    expect(patientEntry.fullUrl).toBe(patientUuid);
    expect(patientEntry.resource.text).toBeDefined();
    expect(patientEntry.resource.text.status).toBe("generated");
    expect(patientEntry.resource.text.div).toContain(
      "Anonymized Patient Resource"
    );
    expect(patientEntry.resource.identifier[0].value).toBe(
      "dr_test_01"
    );
    expect(composition.subject.display).toBe(
      "Anonymous Patient Reference"
    );
    expect(composition.confidentiality).toBeUndefined();
  });

  test("T3 — Secciones e Indexación: 3 secciones con referencias urn:uuid:", () => {
    const sectionTitles = composition.section.map((s) => s.title);
    expect(sectionTitles).toContain("Motivo de la consulta");
    expect(sectionTitles).toContain("Mediciones y Tests");
    expect(sectionTitles).toContain("Hallazgos Clínicos");
    expect(composition.section.length).toBe(3);

    const motivoSection = composition.section.find(
      (s) => s.title === "Motivo de la consulta"
    );
    expect(motivoSection.entry.length).toBe(1);
    expect(motivoSection.entry[0].reference).toMatch(/^urn:uuid:/);

    const medicionesSection = composition.section.find(
      (s) => s.title === "Mediciones y Tests"
    );
    expect(medicionesSection.entry.length).toBe(2);
    medicionesSection.entry.forEach((e) =>
      expect(e.reference).toMatch(/^urn:uuid:/)
    );

    const hallazgosSection = composition.section.find(
      (s) => s.title === "Hallazgos Clínicos"
    );
    expect(hallazgosSection.entry.length).toBe(1);
    expect(hallazgosSection.entry[0].reference).toMatch(/^urn:uuid:/);

    const allFullUrls = parsed.entry.map((e) => e.fullUrl);
    const referencedIds = composition.section.flatMap((s) =>
      s.entry.map((e) => e.reference)
    );
    for (const ref of referencedIds) {
      expect(allFullUrls).toContain(ref);
    }
  });

  test("T3b — Motivo de Consulta: obs-0 como LOINC 10154-3 con valueString plano", () => {
    const reasonObs = resources.find((r) => r.id === "obs-0");
    expect(reasonObs).toBeDefined();
    expect(reasonObs.resourceType).toBe("Observation");
    expect(reasonObs.text).toBeDefined();
    expect(reasonObs.text.status).toBe("generated");
    expect(reasonObs.text.div).toContain(
      "Chief complaint Narrative - Reported"
    );
    expect(reasonObs.text.div).toContain(
      "Paciente con dolor lumbar, irradiado a pierna derecha"
    );
    expect(reasonObs.code.coding[0].system).toBe("http://loinc.org");
    expect(reasonObs.code.coding[0].code).toBe("10154-3");
    expect(reasonObs.code.coding[0].display).toBe(
      "Chief complaint Narrative - Reported"
    );
    expect(reasonObs.subject.reference).toBe(patientUuid);
    expect(reasonObs.subject.display).toBe("Anonymous Patient");
    expect(reasonObs.performer).toBeDefined();
    expect(reasonObs.performer[0].display).toBe(
      "EchoHealth AI Clinical Assistant"
    );
    expect(reasonObs.category).toBeUndefined();
    expect(reasonObs.valueString).toBe(
      "Paciente con dolor lumbar, irradiado a pierna derecha"
    );
    expect(reasonObs.valueCodeableConcept).toBeUndefined();
  });

  test("T4 — Mapeo de Cantidades UCUM: height valueQuantity con cm", () => {
    const heightObs = resources.find(
      (r) => r.id === "obs-1" && r.resourceType === "Observation"
    );
    expect(heightObs).toBeDefined();
    expect(heightObs.text).toBeDefined();
    expect(heightObs.text.status).toBe("generated");
    expect(heightObs.text.div).toContain("Altura (cm)");
    expect(heightObs.code.coding[0].code).toBe("8302-2");
    expect(heightObs.code.coding[0].system).toBe("http://loinc.org");
    expect(heightObs.subject.reference).toBe(patientUuid);
    expect(heightObs.performer).toBeDefined();
    expect(heightObs.performer[0].display).toBe(
      "EchoHealth AI Clinical Assistant"
    );
    expect(heightObs.category).toBeDefined();
    expect(heightObs.category[0].coding[0].code).toBe("vital-signs");
    expect(heightObs.valueQuantity).toBeDefined();
    expect(heightObs.valueQuantity.value).toBe(175);
    expect(heightObs.valueQuantity.unit).toBe("cm");
    expect(heightObs.valueQuantity.system).toBe(
      "http://unitsofmeasure.org"
    );
    expect(heightObs.valueQuantity.code).toBe("cm");
  });

  test("T5 — Tratamiento de Panel Compuesto: PA 85354-9 con 2 componentes", () => {
    const bpObs = resources.find(
      (r) =>
        r.id === "obs-2" &&
        r.code.coding[0].code === "85354-9"
    );
    expect(bpObs).toBeDefined();
    expect(bpObs.resourceType).toBe("Observation");
    expect(bpObs.text).toBeDefined();
    expect(bpObs.text.status).toBe("generated");
    expect(bpObs.text.div).toContain("Presión arterial");
    expect(bpObs.subject.reference).toBe(patientUuid);
    expect(bpObs.performer).toBeDefined();
    expect(bpObs.performer[0].display).toBe(
      "EchoHealth AI Clinical Assistant"
    );
    expect(bpObs.category).toBeDefined();
    expect(bpObs.category[0].coding[0].code).toBe("vital-signs");
    expect(bpObs.component).toBeDefined();
    expect(bpObs.component.length).toBe(2);

    const systolic = bpObs.component[0];
    expect(systolic.code.coding[0].code).toBe("8480-6");
    expect(systolic.code.coding[0].system).toBe("http://loinc.org");
    expect(systolic.code.coding[0].display).toBe(
      "Systolic blood pressure"
    );
    expect(systolic.valueQuantity.value).toBe(120);
    expect(systolic.valueQuantity.unit).toBe("mmHg");
    expect(systolic.valueQuantity.system).toBe(
      "http://unitsofmeasure.org"
    );
    expect(systolic.valueQuantity.code).toBe("mm[Hg]");

    const diastolic = bpObs.component[1];
    expect(diastolic.code.coding[0].code).toBe("8462-4");
    expect(diastolic.code.coding[0].display).toBe(
      "Diastolic blood pressure"
    );
    expect(diastolic.valueQuantity.value).toBe(80);
  });

  test("T6 — Tratamiento de Hallazgos SNOMED: finding → Condition", () => {
    const condition = resources.find(
      (r) => r.resourceType === "Condition"
    );
    expect(condition).toBeDefined();
    expect(condition.id).toBe("condition-3");
    expect(condition.subject.reference).toBe(patientUuid);
    expect(condition.code.coding[0].code).toBe("21522001");
    expect(condition.code.coding[0].system).toBe(
      "http://snomed.info/sct"
    );
    expect(condition.code.coding[0].display).toBe("Dolor abdominal");
    expect(condition.clinicalStatus.coding[0].code).toBe("active");
    expect(condition.clinicalStatus.coding[0].system).toBe(
      "http://terminology.hl7.org/CodeSystem/condition-clinical"
    );
    expect(condition.verificationStatus.coding[0].code).toBe(
      "confirmed"
    );
    expect(condition.verificationStatus.coding[0].system).toBe(
      "http://terminology.hl7.org/CodeSystem/condition-ver-status"
    );
    expect(condition.note).toBeDefined();
    expect(condition.note[0].text).toBe("Leve");
  });

  test("T7 — Control de Tolerancia a Nulos: 0 recursos para campos null", () => {
    expect(parsed.entry.length).toBe(6);
    expect(composition.resourceType).toBe("Composition");
    expect(resources.length).toBe(4);

    const conceptIds = resources.map(
      (r) => r.code?.coding?.[0]?.code || r.id
    );
    expect(conceptIds).not.toContain("29463-7");

    const weightResource = resources.find(
      (r) =>
        r.code?.coding?.[0]?.code === "29463-7" ||
        r.id === "condition-4"
    );
    expect(weightResource).toBeUndefined();
  });
});

// =============================================================================
// NUEVO — buildLongFormatCsv (CSV transaccional formato largo)
// =============================================================================

function parseCsvRow(row) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"' && !inQuotes) {
      inQuotes = true;
    } else if (ch === '"' && inQuotes) {
      if (i + 1 < row.length && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = false;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

describe("buildLongFormatCsv — Test de CSV Transaccional (Formato Largo)", () => {
  const csv = buildLongFormatCsv(mockConsultation);
  const lines = csv.split("\n");
  const dataRows = lines.slice(1).map(parseCsvRow);

  test("T1 — Integridad de la Cabecera: columnas estándar", () => {
    expect(lines[0]).toBe(
      "fecha,consulta_id,medico_id,campo_id,terminologia,codigo_concepto,termino_concepto,valor_extraido,unidad,tipo_semantico"
    );
  });

  test("T2 — Mapeo de Filas Transaccionales: 1 fila por campo activo (4 datos)", () => {
    expect(lines.length).toBe(5);
    expect(dataRows.length).toBe(4);
    for (const row of dataRows) {
      expect(row.length).toBe(10);
    }
  });

  test("T3 — Inyección de Unidades: LOINC cm, SNOMED vacío", () => {
    const loincRows = dataRows.filter(
      (r) => r[4] === "LOINC" && r[5] === "8302-2"
    );
    expect(loincRows.length).toBe(1);
    expect(loincRows[0][8]).toBe("cm");

    const snomedRows = dataRows.filter((r) => r[4] === "SNOMED");
    for (const row of snomedRows) {
      expect(row[8]).toBe("");
    }
  });

  test("T4 — Escapado de Caracteres: comas internas entre comillas dobles", () => {
    const reasonRow = dataRows.find(
      (r) => r[3] === "reasonForVisit"
    );
    expect(reasonRow).toBeDefined();

    const rawReasonLine = lines.find((l) =>
      l.includes("reasonForVisit")
    );
    expect(rawReasonLine).toMatch(
      /"Paciente con dolor lumbar, irradiado a pierna derecha"/
    );

    expect(reasonRow[7]).toBe(
      "Paciente con dolor lumbar, irradiado a pierna derecha"
    );
  });

  test("T5 — fecha column viaja con el ISO de la consulta (no vacía)", () => {
    const csv = buildLongFormatCsv(mockConsultation);
    const rows = csv.split("\n").slice(1).map(parseCsvRow);
    for (const row of rows) {
      expect(row[0]).toBe("2026-05-16T10:00:00.000Z");
    }
  });

  test("T6 — tolera entradas null en fields[] sin colapsar", () => {
    const corrupted = {
      ...mockConsultation,
      fields: [null, ...mockConsultation.fields, null],
    };

    const bundleStr = buildFhirR4Bundle(corrupted);
    const bundle = JSON.parse(bundleStr);
    const resources = bundle.entry.slice(1)
      .filter((e) => e.resource.resourceType !== "Patient")
      .map((e) => e.resource);
    expect(resources.length).toBe(4);

    const csv = buildLongFormatCsv(corrupted);
    const rows = csv.split("\n").slice(1);
    expect(rows.length).toBe(4);
  });
});
