/**
 * EchoHealth — Módulo de Exportación FHIR R5 e Interoperabilidad
 *
 * Convierte el array fields[] de una consulta clínica dinámica en formatos
 * interoperables estándar: FHIR R5 Bundle (tipo document) y CSV transaccional
 * en formato largo.
 *
 * ESTRATEGIA DE MAPEO (Blueprint Conceptual):
 * ──────────────────────────────────
 *
 *   fields[{id, label, type, value, conceptId, term, terminology, semanticTag}]
 *                                    │
 *                    ┌───────────────┴───────────────┐
 *                    │                               │
 *               terminology                          │
 *              /              \                      │
 *          LOINC            SNOMED                   │
 *            │                │                      │
 *        ┌────┴────┐    ┌────┴────────┐             │
 *        │         │    │             │             │
 *   loinc-number  │  semanticTag     │         reasonForVisit
 *        │    loinc-text  │  finding/ │         (caso especial)
 *        │         │    disorder     │             │
 *        ▼         ▼      │     other             ▼
 *   Observation  Observation Condition   Observation
 *   valueQuantity valueString  │    Observation   valueString
 *        │         │          │    valueCodeable  (LOINC 46240-0)
 *        │         │          │    Concept
 *        │         │          │
 *        └────┬────┘          │
 *             │               │
 *             ▼               ▼
 *     ┌──────────────────────────────┐
 *     │    Bundle (type: document)    │
 *     │  ├─ Composition (header)      │
 *     │  ├─ Observation #1 (LOINC)    │
 *     │  ├─ Condition #1 (SNOMED)     │
 *     │  └─ Observation #2 (SNOMED)   │
 *     └──────────────────────────────┘
 *
 * SISTEMAS DE CODIFICACIÓN OFICIALES FHIR:
 *   LOINC:  http://loinc.org
 *   SNOMED: http://snomed.info/sct
 *   UCUM:   http://unitsofmeasure.org
 *
 * CONDITION vs OBSERVATION (SNOMED):
 *   - semanticTag ∈ {"finding","disorder","morphologic-abnormality"} → Condition
 *   - semanticTag ∈ {resto} o null → Observation con valueCodeableConcept/valueString
 *   - Si el hallazgo es un diagnóstico establecido → Condition
 *   - Si es una observación puntual no diagnóstica → Observation
 */

// =========================================================================
// CONSTANTES DE CODIFICACIÓN FHIR
// =========================================================================

const FHIR_SYSTEMS = {
  LOINC: 'http://loinc.org',
  SNOMED: 'http://snomed.info/sct',
  UCUM: 'http://unitsofmeasure.org',
}

const CONDITION_SEMANTIC_TAGS = new Set([
  'finding',
  'disorder',
  'morphologic-abnormality',
  'disease',
  'syndrome',
  'malformation',
])

const LOINC_UNITS = {
  '8302-2':   { unit: 'cm',              code: 'cm' },
  '29463-7':  { unit: 'kg',              code: 'kg' },
  '8867-4':   { unit: 'beats/minute',    code: '/min' },
  '2708-6':   { unit: '%',               code: '%' },
  '39156-5':  { unit: 'kg/m2',           code: 'kg/m2' },
  '8480-6':   { unit: 'mmHg',            code: 'mm[Hg]' },
  '8462-4':   { unit: 'mmHg',            code: 'mm[Hg]' },
  '72514-3':  { unit: '{score}',         code: '{score}' },
  '9303-7':   { unit: 'meters',          code: 'm' },
}

// =========================================================================
// UTILIDADES
// =========================================================================

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function safeStr(v) {
  if (v == null) return ''
  return String(v)
}

