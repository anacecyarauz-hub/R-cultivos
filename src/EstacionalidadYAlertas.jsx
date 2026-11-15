import { useEffect, useState } from "react";
import fichaMaiz from "../data/condiciones_maiz.json";
import fichaFrijol from "../data/condiciones_frijol.json";
import fichaArroz from "../data/condiciones_arroz.json";
import fichaCana from "../data/condiciones_cana_azucar.json";
import { obtenerClimaNASA } from "./services/nasaApi.js";
import { MESES, evaluarAlerta, extraerMeses, respaldoValido } from "./services/estacionalidad.js";
import "./EstacionalidadYAlertas.css";

const ZONAS = [
  { id: "chitre", nombre: "Chitré - Llano Bonito", latitud: 7.9735, longitud: -80.4220 },
  { id: "las-tablas", nombre: "Las Tablas", latitud: 7.7650, longitud: -80.2750 },
  { id: "guarare", nombre: "Guararé", latitud: 7.8150, longitud: -80.2830 },
  { id: "pedasi", nombre: "Pedasí", latitud: 7.5300, longitud: -80.0260 },
  { id: "macaracas", nombre: "Macaracas", latitud: 7.7310, longitud: -80.5530 },
  { id: "tonosi", nombre: "Tonosí", latitud: 7.4060, longitud: -80.4420 },
];

const REFERENCIAS = [
  { id: "maiz", nombre: "Maíz", ficha: fichaMaiz, condicion: "temperatura" },
  { id: "frijol", nombre: "Frijol", ficha: fichaFrijol, condicion: "temperatura" },
  { id: "arroz", nombre: "Arroz · germinación", ficha: fichaArroz, condicion: "temperatura_germinacion" },
  { id: "cana", nombre: "Caña · germinación", ficha: fichaCana, condicion: "temperatura_germinacion" },
].map((opcion) => ({
  ...opcion,
  rango: opcion.ficha.condiciones.find((condicion) => condicion.id === opcion.condicion),
}));

const MENSAJES = {
  roja: ["Alerta roja · Estrés hídrico severo", "Considera riego tecnificado, cobertura vegetal (mulching) o cultivos resistentes a la sequía."],
  amarilla: ["Alerta amarilla · Precaución", "Monitorea la humedad del suelo antes de sembrar."],
  verde: ["Estado verde · Condiciones favorables", "Posible ventana de siembra: verifica el suelo, el pronóstico y las necesidades del cultivo."],
  insuficiente: ["Datos insuficientes", "Falta precipitación o humedad para descartar una alerta. No se puede evaluar este mes."],
  "sin-referencia": ["Lluvia favorable · Temperatura sin evaluar", "Selecciona un cultivo y verifica que exista temperatura para evaluar sus condiciones."],
  temperatura: ["Lluvia favorable · Temperatura fuera del rango", "La temperatura promedio no está dentro de la referencia seleccionada. Revisa las condiciones del cultivo antes de sembrar."],
};

const claveRespaldo = (zona) => `estacionalidad_nasa_v1_${zona.id}`;
const mostrarValor = (valor, unidad) => valor === null ? "Sin dato" : `${valor} ${unidad}`;

function leerRespaldo(zona) {
  const texto = localStorage.getItem(claveRespaldo(zona));
  if (!texto) return null;
  const datos = JSON.parse(texto);
  if (!respaldoValido(datos, zona)) throw new Error("El respaldo local no es válido.");
  return datos;
}

