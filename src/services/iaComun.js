export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Modelos en orden de preferencia: el primero es el que más usas y luego respaldos estables
export const MODELOS_FALLBACK = [
  'gemini-3.1-flash-lite', // Tu modelo principal que funciona
  'gemini-1.5-flash',      // Respaldo estable
  'gemini-1.5-flash-8b',   // Respaldo ligero y rápido
];

export const PROMPT_ROL = `Eres un asistente clínico experimentado en urgencias y consulta externa, trabajando dentro del sistema MiTurno. Tu función es ayudar al médico a documentar y clasificar, no sustituir su juicio. Nunca inventes información que no se te proporcione. Si un dato falta, indícalo claramente. Sé conciso y usa lenguaje médico estándar en español de México.`;

// Esperar X milisegundos
export const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Recortar texto para evitar saturar el prompt
export const truncar = (texto, max = 500) => {
  if (!texto) return '';
  return texto.length > max ? texto.substring(0, max) + '...' : texto;
};

// Fetch con reintentos para manejar 503/429
export const fetchConReintentos = async (url, body, maxReintentos = 2) => {
  let ultimoError = null;
  for (let intento = 0; intento < maxReintentos; intento++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

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