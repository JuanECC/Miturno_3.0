import {
  GEMINI_API_KEY,
  MODELOS_FALLBACK,
  PROMPT_ROL,
  fetchConReintentos,
} from './iaComun';

const construirPrompt = (datosPaciente) => `${PROMPT_ROL}

Analiza el motivo de consulta y los antecedentes para determinar el nivel de triaje y el destino más apropiado.

MOTIVO DE CONSULTA: "${datosPaciente.motivo || 'No especificado'}"
ANTECEDENTES: "${datosPaciente.antecedentes || 'Ninguno'}"

DATOS:
- Edad: ${datosPaciente.edad || '?'} años
- Especialidad: ${datosPaciente.especialidad || 'General'}
- Signos vitales: ${JSON.stringify(datosPaciente.vitales || {})}
- Signos de alarma: ${(datosPaciente.signosAlarma || []).join(', ') || 'Ninguno'}
- Dolor: ${datosPaciente.escalaDolor || 0}/10

Determina:
1. Nivel de triaje (N1=Resucitación, N2=Emergencia, N3=Urgencia, N4=Menor, N5=NoUrgente).
2. Destino sugerido: Sala de espera, Observación, Hospitalización, UCI, Cirugía, Alta o Traslado.

Responde SOLO con JSON:
{"nivel":2,"nombre":"EMERGENCIA","razon":"Explicación breve","recomendacion":"Acción recomendada","destino_sugerido":"Observación"}`;

export const sugerirTriageIA = async (datosPaciente) => {
  if (!GEMINI_API_KEY) throw new Error('API Key de Gemini no configurada');

  const prompt = construirPrompt(datosPaciente);
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
        const err = new Error('La IA bloqueó la respuesta por filtros de contenido.');
        err.motivo = 'SAFETY_BLOCK';
        throw err;
      }

      const texto = candidate.content.parts[0].text;
      const jsonMatch = texto.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Formato de respuesta inválido (no es JSON).');
      return JSON.parse(jsonMatch[0]);
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