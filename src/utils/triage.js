export const RANGOS = {
  spo2:      { n1: 90, n2: 94, n3: 96 },
  temp:      { hipotermia: 35.0, febricula: 37.5, fiebre: 38.0, fiebre_alta: 39.0, critica: 40.0 },
  fc_adulto: { bradicardia: 50, normal_min: 60, normal_max: 100, taqui: 110, taqui_alta: 130, critica: 150 },
  fc_nino:   { normal_max: 160, taqui: 180, critica: 200 },
  fc_neonato:{ normal_max: 180, taqui: 200 },
  sistolica: { choque: 80, hipotension: 90, hipertension: 160, crisis: 180 },
  glu:       { hipoglucemia_grave: 54, hipoglucemia: 70, hiperglucemia: 250, crisis: 400 }
};

export const NIVEL_INFO = {
  0: { nombre: "LABOR DE PARTO",  tiempo: "Inmediato — prioridad absoluta" },
  1: { nombre: "RESUCITACIÓN",    tiempo: "Inmediato — 0 minutos" },
  2: { nombre: "EMERGENCIA",      tiempo: "Muy urgente — ≤ 10 min" },
  3: { nombre: "URGENCIA",        tiempo: "Urgente — ≤ 30 min" },
  4: { nombre: "MENOR",           tiempo: "Menor — ≤ 60 min" },
  5: { nombre: "NO URGENTE",      tiempo: "No urgente — ≤ 120 min" }
};

function parsearTA(ta) {
  if (!ta || ta === "--" || ta === "") return null;
  const partes = String(ta).replace(/\s/g, "").split("/");
  if (partes.length < 2) return null;
  const s = parseInt(partes[0]), d = parseInt(partes[1]);
  if (isNaN(s) || isNaN(d)) return null;
  return { sistolica: s, diastolica: d };
}

function resultado(nivel, razones, banderas = [], camposCriticos = [], categoria = null) {
  return { nivel, ...NIVEL_INFO[nivel], razones, banderas, camposCriticos, categoria };
}

