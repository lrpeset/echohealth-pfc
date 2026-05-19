/**
 * EchoHealth — Motor de Normalización y Convergencia Adaptativa de Datos.
 *
 * Resuelve la coincidencia de esquemas "on-the-fly" en el lado del cliente, unificando payloads
 * polimórficos (estructuras abstractas contemporáneas, colecciones lineales de la capa de inferencia
 * o mapas planos legacy) bajo el modelo documental canónico de persistencia dual.
 */

const METADATA_KNOWN_FIELDS = {
  reasonForVisit: {
    id: "reasonForVisit",
    label: "Motivo de la visita",
    type: "snomed-text",
    conceptId: null,
    term: null,
    terminology: "SNOMED",
    semanticTag: null,
    conceptVerified: false,
  },
  height: {
    id: "height",
    label: "Altura (cm)",
    type: "loinc-number",
    conceptId: "8302-2",
    term: "Body height",
    terminology: "LOINC",
    semanticTag: null,
    conceptVerified: false,
  },
  weight: {
    id: "weight",
    label: "Peso (kg)",
    type: "loinc-number",
    conceptId: "29463-7",
    term: "Body weight",
    terminology: "LOINC",
    semanticTag: null,
    conceptVerified: false,
  },
  pulse: {
    id: "pulse",
    label: "Pulso (ppm)",
    type: "loinc-number",
    conceptId: "8867-4",
    term: "Heart rate",
    terminology: "LOINC",
    semanticTag: null,
    conceptVerified: false,
  },
  bloodPressure: {
    id: "bloodPressure",
    label: "Presión arterial (mmHg)",
    type: "loinc-text",
    conceptId: "85354-9",
    term: "Blood pressure panel",
    terminology: "LOINC",
    semanticTag: null,
    conceptVerified: false,
  },
  oxygenSaturation: {
    id: "oxygenSaturation",
    label: "Saturación de oxígeno (%)",
    type: "loinc-number",
    conceptId: "2708-6",
    term: "Oxygen saturation",
    terminology: "LOINC",
    semanticTag: null,
    conceptVerified: false,
  },
  painLocation: {
    id: "painLocation",
    label: "Localización del dolor",
    type: "snomed-text",
    conceptId: "70163-1",
    term: "Body site",
    terminology: "LOINC",
    semanticTag: null,
    conceptVerified: false,
  },
  painNature: {
    id: "painNature",
    label: "Naturaleza del dolor",
    type: "snomed-text",
    conceptId: "440751004",
    term: "Type of pain",
    terminology: "SNOMED",
    semanticTag: null,
    conceptVerified: true,
  },
  painIntensity: {
    id: "painIntensity",
    label: "Intensidad del dolor (0-10)",
    type: "loinc-number",
    conceptId: "72514-3",
    term: "Pain severity - 0-10",
    terminology: "LOINC",
    semanticTag: null,
    conceptVerified: false,
  },
};

/**
 * Detecta analíticamente la firma del objeto entrante y lo transmuta a la estructura unificada de la UI.
 * * @param {Object|Array} input - Instancia documental o buffer lineal de consulta.
 * @returns {Object} Estructura normalizada consistente con fields[] y content{}.
 */
export function normalizeConsultation(input) {
  if (!input) {
    return buildEmpty();
  }

  // Esquema contemporáneo data-driven con array jerárquico inyectado
  if (input.fields && Array.isArray(input.fields)) {
    return {
      ...input,
      content: input.content || buildContentFromFields(input.fields),
      _normalized: false,
    };
  }

  // Estructura lineal posicional: buffer semántico devuelto directamente por la capa de inferencia
  if (Array.isArray(input)) {
    const fields = input.map((f) => normalizeField(f));
    const content = buildContentFromFields(fields);
    return { fields, content, _normalized: true };
  }

  // Retrocompatibilidad: mapa relacional plano heredado
  if (typeof input === "object" && !Array.isArray(input)) {
    const fields = buildFieldsFromLegacy(input);
    const content = { ...input };
    return { fields, content, _normalized: true };
  }

  return buildEmpty();
}

/**
 * Recupera el primer valor no nulo del motivo de consulta aislando las restricciones del formato de entrada.
 */
export function extractReasonForVisit(data) {
  if (!data) return null;

  if (data.fields && Array.isArray(data.fields)) {
    const rf = data.fields.find((f) => f.id === "reasonForVisit");
    if (rf && rf.value != null) return String(rf.value);
  }

  if (data.content) {
    const val = data.content.reasonForVisit || data.content.ReasonForVisit;
    if (val != null) return String(val);
  }

  if (data.reasonForVisit != null) return String(data.reasonForVisit);

  return null;
}

/**
 * Enriquece de forma defensiva un campo agregando los metadatos terminológicos estandarizados por defecto.
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
    conceptId: f.conceptId != null ? f.conceptId : defaults?.conceptId || null,
    term: f.term || defaults?.term || null,
    terminology: f.terminology || defaults?.terminology || "SNOMED",
    semanticTag: f.semanticTag || defaults?.semanticTag || null,
    conceptVerified:
      f.conceptVerified != null
        ? !!f.conceptVerified
        : defaults?.conceptVerified || false,
  };
}

/**
 * Mapea mapas planos a estructuras EAV jerárquicas individuales.
 * * Control defensivo: acota el bucle estrictamente a las llaves físicas presentes en el payload plano,
 * enriqueciendo el linaje terminológico mapeado sin inducir efectos colaterales ni inventar atributos ausentes.
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
        type:
          flat[key] != null && !isNaN(Number(flat[key]))
            ? "loinc-number"
            : "snomed-text",
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
 * Sincroniza de forma síncrona el mapa de retrocompatibilidad content{} a partir del array dinámico fields[].
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
