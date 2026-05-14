/**
 * Utilidad de exportación FHIR para EchoHealth.
 * Convierte el array fields[] de una consulta clínica en formatos
 * interoperables (JSON FHIR-R4, CSV) donde cada valor clínico está
 * vinculado a su código internacional (SNOMED/LOINC).
 *
 * CRÍTICO: Estos formatos son consumidos por sistemas hospitalarios reales
 * (Epic, Cerner, Historia Clínica Electrónica). La presencia de
 * system/code/display es obligatoria para la interoperabilidad FHIR.
 */

/**
 * Genera un JSON estructurado con metadatos FHIR-R4.
 * Cada campo extraído incluye:
 *   - code: conceptId (SNOMED o LOINC)
 *   - system: terminología ("SNOMED" | "LOINC")
 *   - display: término clínico asociado al código
 *
 * @param {Array} fields - Array de objetos campo { id, label, type, value, conceptId, term, terminology, semanticTag }
 * @returns {string} JSON string con exportVersion, generatedAt, fieldCount y fields[]
 */
export function buildFhirJson(fields) {
  const safeFields = fields || [];
  const exportFields = safeFields
    .filter((f) => f.value != null)
    .map((f) => ({
      id: f.id,
      label: f.label,
      value: f.value,
      code: f.conceptId || null,
      system: f.terminology || "SNOMED",
      display: f.term || null,
      semanticTag: f.semanticTag || null,
    }));

  return JSON.stringify(
    {
      exportVersion: "FHIR-R4-1.0",
      generatedAt: new Date().toISOString(),
      source: "EchoHealth IA Clínica",
      fieldCount: exportFields.length,
      fields: exportFields,
    },
    null,
    2
  );
}

/**
 * Genera un CSV plano con los códigos internacionales.
 * Columnas: id, label, value, code, system, display, semanticTag
 * Valores con comas internas se escapan entre comillas dobles.
 *
 * @param {Array} fields - Array de objetos campo
 * @returns {string} CSV string con header + filas de datos
 */
export function buildFhirCsv(fields) {
  const safeFields = fields || [];
  const header = "id,label,value,code,system,display,semanticTag";
  const rows = safeFields
    .filter((f) => f.value != null)
    .map((f) => {
      const escape = (v) => {
        if (v == null) return "";
        const s = String(v).replace(/"/g, '""');
        return s.includes(",") || s.includes("\n") ? `"${s}"` : s;
      };
      return [
        escape(f.id),
        escape(f.label),
        escape(f.value),
        escape(f.conceptId),
        escape(f.terminology || "SNOMED"),
        escape(f.term),
        escape(f.semanticTag),
      ].join(",");
    });
  return [header, ...rows].join("\n");
}