export function calcularTriage(datos) {
  const {
    vitales = {}, signosAlarma = [], especialidad = "", edad = 0,
    motivo = "", antecedentes = "", escalaDolor = 0,
    obs = {}, ped = {}, cardio = {}, trauma = {}, neuro = {}
  } = datos;

  const spo2 = parseFloat(vitales.spo2) || null;
  const temp = parseFloat(vitales.temp) || null;
  const fc   = parseFloat(vitales.fc)   || null;
  const glu  = parseFloat(vitales.glu)  || null;
  const peso = parseFloat(vitales.peso) || null;
  const ta   = parsearTA(vitales.ta);
  const ml   = (motivo || "").toLowerCase();
  const al   = (antecedentes || "").toLowerCase();
  const esl  = (especialidad || "").toLowerCase();
  const camposCriticos = [];
  const banderas = [];

  // Determinar si es pediátrico
  const esPediatria = esl.includes("pediatr") || esl.includes("neonat");
  const edadMeses = parseInt(ped?.edad_meses) || (edad < 2 ? edad * 12 : null);
  const esNeonato = edadMeses !== null && edadMeses <= 3;
  const esLactante = edadMeses !== null && edadMeses <= 12;
  const esMenorCinco = edad < 5;

  // ═══════════════════════════════════════════
  // BLOQUE 0: PARO / INCONSCIENCIA
  // ═══════════════════════════════════════════
  if (/paro card|no respira|sin pulso|paro resp|inconsciente|no reacciona|no responde/.test(ml)) {
    return resultado(1,
      ["Paro cardiorrespiratorio o inconsciencia — activar código azul"],
      ["RCP inmediata", "Desfibrilador"],
      ["Estado de consciencia crítico"]
    );
  }

  // ═══════════════════════════════════════════
  // BLOQUE 1: PRIORIDAD OBSTÉTRICA (NIVEL 0)
  // ═══════════════════════════════════════════
  const esObstetrica = esl.includes("ginecol") || esl.includes("maternid") || esl.includes("obstet");
  const motivoObstetrico = /parto|labor|contracci|trabajo de parto|bolsa rota|ruptura|expuls|empujar|pujar|bebe viene|nacimiento|cesarea/.test(ml);

  if (esObstetrica || motivoObstetrico) {
    const laborActiva = [
      motivoObstetrico,
      obs?.contracciones_min && parseInt(obs.contracciones_min) >= 1,
      obs?.semanas && parseInt(obs.semanas) >= 37,
      obs?.sangrado_activo,
      obs?.ruptura_fuente,
      /labor|trabajo de parto|contracci/.test(ml)
    ];

    if (laborActiva.some(Boolean)) {
      const complicaciones = [
        obs?.sangrado_activo || /sangrado activo|hemorragia/.test(ml),
        obs?.ruptura_fuente || /ruptura|bolsa rota|liquido amniotico/.test(ml),
        /prolapso de cordon|cordon umbilical|presentacion|sufrimiento fetal/.test(ml),
        /eclampsia|convulsion|presion muy alta/.test(ml),
        obs?.contracciones_min && parseInt(obs.contracciones_min) >= 5,
        spo2 !== null && spo2 < RANGOS.spo2.n2,
        ta && ta.sistolica > 160,
        ta && ta.sistolica < RANGOS.sistolica.hipotension,
        escalaDolor >= 8
      ];

      const razones = ["TRABAJO DE PARTO ACTIVO – prioridad absoluta"];
      if (obs?.semanas) razones.push(`Gestación: ${obs.semanas} semanas`);
      if (obs?.contracciones_min) razones.push(`Contracciones: ${obs.contracciones_min} en 10 min`);
      if (escalaDolor >= 8) razones.push(`Dolor intenso: ${escalaDolor}/10`);
      if (!obs?.semanas && !obs?.contracciones_min) razones.push("Motivo obstétrico activo – evaluación inmediata requerida");

      const banderasArr = ["Verificar frecuencia cardíaca fetal", "Preparar sala de partos"];
      if (complicaciones.some(Boolean)) {
        razones.push("Complicaciones detectadas – atención simultánea urgente");
        banderasArr.push("Activar protocolo obstétrico de emergencia");
      }

      return resultado(0, razones, banderasArr, camposCriticos, "obstetrica");
    }

    if (signosAlarma.length > 0 || ta?.sistolica > 140 || escalaDolor >= 6) {
      return resultado(2,
        ["Paciente obstétrica con signos de alarma — evaluación urgente"],
        [`Semanas: ${obs?.semanas || "no registradas"}`, escalaDolor >= 6 ? `Dolor: ${escalaDolor}/10` : null].filter(Boolean),
        camposCriticos, "obstetrica"
      );
    }
    return resultado(3,
      ["Paciente obstétrica sin trabajo de parto activo — evaluación prioritaria"],
      ["Registrar semanas de gestación y FCF"],
      camposCriticos, "obstetrica"
    );
  }

  // ═══════════════════════════════════════════
  // BLOQUE 2: PRIORIDAD PEDIÁTRICA
  // ═══════════════════════════════════════════
  if (esPediatria || edad < 15) {
    if (esNeonato) {
      const signosCriticosNeonato = [
        signosAlarma.includes("Dificultad Respiratoria"),
        temp !== null && temp > 38.0,
        temp !== null && temp < 36.0,
        /convulsion|no come|no llora|flacido|morado|cianosis/.test(ml),
        spo2 !== null && spo2 < RANGOS.spo2.n2,
        fc !== null && (fc > RANGOS.fc_neonato.taqui || fc < 80)
      ];
      if (signosCriticosNeonato.some(Boolean)) {
        return resultado(1,
          ["Neonato (≤ 3 meses) con signo de alarma — emergencia pediátrica"],
          ["Temperatura en neonato = emergencia", "Activar pediatría"],
          ["Neonato crítico"], "pediatrica"
        );
      }
      return resultado(2,
        ["Neonato (≤ 3 meses) — evaluación urgente por protocolo"],
        ["Todo neonato requiere evaluación médica ≤ 10 min"],
        camposCriticos, "pediatrica"
      );
    }

    if (esLactante && temp !== null && temp > 39.0) {
      return resultado(2,
        [`Lactante (${edadMeses} meses) con fiebre alta: ${temp}°C`],
        ["Riesgo de convulsión febril", "Evaluar signos meníngeos"],
        [`Temperatura: ${temp}°C`], "pediatrica"
      );
    }

    if (esMenorCinco && signosAlarma.includes("Dificultad Respiratoria")) {
      return resultado(1,
        ["Menor de 5 años con dificultad respiratoria — reserva pulmonar limitada"],
        ["Los niños pequeños descompensan rápido"],
        ["Dificultad respiratoria pediátrica"], "pediatrica"
      );
    }

    if (escalaDolor >= 8 && edad < 12) {
      return resultado(2,
        [`Dolor intenso (${escalaDolor}/10) en paciente pediátrico — evaluar causa`],
        ["El dolor severo en niños puede indicar patología grave"],
        camposCriticos, "pediatrica"
      );
    }
  }

  // ═══════════════════════════════════════════
  // BLOQUE 3: DOLOR SEGÚN ESCALA
  // ═══════════════════════════════════════════
  if (escalaDolor >= 8) {
    if (signosAlarma.includes("Dolor Torácico") && (fc && fc > RANGOS.fc_adulto.taqui)) {
      return resultado(1,
        [`Dolor torácico intenso (${escalaDolor}/10) — SCA probable`],
        ["ECG en menos de 10 min", "Troponinas", "Acceso IV"],
        camposCriticos
      );
    }
    return resultado(2,
      [`Dolor intenso (${escalaDolor}/10) — requiere analgesia y evaluación urgente`],
      ["Valorar causa del dolor", "Manejo del dolor"],
      camposCriticos
    );
  }

  if (escalaDolor >= 6) {
    return resultado(2,
      [`Dolor moderado-severo (${escalaDolor}/10) — evaluación prioritaria`],
      ["Analgesia según protocolo"],
      camposCriticos
    );
  }

  // ═══════════════════════════════════════════
  // BLOQUE 4: SIGNOS VITALES CRÍTICOS
  // ═══════════════════════════════════════════
  if (spo2 !== null && spo2 < RANGOS.spo2.n1) {
    camposCriticos.push(`SpO₂ crítico: ${spo2}%`);
    return resultado(1,
      [`SpO₂ ${spo2}% — insuficiencia respiratoria grave`],
      ["Oxígeno inmediato", "Preparar vía aérea"],
      camposCriticos
    );
  }

  if (fc !== null) {
    const fcMax = esNeonato ? RANGOS.fc_neonato.taqui : esMenorCinco ? RANGOS.fc_nino.taqui : RANGOS.fc_adulto.critica;
    const fcMin = RANGOS.fc_adulto.bradicardia;
    if (fc > fcMax || fc < fcMin) {
      camposCriticos.push(`FC crítica: ${fc} lpm`);
      return resultado(1,
        [`Frecuencia cardíaca crítica: ${fc} lpm — riesgo de colapso hemodinámico`],
        [fc > 150 ? "Taquicardia severa — buscar causa" : "Bradicardia severa — riesgo de paro"],
        camposCriticos
      );
    }
  }

  if (ta && ta.sistolica < RANGOS.sistolica.choque) {
    camposCriticos.push(`TA en choque: ${vitales.ta}`);
    return resultado(1,
      [`Presión arterial ${vitales.ta} — choque hemodinámico`],
      ["Acceso venoso inmediato", "Posición Trendelenburg"],
      camposCriticos
    );
  }

  if (temp !== null && (temp > RANGOS.temp.critica || temp < RANGOS.temp.hipotermia)) {
    camposCriticos.push(`Temperatura crítica: ${temp}°C`);
    return resultado(1,
      [`Temperatura ${temp}°C — ${temp > 40 ? "hipertermia extrema" : "hipotermia grave"}`],
      [temp > 40 ? "Riesgo de daño neurológico" : "Riesgo de falla cardíaca por frío"],
      camposCriticos
    );
  }

  if (glu !== null && glu < RANGOS.glu.hipoglucemia_grave) {
    camposCriticos.push(`Glucosa crítica: ${glu} mg/dL`);
    return resultado(1,
      [`Hipoglucemia grave: ${glu} mg/dL — riesgo de daño cerebral`],
      ["Glucosa IV inmediata", "Verificar nivel de consciencia"],
      camposCriticos
    );
  }

  // ═══════════════════════════════════════════
  // BLOQUE 5: DOLOR TORÁCICO / CARDIO
  // ═══════════════════════════════════════════
  const esDolorTorax = signosAlarma.includes("Dolor Torácico") ||
    /dolor de pecho|dolor toraci|opresion en el pecho|infarto|angina/.test(ml);

  if (esDolorTorax) {
    const signosSCA = [
      cardio?.dolor_irradiado || /irradia|brazo|mandibula|espalda/.test(ml),
      cardio?.diaforesis || /sudoracion|sudor frio|diaforesis/.test(ml),
      cardio?.disnea_reposo || /falta de aire|no puede respirar/.test(ml),
      cardio?.sincope || /desmayo|perdio el conocimiento/.test(ml),
      fc !== null && fc > RANGOS.fc_adulto.taqui,
      ta && ta.sistolica < RANGOS.sistolica.hipotension,
      al.includes("cardio") || al.includes("infarto previo") || al.includes("stent"),
      escalaDolor >= 6
    ];

    if (signosSCA.filter(Boolean).length >= 2) {
      return resultado(1,
        ["Síndrome coronario agudo probable — protocolo STEMI"],
        ["ECG en menos de 10 minutos", "Aspirina 300mg si no contraindicada", "Acceso IV"],
        camposCriticos
      );
    }
    return resultado(2,
      ["Dolor torácico — descartar síndrome coronario agudo"],
      ["ECG requerido", "Troponinas basales"],
      camposCriticos
    );
  }

  // ═══════════════════════════════════════════
  // BLOQUE 6: SANGRADO ACTIVO
  // ═══════════════════════════════════════════
  if (signosAlarma.includes("Sangrado Activo")) {
    const signosShock = [
      ta && ta.sistolica < RANGOS.sistolica.hipotension,
      fc !== null && fc > RANGOS.fc_adulto.taqui_alta,
      /sangrado masivo|no para|mucha sangre|hemorragia/.test(ml)
    ];
    if (signosShock.some(Boolean)) {
      camposCriticos.push("Sangrado con inestabilidad hemodinámica");
      return resultado(1,
        ["Sangrado activo con compromiso hemodinámico"],
        ["Control hemostático urgente", "Tipo y cruce", "Acceso IV grueso"],
        camposCriticos
      );
    }
    return resultado(2,
      ["Sangrado activo — control y evaluación urgente"],
      [],
      camposCriticos
    );
  }

  // ═══════════════════════════════════════════
  // BLOQUE 7: INTOXICACIÓN
  // ═══════════════════════════════════════════
  const esIntoxicacion = /intoxicaci|sobredosis|overdose|ingiri|tomo pastillas|ingestion|veneno|envenenami|droga|sustancia/.test(ml);
  if (esIntoxicacion) {
    const criticos = [
      /inconsciente|no responde|no respira|apnea/.test(ml),
      spo2 !== null && spo2 < RANGOS.spo2.n2,
      fc !== null && (fc < RANGOS.fc_adulto.bradicardia || fc > RANGOS.fc_adulto.critica),
      ta && ta.sistolica < RANGOS.sistolica.choque,
    ];
    if (criticos.some(Boolean)) {
      return resultado(1,
        ["Intoxicación/sobredosis con compromiso vital"],
        ["Asegurar vía aérea", "Naloxona si sospecha opioides", "Acceso IV inmediato"],
        camposCriticos
      );
    }
    return resultado(2,
      ["Intoxicación sintomática — vigilancia y soporte"],
      ["Monitoreo continuo", "Carbón activado si < 1 h de ingesta"],
      camposCriticos
    );
  }

  // ═══════════════════════════════════════════
  // BLOQUE 8: NEUROLÓGICO
  // ═══════════════════════════════════════════
  const haySignoNeuro = /convulsion|crisis convulsiva|habla trabada|paralisis|debilidad facial|asimetria|perdida de vision|cefalea intensa|peor dolor de cabeza/.test(ml);
  if (haySignoNeuro) {
    if (/habla trabada|paralisis|debilidad facial|asimetria facial|caida de la cara/.test(ml) || neuro?.asimetria_facial) {
      return resultado(1,
        ["Síntomas de ACV — activar protocolo ictus", "El tiempo es cerebro: ventana 4.5 horas"],
        ["TAC urgente", "Neurología inmediata"],
        camposCriticos
      );
    }
    if (/convulsion activa|esta convulsionando|no para de convulsionar/.test(ml)) {
      return resultado(1,
        ["Convulsión activa — riesgo de hipoxia cerebral"],
        ["Proteger vía aérea", "Benzodiacepina IV/IM"],
        camposCriticos
      );
    }
    if (/peor dolor de cabeza|cefalea en trueno|nunca habia tenido/.test(ml) || (escalaDolor >= 8 && /cefalea|dolor de cabeza/.test(ml))) {
      return resultado(2,
        ["Cefalea de inicio explosivo — descartar hemorragia subaracnoidea"],
        ["TAC urgente sin contraste"],
        camposCriticos
      );
    }
    return resultado(2, ["Síntoma neurológico agudo — evaluación urgente"], [], camposCriticos);
  }

  // ═══════════════════════════════════════════
  // BLOQUE 9: ABDOMEN AGUDO
  // ═══════════════════════════════════════════
  if (/abdomen rigido|rebote positivo|dolor abdominal intenso|vomito con sangre|hematemesis|melena/.test(ml)) {
    return resultado(2,
      ["Abdomen agudo probable — evaluación quirúrgica urgente"],
      ["Descartar perforación, apendicitis, obstrucción"],
      camposCriticos
    );
  }

  // ═══════════════════════════════════════════
  // BLOQUE 10: SIGNOS VITALES MODERADOS
  // ═══════════════════════════════════════════
  const razones = [];

  if (spo2 !== null && spo2 < RANGOS.spo2.n2) {
    camposCriticos.push(`SpO₂ bajo: ${spo2}%`);
    razones.push(`SpO₂ ${spo2}% — hipoxemia moderada`);
  }
  if (ta && ta.sistolica >= RANGOS.sistolica.crisis) {
    camposCriticos.push(`TA en crisis: ${vitales.ta}`);
    razones.push(`Crisis hipertensiva: ${vitales.ta}`);
  }
  if (ta && ta.sistolica < RANGOS.sistolica.hipotension && ta.sistolica >= RANGOS.sistolica.choque) {
    camposCriticos.push(`Hipotensión: ${vitales.ta}`);
    razones.push(`Hipotensión: ${vitales.ta}`);
  }
  if (fc !== null && fc >= RANGOS.fc_adulto.taqui_alta) {
    camposCriticos.push(`Taquicardia: ${fc} lpm`);
    razones.push(`Taquicardia ${fc} lpm — puede compensar condición grave`);
    banderas.push("Paciente compensado — puede deteriorar rápidamente");
  }
  if (temp !== null && temp > RANGOS.temp.fiebre_alta) {
    camposCriticos.push(`Fiebre alta: ${temp}°C`);
    razones.push(`Fiebre alta: ${temp}°C`);
    if (al.includes("diabete") || al.includes("inmunosuprimi")) {
      banderas.push("Inmunocomprometido con fiebre — riesgo de sepsis");
    }
  }
  if (glu !== null && (glu < RANGOS.glu.hipoglucemia || glu > RANGOS.glu.hiperglucemia)) {
    camposCriticos.push(`Glucosa: ${glu} mg/dL`);
    razones.push(`Glucosa alterada: ${glu} mg/dL`);
  }
  if (signosAlarma.length >= 2) {
    razones.push(`${signosAlarma.length} signos de alarma simultáneos: ${signosAlarma.join(", ")}`);
  }

  if (razones.length > 0) {
    if (al.includes("cardio") || al.includes("diabete") || al.includes("epoc") || al.includes("renal")) {
      banderas.push("Antecedentes de enfermedad crónica — vigilancia estrecha");
    }
    return resultado(2, razones, banderas, camposCriticos);
  }

  // ═══════════════════════════════════════════
  // BLOQUE 11: N3 POR CONTEXTO CLÍNICO
  // ═══════════════════════════════════════════
  const razonesN3 = [];

  if (spo2 !== null && spo2 < RANGOS.spo2.n3) razonesN3.push(`SpO₂ levemente bajo: ${spo2}%`);
  if (temp !== null && temp >= RANGOS.temp.fiebre && temp <= RANGOS.temp.fiebre_alta) razonesN3.push(`Fiebre moderada: ${temp}°C`);
  if (fc !== null && fc > RANGOS.fc_adulto.normal_max && fc < RANGOS.fc_adulto.taqui_alta) razonesN3.push(`Taquicardia leve: ${fc} lpm`);
  if (glu !== null && glu < RANGOS.glu.hipoglucemia && glu >= RANGOS.glu.hipoglucemia_grave) razonesN3.push(`Hipoglucemia leve: ${glu} mg/dL`);
  if (signosAlarma.length === 1) razonesN3.push(`Signo de alarma: ${signosAlarma[0]}`);
  if (escalaDolor >= 4) razonesN3.push(`Dolor moderado: ${escalaDolor}/10`);
  if (edad > 70 && razonesN3.length === 0) razonesN3.push(`Adulto mayor: ${edad} años — evaluación por edad`);
  if (/caida|golpe en la cabeza|trauma craneal/.test(ml)) razonesN3.push("Traumatismo craneoencefálico — descartar hemorragia");
  if (esl.includes("traumatol") && /fractura|fractura/.test(ml)) razonesN3.push("Fractura potencial — evaluación ortopédica");
  if (edad > 75 && /caida|se cayo|se resbaló/.test(ml)) {
    razonesN3.push(`Adulto mayor (${edad} años) con caída — posible fractura de cadera`);
    banderas.push("El 30% de fracturas de cadera llegan caminando");
  }

  if (razonesN3.length > 0) return resultado(3, razonesN3, banderas, camposCriticos);

  // ═══════════════════════════════════════════
  // BLOQUE 12: N4 SÍNTOMAS LEVES
  // ═══════════════════════════════════════════
  const razonesN4 = [];

  if (temp !== null && temp >= RANGOS.temp.febricula && temp < RANGOS.temp.fiebre) razonesN4.push(`Febrícula: ${temp}°C`);
  if (fc !== null && fc > 100 && fc <= RANGOS.fc_adulto.normal_max + 10) razonesN4.push(`FC levemente elevada: ${fc} lpm`);
  if (escalaDolor >= 2 && escalaDolor < 4) razonesN4.push(`Dolor leve: ${escalaDolor}/10`);
  if (/dolor leve|malestar general|tos sin fiebre|resfriado|gripe|nausea sin vomito/.test(ml)) razonesN4.push("Síntomas de baja complejidad");

  if (razonesN4.length > 0) return resultado(4, razonesN4, banderas, camposCriticos);

  // ═══════════════════════════════════════════
  // N5 POR DESCARTE
  // ═══════════════════════════════════════════
  return resultado(5,
    ["Signos vitales dentro de rangos normales, sin signos de alarma"],
    [],
    []
  );
}

