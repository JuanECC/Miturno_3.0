// Pesos clínicos para el modelo de triaje
const PESOS = {
  // Signos vitales críticos
  spo2_critico: 10,        // SpO₂ < 90%
  spo2_alerta: 6,          // SpO₂ < 94%
  fc_critica: 10,          // FC > 150 o < 50
  fc_alerta: 5,            // FC > 110
  ta_choque: 10,           // Sistólica < 80
  ta_crisis: 7,            // Sistólica > 180
  temp_critica: 10,        // Temp > 40°C o < 35°C
  temp_alta: 5,            // Temp > 39°C
  glu_critica: 10,         // Glucosa < 54
  glu_alerta: 5,           // Glucosa < 70 o > 250

  // Signos de alarma
  dificultad_respiratoria: 9,
  dolor_toracico: 8,
  sangrado_activo: 9,

  // Factores de riesgo
  edad_avanzada: 3,        // > 70 años
  neonato: 10,             // < 3 meses
  lactante: 6,             // < 1 año
  pediatrico: 3,           // < 5 años

  // Contexto clínico
  dolor_severo: 8,         // Escala 8-10
  dolor_moderado: 5,       // Escala 6-7
  dolor_leve: 2,           // Escala 2-5
  obstetrico_activo: 10,   // Trabajo de parto
  obstetrico_alerta: 6,    // Obstétrica con signos
  neurologico_agudo: 8,    // ACV, convulsión
  intoxicacion: 7,
  abdomen_agudo: 6,
  multiple_alarmas: 7,     // 2+ signos de alarma
  antecedentes_riesgo: 2,  // Diabetes, cardio, etc.
};

const NOMBRES_NIVEL = {
  1: 'RESUCITACIÓN',
  2: 'EMERGENCIA',
  3: 'URGENCIA',
  4: 'MENOR',
  5: 'NO URGENTE',
};

const RECOMENDACIONES = {
  1: 'Atención inmediata. Activar código azul. Preparar equipo de reanimación.',
  2: 'Evaluación urgente en menos de 10 minutos. Monitoreo continuo.',
  3: 'Evaluación prioritaria en menos de 30 minutos. Vigilancia periódica.',
  4: 'Evaluación en menos de 60 minutos. Puede esperar en sala.',
  5: 'Evaluación en menos de 120 minutos. Cuadro no urgente.',
};

