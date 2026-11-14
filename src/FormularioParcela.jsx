import { useEffect, useMemo, useState } from "react";
import formulario from "../data/formulario_parcela.json";
import fichaMaiz from "../data/condiciones_maiz.json";
import fichaArroz from "../data/condiciones_arroz.json";
import fichaCanaAzucar from "../data/condiciones_cana_azucar.json";
import fichaFrijol from "../data/condiciones_frijol.json";
import { compararCultivos } from "./compararCultivos.js";

const STORAGE_KEY = "parcela_temporal_v1";
const fichasCultivos = [fichaMaiz, fichaArroz, fichaCanaAzucar, fichaFrijol];

function crearDatosIniciales() {
  return {
    version: "1.0",
    cultivo_deseado_id: null,
    tipo_suelo_id: null,
    temperatura_promedio_c: null,
    periodo_temperatura_id: null,
    abastecimiento_agua_id: null,
    sistemas_riego: [],
    cultivo_previo: null,
    numero_ciclos_previos: null,
    historial_cultivos: [],
    actualizado_en: null,
  };
}

function esCatalogoValido(valor, propiedad) {
  return (
    valor &&
    Array.isArray(valor[propiedad]) &&
    valor[propiedad].length > 0 &&
    valor[propiedad].every(
      (opcion) =>
        opcion &&
        typeof opcion.id === "string" &&
        opcion.id.length > 0 &&
        typeof opcion.nombre === "string" &&
        opcion.nombre.length > 0,
    ) &&
    new Set(valor[propiedad].map((opcion) => opcion.id)).size ===
      valor[propiedad].length
  );
}

function esObjetoTemporalValido(valor) {
  const formatoValido =
    valor &&
    typeof valor === "object" &&
    !Array.isArray(valor) &&
    valor.version === "1.0" &&
    (valor.cultivo_deseado_id === null ||
      typeof valor.cultivo_deseado_id === "string") &&
    (valor.tipo_suelo_id === null || typeof valor.tipo_suelo_id === "string") &&
    (valor.temperatura_promedio_c === null ||
      (typeof valor.temperatura_promedio_c === "number" &&
        Number.isFinite(valor.temperatura_promedio_c))) &&
    (valor.periodo_temperatura_id === null ||
      typeof valor.periodo_temperatura_id === "string") &&
    (valor.abastecimiento_agua_id === null ||
      typeof valor.abastecimiento_agua_id === "string") &&
    Array.isArray(valor.sistemas_riego) &&
    valor.sistemas_riego.every((id) => typeof id === "string") &&
    (valor.cultivo_previo === null ||
      typeof valor.cultivo_previo === "boolean") &&
    (valor.numero_ciclos_previos === null ||
      (Number.isInteger(valor.numero_ciclos_previos) &&
        valor.numero_ciclos_previos >= 0)) &&
    Array.isArray(valor.historial_cultivos) &&
    valor.historial_cultivos.every(
      (registro) =>
        registro &&
        typeof registro === "object" &&
        !Array.isArray(registro) &&
        (registro.cultivo_id === null ||
          typeof registro.cultivo_id === "string") &&
        (registro.otro_nombre === null ||
          typeof registro.otro_nombre === "string"),
    ) &&
    typeof valor.actualizado_en === "string" &&
    Number.isFinite(Date.parse(valor.actualizado_en)) &&
    new Date(valor.actualizado_en).toISOString() === valor.actualizado_en;

  if (!formatoValido) return false;
  if (
    valor.cultivo_previo === false &&
    (valor.numero_ciclos_previos !== 0 ||
      valor.historial_cultivos.length !== 0)
  ) {
    return false;
  }
  if (
    valor.cultivo_previo === null &&
    (valor.numero_ciclos_previos !== null ||
      valor.historial_cultivos.length !== 0)
  ) {
    return false;
  }
  if (
    valor.cultivo_previo === true &&
    (valor.numero_ciclos_previos === 0 ||
      (valor.numero_ciclos_previos !== null &&
        valor.historial_cultivos.length > valor.numero_ciclos_previos))
  ) {
    return false;
  }
  if (
    !["riego_artificial", "lluvia_y_riego"].includes(
      valor.abastecimiento_agua_id,
    ) &&
    valor.sistemas_riego.length > 0
  ) {
    return false;
  }
  return true;
}

function obtenerEtiqueta(opciones, id) {
  return opciones.find((opcion) => opcion.id === id)?.nombre ?? "No informado";
}

function CampoError({ id, mensaje }) {
  return mensaje ? (
    <p className="form-error" id={`${id}-error`} role="alert">
      {mensaje}
    </p>
  ) : null;
}