// ═══════════════════════════════════════════
// CAMPOS POR ESPECIALIDAD
// ═══════════════════════════════════════════
export function camposPorEspecialidad(especialidad) {
  const esp = (especialidad || "").toLowerCase();

  if (esp.includes("ginecol") || esp.includes("maternid") || esp.includes("obstet")) {
    return {
      grupo: "obstetrico", titulo: "Datos obstétricos",
      campos: [
        { id: "obs_semanas", label: "Semanas de gestación", tipo: "number", placeholder: "38", urgente: true },
        { id: "obs_contracciones", label: "Contracciones en 10 min", tipo: "number", placeholder: "0", urgente: true },
        { id: "obs_sangrado", label: "¿Sangrado activo?", tipo: "check", value: "sangrado_activo", urgente: true },
        { id: "obs_ruptura", label: "¿Bolsa rota / líquido?", tipo: "check", value: "ruptura_fuente", urgente: true },
        { id: "obs_fum", label: "Fecha última menstruación", tipo: "text", placeholder: "dd/mm/aaaa" },
        { id: "obs_gesta", label: "Gestas / Partos", tipo: "text", placeholder: "G2 P1" },
      ]
    };
  }

  if (esp.includes("pediatr") || esp.includes("neonat")) {
    return {
      grupo: "pediatrico", titulo: "Datos pediátricos",
      campos: [
        { id: "ped_edad_meses", label: "Edad en meses", tipo: "number", placeholder: "6", urgente: true },
        { id: "ped_peso", label: "Peso (kg)", tipo: "number", placeholder: "7.5" },
        { id: "ped_vacunas", label: "¿Vacunas al día?", tipo: "check", value: "vacunas_al_dia" },
        { id: "ped_lactancia", label: "¿Lactando?", tipo: "check", value: "lactancia" },
      ]
    };
  }

  if (esp.includes("cardiolog")) {
    return {
      grupo: "cardiologico", titulo: "Datos cardiológicos",
      campos: [
        { id: "cardio_irradiado", label: "¿Dolor se irradia?", tipo: "check", value: "dolor_irradiado", urgente: true },
        { id: "cardio_diaforesis", label: "¿Sudoración fría?", tipo: "check", value: "diaforesis", urgente: true },
        { id: "cardio_disnea", label: "¿Falta de aire en reposo?", tipo: "check", value: "disnea_reposo", urgente: true },
        { id: "cardio_sincope", label: "¿Desmayo / síncope?", tipo: "check", value: "sincope", urgente: true },
      ]
    };
  }

  if (esp.includes("traumatol")) {
    return {
      grupo: "traumatologico", titulo: "Datos traumatológicos",
      campos: [
        { id: "trauma_mecanismo", label: "Mecanismo de lesión", tipo: "select",
          opciones: ["Caída", "Accidente de tráfico", "Aplastamiento", "Deportivo", "Otro"] },
        { id: "trauma_zona", label: "Zona afectada", tipo: "text", placeholder: "Ej: rodilla derecha" },
        { id: "trauma_conciencia", label: "¿Perdió el conocimiento?", tipo: "check", value: "perdida_conciencia", urgente: true },
      ]
    };
  }

  if (esp.includes("neurolog")) {
    return {
      grupo: "neurologico", titulo: "Datos neurológicos",
      campos: [
        { id: "neuro_glasgow", label: "Escala de Glasgow (3-15)", tipo: "number", placeholder: "15", urgente: true },
        { id: "neuro_confusion", label: "¿Confusión / desorientación?", tipo: "check", value: "confusion", urgente: true },
        { id: "neuro_asimetria", label: "¿Asimetría facial?", tipo: "check", value: "asimetria_facial", urgente: true },
      ]
    };
  }

  return null;
}