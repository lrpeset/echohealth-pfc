/**
 * EchoHealth — Módulo de Exportación e Interoperabilidad Clínica Hospitalaria.
 *
 * Transmuta de forma determinista la estructura abstracta de las consultas médicas (modelo EAV)
 * en documentos canónicos de intercambio de datos de salud bajo el estándar internacional HL7 FHIR R4
 * (Bundle de tipo Document) y matrices planas de Big Data transaccional (CSV Formato Largo).
 *
 * Reglas de Mapeo y Normalización Semántica:
 * - Constantes vitales y métricas cuantitativas (LOINC) -> Recursos Observation con taxonomía canónica UCUM.
 * - Trastornos, diagnósticos y hallazgos clínicos (SNOMED CT) con tags de condición -> Recursos Condition.
 * - Notas narrativas, variables cualitativas puntuales o motivo de consulta -> Recursos Observation planos.
 * - Control de Conformidad: Inyección obligatoria de narrativa XHTML indexable para el cumplimiento de la regla dom-6.
 */

// =========================================================================
// SISTEMAS DE CODIFICACIÓN Y MATRICES TERMINOLÓGICAS FHIR
// =========================================================================

const FHIR_SYSTEMS = {
  LOINC: "http://loinc.org",
  SNOMED: "http://snomed.info/sct",
  UCUM: "http://unitsofmeasure.org",
};

const CONDITION_SEMANTIC_TAGS = new Set([
  "finding",
  "disorder",
  "morphologic-abnormality",
  "disease",
  "syndrome",
  "malformation",
]);

// Diccionario de unidades canónicas UCUM
const LOINC_UNITS = {
  "8302-2": { unit: "cm", code: "cm" },
  "29463-7": { unit: "kg", code: "kg" },
  "8867-4": { unit: "beats/minute", code: "/min" },
  "2708-6": { unit: "%", code: "%" },
  "39156-5": { unit: "kg/m2", code: "kg/m2" },
  "8480-6": { unit: "mmHg", code: "mm[Hg]" },
  "8462-4": { unit: "mmHg", code: "mm[Hg]" },
  "72514-3": { unit: "{score}", code: "{score}" },
  "9303-7": { unit: "meters", code: "m" },
};

// Blindaje Terminológico: Exigencia estricta del Validador HL7 para perfiles Vital Signs
const CANONICAL_LOINC_DISPLAYS = {
  "85354-9": "Blood pressure panel with all children optional",
  "2708-6": "Oxygen saturation in Arterial blood",
  "8302-2": "Body height",
  "29463-7": "Body weight",
  "8867-4": "Heart rate",
  "8480-6": "Systolic blood pressure",
  "8462-4": "Diastolic blood pressure",
};

// =========================================================================
// FUNCIONES DE UTILIDAD SINTÁCTICA
// =========================================================================

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function safeStr(v) {
  if (v == null) return "";
  return String(v);
}

