const URL_NASA = "https://power.larc.nasa.gov/api/temporal/climatology/point";
const PARAMETROS = ["T2M", "PRECTOTCORR", "RH2M", "ALLSKY_SFC_SW_DWN"];

export async function obtenerClimaNASA(latitud, longitud) {
  if (
    !Number.isFinite(latitud) || latitud < -90 || latitud > 90 ||
    !Number.isFinite(longitud) || longitud < -180 || longitud > 180
  ) {
    throw new Error("Introduce coordenadas válidas.");
  }

  const parametros = new URLSearchParams({
    parameters: PARAMETROS.join(","),
    community: "AG",
    longitude: String(longitud),
    latitude: String(latitud),
    format: "JSON",
  });
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), 15000);

  try {
    const respuesta = await fetch(`${URL_NASA}?${parametros}`, {
      signal: controlador.signal,
    });
    if (!respuesta.ok) {
      throw new Error(`NASA POWER respondió con HTTP ${respuesta.status}.`);
    }

    const datos = await respuesta.json();
    const valores = datos.properties?.parameter;
    if (
      !valores ||
      PARAMETROS.some((parametro) =>
        !valores[parametro] || typeof valores[parametro] !== "object",
      ) ||
      typeof datos.header?.range !== "string" ||
      !Number.isFinite(datos.header?.fill_value)
    ) {
      throw new Error("NASA POWER devolvió datos incompletos.");
    }

    const valorMensual = (parametro, mes) => {
      const valor = valores[parametro][mes];
      return Number.isFinite(valor) &&
        valor !== datos.header.fill_value &&
        (parametro === "T2M" || valor >= 0) &&
        (parametro !== "RH2M" || valor <= 100)
        ? valor
        : null;
    };

    return {
      latitud,
      longitud,
      periodo: datos.header.range,
      valorMensual,
    };
  } finally {
    clearTimeout(temporizador);
  }
}
