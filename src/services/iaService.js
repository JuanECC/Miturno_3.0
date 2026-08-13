const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const MODELOS_FALLBACK = [
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
];

const PROMPT_ROL = `Eres un asistente clínico experimentado en urgencias y consulta externa, trabajando dentro del sistema MiTurno. Tu función es ayudar al médico a documentar y clasificar, no sustituir su juicio. Nunca inventes información que no se te proporcione. Si un dato falta, indícalo claramente. Sé conciso y usa lenguaje médico estándar en español de México.`;

// ═══════════════════════════════════════════
// TRIAJE
// ═══════════════════════════════════════════
const construirPrompt = (datosPaciente) => `${PROMPT_ROL}

Analiza DETENIDAMENTE el motivo de consulta y los antecedentes del paciente para determinar la gravedad y el destino más apropiado en el flujo de urgencias.

MOTIVO DE CONSULTA (analiza palabras clave): "${datosPaciente.motivo || 'No especificado'}"
ANTECEDENTES (busca condiciones de riesgo): "${datosPaciente.antecedentes || 'Ninguno'}"

DATOS COMPLEMENTARIOS:
- Edad: ${datosPaciente.edad || '?'} años
- Especialidad: ${datosPaciente.especialidad || 'General'}
- Signos vitales: ${JSON.stringify(datosPaciente.vitales || {})}
- Signos de alarma: ${(datosPaciente.signosAlarma || []).join(', ') || 'Ninguno'}
- Escala de dolor: ${datosPaciente.escalaDolor || 0}/10

Palabras clave de ALTO RIESGO en el motivo: "paro", "no respira", "inconsciente", "convulsión", "sangrado masivo", "dolor intenso", "infarto", "parto", "labor de parto".
Palabras clave de RIESGO MODERADO: "fiebre alta", "vómito", "caída", "fractura", "dolor moderado".
Antecedentes de riesgo: "diabetes", "hipertensión", "cardiópata", "EPOC", "inmunosuprimido", "cáncer".

Determina:
1. Nivel de triaje (N1=Resucitación, N2=Emergencia, N3=Urgencia, N4=Menor, N5=NoUrgente).
2. Destino sugerido: puede ser "Sala de espera", "Observación", "Hospitalización", "UCI", "Cirugía", "Alta" o "Traslado". Usa los datos disponibles.

Responde SOLO con JSON:
{"nivel":2,"nombre":"EMERGENCIA","razon":"Explicación detallada basada en el motivo y antecedentes","recomendacion":"Acción recomendada","destino_sugerido":"Observación"}`;

export const sugerirTriageIA = async (datosPaciente) => {
  if (!GEMINI_API_KEY) throw new Error('API Key de Gemini no configurada');
  const prompt = construirPrompt(datosPaciente);
  let ultimoError = null;

  for (const modelo of MODELOS_FALLBACK) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      if (response.status === 429) { const err = new Error('RATE_LIMIT'); err.status = 429; throw err; }
      if (!response.ok) { const textoError = await response.text().catch(() => ''); const err = new Error(`Error del servidor: ${response.status}`); err.status = response.status; err.detalle = textoError; throw err; }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      if (!candidate) throw new Error('La IA no pudo generar una respuesta. Intenta de nuevo.');
      if (candidate.finishReason === 'SAFETY' || !candidate.content?.parts?.[0]?.text) { const err = new Error('La IA bloqueó la respuesta por filtros de contenido.'); err.motivo = 'SAFETY_BLOCK'; throw err; }

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
  throw new Error(ultimoError?.message || 'No se pudo consultar la IA. Intenta de nuevo.');
};

