const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Modelos en orden de preferencia: el primero es el que más usas y luego respaldos estables
const MODELOS_FALLBACK = [
  'gemini-3.1-flash-lite', // Tu modelo principal que funciona
  'gemini-1.5-flash',      // Respaldo estable
  'gemini-1.5-flash-8b',   // Respaldo ligero y rápido
];

const PROMPT_ROL = `Eres un asistente clínico experimentado en urgencias y consulta externa, trabajando dentro del sistema MiTurno. Tu función es ayudar al médico a documentar y clasificar, no sustituir su juicio. Nunca inventes información que no se te proporcione. Si un dato falta, indícalo claramente. Sé conciso y usa lenguaje médico estándar en español de México.`;

// ═══════════════════════════════════════════
// Funciones auxiliares
// ═══════════════════════════════════════════
const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const truncar = (texto, max = 500) => {
  if (!texto) return '';
  return texto.length > max ? texto.substring(0, max) + '...' : texto;
};

// Reintento con backoff para manejar 503/429
const fetchConReintentos = async (url, body, maxReintentos = 2) => {
  let ultimoError = null;
  for (let intento = 0; intento < maxReintentos; intento++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // Si es 503 o 429, esperar y reintentar
      if (response.status === 503 || response.status === 429) {
        const espera = response.status === 429 ? 2000 : 1000;
        await esperar(espera * (intento + 1));
        const err = new Error(`Error del servidor: ${response.status}`);
        err.status = response.status;
        ultimoError = err;
        continue;
      }

      if (!response.ok) {
        const textoError = await response.text().catch(() => '');
        const err = new Error(`Error del servidor: ${response.status}`);
        err.status = response.status;
        err.detalle = textoError;
        throw err;
      }

      const data = await response.json();
      return data;
    } catch (err) {
      if (err.status === 429 || err.status === 503) {
        ultimoError = err;
        continue;
      }
      throw err;
    }
  }
  throw ultimoError || new Error('No se pudo completar la solicitud');
};

// ═══════════════════════════════════════════
// TRIAJE
// ═══════════════════════════════════════════
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

// ═══════════════════════════════════════════
// NOTA MÉDICA SOAP
// ═══════════════════════════════════════════
const construirPromptNota = (datosPaciente) => {
  // Recortar textos para no saturar el prompt
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
      // Intentar parsear JSON; si falla, devolver texto plano.
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