function parseNumeric(v) {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function escapeCsv(v) {
  if (v == null) return "";
  const s = String(v).replace(/"/g, '""');
  return s.includes(",") || s.includes("\n") || s.includes('"') ? `"${s}"` : s;
}

function nowISO() {
  return new Date().toISOString();
}

function formatFhirDate(dateStr) {
  if (!dateStr) return nowISO();
  if (!dateStr.includes("T")) return dateStr;
  if (dateStr.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(dateStr)) return dateStr;
  return dateStr + "Z";
}

// =========================================================================
// MOTORES DE TRANSFORMACIÓN A RECURSOS HL7 FHIR R4
// =========================================================================

function parseBloodPressure(value) {
  const s = String(value);
  if (!s.includes("/")) return null;
  const parts = s.split("/").map((p) => p.trim());
  if (parts.length !== 2) return null;
  if (parts[0] === "" || parts[1] === "") return null;
  const systolic = parseNumeric(parts[0]);
  const diastolic = parseNumeric(parts[1]);
  if (systolic != null && diastolic != null) {
    return { systolic, diastolic };
  }
  return null;
}

function mapFieldToObservation(field, idx, clinicalDate, patientUuid) {
  const isReason = field.id === "reasonForVisit";

  // Interceptamos y forzamos la nomenclatura canónica si es un LOINC controlado, si no, mantenemos el valor de la IA
  const resolvedDisplay = isReason
    ? "Chief complaint Narrative - Reported"
    : (field.terminology === "LOINC" && CANONICAL_LOINC_DISPLAYS[field.conceptId])
      ? CANONICAL_LOINC_DISPLAYS[field.conceptId]
      : field.term || field.label || "";

  const resource = {
    resourceType: "Observation",
    id: `obs-${idx}`,
    status: "final",
    text: {
      status: "generated",
      div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>${isReason ? "Chief complaint Narrative - Reported" : field.label || "Clinical Observation"}: ${String(field.value || "")}</p></div>`,
    },
    code: {
      coding: [
        {
          system: isReason
            ? FHIR_SYSTEMS.LOINC
            : field.terminology === "LOINC"
              ? FHIR_SYSTEMS.LOINC
              : FHIR_SYSTEMS.SNOMED,
          code: isReason ? "10154-3" : field.conceptId || "unknown",
          display: resolvedDisplay,
        },
      ],
      text: isReason
        ? "Chief complaint Narrative - Reported"
        : field.label || "",
    },
    subject: {
      reference: patientUuid,
      display: "Anonymous Patient",
    },
    performer: [
      {
        display: "EchoHealth AI Clinical Assistant",
      },
    ],
    effectiveDateTime: formatFhirDate(clinicalDate || nowISO()),
  };

  if (field.terminology === "LOINC" && !isReason) {
    resource.category = [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/observation-category",
            code: "vital-signs",
            display: "Vital Signs",
          },
        ],
      },
    ];
  }

  if (isReason) {
    resource.valueString = field.value ? String(field.value) : "";
    return resource;
  }

  const isLoincNumber = field.type && field.type.endsWith("-number");
  const numericValue = parseNumeric(field.value);

  // Tratamiento especializado para paneles compuestos: desglosa presión arterial en componentes sistólico/diastólico
  if (field.conceptId === "85354-9") {
    const bp = parseBloodPressure(field.value);
    if (bp) {
      resource.code.text = "Blood pressure panel";
      resource.component = [
        {
          code: {
            coding: [
              {
                system: FHIR_SYSTEMS.LOINC,
                code: "8480-6",
                display: CANONICAL_LOINC_DISPLAYS["8480-6"],
              },
            ],
          },
          valueQuantity: {
            value: bp.systolic,
            unit: "mmHg",
            system: FHIR_SYSTEMS.UCUM,
            code: "mm[Hg]",
          },
        },
        {
          code: {
            coding: [
              {
                system: FHIR_SYSTEMS.LOINC,
                code: "8462-4",
                display: CANONICAL_LOINC_DISPLAYS["8462-4"],
              },
            ],
          },
          valueQuantity: {
            value: bp.diastolic,
            unit: "mmHg",
            system: FHIR_SYSTEMS.UCUM,
            code: "mm[Hg]",
          },
        },
      ];
    } else {
      resource.valueString = safeStr(field.value);
    }
  } else if (isLoincNumber && numericValue != null) {
    const unitInfo = LOINC_UNITS[field.conceptId] || { unit: "", code: "" };
    resource.valueQuantity = {
      value: numericValue,
      unit: unitInfo.unit,
      system: unitInfo.code ? FHIR_SYSTEMS.UCUM : undefined,
      code: unitInfo.code || undefined,
    };
  } else if (field.terminology === "SNOMED" && field.conceptId) {
    resource.valueCodeableConcept = {
      coding: [
        {
          system: FHIR_SYSTEMS.SNOMED,
          code: field.conceptId,
          display: field.term || field.label || "",
        },
      ],
      text: safeStr(field.value),
    };
  } else {
    resource.valueString = safeStr(field.value);
  }

  return resource;
}

function mapFieldToCondition(field, idx, patientUuid) {
  return {
    resourceType: "Condition",
    id: `condition-${idx}`,
    subject: {
      reference: patientUuid,
      display: "Anonymous Patient",
    },
    clinicalStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: "active",
          display: "Active",
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
          code: "confirmed",
          display: "Confirmed",
        },
      ],
    },
    code: {
      coding: [
        {
          system: FHIR_SYSTEMS.SNOMED,
          code: field.conceptId || "unknown",
          display: field.term || field.label || "",
        },
      ],
      text: field.label || "",
    },
    note: field.value ? [{ text: safeStr(field.value) }] : undefined,
  };
}

function mapFieldToFhirResource(field, idx, clinicalDate, patientUuid) {
  const isReasonForVisit = field.id === "reasonForVisit";

  if (isReasonForVisit) {
    return mapFieldToObservation(
      {
        ...field,
        conceptId: "10154-3",
        term: "Chief complaint Narrative - Reported",
        terminology: "LOINC",
        type: "loinc-text",
      },
      idx,
      clinicalDate,
      patientUuid,
    );
  }

  const isSnomedFinding =
    field.terminology === "SNOMED" &&
    CONDITION_SEMANTIC_TAGS.has(field.semanticTag);

  if (isSnomedFinding && field.conceptId) {
    return mapFieldToCondition(field, idx, patientUuid);
  }

  return mapFieldToObservation(field, idx, clinicalDate, patientUuid);
}

// =========================================================================
// COMPOSICIÓN Y MANIFIESTO ESTRUCTURAL DEL DOCUMENTO CLÍNICO
// =========================================================================

const SECTION_DISPLAY_NAMES = {
  "Motivo de la consulta": "Chief complaint Narrative - Reported",
  "Mediciones y Tests": "Vital signs note",
  "Hallazgos Clínicos": "Clinical findings",
  "Otras Observaciones": "Other clinical observations",
};

function buildComposition(consultation, sectionEntries, patientUuid) {
  const now = nowISO();

  const composition = {
    resourceType: "Composition",
    id: "composition-1",
    status: "final",
    text: {
      status: "generated",
      div: '<div xmlns="http://www.w3.org/1999/xhtml"><p>EchoHealth Clinical Summary Composition</p></div>',
    },
    type: {
      coding: [
        {
          system: FHIR_SYSTEMS.LOINC,
          code: "34108-1",
          display: "Outpatient Note",
        },
      ],
      text: "EchoHealth Clinical Summary",
    },
    subject: {
      reference: patientUuid,
      display: "Anonymous Patient Reference",
    },
    date: formatFhirDate(consultation.createdAt || now),
    author: [
      {
        display: "EchoHealth AI Clinical Assistant",
      },
    ],
    title: "EchoHealth - Resumen Clínico",
    section: [],
  };

  const seenSections = new Set();

  for (const { section, entry } of sectionEntries) {
    if (!seenSections.has(section.title)) {
      seenSections.add(section.title);
      composition.section.push({
        title: section.title,
        code: section.code
          ? {
              coding: [
                {
                  system: FHIR_SYSTEMS.LOINC,
                  code: section.code,
                  display:
                    SECTION_DISPLAY_NAMES[section.title] || section.title,
                },
              ],
            }
          : undefined,
        entry: [],
      });
    }
    const sec = composition.section.find((s) => s.title === section.title);
    if (entry) {
      sec.entry.push(entry);
    }
  }

  return composition;
}

// =========================================================================
// PASARELAS DE EXPORTACIÓN PÚBLICA (APIs DEL MÓDULO)
// =========================================================================

export function buildFhirR4Bundle(consultation) {
  const fields = consultation?.fields || [];
  const now = nowISO();
  const clinicalDate = consultation?.createdAt || now;
  const patientUuid = "urn:uuid:" + generateUUID();

  const patientResource = {
    resourceType: "Patient",
    id: "patient-" + generateUUID(),
    text: {
      status: "generated",
      div: '<div xmlns="http://www.w3.org/1999/xhtml"><p>Anonymized Patient Resource</p></div>',
    },
    identifier: [
      {
        system: "https://echohealth.app/patients",
        value: consultation.userId || "anonymous",
      },
    ],
  };

  const bundleEntries = [];
  const sectionEntries = [];

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (!field || field.value == null || String(field.value).trim() === "")
      continue;

    const resource = mapFieldToFhirResource(
      field,
      i,
      clinicalDate,
      patientUuid,
    );
    const resourceUuid = "urn:uuid:" + generateUUID();

    bundleEntries.push({
      fullUrl: resourceUuid,
      resource,
    });

    if (field.id === "reasonForVisit") {
      sectionEntries.push({
        section: {
          title: "Motivo de la consulta",
          code: "10154-3",
        },
        entry: { reference: resourceUuid },
      });
    } else if (field.terminology === "LOINC") {
      sectionEntries.push({
        section: {
          title: "Mediciones y Tests",
          code: "8716-3",
        },
        entry: { reference: resourceUuid },
      });
    } else if (resource.resourceType === "Condition") {
      sectionEntries.push({
        section: {
          title: "Hallazgos Clínicos",
          code: "87189-4",
        },
        entry: { reference: resourceUuid },
      });
    } else {
      sectionEntries.push({
        section: {
          title: "Otras Observaciones",
          code: "81232-1",
        },
        entry: { reference: resourceUuid },
      });
    }
  }

  const composition = buildComposition(
    consultation,
    sectionEntries,
    patientUuid,
  );
  const compositionUuid = "urn:uuid:" + generateUUID();

  const bundle = {
    resourceType: "Bundle",
    id: generateUUID(),
    type: "document",
    timestamp: formatFhirDate(now),
    identifier: {
      system: "https://echohealth.app/consultations",
      value: consultation.id || "unknown",
    },
    entry: [
      {
        fullUrl: compositionUuid,
        resource: composition,
      },
      {
        fullUrl: patientUuid,
        resource: patientResource,
      },
      ...bundleEntries,
    ],
  };

  return JSON.stringify(bundle, null, 2);
}

const CSV_LONG_HEADER = [
  "fecha",
  "consulta_id",
  "medico_id",
  "campo_id",
  "terminologia",
  "codigo_concepto",
  "termino_concepto",
  "valor_extraido",
  "unidad",
  "tipo_semantico",
].join(",");

export function buildLongFormatCsv(consultation) {
  const fields = consultation?.fields || [];
  const consultaId = consultation.id || "";
  const medicoId = consultation.userId || "";
  const fecha = consultation.createdAt
    ? new Date(consultation.createdAt).toISOString()
    : "";

  const rows = fields
    .filter(
      (f) => f != null && f.value != null && String(f.value).trim() !== "",
    )
    .map((f) => {
      const unidad =
        f.terminology === "LOINC" && f.conceptId
          ? LOINC_UNITS[f.conceptId]?.unit || ""
          : "";
      const row = [
        fecha,
        consultaId,
        medicoId,
        f.id || "",
        f.terminology || "SNOMED",
        f.conceptId || "",
        f.term || "",
        String(f.value),
        unidad,
        f.semanticTag || "",
      ];
      return row.map(escapeCsv).join(",");
    });

  return [CSV_LONG_HEADER, ...rows].join("\n");
}