// ═══════════════════════════════════════════
// NOTA MÉDICA SOAP
// ═══════════════════════════════════════════
const construirPromptNota = (datosPaciente) => `${PROMPT_ROL}

Genera una NOTA MÉDICA en formato SOAP para el siguiente paciente. La nota debe ser concisa y lista para incluir en el expediente clínico electrónico. Incluye SOLO la información que se te proporciona, no inventes datos.

DATOS DEL PACIENTE:
- Nombre: ${datosPaciente.nombre || 'No especificado'}
- Edad: ${datosPaciente.edad || '?'} años
- Especialidad: ${datosPaciente.especialidad || 'General'}

MOTIVO DE CONSULTA:
"${datosPaciente.motivo || 'No especificado'}"

ANTECEDENTES RELEVANTES:
"${datosPaciente.antecedentes || 'Ninguno'}"

SIGNOS VITALES:
${JSON.stringify(datosPaciente.vitales || {})}

SIGNOS DE ALARMA:
${(datosPaciente.signosAlarma || []).join(', ') || 'Ninguno'}

ESCALA DE DOLOR: ${datosPaciente.escalaDolor || 0}/10

HISTORIA CLÍNICA:
- Padecimiento actual: "${datosPaciente.historiaClinica?.padecimiento || 'No registrado'}"
- Exploración física: "${datosPaciente.historiaClinica?.exploracion || 'No registrada'}"

DIAGNÓSTICOS CIE-10:
${(datosPaciente.diagnosticos && datosPaciente.diagnosticos.length > 0)
  ? datosPaciente.diagnosticos.map(d => `- ${d.codigo}: ${d.descripcion}`).join('\n')
  : 'Sin diagnósticos registrados'}

INDICACIONES MÉDICAS:
${(datosPaciente.indicaciones && datosPaciente.indicaciones.length > 0)
  ? datosPaciente.indicaciones.map(i => `- ${i.medicamento || i.texto} (${i.dosis || ''} ${i.via || ''} ${i.frecuencia || ''})`).join('\n')
  : 'Sin indicaciones registradas'}

Genera la nota con el formato EXACTO:

NOTA MÉDICA - MITURNO

S: [Subjetivo: motivo y padecimiento actual]
O: [Objetivo: signos vitales y exploración física]
A: [Análisis: diagnóstico y justificación clínica]
P: [Plan: indicaciones, estudios y destino]

Además, sugiere una lista de ESTUDIOS DE LABORATORIO O GABINETE que consideres pertinentes según el caso. Devuélvelos en formato JSON separado de la nota.

Formato de respuesta JSON:
{
  "nota": "Aquí va el texto completo de la nota SOAP",
  "estudios_sugeridos": [
    {"tipo": "laboratorio", "descripcion": "Hemograma completo", "prioridad": "normal"},
    {"tipo": "gabinete", "descripcion": "Radiografía de tórax", "prioridad": "urgente"}
  ]
}

Si no se requieren estudios, devuelve un array vacío.`;

export const generarNotaMedica = async (datosPaciente) => {
  if (!GEMINI_API_KEY) throw new Error('API Key de Gemini no configurada');

  const prompt = construirPromptNota(datosPaciente);
  let ultimoError = null;

  for (const modelo of MODELOS_FALLBACK) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );

      if (response.status === 429) { const err = new Error('RATE_LIMIT'); err.status = 429; throw err; }
      if (!response.ok) { const textoError = await response.text().catch(() => ''); const err = new Error(`Error del servidor: ${response.status}`); err.status = response.status; err.detalle = textoError; throw err; }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      if (!candidate) throw new Error('La IA no pudo generar una respuesta. Intenta de nuevo.');
      if (candidate.finishReason === 'SAFETY' || !candidate.content?.parts?.[0]?.text) {
        const err = new Error('La IA bloqueó la respuesta por filtros de contenido. Intenta reformular.');
        err.motivo = 'SAFETY_BLOCK';
        throw err;
      }

      const texto = candidate.content.parts[0].text;
      // Intentar parsear como JSON; si falla, asumir que es solo texto y devolver nota sin estudios.
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
      // Fallback: devolver el texto como nota, sin estudios.
      return { nota: texto.trim(), estudios_sugeridos: [] };
    } catch (err) {
      console.error(`Error con modelo "${modelo}":`, err);
      ultimoError = err;
      if (err.motivo === 'SAFETY_BLOCK') throw err;
      continue;
    }
  }

  if (ultimoError?.status === 429) throw new Error('Límite de consultas alcanzado. Espera un minuto e intenta de nuevo.');
  throw new Error(ultimoError?.message || 'No se pudo consultar la IA. Intenta de nuevo.');
};