function parseNumeric(v) {
  if (v == null || String(v).trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function escapeCsv(v) {
  if (v == null) return ''
  const s = String(v).replace(/"/g, '""')
  return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s}"` : s
}

function nowISO() {
  return new Date().toISOString()
}

function formatFhirDate(dateStr) {
  if (!dateStr) return nowISO()
  if (!dateStr.includes('T')) return dateStr
  if (dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr)) return dateStr
  return dateStr + 'Z'
}

// =========================================================================
// NÚCLEO: MAPEO DE CADA FIELD A RECURSO FHIR R5
// =========================================================================

function parseBloodPressure(value) {
  const s = String(value)
  if (!s.includes('/')) return null
  const parts = s.split('/').map((p) => p.trim())
  if (parts.length !== 2) return null
  if (parts[0] === '' || parts[1] === '') return null
  const systolic = parseNumeric(parts[0])
  const diastolic = parseNumeric(parts[1])
  if (systolic != null && diastolic != null) {
    return { systolic, diastolic }
  }
  return null
}

function mapFieldToObservation(field, idx, clinicalDate, patientUuid) {
  const isReason = field.id === 'reasonForVisit'

  const resource = {
    resourceType: 'Observation',
    id: `obs-${idx}`,
    status: 'final',
    text: {
      status: 'generated',
      div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>${isReason ? 'Chief complaint Narrative - Reported' : (field.label || 'Clinical Observation')}: ${String(field.value || '')}</p></div>`,
    },
    code: {
      coding: [
        {
          system: isReason
            ? FHIR_SYSTEMS.LOINC
            : field.terminology === 'LOINC'
              ? FHIR_SYSTEMS.LOINC
              : FHIR_SYSTEMS.SNOMED,
          code: isReason ? '10154-3' : (field.conceptId || 'unknown'),
          display: isReason
            ? 'Chief complaint Narrative - Reported'
            : (field.term || field.label || ''),
        },
      ],
      text: isReason ? 'Chief complaint Narrative - Reported' : (field.label || ''),
    },
    subject: {
      reference: patientUuid,
      display: 'Anonymous Patient',
    },
    performer: [
      {
        display: 'EchoHealth AI Clinical Assistant',
      },
    ],
    effectiveDateTime: formatFhirDate(clinicalDate || nowISO()),
  }

  if (field.terminology === 'LOINC' && !isReason) {
    resource.category = [
      {
        coding: [
          {
            system:
              'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          },
        ],
      },
    ]
  }

  if (isReason) {
    resource.valueString = field.value ? String(field.value) : ''
    return resource
  }

  const isLoincNumber =
    field.type && field.type.endsWith('-number')

  const numericValue = parseNumeric(field.value)

  if (field.conceptId === '85354-9') {
    const bp = parseBloodPressure(field.value)
    if (bp) {
      resource.code.text = 'Blood pressure panel'
      resource.component = [
        {
          code: {
            coding: [
              {
                system: FHIR_SYSTEMS.LOINC,
                code: '8480-6',
                display: 'Systolic blood pressure',
              },
            ],
          },
          valueQuantity: {
            value: bp.systolic,
            unit: 'mmHg',
            system: FHIR_SYSTEMS.UCUM,
            code: 'mm[Hg]',
          },
        },
        {
          code: {
            coding: [
              {
                system: FHIR_SYSTEMS.LOINC,
                code: '8462-4',
                display: 'Diastolic blood pressure',
              },
            ],
          },
          valueQuantity: {
            value: bp.diastolic,
            unit: 'mmHg',
            system: FHIR_SYSTEMS.UCUM,
            code: 'mm[Hg]',
          },
        },
      ]
    } else {
      resource.valueString = safeStr(field.value)
    }
  } else if (isLoincNumber && numericValue != null) {
    const unitInfo =
      LOINC_UNITS[field.conceptId] || { unit: '', code: '' }
    resource.valueQuantity = {
      value: numericValue,
      unit: unitInfo.unit,
      system: unitInfo.code ? FHIR_SYSTEMS.UCUM : undefined,
      code: unitInfo.code || undefined,
    }
  } else if (field.terminology === 'SNOMED' && field.conceptId) {
    resource.valueCodeableConcept = {
      coding: [
        {
          system: FHIR_SYSTEMS.SNOMED,
          code: field.conceptId,
          display: field.term || field.label || '',
        },
      ],
      text: safeStr(field.value),
    }
  } else {
    resource.valueString = safeStr(field.value)
  }

  return resource
}

function mapFieldToCondition(field, idx, patientUuid) {
  return {
    resourceType: 'Condition',
    id: `condition-${idx}`,
    subject: {
      reference: patientUuid,
      display: 'Anonymous Patient',
    },
    clinicalStatus: {
      coding: [
        {
          system:
            'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active',
          display: 'Active',
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system:
            'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: 'confirmed',
          display: 'Confirmed',
        },
      ],
    },
    code: {
      coding: [
        {
          system: FHIR_SYSTEMS.SNOMED,
          code: field.conceptId || 'unknown',
          display: field.term || field.label || '',
        },
      ],
      text: field.label || '',
    },
    note: field.value
      ? [{ text: safeStr(field.value) }]
      : undefined,
  }
}

function mapFieldToFhirResource(field, idx, clinicalDate, patientUuid) {
  const isReasonForVisit = field.id === 'reasonForVisit'

  if (isReasonForVisit) {
    return mapFieldToObservation(
      {
        ...field,
        conceptId: '10154-3',
        term: 'Chief complaint Narrative - Reported',
        terminology: 'LOINC',
        type: 'loinc-text',
      },
      idx,
      clinicalDate,
      patientUuid
    )
  }

  const isSnomedFinding =
    field.terminology === 'SNOMED' &&
    CONDITION_SEMANTIC_TAGS.has(field.semanticTag)

  if (isSnomedFinding && field.conceptId) {
    return mapFieldToCondition(field, idx, patientUuid)
  }

  return mapFieldToObservation(field, idx, clinicalDate, patientUuid)
}

// =========================================================================
// CONSTRUCCIÓN DEL COMPOSITION (CABECERA DEL DOCUMENTO FHIR)
// =========================================================================

const SECTION_DISPLAY_NAMES = {
  'Motivo de la consulta': 'Chief complaint Narrative - Reported',
  'Mediciones y Tests': 'Vital signs note',
  'Hallazgos Clínicos': 'Clinical findings',
  'Otras Observaciones': 'Other clinical observations',
}

function buildComposition(consultation, sectionEntries, patientUuid) {
  const now = nowISO()

  const composition = {
    resourceType: 'Composition',
    id: 'composition-1',
    status: 'final',
    text: {
      status: 'generated',
      div: '<div xmlns="http://www.w3.org/1999/xhtml"><p>EchoHealth Clinical Summary Composition</p></div>',
    },
    type: {
      coding: [
        {
          system: FHIR_SYSTEMS.LOINC,
          code: '34108-1',
          display: 'Outpatient Note',
        },
      ],
      text: 'EchoHealth Clinical Summary',
    },
    subject: [
      {
        reference: patientUuid,
        display: `Patient-ID: ${consultation.userId || 'Unknown'}`,
      },
    ],
    date: formatFhirDate(consultation.createdAt || now),
    author: [
      {
        display: 'EchoHealth AI Clinical Assistant',
      },
    ],
    title: 'EchoHealth - Resumen Clínico',
    section: [],
  }

  const seenSections = new Set()

  for (const { section, entry } of sectionEntries) {
    if (!seenSections.has(section.title)) {
      seenSections.add(section.title)
      composition.section.push({
        title: section.title,
        code: section.code
          ? {
              coding: [
                {
                  system: FHIR_SYSTEMS.LOINC,
                  code: section.code,
                  display: SECTION_DISPLAY_NAMES[section.title] || section.title,
                },
              ],
            }
          : undefined,
        entry: [],
      })
    }
    const sec = composition.section.find(
      (s) => s.title === section.title
    )
    if (entry) {
      sec.entry.push(entry)
    }
  }

  return composition
}

// =========================================================================
// API PÚBLICA: buildFhirR5Bundle
// =========================================================================

/**
 * Convierte una consulta completa en un Bundle FHIR R5 de tipo "document".
 *
 * @param {Object} consultation - Objeto consulta { id, userId, createdAt, fields: [...] }
 * @returns {string} JSON string del Bundle FHIR R5 formateado
 */
export function buildFhirR5Bundle(consultation) {
  const fields = consultation?.fields || []
  const now = nowISO()
  const clinicalDate = consultation?.createdAt || now
  const patientUuid = 'urn:uuid:' + generateUUID()

  const patientResource = {
    resourceType: 'Patient',
    id: 'patient-' + generateUUID(),
    text: {
      status: 'generated',
      div: '<div xmlns="http://www.w3.org/1999/xhtml"><p>Anonymized Patient Resource</p></div>',
    },
    identifier: [
      {
        system: 'https://echohealth.app/patients',
        value: consultation.userId || 'anonymous',
      },
    ],
  }

  const bundleEntries = []
  const sectionEntries = []

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i]
    if (!field || field.value == null || String(field.value).trim() === '') continue

    const resource = mapFieldToFhirResource(field, i, clinicalDate, patientUuid)
    const resourceUuid = 'urn:uuid:' + generateUUID()

    bundleEntries.push({
      fullUrl: resourceUuid,
      resource,
    })

    if (field.id === 'reasonForVisit') {
      sectionEntries.push({
        section: {
          title: 'Motivo de la consulta',
          code: '10154-3',
        },
        entry: { reference: resourceUuid },
      })
    } else if (field.terminology === 'LOINC') {
      sectionEntries.push({
        section: {
          title: 'Mediciones y Tests',
          code: '8716-3',
        },
        entry: { reference: resourceUuid },
      })
    } else if (resource.resourceType === 'Condition') {
      sectionEntries.push({
        section: {
          title: 'Hallazgos Clínicos',
          code: '87189-4',
        },
        entry: { reference: resourceUuid },
      })
    } else {
      sectionEntries.push({
        section: {
          title: 'Otras Observaciones',
          code: '81232-1',
        },
        entry: { reference: resourceUuid },
      })
    }
  }

  const composition = buildComposition(consultation, sectionEntries, patientUuid)
  const compositionUuid = 'urn:uuid:' + generateUUID()

  const bundle = {
    resourceType: 'Bundle',
    id: generateUUID(),
    type: 'document',
    timestamp: formatFhirDate(now),
    identifier: {
      system: 'https://echohealth.app/consultations',
      value: consultation.id || 'unknown',
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
  }

  return JSON.stringify(bundle, null, 2)
}

// =========================================================================
// FORMATO LARGO — CSV INTEROPERABLE (Una fila = un valor clínico)
// =========================================================================

const CSV_LONG_HEADER = [
  'fecha',
  'consulta_id',
  'medico_id',
  'campo_id',
  'terminologia',
  'codigo_concepto',
  'termino_concepto',
  'valor_extraido',
  'unidad',
  'tipo_semantico',
].join(',')

/**
 * Genera un CSV en formato largo/transaccional donde cada fila representa
 * un único valor clínico mapeado.
 *
 * Ventajas frente al formato ancho (wide):
 *   - Agnóstico al esquema: cualquier número de campos funciona
 *   - Consultable: fácil de cargar en R, Python, Excel (tabla dinámica)
 *   - Appendable: nuevas consultas añaden filas sin romper columnas
 *   - Interoperable: formato estándar para intercambio de datos clínicos
 *
 * @param {Object} consultation - Objeto consulta { id, userId, createdAt, fields: [...] }
 * @returns {string} CSV string en formato largo
 */
export function buildLongFormatCsv(consultation) {
  const fields = consultation?.fields || []
  const consultaId = consultation.id || ''
  const medicoId = consultation.userId || ''
  const fecha = consultation.createdAt
    ? new Date(consultation.createdAt).toISOString()
    : ''

  const rows = fields
    .filter((f) => f != null && f.value != null && String(f.value).trim() !== '')
    .map((f) => {
      const unidad =
        f.terminology === 'LOINC' && f.conceptId
          ? LOINC_UNITS[f.conceptId]?.unit || ''
          : ''
      const row = [
        fecha,
        consultaId,
        medicoId,
        f.id || '',
        f.terminology || 'SNOMED',
        f.conceptId || '',
        f.term || '',
        String(f.value),
        unidad,
        f.semanticTag || '',
      ]
      return row.map(escapeCsv).join(',')
    })

  return [CSV_LONG_HEADER, ...rows].join('\n')
}