export const sugerirTriageLocal = (datosPaciente) => {
  const { vitales = {}, signosAlarma = [], edad = 0, motivo = '', antecedentes = '', escalaDolor = 0, especialidad = '' } = datosPaciente;
  
  const spo2 = parseFloat(vitales.spo2) || null;
  const temp = parseFloat(vitales.temp) || null;
  const fc = parseFloat(vitales.fc) || null;
  const glu = parseFloat(vitales.glu) || null;
  const taSistolica = parseInt(vitales.ta?.split('/')[0]) || null;
  const ml = (motivo || '').toLowerCase();
  const al = (antecedentes || '').toLowerCase();
  const esl = (especialidad || '').toLowerCase();

  let puntuacion = 0;
  const razones = [];
  const recomendaciones = [];

  // ═══ SIGNOS VITALES ═══
  if (spo2 !== null) {
    if (spo2 < 90) { puntuacion += PESOS.spo2_critico; razones.push(`SpO₂ crítica: ${spo2}%`); }
    else if (spo2 < 94) { puntuacion += PESOS.spo2_alerta; razones.push(`SpO₂ baja: ${spo2}%`); }
  }

  if (fc !== null) {
    if (fc > 150 || fc < 50) { puntuacion += PESOS.fc_critica; razones.push(`FC crítica: ${fc} lpm`); }
    else if (fc > 110) { puntuacion += PESOS.fc_alerta; razones.push(`Taquicardia: ${fc} lpm`); }
  }

  if (taSistolica !== null) {
    if (taSistolica < 80) { puntuacion += PESOS.ta_choque; razones.push(`Hipotensión severa: ${vitales.ta}`); }
    else if (taSistolica > 180) { puntuacion += PESOS.ta_crisis; razones.push(`Crisis hipertensiva: ${vitales.ta}`); }
  }

  if (temp !== null) {
    if (temp > 40 || temp < 35) { puntuacion += PESOS.temp_critica; razones.push(`Temperatura crítica: ${temp}°C`); }
    else if (temp > 39) { puntuacion += PESOS.temp_alta; razones.push(`Fiebre alta: ${temp}°C`); }
  }

  if (glu !== null) {
    if (glu < 54) { puntuacion += PESOS.glu_critica; razones.push(`Hipoglucemia grave: ${glu} mg/dL`); }
    else if (glu < 70 || glu > 250) { puntuacion += PESOS.glu_alerta; razones.push(`Glucosa alterada: ${glu} mg/dL`); }
  }

  // ═══ SIGNOS DE ALARMA ═══
  if (signosAlarma.includes('Dificultad Respiratoria')) {
    puntuacion += PESOS.dificultad_respiratoria;
    razones.push('Dificultad respiratoria');
  }
  if (signosAlarma.includes('Dolor Torácico')) {
    puntuacion += PESOS.dolor_toracico;
    razones.push('Dolor torácico');
  }
  if (signosAlarma.includes('Sangrado Activo')) {
    puntuacion += PESOS.sangrado_activo;
    razones.push('Sangrado activo');
  }
  if (signosAlarma.length >= 2) {
    puntuacion += PESOS.multiple_alarmas;
    razones.push(`${signosAlarma.length} signos de alarma simultáneos`);
  }

  // ═══ EDAD ═══
  if (edad > 70) { puntuacion += PESOS.edad_avanzada; razones.push(`Adulto mayor: ${edad} años`); }
  if (edad < 1) { puntuacion += PESOS.lactante; razones.push(`Lactante: ${edad} años`); }
  else if (edad < 5) { puntuacion += PESOS.pediatrico; razones.push(`Pediátrico: ${edad} años`); }

  // ═══ ESCALA DE DOLOR ═══
  if (escalaDolor >= 8) { puntuacion += PESOS.dolor_severo; razones.push(`Dolor severo: ${escalaDolor}/10`); }
  else if (escalaDolor >= 6) { puntuacion += PESOS.dolor_moderado; razones.push(`Dolor moderado: ${escalaDolor}/10`); }
  else if (escalaDolor >= 2) { puntuacion += PESOS.dolor_leve; razones.push(`Dolor leve: ${escalaDolor}/10`); }

  // ═══ CONTEXTO CLÍNICO ═══
  if (/paro|no respira|inconsciente/.test(ml)) {
    puntuacion += 15;
    razones.push('Posible paro o inconsciencia');
    recomendaciones.push('Activar código azul inmediatamente');
  }

  const esObstetrica = esl.includes('ginecol') || esl.includes('maternid') || esl.includes('obstet');
  if (esObstetrica && /parto|labor|contracci|bolsa rota/.test(ml)) {
    puntuacion += PESOS.obstetrico_activo;
    razones.push('Trabajo de parto activo');
    recomendaciones.push('Preparar sala de partos');
  } else if (esObstetrica) {
    puntuacion += PESOS.obstetrico_alerta;
    razones.push('Paciente obstétrica');
  }

  if (/convulsion|acv|paralisis|habla trabada/.test(ml)) {
    puntuacion += PESOS.neurologico_agudo;
    razones.push('Signo neurológico agudo');
  }

  if (/intoxicaci|sobredosis|ingirió/.test(ml)) {
    puntuacion += PESOS.intoxicacion;
    razones.push('Posible intoxicación');
  }

  if (/abdomen rigido|dolor abdominal intenso/.test(ml)) {
    puntuacion += PESOS.abdomen_agudo;
    razones.push('Abdomen agudo probable');
  }

  if (/diabete|cardio|epoc|renal/.test(al)) {
    puntuacion += PESOS.antecedentes_riesgo;
    razones.push('Antecedentes de riesgo');
  }

  // ═══ CLASIFICACIÓN ═══
  let nivel;
  if (puntuacion >= 10) nivel = 1;
  else if (puntuacion >= 7) nivel = 2;
  else if (puntuacion >= 4) nivel = 3;
  else if (puntuacion >= 2) nivel = 4;
  else nivel = 5;

  if (recomendaciones.length === 0) {
    recomendaciones.push(RECOMENDACIONES[nivel]);
  }

  return {
    nivel,
    nombre: NOMBRES_NIVEL[nivel],
    razon: razones.slice(0, 3).join(' · ') || 'Signos vitales normales',
    recomendacion: recomendaciones[0],
    puntuacion,
    confianza: Math.min(100, Math.round((puntuacion / 15) * 100))
  };
};