function ResultadoComparacion({ datos, cultivos, sistemasRiego }) {
  const configuracion = formulario.comparacion;
  const resultado = compararCultivos(
    datos,
    fichasCultivos,
    formulario.tipos_suelo,
    formulario.periodos_temperatura,
  );

  function obtenerDetalle(factor) {
    const mensajes = configuracion.mensajes;
    if (factor.id === "suelo") {
      if (!factor.referencia) {
        return mensajes.sin_referencia_estructurada;
      }
      if (factor.resultado === "sin_informacion") {
        return mensajes.textura_sin_dato;
      }
      return factor.dentro ? mensajes.textura_dentro : mensajes.textura_fuera;
    }

    if (factor.id === "rotacion") {
      return typeof factor.porcentaje_compatibilidad === "number"
        ? `Rotación: ${factor.porcentaje_compatibilidad}%. ${factor.detalle || ""}`
        : factor.detalle || "No sabemos qué se sembró antes.";
    }

    if (factor.id === "agua") {
      return factor.detalle || "No tenemos una recomendación de agua para este cultivo.";
    }

    if (!factor.referencia) {
      return factor.valor_usuario === null
        ? mensajes.temperatura_sin_dato
        : mensajes.sin_referencia_estructurada;
    }
    if (factor.valor_usuario === null) {
      return factor.requiere_contexto
        ? `${mensajes.temperatura_sin_dato} ${mensajes.temperatura_etapa_requiere_contexto}`
        : mensajes.temperatura_sin_dato;
    }
    if (factor.requiere_contexto) {
      return factor.dentro
        ? mensajes.temperatura_etapa_dentro
        : mensajes.temperatura_etapa_fuera;
    }
    return factor.dentro
      ? mensajes.temperatura_dentro
      : mensajes.temperatura_fuera;
  }

  function obtenerEstado(factor) {
    return configuracion.estados[factor.resultado];
  }

  function obtenerValorReferencia(factor) {
    if (factor.id === "rotacion") {
      return "Revisamos qué se sembró antes.";
    }
    if (factor.id === "agua") {
      return `¿Puede crecer solo con lluvia?: ${factor.referencia?.admite_secano ? "Sí" : "No"}.`;
    }
    if (!factor.referencia) {
      return configuracion.mensajes.sin_referencia_estructurada;
    }
    if (factor.id === "suelo") {
      return `Suelos recomendados: ${factor.referencia.join(", ")}.`;
    }
    const { minimo, maximo, unidad, periodo } = factor.referencia;
    return `Recomendado: de ${minimo} a ${maximo} ${unidad}${periodo ? ` durante ${periodo}` : ""}.`;
  }

  function obtenerFuentes(ficha, fuenteId) {
    const fuente = ficha.fuentes.find((item) => item.id === fuenteId);
    if (!fuente) return configuracion.mensajes.sin_fuente_estructurada;
    return (
      <a href={fuente.url} rel="noopener noreferrer" target="_blank">
        {fuente.institucion}: {fuente.titulo}
      </a>
    );
  }

  function obtenerDatoUsuario(factor) {
    if (
      factor.id === "rotacion" &&
      factor.valor_usuario === "Sin historial informado"
    ) {
      return configuracion.mensajes.no_informado;
    }
    if (factor.id === "suelo" || factor.id === "rotacion" || factor.id === "agua") {
      return factor.valor_usuario ?? configuracion.mensajes.no_informado;
    }
    if (factor.valor_usuario === null) {
      return configuracion.mensajes.no_informado;
    }
    return `${factor.valor_usuario} °C · ${configuracion.etiquetas.periodo_usuario}: ${factor.periodo_usuario ?? configuracion.mensajes.no_informado}`;
  }

  const resultadoOrdenado = resultado
    .map((cultivo, indice) => {
      const factores = cultivo.factores.map((factor) => ({
        ...factor,
        nombre:
          factor.id === "suelo"
            ? formulario.etiquetas.tipo_suelo
            : factor.id === "rotacion"
              ? "Rotación de cultivos"
              : factor.id === "agua"
                ? "Agua disponible"
                : factor.nombre ?? formulario.etiquetas.temperatura,
      }));

      return { ...cultivo, factores, indice };
    })
    .sort(
      (primero, segundo) =>
        (segundo.porcentaje ?? -1) - (primero.porcentaje ?? -1) ||
        primero.indice - segundo.indice,
    );

  return (
    <section
      aria-labelledby="comparacion-titulo"
      aria-live="polite"
      className="resultado-comparacion"
    >
      <h3 id="comparacion-titulo">{configuracion.titulo}</h3>
      <p className="comparacion-conclusion">{configuracion.resultado_general}</p>

      <div className="comparacion-cultivos">
        {resultadoOrdenado.map((cultivo) => {
          const ficha = fichasCultivos.find(
            (item) => item.cultivo_id === cultivo.id,
          );
          const factorRotacion = cultivo.factores.find(
            (factor) => factor.id === "rotacion",
          );

          return (
            <section className="comparacion-cultivo" key={cultivo.id}>
              <div className="comparacion-cultivo-resumen">
                <h4>{cultivo.nombre}</h4>
                <div
                  aria-label={
                    cultivo.porcentaje === null
                      ? "Sin datos evaluables"
                      : `${cultivo.porcentaje}% de compatibilidad`
                  }
                  className="compatibilidad-circulo"
                  role="img"
                  style={{
                    "--progreso": `${cultivo.porcentaje ?? 0}%`,
                  }}
                >
                  <span className="compatibilidad-porcentaje">
                    {cultivo.porcentaje === null
                      ? "—"
                      : `${cultivo.porcentaje}%`}
                  </span>
                  <span className="compatibilidad-etiqueta">
                    {cultivo.porcentaje === null ? "Sin datos" : "Compatibilidad"}
                  </span>
                </div>
                <p className="compatibilidad-nota">
                  {cultivo.porcentaje === null
                    ? "Faltan datos para calcular el puntaje."
                    : "Revisamos el clima, el suelo, el agua y lo que se sembró antes. Si falta un dato, no lo contamos."}
                </p>

                {ficha?.epoca_siembra && (
                  <section
                    aria-labelledby={`epoca-siembra-${cultivo.id}`}
                    className="epoca-siembra"
                  >
                    <h5 id={`epoca-siembra-${cultivo.id}`}>
                      Época recomendada
                    </h5>
                    <p>{ficha.epoca_siembra}</p>
                    <p className="epoca-siembra-nota">
                      La fecha puede cambiar según las lluvias. Confirma con el
                      MIDA de tu zona.
                    </p>
                  </section>
                )}

                {factorRotacion?.alerta_preventiva && (
                  <section
                    aria-labelledby={`alerta-plagas-${cultivo.id}`}
                    className="alerta-plagas"
                    role="note"
                  >
                    <h5 id={`alerta-plagas-${cultivo.id}`}>
                      Alerta de plagas
                    </h5>
                    <p>{factorRotacion.alerta_preventiva}</p>
                  </section>
                )}
              </div>

              <details className="compatibilidad-explicacion">
                <summary>¿Por qué este resultado?</summary>
                <ul className="compatibilidad-factores">
                  {cultivo.factores.map((factor) => (
                    <li
                      className={`compatibilidad-factor compatibilidad-factor--${factor.resultado}`}
                      key={factor.id}
                    >
                      <div className="compatibilidad-factor-encabezado">
                        <strong>{factor.nombre}</strong>
                        <span className="compatibilidad-estado">
                          {obtenerEstado(factor)}
                        </span>
                      </div>
                      <p className="comparacion-detalle">
                        {obtenerDetalle(factor)}
                      </p>
                      <p className="comparacion-metadato">
                        <strong>Lo que indicaste:</strong>{" "}
                        {obtenerDatoUsuario(factor)}
                      </p>
                      <p className="comparacion-metadato">
                        <strong>Lo recomendado:</strong>{" "}
                        {obtenerValorReferencia(factor)}
                      </p>
                      <p className="comparacion-metadato comparacion-fuente">
                        <strong>Fuente:</strong>{" "}
                        {obtenerFuentes(ficha, factor.fuente_id)}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>

              {Array.isArray(ficha?.guia_practica) &&
                ficha.guia_practica.length > 0 && (
                  <section
                    aria-labelledby={`guia-siembra-${cultivo.id}`}
                    className="guia-siembra"
                  >
                    <h5 id={`guia-siembra-${cultivo.id}`}>
                      Guía práctica de siembra
                    </h5>
                    <ul>
                      {ficha.guia_practica.map((consejo) => (
                        <li key={consejo}>{consejo}</li>
                      ))}
                    </ul>
                  </section>
                )}
            </section>
          );
        })}
      </div>
    </section>
  );
}

function FormularioParcela({ cultivos }) {
  const [borrador, setBorrador] = useState(crearDatosIniciales);
  const [datosGuardados, setDatosGuardados] = useState(null);
  const [editando, setEditando] = useState(true);
  const [cultivoDeseadoSeleccionado, setCultivoDeseadoSeleccionado] =
    useState("");
  const [cultivoPrevioSeleccion, setCultivoPrevioSeleccion] = useState("");
  const [temperaturaDesconocida, setTemperaturaDesconocida] = useState(false);
  const [ciclosDesconocidos, setCiclosDesconocidos] = useState(false);
  const [sistemasRiego, setSistemasRiego] = useState([]);
  const [errorCatalogoRiego, setErrorCatalogoRiego] = useState("");
  const [errorAlmacenamiento, setErrorAlmacenamiento] = useState("");
  const [errorRestauracion, setErrorRestauracion] = useState("");
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState("");

  const cultivoIds = useMemo(
    () => new Set(cultivos.map((cultivo) => cultivo.id)),
    [cultivos],
  );
  const catalogosValidos =
    formulario.version === "1.0" &&
    esCatalogoValido({ opciones: formulario.tipos_suelo }, "opciones") &&
    esCatalogoValido(
      { opciones: formulario.periodos_temperatura },
      "opciones",
    ) &&
    esCatalogoValido(
      { opciones: formulario.abastecimientos_agua },
      "opciones",
    ) &&
    cultivos.length === 4 &&
    cultivoIds.size === 4;

  useEffect(() => {
    let cancelado = false;
    let contenidoGuardado = null;
    let errorDeLectura = "";

    try {
      contenidoGuardado = window.sessionStorage.getItem(STORAGE_KEY);
    } catch {
      errorDeLectura =
        "No se pudo acceder al almacenamiento de esta pestaña. Puedes continuar, pero los datos no se conservarán al recargar.";
    }

    async function cargarCatalogosYRestaurar() {
      let riego = [];
      let errorRiego = "";

      try {
        const respuesta = await fetch(
          `${import.meta.env.BASE_URL}${formulario.fuente_sistemas_riego}`,
        );
        if (!respuesta.ok) {
          throw new Error(
            respuesta.status === 404
              ? "No existe data/sistemas_riego.json."
              : `No se pudo leer data/sistemas_riego.json (HTTP ${respuesta.status}).`,
          );
        }
        if (
          !respuesta.headers
            .get("content-type")
            ?.includes("application/json")
        ) {
          throw new Error(
            "No existe data/sistemas_riego.json o la ruta no devuelve un archivo JSON.",
          );
        }
        const datosRiego = await respuesta.json();
        if (!esCatalogoValido(datosRiego, "sistemas_riego")) {
          throw new Error(
            "data/sistemas_riego.json no contiene un catálogo válido.",
          );
        }
        riego = datosRiego.sistemas_riego;
      } catch (error) {
        errorRiego =
          error instanceof SyntaxError
            ? "data/sistemas_riego.json contiene JSON inválido."
            : error.message ||
              "No se pudo cargar data/sistemas_riego.json.";
      }

      if (cancelado) return;
      setSistemasRiego(riego);
      setErrorCatalogoRiego(errorRiego);
      setErrorAlmacenamiento(errorDeLectura);

      if (contenidoGuardado === null) return;

      let restaurados;
      try {
        restaurados = JSON.parse(contenidoGuardado);
      } catch {
        setErrorRestauracion(
          "Los datos temporales contienen JSON corrupto. Puedes empezar de nuevo.",
        );
        return;
      }

      if (!esObjetoTemporalValido(restaurados)) {
        setErrorRestauracion(
          "Los datos temporales tienen una versión o estructura incompatible. Puedes empezar de nuevo.",
        );
        return;
      }

      const datosCatalogados = [
        [restaurados.cultivo_deseado_id, cultivoIds],
        [
          restaurados.tipo_suelo_id,
          new Set(formulario.tipos_suelo.map((opcion) => opcion.id)),
        ],
        [
          restaurados.periodo_temperatura_id,
          new Set(formulario.periodos_temperatura.map((opcion) => opcion.id)),
        ],
        [
          restaurados.abastecimiento_agua_id,
          new Set(formulario.abastecimientos_agua.map((opcion) => opcion.id)),
        ],
      ];
      const catalogoInvalido = datosCatalogados.some(
        ([id, ids]) => id !== null && !ids.has(id),
      );
      const cultivoPrevioInvalido = restaurados.historial_cultivos.some(
        (registro) =>
          registro.cultivo_id !== null &&
          !cultivoIds.has(registro.cultivo_id),
      );
      const riegoInvalido =
        restaurados.sistemas_riego.length > 0 &&
        (!riego.length ||
          restaurados.sistemas_riego.some(
            (id) => !riego.some((opcion) => opcion.id === id),
          ));

      if (catalogoInvalido || cultivoPrevioInvalido || riegoInvalido) {
        setErrorRestauracion(
          "Los datos temporales incluyen identificadores que no están en los catálogos disponibles. Puedes empezar de nuevo.",
        );
        return;
      }

      setBorrador(restaurados);
      setDatosGuardados(restaurados);
      setEditando(false);
      setCultivoDeseadoSeleccionado(
        restaurados.cultivo_deseado_id ?? "__todas_las_opciones__",
      );
      setCultivoPrevioSeleccion(
        restaurados.cultivo_previo === null
          ? "desconocido"
          : restaurados.cultivo_previo
            ? "si"
            : "no",
      );
      setTemperaturaDesconocida(restaurados.temperatura_promedio_c === null);
      setCiclosDesconocidos(
        restaurados.cultivo_previo === true &&
          restaurados.numero_ciclos_previos === null,
      );
    }

    cargarCatalogosYRestaurar();
    return () => {
      cancelado = true;
    };
  }, [cultivoIds]);

  const hayCambiosSinGuardar =
    datosGuardados !== null &&
    JSON.stringify({ ...borrador, actualizado_en: null }) !==
      JSON.stringify({ ...datosGuardados, actualizado_en: null });

  function actualizar(cambios) {
    setBorrador((actual) => ({ ...actual, ...cambios }));
    setMensaje("");
  }

  function validar(datos) {
    const nuevosErrores = {};
    const valoresPermitidos = {
      cultivo_deseado: datos.cultivo_deseado_id,
      tipo_suelo: datos.tipo_suelo_id,
      periodo_temperatura: datos.periodo_temperatura_id,
      abastecimiento_agua: datos.abastecimiento_agua_id,
    };
    const catálogosPermitidos = {
      cultivo_deseado: cultivoIds,
      tipo_suelo: new Set(formulario.tipos_suelo.map((opcion) => opcion.id)),
      periodo_temperatura: new Set(
        formulario.periodos_temperatura.map((opcion) => opcion.id),
      ),
      abastecimiento_agua: new Set(
        formulario.abastecimientos_agua.map((opcion) => opcion.id),
      ),
    };

    Object.entries(valoresPermitidos).forEach(([campo, valor]) => {
      if (valor !== null && !catálogosPermitidos[campo].has(valor)) {
        nuevosErrores[campo] =
          formulario.mensajes_validacion[campo] ??
          "La opción seleccionada no es válida.";
      }
    });

    if (
      datos.temperatura_promedio_c !== null &&
      (typeof datos.temperatura_promedio_c !== "number" ||
        !Number.isFinite(datos.temperatura_promedio_c))
    ) {
      nuevosErrores.temperatura =
        formulario.mensajes_validacion.temperatura;
    }

    if (cultivoDeseadoSeleccionado === "") {
      nuevosErrores.cultivo_deseado =
        formulario.mensajes_validacion.cultivo_deseado_requerido;
    }

    if (
      datos.cultivo_previo === true &&
      datos.numero_ciclos_previos === null &&
      !ciclosDesconocidos
    ) {
      nuevosErrores.numero_ciclos =
        formulario.mensajes_validacion.ciclos_requeridos;
    }

    if (
      datos.cultivo_previo === true &&
      datos.numero_ciclos_previos !== null &&
      (!Number.isInteger(datos.numero_ciclos_previos) ||
        datos.numero_ciclos_previos < 1)
    ) {
      nuevosErrores.numero_ciclos =
        formulario.mensajes_validacion.numero_ciclos;
    }

    if (
      datos.sistemas_riego.some(
        (id) => !sistemasRiego.some((sistema) => sistema.id === id),
      )
    ) {
      nuevosErrores.sistemas_riego =
        formulario.mensajes_validacion.sistemas_riego;
    }

    const historialValido = datos.historial_cultivos.every((registro) => {
      if (registro.cultivo_id === null) {
        return (
          typeof registro.otro_nombre === "string" &&
          registro.otro_nombre.trim().length > 0
        );
      }
      return (
        cultivoIds.has(registro.cultivo_id) && registro.otro_nombre === null
      );
    });
    if (!historialValido) {
      nuevosErrores.historial_cultivos =
        formulario.mensajes_validacion.historial_cultivos;
    }

    if (
      datos.cultivo_previo === true &&
      datos.numero_ciclos_previos !== null &&
      datos.historial_cultivos.length > datos.numero_ciclos_previos
    ) {
      nuevosErrores.historial_cultivos =
        formulario.mensajes_validacion.historial_supera_ciclos;
    }

    return nuevosErrores;
  }

  function guardar(evento) {
    evento.preventDefault();
    if (!catalogosValidos) {
      setMensaje("No se pudieron validar los catálogos del formulario.");
      return;
    }

    const datos = {
      ...borrador,
      actualizado_en: new Date().toISOString(),
    };
    const nuevosErrores = validar(datos);
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length > 0) {
      setMensaje("Revisa los campos indicados antes de guardar.");
      return;
    }

    setBorrador(datos);
    setDatosGuardados(datos);
    setEditando(false);
    setErrorRestauracion("");

    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(datos));
      setErrorAlmacenamiento("");
      setMensaje("Datos guardados en esta pestaña.");
    } catch {
      setErrorAlmacenamiento(
        "El almacenamiento está bloqueado. Los datos se mantienen en memoria, pero no se conservarán al recargar.",
      );
      setMensaje("");
    }
  }

  function borrarDatos() {
    let error = "";
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      error =
        "No se pudo borrar el almacenamiento de esta pestaña. Los datos locales se reiniciaron, pero el elemento guardado podría permanecer.";
    }

    setBorrador(crearDatosIniciales());
    setDatosGuardados(null);
    setEditando(true);
    setCultivoDeseadoSeleccionado("");
    setCultivoPrevioSeleccion("");
    setTemperaturaDesconocida(false);
    setCiclosDesconocidos(false);
    setErrores({});
    setMensaje(error ? "" : "Datos temporales borrados.");
    setErrorAlmacenamiento(error);
    setErrorRestauracion("");
  }

  function empezarDeNuevo() {
    borrarDatos();
  }

  function cambiarCultivoPrevio(valor) {
    const cultivoPrevio =
      valor === "desconocido" ? null : valor === "si";
    setCultivoPrevioSeleccion(valor);
    actualizar({
      cultivo_previo: cultivoPrevio,
      numero_ciclos_previos: cultivoPrevio === false ? 0 : null,
      historial_cultivos: [],
    });
    setCiclosDesconocidos(false);
    setErrores((actuales) => ({
      ...actuales,
      numero_ciclos: "",
      historial_cultivos: "",
    }));
  }

  function cambiarAbastecimiento(valor) {
    const necesitaRiego =
      valor === "riego_artificial" || valor === "lluvia_y_riego";
    actualizar({
      abastecimiento_agua_id: valor || null,
      sistemas_riego: necesitaRiego ? borrador.sistemas_riego : [],
    });
  }

  function cambiarSistemaRiego(id, seleccionado) {
    const sistemas = new Set(borrador.sistemas_riego);
    if (seleccionado) sistemas.add(id);
    else sistemas.delete(id);
    actualizar({ sistemas_riego: [...sistemas] });
  }

  function cambiarRegistroHistorial(indice, cambios) {
    const historial = borrador.historial_cultivos.map((registro, posicion) =>
      posicion === indice ? { ...registro, ...cambios } : registro,
    );
    actualizar({ historial_cultivos: historial });
  }

  function agregarRegistroHistorial() {
    actualizar({
      historial_cultivos: [
        ...borrador.historial_cultivos,
        { cultivo_id: null, otro_nombre: null },
      ],
    });
  }

  function quitarRegistroHistorial(indice) {
    actualizar({
      historial_cultivos: borrador.historial_cultivos.filter(
        (_, posicion) => posicion !== indice,
      ),
    });
  }

  function nombreCultivoPrevio(registro) {
    if (registro.cultivo_id === null) {
      return registro.otro_nombre || "No informado";
    }
    return (
      cultivos.find((cultivo) => cultivo.id === registro.cultivo_id)?.nombre ??
      "No informado"
    );
  }

  return (
    <section className="parcela" aria-labelledby="formulario-parcela-titulo">
      <header className="parcela-heading">
        <p className="eyebrow">DATOS DE LA PARCELA</p>
        <h2 id="formulario-parcela-titulo">{formulario.titulo}</h2>
        <p>{formulario.descripcion}</p>
      </header>

      {errorCatalogoRiego && (
        <p className="form-notice form-notice--warning" role="alert">
          No están disponibles las opciones de riego: {errorCatalogoRiego} No
          se ha creado un catálogo alternativo.
        </p>
      )}
      {!catalogosValidos && (
        <p className="form-notice form-notice--warning" role="alert">
          El catálogo de cultivos o la configuración del formulario no es válido.
          No se pueden validar los datos.
        </p>
      )}
      {errorRestauracion && (
        <div className="form-notice form-notice--warning" role="alert">
          <p>{errorRestauracion}</p>
          <button className="secondary-button" onClick={empezarDeNuevo} type="button">
            Empezar de nuevo
          </button>
        </div>
      )}
      {errorAlmacenamiento && (
        <p className="form-notice form-notice--warning" role="status">
          {errorAlmacenamiento}
        </p>
      )}
      {mensaje && (
        <p className="form-notice" role="status">
          {mensaje}
        </p>
      )}
      {hayCambiosSinGuardar && (
        <p className="form-notice form-notice--warning" role="status">
          Hay cambios sin guardar.
        </p>
      )}

      {datosGuardados && !editando && (
        <section className="resumen-parcela" aria-labelledby="resumen-titulo">
          <h3 id="resumen-titulo">Resumen de tu parcela</h3>
          <dl className="resumen-lista">
            <div>
              <dt>Cultivo que desea plantar</dt>
              <dd>
                {datosGuardados.cultivo_deseado_id === null
                  ? "Quiero evaluar las cuatro opciones"
                  : obtenerEtiqueta(
                      cultivos,
                      datosGuardados.cultivo_deseado_id,
                    )}
              </dd>
            </div>
            <div>
              <dt>Tipo de suelo</dt>
              <dd>
                {obtenerEtiqueta(
                  formulario.tipos_suelo,
                  datosGuardados.tipo_suelo_id,
                )}
              </dd>
            </div>
            <div>
              <dt>Temperatura promedio</dt>
              <dd>
                {datosGuardados.temperatura_promedio_c === null
                  ? "No informado"
                  : `${datosGuardados.temperatura_promedio_c} °C`}
              </dd>
            </div>
            <div>
              <dt>Período del promedio</dt>
              <dd>
                {obtenerEtiqueta(
                  formulario.periodos_temperatura,
                  datosGuardados.periodo_temperatura_id,
                )}
              </dd>
            </div>
            <div>
              <dt>Cómo recibe agua</dt>
              <dd>
                {obtenerEtiqueta(
                  formulario.abastecimientos_agua,
                  datosGuardados.abastecimiento_agua_id,
                )}
              </dd>
            </div>
            <div>
              <dt>Sistemas de riego</dt>
              <dd>
                {datosGuardados.sistemas_riego.length === 0
                  ? datosGuardados.abastecimiento_agua_id === "solo_lluvia"
                    ? "No aplica (solo lluvia)"
                    : "No informado"
                  : datosGuardados.sistemas_riego
                      .map((id) => obtenerEtiqueta(sistemasRiego, id))
                      .join(", ")}
              </dd>
            </div>
            <div>
              <dt>¿Se ha cultivado antes?</dt>
              <dd>
                {datosGuardados.cultivo_previo === null
                  ? "No informado"
                  : datosGuardados.cultivo_previo
                    ? "Sí"
                    : "No"}
              </dd>
            </div>
            <div>
              <dt>Ciclos de cultivo anteriores</dt>
              <dd>
                {datosGuardados.cultivo_previo === false
                  ? "0"
                  : datosGuardados.numero_ciclos_previos === null
                    ? "No informado"
                    : datosGuardados.numero_ciclos_previos}
              </dd>
            </div>
            <div>
              <dt>Cultivos anteriores (del más reciente al más antiguo)</dt>
              <dd>
                {datosGuardados.historial_cultivos.length === 0
                  ? "No informado"
                  : datosGuardados.historial_cultivos
                      .map(nombreCultivoPrevio)
                      .join(", ")}
                {datosGuardados.numero_ciclos_previos !== null &&
                  datosGuardados.numero_ciclos_previos >
                    datosGuardados.historial_cultivos.length && (
                    <span className="historial-parcial">Historial parcial</span>
                  )}
              </dd>
            </div>
          </dl>
          <div className="form-actions">
            <button
              className="primary-button"
              onClick={() => {
                setEditando(true);
                setMensaje("");
              }}
              type="button"
            >
              Editar datos
            </button>
            <button
              className="secondary-button"
              onClick={borrarDatos}
              type="button"
            >
              Borrar datos temporales
            </button>
          </div>
        </section>
      )}
      {datosGuardados && !editando && (
        <ResultadoComparacion
          cultivos={cultivos}
          datos={datosGuardados}
          sistemasRiego={sistemasRiego}
        />
      )}

      {(!datosGuardados || editando) && (
        <form className="parcela-form" onSubmit={guardar} noValidate>
          <fieldset>
            <legend>{formulario.etiquetas.cultivo_deseado}</legend>
            <label className="field-control" htmlFor="cultivo-deseado">
              <span className="sr-only">
                {formulario.etiquetas.cultivo_deseado}
              </span>
              <select
                aria-describedby={
                  errores.cultivo_deseado
                    ? "cultivo-deseado-error"
                    : undefined
                }
                id="cultivo-deseado"
                onChange={(evento) => {
                  const valor = evento.target.value;
                  setCultivoDeseadoSeleccionado(valor);
                  actualizar({
                    cultivo_deseado_id:
                      valor === "__todas_las_opciones__" || valor === ""
                        ? null
                        : valor,
                  });
                }}
                value={cultivoDeseadoSeleccionado}
              >
                <option value="">Selecciona una opción</option>
                {cultivos.map((cultivo) => (
                  <option key={cultivo.id} value={cultivo.id}>
                    {cultivo.nombre}
                  </option>
                ))}
                <option value="__todas_las_opciones__">
                  {formulario.etiquetas.evaluar_cuatro}
                </option>
              </select>
            </label>
            <CampoError id="cultivo-deseado" mensaje={errores.cultivo_deseado} />
          </fieldset>

          <fieldset>
            <legend>{formulario.etiquetas.tipo_suelo}</legend>
            <label className="field-control" htmlFor="tipo-suelo">
              <span className="sr-only">{formulario.etiquetas.tipo_suelo}</span>
              <select
                aria-describedby={
                  errores.tipo_suelo ? "tipo-suelo-error" : undefined
                }
                id="tipo-suelo"
                onChange={(evento) =>
                  actualizar({ tipo_suelo_id: evento.target.value || null })
                }
                value={borrador.tipo_suelo_id ?? ""}
              >
                <option value="">Selecciona una opción</option>
                {formulario.tipos_suelo.map((opcion) => (
                  <option key={opcion.id} value={opcion.id}>
                    {opcion.nombre}
                  </option>
                ))}
              </select>
            </label>
            <CampoError id="tipo-suelo" mensaje={errores.tipo_suelo} />
          </fieldset>

          <fieldset>
            <legend>{formulario.etiquetas.temperatura}</legend>
            <label className="field-control" htmlFor="temperatura">
              <span>{formulario.etiquetas.temperatura} (°C)</span>
              <input
                aria-describedby={
                  errores.temperatura
                    ? "ayuda-temperatura temperatura-error"
                    : "ayuda-temperatura"
                }
                disabled={temperaturaDesconocida}
                id="temperatura"
                inputMode="decimal"
                onChange={(evento) =>
                  actualizar({
                    temperatura_promedio_c:
                      evento.target.value === ""
                        ? null
                        : Number(evento.target.value),
                    ...(evento.target.value === ""
                      ? { periodo_temperatura_id: null }
                      : {}),
                  })
                }
                step="any"
                type="number"
                value={borrador.temperatura_promedio_c ?? ""}
              />
            </label>
            <p className="field-help" id="ayuda-temperatura">
              {formulario.ayudas.temperatura}
            </p>
            <label className="check-control">
              <input
                checked={temperaturaDesconocida}
                onChange={(evento) => {
                  setTemperaturaDesconocida(evento.target.checked);
                  if (evento.target.checked) {
                    actualizar({
                      temperatura_promedio_c: null,
                      periodo_temperatura_id: null,
                    });
                  }
                }}
                type="checkbox"
              />
              {formulario.etiquetas.temperatura_desconocida}
            </label>
            <CampoError id="temperatura" mensaje={errores.temperatura} />
          </fieldset>

          <fieldset>
            <legend>{formulario.etiquetas.periodo_temperatura}</legend>
            <label className="field-control" htmlFor="periodo-temperatura">
              <span className="sr-only">
                {formulario.etiquetas.periodo_temperatura}
              </span>
              <select
                aria-describedby={
                  errores.periodo_temperatura
                    ? "periodo-temperatura-error"
                    : undefined
                }
                id="periodo-temperatura"
                onChange={(evento) =>
                  actualizar({
                    periodo_temperatura_id: evento.target.value || null,
                  })
                }
                value={borrador.periodo_temperatura_id ?? ""}
              >
                <option value="">Selecciona una opción</option>
                {formulario.periodos_temperatura.map((opcion) => (
                  <option key={opcion.id} value={opcion.id}>
                    {opcion.nombre}
                  </option>
                ))}
              </select>
            </label>
            <CampoError
              id="periodo-temperatura"
              mensaje={errores.periodo_temperatura}
            />
          </fieldset>

          <fieldset>
            <legend>{formulario.etiquetas.abastecimiento_agua}</legend>
            <label className="field-control" htmlFor="abastecimiento-agua">
              <span className="sr-only">
                {formulario.etiquetas.abastecimiento_agua}
              </span>
              <select
                aria-describedby={
                  errores.abastecimiento_agua
                    ? "abastecimiento-agua-error"
                    : undefined
                }
                id="abastecimiento-agua"
                onChange={(evento) => cambiarAbastecimiento(evento.target.value)}
                value={borrador.abastecimiento_agua_id ?? ""}
              >
                <option value="">Selecciona una opción</option>
                {formulario.abastecimientos_agua.map((opcion) => (
                  <option key={opcion.id} value={opcion.id}>
                    {opcion.nombre}
                  </option>
                ))}
              </select>
            </label>
            <CampoError
              id="abastecimiento-agua"
              mensaje={errores.abastecimiento_agua}
            />
            {(borrador.abastecimiento_agua_id === "riego_artificial" ||
              borrador.abastecimiento_agua_id === "lluvia_y_riego") && (
              <div className="nested-fields">
                <p className="field-label">
                  {formulario.etiquetas.sistemas_riego}
                </p>
                {sistemasRiego.map((sistema) => (
                  <label className="check-control" key={sistema.id}>
                    <input
                      checked={borrador.sistemas_riego.includes(sistema.id)}
                      onChange={(evento) =>
                        cambiarSistemaRiego(sistema.id, evento.target.checked)
                      }
                      type="checkbox"
                    />
                    {sistema.nombre}
                  </label>
                ))}
                {errorCatalogoRiego ? (
                  <p className="field-help">
                    No se pueden ofrecer opciones hasta disponer de un catálogo
                    válido.
                  </p>
                ) : null}
                <CampoError
                  id="sistemas-riego"
                  mensaje={errores.sistemas_riego}
                />
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend>{formulario.etiquetas.cultivo_previo}</legend>
            <div className="radio-options">
              {[
                ["si", "Sí"],
                ["no", "No"],
                ["desconocido", "No lo sé"],
              ].map(([valor, nombre]) => (
                <label className="check-control" key={valor}>
                  <input
                    checked={cultivoPrevioSeleccion === valor}
                    onChange={() => cambiarCultivoPrevio(valor)}
                    type="radio"
                    value={valor}
                  />
                  {nombre}
                </label>
              ))}
            </div>
          </fieldset>

          {borrador.cultivo_previo === true && (
            <>
              <fieldset>
                <legend>{formulario.etiquetas.numero_ciclos}</legend>
                <label className="field-control" htmlFor="numero-ciclos">
                  <span>{formulario.etiquetas.numero_ciclos}</span>
                  <input
                    aria-describedby={
                      errores.numero_ciclos
                        ? "ayuda-ciclos numero-ciclos-error"
                        : "ayuda-ciclos"
                    }
                    disabled={ciclosDesconocidos}
                    id="numero-ciclos"
                    min="1"
                    onChange={(evento) =>
                      actualizar({
                        numero_ciclos_previos:
                          evento.target.value === ""
                            ? null
                            : Number(evento.target.value),
                      })
                    }
                    step="1"
                    type="number"
                    value={borrador.numero_ciclos_previos ?? ""}
                  />
                </label>
                <p className="field-help" id="ayuda-ciclos">
                  {formulario.ayudas.numero_ciclos}
                </p>
                <label className="check-control">
                  <input
                    checked={ciclosDesconocidos}
                    onChange={(evento) => {
                      setCiclosDesconocidos(evento.target.checked);
                      if (evento.target.checked) {
                        actualizar({ numero_ciclos_previos: null });
                      }
                    }}
                    type="checkbox"
                  />
                  {formulario.etiquetas.ciclos_desconocidos}
                </label>
                <CampoError
                  id="numero-ciclos"
                  mensaje={errores.numero_ciclos}
                />
              </fieldset>

              <fieldset>
                <legend>{formulario.etiquetas.historial_cultivos}</legend>
                <p className="field-help">
                  {formulario.ayudas.historial_cultivos}
                </p>
                {borrador.historial_cultivos.map((registro, indice) => (
                  <div className="historial-row" key={indice}>
                    <label
                      className="field-control"
                      htmlFor={`cultivo-previo-${indice}`}
                    >
                      <span>
                        Cultivo {indice + 1} (del más reciente al más antiguo)
                      </span>
                      <select
                        id={`cultivo-previo-${indice}`}
                        onChange={(evento) => {
                          const valor = evento.target.value;
                          cambiarRegistroHistorial(indice, {
                            cultivo_id: valor === "otro" ? null : valor,
                            otro_nombre: valor === "otro" ? "" : null,
                          });
                        }}
                        value={
                          registro.cultivo_id ??
                          (registro.otro_nombre !== null ? "otro" : "")
                        }
                      >
                        <option value="">Selecciona un cultivo</option>
                        {cultivos.map((cultivo) => (
                          <option key={cultivo.id} value={cultivo.id}>
                            {cultivo.nombre}
                          </option>
                        ))}
                        <option value="otro">
                          {formulario.etiquetas.otro_cultivo}
                        </option>
                      </select>
                    </label>
                    {registro.otro_nombre !== null && (
                      <label
                        className="field-control"
                        htmlFor={`otro-cultivo-${indice}`}
                      >
                        <span>
                          {formulario.etiquetas.nombre_otro_cultivo}
                        </span>
                        <input
                          id={`otro-cultivo-${indice}`}
                          onChange={(evento) =>
                            cambiarRegistroHistorial(indice, {
                              otro_nombre: evento.target.value,
                            })
                          }
                          type="text"
                          value={registro.otro_nombre}
                        />
                      </label>
                    )}
                    <button
                      className="remove-button"
                      onClick={() => quitarRegistroHistorial(indice)}
                      type="button"
                    >
                      Quitar cultivo {indice + 1}
                    </button>
                  </div>
                ))}
                <CampoError
                  id="historial-cultivos"
                  mensaje={errores.historial_cultivos}
                />
                <button
                  className="secondary-button"
                  disabled={
                    borrador.numero_ciclos_previos !== null &&
                    borrador.historial_cultivos.length >=
                      borrador.numero_ciclos_previos
                  }
                  onClick={agregarRegistroHistorial}
                  type="button"
                >
                  Añadir cultivo anterior
                </button>
              </fieldset>
            </>
          )}

          <div className="form-actions">
            <button className="primary-button" type="submit">
              Guardar datos temporalmente
            </button>
            {datosGuardados && (
              <button
                className="secondary-button"
                onClick={borrarDatos}
                type="button"
              >
                Borrar datos temporales
              </button>
            )}
          </div>
        </form>
      )}

      <p className="storage-explanation">
        Los datos se guardan en esta pestaña; normalmente se eliminan al cerrarla
      </p>
    </section>
  );
}

export default FormularioParcela;