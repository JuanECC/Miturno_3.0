import {
  GEMINI_API_KEY,
  MODELOS_FALLBACK,
  PROMPT_ROL,
  fetchConReintentos,
  truncar,
} from './iaComun';

const construirPromptNota = (datosPaciente) => {
  const historia = {
    padecimiento: truncar(datosPaciente.historiaClinica?.padecimiento, 300),
    exploracion: truncar(datosPaciente.historiaClinica?.exploracion, 300),
    antecedentes: truncar(datosPaciente.historiaClinica?.antecedentes, 200),
  };

  const diagnosticos = (datosPaciente.diagnosticos || [])
    .map(d => `${d.codigo}: ${d.descripcion}`)
    .join(' | ');
  const indicaciones = (datosPaciente.indicaciones || [])
    .map(i => `${i.medicamento || i.texto} (${i.dosis || ''} ${i.via || ''} ${i.frecuencia || ''})`)
    .join(' | ');

  return `${PROMPT_ROL}

Genera una NOTA MÉDICA en formato SOAP concisa. Incluye SOLO la información proporcionada.

DATOS:
- Nombre: ${datosPaciente.nombre || 'N/A'}
- Edad: ${datosPaciente.edad || '?'} años
- Motivo: "${datosPaciente.motivo || 'N/A'}"
- Antecedentes: "${datosPaciente.antecedentes || 'Ninguno'}"

SIGNOS VITALES:
${JSON.stringify(datosPaciente.vitales || {})}

HISTORIA CLÍNICA:
- Padecimiento: "${historia.padecimiento}"
- Exploración: "${historia.exploracion}"

DIAGNÓSTICOS CIE-10:
${diagnosticos || 'Sin diagnóstico'}

INDICACIONES:
${indicaciones || 'Sin indicaciones'}

Formato EXACTO:
NOTA MÉDICA - MITURNO
S: [Subjetivo]
O: [Objetivo]
A: [Análisis]
P: [Plan]

Sugiere además una lista de ESTUDIOS pertinentes. Devuelve JSON:
{
  "nota": "texto completo de la nota",
  "estudios_sugeridos": [
    {"tipo": "laboratorio", "descripcion": "Hemograma completo", "prioridad": "normal"}
  ]
}`;
};

export const generarNotaMedica = async (datosPaciente) => {
  if (!GEMINI_API_KEY) throw new Error('API Key de Gemini no configurada');

  const prompt = construirPromptNota(datosPaciente);
  let ultimoError = null;

  for (const modelo of MODELOS_FALLBACK) {
    try {
      const data = await fetchConReintentos(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`,
        { contents: [{ parts: [{ text: prompt }] }] }
      );

      const candidate = data.candidates?.[0];
      if (!candidate) throw new Error('La IA no pudo generar una respuesta.');
      if (candidate.finishReason === 'SAFETY' || !candidate.content?.parts?.[0]?.text) {
        const err = new Error('La IA bloqueó la respuesta por filtros de contenido. Intenta reformular.');
        err.motivo = 'SAFETY_BLOCK';
        throw err;
      }

      const texto = candidate.content.parts[0].text;
      try {
        const jsonMatch = texto.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.nota && Array.isArray(parsed.estudios_sugeridos)) {
            return parsed;
          }
        }
      } catch (parseError) {
        console.warn('No se pudo parsear JSON de nota, se devuelve texto plano');
      }
      return { nota: texto.trim(), estudios_sugeridos: [] };
    } catch (err) {
      console.error(`Error con modelo "${modelo}":`, err);
      ultimoError = err;
      if (err.motivo === 'SAFETY_BLOCK') throw err;
      continue;
    }
  }

  if (ultimoError?.status === 429) throw new Error('Límite de consultas alcanzado. Espera un minuto e intenta de nuevo.');
  throw new Error(ultimoError?.message || 'No se pudo consultar la IA.');
};