function Grafico({ meses, seleccionado, seleccionar }) {
  const lluvias = meses.map((mes) => mes.lluvia).filter((valor) => valor !== null);
  const temperaturas = meses.map((mes) => mes.temperatura).filter((valor) => valor !== null);
  const lluviaMax = Math.max(1, ...lluvias);
  const tempMin = temperaturas.length ? Math.min(...temperaturas) : 0;
  const tempMax = temperaturas.length ? Math.max(...temperaturas) : 0;
  const alturaTemperatura = (valor) => tempMax === tempMin
    ? 100 : 175 - ((valor - tempMin) / (tempMax - tempMin)) * 150;
  const x = (indice) => 30 + indice * 60;

  return (
    <div className="estacionalidad-chart-scroll">
      <div className="estacionalidad-chart">
        <p className="estacionalidad-legend">
          <span><i className="estacionalidad-key-lluvia" /> Lluvia: 0–{lluviaMax} mm/día</span>
          <span><i className="estacionalidad-key-temp" /> Temperatura: {temperaturas.length ? `${tempMin}–${tempMax} °C` : "sin datos"}</span>
        </p>
        <svg viewBox="0 0 720 200" role="img" aria-label="Barras de precipitación y línea de temperatura mensual. Selecciona un mes para ver los valores.">
          <line x1="0" x2="720" y1="180" y2="180" stroke="#b9c9c0" />
          {meses.map((mes, indice) => mes.lluvia !== null && (
            <rect key={mes.id} x={x(indice) - 13} y={180 - mes.lluvia / lluviaMax * 160}
              width="26" height={mes.lluvia / lluviaMax * 160} rx="3"
              fill={indice === seleccionado ? "#2b6f83" : "#92c4cd"} />
          ))}
          {meses.slice(1).map((mes, indice) => {
            const anterior = meses[indice];
            return mes.temperatura !== null && anterior.temperatura !== null && (
              <line key={mes.id} x1={x(indice)} y1={alturaTemperatura(anterior.temperatura)}
                x2={x(indice + 1)} y2={alturaTemperatura(mes.temperatura)}
                stroke="#b25837" strokeWidth="3" />
            );
          })}
          {meses.map((mes, indice) => mes.temperatura !== null && (
            <circle key={mes.id} cx={x(indice)} cy={alturaTemperatura(mes.temperatura)}
              r="4" fill="#b25837" />
          ))}
        </svg>
        <div className="estacionalidad-months" aria-label="Seleccionar mes">
          {MESES.map(([id, nombre, abreviatura], indice) => (
            <button key={id} type="button" aria-label={nombre} aria-pressed={seleccionado === indice}
              onClick={() => seleccionar(indice)} onFocus={() => seleccionar(indice)}
              onMouseEnter={() => seleccionar(indice)}>
              {abreviatura}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function EstacionalidadYAlertas() {
  const [zonaId, setZonaId] = useState(ZONAS[0].id);
  const [mes, setMes] = useState(() => new Date().getMonth());
  const [cultivo, setCultivo] = useState("");
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);
  const [resultado, setResultado] = useState(null);
  const zona = ZONAS.find((opcion) => opcion.id === zonaId);
  const referencia = REFERENCIAS.find((opcion) => opcion.id === cultivo);

  useEffect(() => {
    const actualizar = () => setEnLinea(navigator.onLine);
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);
    return () => {
      window.removeEventListener("online", actualizar);
      window.removeEventListener("offline", actualizar);
    };
  }, []);

  useEffect(() => {
    let vigente = true;
    const cargar = async () => {
      setResultado({ zonaId: zona.id, cargando: true });
      if (enLinea) {
        try {
          const clima = await obtenerClimaNASA(zona.latitud, zona.longitud);
          if (!vigente) return;
          const datos = { latitud: zona.latitud, longitud: zona.longitud, periodo: clima.periodo, meses: extraerMeses(clima) };
          let aviso = "";
          try {
            localStorage.setItem(claveRespaldo(zona), JSON.stringify(datos));
          } catch (error) {
            console.error("No se pudo guardar el respaldo climático:", error);
            aviso = "No se pudo guardar el respaldo local para esta zona.";
          }
          setResultado({ zonaId: zona.id, datos, fuente: "NASA POWER API (En vivo)", aviso });
          return;
        } catch (error) {
          if (!vigente) return;
          console.error("No se pudo consultar NASA POWER:", error);
        }
      }

      try {
        const datos = leerRespaldo(zona);
        if (!vigente) return;
        setResultado({
          zonaId: zona.id,
          datos,
          fuente: datos ? "Base de Datos Local (Modo Offline)" : null,
          aviso: enLinea
            ? "No se pudo consultar NASA POWER. " + (datos ? "Se muestra la última copia local." : "No hay copia local para esta zona.")
            : datos ? "" : "No hay copia local para esta zona. Consulta NASA con conexión para guardarla.",
        });
      } catch (error) {
        console.error("No se pudo leer el respaldo climático:", error);
        if (vigente) setResultado({ zonaId: zona.id, aviso: "No se pudo leer el respaldo local de esta zona." });
      }
    };
    cargar();
    return () => { vigente = false; };
  }, [zona, enLinea]);

  const actual = resultado?.zonaId === zonaId ? resultado : null;
  const datosMes = actual?.datos?.meses[mes];
  const alerta = evaluarAlerta(datosMes, referencia?.rango);

  return (
    <section className="estacionalidad" aria-labelledby="estacionalidad-titulo">
      <header>
        <p className="eyebrow">CLIMA · ARCO SECO</p>
        <h2 id="estacionalidad-titulo">Estacionalidad y alertas</h2>
        <p>Promedios climatológicos históricos, no observaciones actuales ni pronósticos.</p>
      </header>
      <div className="estacionalidad-selectores">
        <label>Zona / Distrito
          <select value={zonaId} onChange={(evento) => setZonaId(evento.target.value)}>
            {ZONAS.map((opcion) => <option key={opcion.id} value={opcion.id}>{opcion.nombre}</option>)}
          </select>
        </label>
        <label>Cultivo para evaluar temperatura
          <select value={cultivo} onChange={(evento) => setCultivo(evento.target.value)}>
            <option value="">Selecciona un cultivo</option>
            {REFERENCIAS.map((opcion) => <option key={opcion.id} value={opcion.id}>{opcion.nombre}</option>)}
          </select>
        </label>
      </div>
      {referencia?.rango && <p className="estacionalidad-nota">Referencia de la ficha: {referencia.rango.minimo}–{referencia.rango.maximo} °C. Un promedio mensual no describe necesariamente cada etapa del cultivo.</p>}
      {(!actual || actual.cargando) && <p role="status">Consultando datos climáticos…</p>}
      {actual?.aviso && <p className="estacionalidad-aviso" role="status">{actual.aviso}</p>}
      {actual?.datos && (
        <>
          <p className="estacionalidad-fuente">{actual.fuente} · {actual.datos.periodo} · {zona.latitud}, {zona.longitud}</p>
          <Grafico meses={actual.datos.meses} seleccionado={mes} seleccionar={setMes} />
          <div className="estacionalidad-detalle" aria-live="polite">
            <strong>{MESES[mes][1]}</strong>
            <span>Lluvia: {mostrarValor(datosMes.lluvia, "mm/día")}</span>
            <span>Temperatura: {mostrarValor(datosMes.temperatura, "°C")}</span>
            <span>Humedad: {mostrarValor(datosMes.humedad, "%")}</span>
          </div>
          <div className={`estacionalidad-alerta estacionalidad-alerta--${alerta}`} role="status">
            <strong>{MENSAJES[alerta][0]}</strong>
            <p>{MENSAJES[alerta][1]}</p>
          </div>
        </>
      )}
    </section>
  );
}
