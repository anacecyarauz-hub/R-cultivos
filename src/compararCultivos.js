function normalizarTexto(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function obtenerReferenciasTemperatura(ficha, temperatura, periodo) {
  const condiciones = ficha.condiciones.filter(
    (condicion) =>
      (condicion.id === "temperatura" ||
        condicion.id.startsWith("temperatura_")) &&
      Number.isFinite(condicion.minimo) &&
      Number.isFinite(condicion.maximo),
  );

  if (condiciones.length === 0) {
    return [
      {
        id: "temperatura-sin-referencia",
        nombre: null,
        valor_usuario: temperatura?.valor ?? null,
        periodo_usuario: periodo,
        referencia: null,
        fuente_id: null,
        requiere_contexto: false,
        resultado: "sin_informacion",
      },
    ];
  }

  // Si es Arroz y tiene múltiples etapas, unificamos sus rangos en una sola condición general
  // para que se evalúe con la temperatura promedio del usuario sin requerir contexto por etapa.
  let condicionesAEvaluar = condiciones;
  if (ficha.cultivo_id === "arroz" && condiciones.length > 1) {
    const minGlobal = Math.min(...condiciones.map((c) => c.minimo));
    const maxGlobal = Math.max(...condiciones.map((c) => c.maximo));
    condicionesAEvaluar = [
      {
        id: "temperatura_general",
        nombre: "Temperatura óptima general",
        minimo: minGlobal,
        maximo: maxGlobal,
        unidad: "°C",
        periodo: null,
        fuente_id: condiciones[0].fuente_id,
      },
    ];
  }

  return condicionesAEvaluar.map((condicion) => {
    const requiereContexto = Boolean(condicion.periodo);
    const dentro =
      temperatura !== null &&
      temperatura.valor >= condicion.minimo &&
      temperatura.valor <= condicion.maximo;

    return {
      id: condicion.id,
      nombre: condicion.nombre,
      valor_usuario: temperatura?.valor ?? null,
      periodo_usuario: periodo,
      referencia: {
        minimo: condicion.minimo,
        maximo: condicion.maximo,
        unidad: condicion.unidad,
        periodo: condicion.periodo,
      },
      fuente_id: condicion.fuente_id,
      requiere_contexto: requiereContexto,
      dentro,
      resultado:
        temperatura === null
          ? "sin_informacion"
          : requiereContexto
            ? "requiere_contexto"
            : dentro
              ? "dentro"
              : "fuera",
    };
  });
}

function obtenerReferenciaSuelo(ficha, suelo, opcionSuelo) {
  const texturas = ficha.suelo?.texturas;
  const tieneTexturas = Array.isArray(texturas) && texturas.length > 0;
  const dentro =
    suelo !== null &&
    tieneTexturas &&
    texturas.some(
      (textura) => normalizarTexto(textura) === normalizarTexto(suelo.nombre),
    );

  return {
    id: "suelo",
    nombre: "Tipo de suelo",
    valor_usuario: opcionSuelo?.nombre ?? null,
    referencia: tieneTexturas ? texturas : null,
    fuente_id: tieneTexturas ? ficha.suelo.fuente_id : null,
    resultado:
      suelo === null || !tieneTexturas
        ? "sin_informacion"
        : dentro
          ? "dentro"
          : "fuera",
    dentro,
  };
}

const FAMILIAS_CULTIVOS = {
  arroz: "graminea",
  maiz: "graminea",
  cana_azucar: "graminea",
  frijol: "leguminosa",
};

const ALIAS_CULTIVOS = {
  arroz: "arroz",
  maiz: "maiz",
  "cana azucar": "cana_azucar",
  "cana de azucar": "cana_azucar",
  frijol: "frijol",
  "frijol comun": "frijol",
  "frijol comun o poroto": "frijol",
  poroto: "frijol",
};

const NOMBRES_CULTIVOS = {
  arroz: "arroz",
  maiz: "maíz",
  cana_azucar: "caña de azúcar",
  frijol: "frijol",
};

function identificarCultivo(registro) {
  const identificador = normalizarTexto(registro?.cultivo_id ?? "");
  const nombre = normalizarTexto(registro?.otro_nombre ?? "");
  const cultivoId = ALIAS_CULTIVOS[identificador] ?? ALIAS_CULTIVOS[nombre];

  return cultivoId
    ? {
        id: cultivoId,
        familia: FAMILIAS_CULTIVOS[cultivoId],
        nombre: NOMBRES_CULTIVOS[cultivoId],
      }
    : null;
}

function obtenerReferenciaRotacion(ficha, historialCultivos) {
  const rotacionInfo = ficha.rotacion;
  if (
    !rotacionInfo ||
    !Array.isArray(historialCultivos) ||
    historialCultivos.length === 0
  ) {
    return {
      id: "rotacion",
      nombre: "Rotación de cultivos",
      valor_usuario: "Sin historial informado",
      referencia: null,
      resultado: "sin_informacion",
      detalle: "No indicaste qué sembraste antes, así que no podemos revisar la rotación.",
      porcentaje_compatibilidad: null,
    };
  }

  const registroPrevio = historialCultivos[0];
  const cultivoPrevio = identificarCultivo(registroPrevio);
  const cultivoActual = identificarCultivo({ cultivo_id: ficha.cultivo_id });
  const huboCana = historialCultivos.some(
    (registro) => identificarCultivo(registro)?.id === "cana_azucar",
  );
  let resultado = "sin_informacion";
  let porcentajeCompatibilidad = 50;
  let penalizacionCritica = false;
  let alertaPreventiva = null;
  let detalle =
    "No reconocemos el cultivo anterior. Si puedes, selecciónalo por su nombre.";

  if (cultivoPrevio?.familia === "graminea" && cultivoActual?.id === "frijol") {
    resultado = "dentro";
    porcentajeCompatibilidad = 100;
    detalle = `¡Muy buena opción! Después de ${cultivoPrevio.nombre}, el frijol ayuda a recuperar nitrógeno y a cortar la cadena de plagas.`;
  } else if (
    cultivoPrevio?.familia === "graminea" &&
    cultivoActual?.familia === "graminea"
  ) {
    resultado = "fuera";
    porcentajeCompatibilidad = 0;
    penalizacionCritica = true;
    alertaPreventiva =
      `Ojo: sembrar arroz, maíz o caña seguidos puede aumentar las plagas y gastar nutrientes del suelo. ` +
      `${ficha.cultivo_id === "maiz" ? "En el maíz, vigila el gusano cogollero. " : ""}Intercala frijol.`;
    detalle = `Después de ${cultivoPrevio.nombre}, sembrar ${ficha.nombre} sigue con arroz, maíz o caña. Para reducir el riesgo, intercala frijol. Por esta alerta, el puntaje no pasa de 50%.`;
  } else if (
    cultivoPrevio?.familia === "leguminosa" &&
    cultivoActual?.familia === "graminea"
  ) {
    resultado = "dentro";
    porcentajeCompatibilidad = 100;
    detalle =
      "¡Buen cambio! El frijol ayuda a recuperar nutrientes del suelo y corta la seguidilla de arroz, maíz o caña.";
  } else if (
    cultivoPrevio?.id === cultivoActual?.id &&
    cultivoActual?.id === "frijol"
  ) {
    resultado = "fuera";
    porcentajeCompatibilidad = 0;
    alertaPreventiva =
      "Ojo: repetir frijol en el mismo terreno puede aumentar hongos y otras enfermedades del suelo. Alterna con otro cultivo.";
    detalle = "Conviene alternar el frijol para reducir enfermedades del suelo.";
  } else if (!cultivoPrevio) {
    resultado = "sin_informacion";
  } else {
    resultado = "dentro";
    porcentajeCompatibilidad = 75;
    detalle = "No vemos un problema claro con el cultivo anterior.";
  }

  if (huboCana) {
    detalle +=
      " También hubo caña, que puede quedarse de 3 a 5 años. Renueva por partes y deja descansar el suelo; el frijol ayuda. Si usas maíz, que sea como parte de una renovación planificada.";
  }

  return {
    id: "rotacion",
    nombre: "Rotación de cultivos",
    valor_usuario:
      cultivoPrevio?.nombre ??
      registroPrevio?.otro_nombre ??
      registroPrevio?.cultivo_id ??
      "Informado",
    referencia: rotacionInfo,
    resultado,
    porcentaje_compatibilidad: porcentajeCompatibilidad,
    penalizacion_critica: penalizacionCritica,
    alerta_preventiva: alertaPreventiva,
    detalle,
  };
}

function obtenerReferenciaAgua(ficha, abastecimientoAguaId) {
  const aguaInfo = ficha.agua_compatibilidad;
  if (!aguaInfo) {
    return {
      id: "agua",
      nombre: "Agua y Riego",
      resultado: "sin_informacion",
    };
  }

  if (!abastecimientoAguaId || abastecimientoAguaId === "desconocido") {
    return {
      id: "agua",
      nombre: "Agua y Riego",
      valor_usuario: "No lo indicaste",
      referencia: aguaInfo,
      resultado: "sin_informacion",
      detalle:
        "No indicaste cómo recibirá agua este cultivo. Revisa este punto antes de sembrar.",
    };
  }

  const esSecanoPuro = abastecimientoAguaId === "solo_lluvia";
  const abastecimientos = {
    solo_lluvia: "solo lluvia",
    riego_artificial: "riego",
    lluvia_y_riego: "lluvia y riego",
  };
  let resultado = "dentro";
  let detalle = `¡Bien! El cultivo puede crecer con ${abastecimientos[abastecimientoAguaId] ?? "el agua que indicaste"}.`;

  if (esSecanoPuro && !aguaInfo.admite_secano) {
    resultado = "fuera";
    detalle =
      "Ojo: este cultivo necesita riego adicional, pero indicaste que solo cuenta con lluvia.";
  }

  return {
    id: "agua",
    nombre: "Agua y Riego",
    valor_usuario: abastecimientos[abastecimientoAguaId] ?? abastecimientoAguaId,
    referencia: aguaInfo,
    resultado,
    detalle,
  };
}

function calcularCompatibilidad(ficha, factoresTemp, factorSuelo, factorRotacion, factorAgua) {
  let puntos = 0;
  let puntosPosibles = 0;
  const fortalezas = [];
  const debilidades = [];

  // 1. Temperatura (Peso: 30 puntos)
  const tempsConDato = factoresTemp.filter((t) => t.valor_usuario !== null && t.referencia);
  if (tempsConDato.length > 0) {
    puntosPosibles += 30;
    const etapasDentro = tempsConDato.filter((t) => t.dentro).length;
    const proporcion = etapasDentro / tempsConDato.length;
    puntos += Math.round(30 * proporcion);

    if (proporcion === 1) {
      fortalezas.push("el clima coincide con lo recomendado");
    } else if (proporcion > 0) {
      fortalezas.push("el clima coincide con parte de lo recomendado");
    } else {
      debilidades.push("el clima no coincide con lo recomendado");
    }
  }

  // 2. Tipo de Suelo (Peso: 30 puntos)
  if (factorSuelo.resultado !== "sin_informacion") {
    puntosPosibles += 30;
    if (factorSuelo.resultado === "dentro") {
      puntos += 30;
      fortalezas.push(`la tierra ${factorSuelo.valor_usuario.toLowerCase()} coincide con lo recomendado`);
    } else {
      debilidades.push(`la tierra ${factorSuelo.valor_usuario.toLowerCase()} no coincide con lo recomendado`);
    }
  }

  // 3. Rotación (Peso: 20 puntos)
  if (
    factorRotacion.valor_usuario !== "Sin historial informado" &&
    Number.isFinite(factorRotacion.porcentaje_compatibilidad)
  ) {
    puntosPosibles += 20;
    const puntajeRotacion = factorRotacion.porcentaje_compatibilidad;
    puntos += Math.round((20 * puntajeRotacion) / 100);

    if (puntajeRotacion === 100) {
      fortalezas.push("lo que sembraste antes ayuda a este cultivo");
    } else if (factorRotacion.resultado === "fuera") {
      debilidades.push(
        "conviene cambiar lo sembrado antes para cuidar el suelo y reducir plagas",
      );
    }
  }

  // 4. Agua y Riego (Peso: 20 puntos)
  if (factorAgua.resultado !== "sin_informacion") {
    puntosPosibles += 20;
    if (factorAgua.resultado === "dentro") {
      puntos += 20;
      fortalezas.push("el agua disponible le puede servir");
    } else {
      debilidades.push("puede faltarle agua con el sistema disponible");
    }
  }

  const porcentajeCalculado =
    puntosPosibles > 0 ? Math.round((puntos / puntosPosibles) * 100) : 0;
  const penalizacionCritica = factorRotacion.penalizacion_critica === true;
  const porcentaje = penalizacionCritica
    ? Math.min(porcentajeCalculado, 50)
    : porcentajeCalculado;

  let explicacion = "";
  if (puntosPosibles === 0) {
    explicacion = "Aún falta información para comparar este cultivo.";
  } else {
    if (fortalezas.length > 0) {
      explicacion += `¡Bien! ${fortalezas.join(", ").replace(/, ([^,]*)$/, " y $1")}. `;
    }
    if (debilidades.length > 0) {
      explicacion += `Ojo: ${debilidades.join(", ").replace(/, ([^,]*)$/, " y $1")}.`;
    }
    if (penalizacionCritica) {
      explicacion +=
        " Por seguir sembrando arroz, maíz o caña, el puntaje no pasa de 50%.";
    }
  }

  return { porcentaje, explicacion: explicacion.trim() };
}

export function compararCultivos(
  datos,
  fichas,
  tiposSuelo,
  periodosTemperatura,
) {
  const opcionSuelo = tiposSuelo.find(
    (tipo) => tipo.id === datos.tipo_suelo_id,
  );
  const suelo =
    opcionSuelo && !["otro", "desconocido"].includes(opcionSuelo.id)
      ? opcionSuelo
      : null;
  const valorTemperatura = Number.isFinite(datos.temperatura_promedio_c)
    ? { valor: datos.temperatura_promedio_c }
    : null;
  const periodo = periodosTemperatura.find(
    (opcion) => opcion.id === datos.periodo_temperatura_id,
  )?.nombre;

  const evaluaciones = fichas.map((ficha) => {
    const factoresTemp = obtenerReferenciasTemperatura(
      ficha,
      valorTemperatura,
      periodo ?? null,
    );
    const factorSuelo = obtenerReferenciaSuelo(ficha, suelo, opcionSuelo);
    const factorRotacion = obtenerReferenciaRotacion(ficha, datos.historial_cultivos);
    const factorAgua = obtenerReferenciaAgua(ficha, datos.abastecimiento_agua_id);

    const { porcentaje, explicacion } = calcularCompatibilidad(
      ficha,
      factoresTemp,
      factorSuelo,
      factorRotacion,
      factorAgua,
    );

    return {
      id: ficha.cultivo_id,
      nombre: ficha.nombre,
      porcentaje,
      explicacion,
      factores: [
        ...factoresTemp,
        factorSuelo,
        factorRotacion,
        factorAgua,
      ],
    };
  });

  evaluaciones.sort((a, b) => b.porcentaje - a.porcentaje);

  const maxPorcentaje = evaluaciones[0]?.porcentaje ?? 0;
  return evaluaciones.map((item) => ({
    ...item,
    esMejorOpcion: maxPorcentaje > 0 && item.porcentaje === maxPorcentaje,
  }));
}