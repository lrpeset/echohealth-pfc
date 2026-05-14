/**
 * Normalizador de consultas clínicas — Estrategia de Migración 'On-the-fly'.
 *
 * Detecta automáticamente el formato del JSON (legacy vs. estructurado SNOMED/LOINC)
 * y lo transforma a una representación unificada con fields[], content{} y metadata.
 *
 * Formatos aceptados:
 *   - NUEVO: { fields: [...], content: {...} }              → pasa limpio
 *   - LEGACY: { reasonForVisit: "...", height: 175, ... }    → se envuelve con fields[]
 *   - ARRAY: [{ id: "reasonForVisit", ... }, ...]            → se envuelve en { fields: [...] }
 *   - MOCK: item.content + item.contentJson                  → se normaliza a fields[]
 *
 * El resultado siempre tiene:
 *   result.fields    → Array<{ id, label, type, value, conceptId, term, terminology, semanticTag, conceptVerified }>
 *   result.content   → Map<string, any> (plano, retrocompat)
 *   result._normalized → true (flag para depuración)
 */

const METADATA_KNOWN_FIELDS = {
  reasonForVisit: {
    id: "reasonForVisit", label: "Motivo de la visita", type: "snomed-text",
    conceptId: null, term: null, terminology: "SNOMED", semanticTag: null, conceptVerified: false,
  },
  height: {
    id: "height", label: "Altura (cm)", type: "loinc-number",
    conceptId: "8302-2", term: "Body height", terminology: "LOINC", semanticTag: null, conceptVerified: false,
  },
  weight: {
    id: "weight", label: "Peso (kg)", type: "loinc-number",
    conceptId: "29463-7", term: "Body weight", terminology: "LOINC", semanticTag: null, conceptVerified: false,
  },
  pulse: {
    id: "pulse", label: "Pulso (ppm)", type: "loinc-number",
    conceptId: "8867-4", term: "Heart rate", terminology: "LOINC", semanticTag: null, conceptVerified: false,
  },
  bloodPressure: {
    id: "bloodPressure", label: "Presión arterial (mmHg)", type: "loinc-text",
    conceptId: "85354-9", term: "Blood pressure panel", terminology: "LOINC", semanticTag: null, conceptVerified: false,
  },
  oxygenSaturation: {
    id: "oxygenSaturation", label: "Saturación de oxígeno (%)", type: "loinc-number",
    conceptId: "2708-6", term: "Oxygen saturation", terminology: "LOINC", semanticTag: null, conceptVerified: false,
  },
  painLocation: {
    id: "painLocation", label: "Localización del dolor", type: "snomed-text",
    conceptId: "70163-1", term: "Body site", terminology: "LOINC", semanticTag: null, conceptVerified: false,
  },
  painNature: {
    id: "painNature", label: "Naturaleza del dolor", type: "snomed-text",
    conceptId: "440751004", term: "Type of pain", terminology: "SNOMED", semanticTag: null, conceptVerified: true,
  },
  painIntensity: {
    id: "painIntensity", label: "Intensidad del dolor (0-10)", type: "loinc-number",
    conceptId: "72514-3", term: "Pain severity - 0-10", terminology: "LOINC", semanticTag: null, conceptVerified: false,
  },
};

/**
 * Detecta el formato de un objeto consulta y lo normaliza a la estructura unificada.
 *
 * @param {Object|Array} input - Consulta en cualquier formato (legacy, nuevo, array plano)
 * @returns {Object} Siempre devuelve { fields: [], content: {}, _normalized: true }
 */
export function normalizeConsultation(input) {
  if (!input) {
    return buildEmpty();
  }

  // FORMATO NUEVO: Ya tiene fields[] y opcionalmente content{}
  if (input.fields && Array.isArray(input.fields)) {
    return {
      ...input,
      content: input.content || buildContentFromFields(input.fields),
      _normalized: false,
    };
  }

  // FORMATO ARRAY PLANO: Array de objetos campo (respuesta legacy de Gemini)
  if (Array.isArray(input)) {
    const fields = input.map((f) => normalizeField(f));
    const content = buildContentFromFields(fields);
    return { fields, content, _normalized: true };
  }

  // FORMATO LEGACY: Objeto plano con claves como reasonForVisit, height, etc.
  if (typeof input === "object" && !Array.isArray(input)) {
    const fields = buildFieldsFromLegacy(input);
    const content = { ...input };
    return { fields, content, _normalized: true };
  }

  return buildEmpty();
}

/**
 * Busca el primer valor no nulo de reasonForVisit en cualquiera de los formatos.
 * Útil para HomeScreen y HistoryScreen que muestran el motivo en la tarjeta.
 */
export function extractReasonForVisit(data) {
  if (!data) return null;

  // Formato nuevo: fields[]
  if (data.fields && Array.isArray(data.fields)) {
    const rf = data.fields.find((f) => f.id === "reasonForVisit");
    if (rf && rf.value != null) return String(rf.value);
  }

  // Formato legacy: content{} plano
  if (data.content) {
    const val = data.content.reasonForVisit || data.content.ReasonForVisit;
    if (val != null) return String(val);
  }

  // Plano directo
  if (data.reasonForVisit != null) return String(data.reasonForVisit);

  return null;
}

/**
 * Extrae los metadatos de un campo legacy (value + default metadata).
 * Si el campo tiene type, conceptId, terminology, se conservan;
 * si no, se añaden los defaults según el id del campo.
 */
function normalizeField(f) {
  if (!f) return null;

  const id = f.id || "";
  const defaults = METADATA_KNOWN_FIELDS[id];

  return {
    id,
    label: f.label || defaults?.label || id,
    type: f.type || defaults?.type || "snomed-text",
    value: f.value != null ? f.value : null,
    conceptId: f.conceptId != null ? f.conceptId : (defaults?.conceptId || null),
    term: f.term || defaults?.term || null,
    terminology: f.terminology || defaults?.terminology || "SNOMED",
    semanticTag: f.semanticTag || defaults?.semanticTag || null,
    conceptVerified: f.conceptVerified != null ? !!f.conceptVerified : (defaults?.conceptVerified || false),
  };
}

/**
 * Convierte un objeto plano legacy (clave → valor) a fields[] estructurados.
 * Itera EXCLUSIVAMENTE sobre las claves que existen en el objeto plano.
 * Usa METADATA_KNOWN_FIELDS solo para enriquecer metadatos si la clave es conocida;
 * NUNCA inventa campos que no estén presentes en los datos.
 */
function buildFieldsFromLegacy(flat) {
  const fields = [];

  for (const key of Object.keys(flat)) {
    if (flat[key] == null) continue;

    const known = METADATA_KNOWN_FIELDS[key];
    if (known) {
      fields.push({ ...known, value: flat[key] });
    } else {
      fields.push({
        id: key,
        label: key,
        type: flat[key] != null && !isNaN(Number(flat[key])) ? "loinc-number" : "snomed-text",
        value: flat[key],
        conceptId: null,
        term: null,
        terminology: "SNOMED",
        semanticTag: null,
        conceptVerified: false,
      });
    }
  }

  return fields;
}

/**
 * Construye el mapa plano content{} a partir del array fields[].
 */
function buildContentFromFields(fields) {
  const content = {};
  for (const f of fields) {
    if (f.id && f.value != null) {
      content[f.id] = f.value;
    }
  }
  return content;
}

function buildEmpty() {
  return { fields: [], content: {}, _normalized: true };
}
