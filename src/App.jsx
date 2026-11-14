import { useState } from "react";
import cultivosData from "../data/cultivos.json";
import fichaMaiz from "../data/condiciones_maiz.json";
import fichaArroz from "../data/condiciones_arroz.json";
import fichaFrijol from "../data/condiciones_frijol.json";
import fichaCanaAzucar from "../data/condiciones_cana_azucar.json";
import FormularioParcela from "./FormularioParcela.jsx";

function formatearLimite(condicion, valor) {
  return condicion.id === "ph" ? valor.toFixed(1) : valor;
}

function formatearCondicion(condicion) {
  const minimo = formatearLimite(condicion, condicion.minimo);
  const maximo = formatearLimite(condicion, condicion.maximo);
  const valores = minimo === maximo ? minimo : `${minimo}–${maximo}`;
  return `${valores}${condicion.unidad ? ` ${condicion.unidad}` : ""}`;
}

function esValorDisponible(valor) {
  return (
    valor !== null &&
    valor !== undefined &&
    !(typeof valor === "number" && !Number.isFinite(valor))
  );
}

const fichas = {
  [fichaMaiz.cultivo_id]: fichaMaiz,
  [fichaArroz.cultivo_id]: fichaArroz,
  [fichaFrijol.cultivo_id]: fichaFrijol,
  [fichaCanaAzucar.cultivo_id]: fichaCanaAzucar,
};

function App() {
  const [cultivoConFichaAbierta, setCultivoConFichaAbierta] = useState(null);
  const fichaAbierta = fichas[cultivoConFichaAbierta];
  const fuenteDrenaje = fichaAbierta?.fuentes.find(
    (fuente) => fuente.id === fichaAbierta.drenaje?.fuente_id,
  );
  const obtenerFuente = (fuenteId) =>
    fichaAbierta?.fuentes.find((fuente) => fuente.id === fuenteId);
  const mostrarFuentes = (fuenteIds) => {
    const ids = Array.isArray(fuenteIds) ? fuenteIds : [fuenteIds];
    return (
      <p className="referencia-fuentes">
        Fuente{ids.length > 1 ? "s" : ""}:{" "}
        {ids.map((fuenteId, index) => {
          const fuente = obtenerFuente(fuenteId);
          if (!fuente) return null;
          return (
            <span key={fuente.id}>
              {index > 0 ? "; " : ""}
              <a href={fuente.url} rel="noopener noreferrer" target="_blank">
                {fuente.institucion}
              </a>
            </span>
          );
        })}
      </p>
    );
  };
  const renderElementoApartado = (elemento) => {
    if (elemento.tipo === "condicion") {
      const condicion = fichaAbierta.condiciones.find(
        (item) => item.id === elemento.condicion_id,
      );
      if (!condicion) return null;
      return (
        <div key={elemento.condicion_id}>
          <p>
            <strong>
              {condicion.nombre}: {formatearCondicion(condicion)}
            </strong>
          </p>
          {condicion.periodo && <p>{condicion.periodo}</p>}
          {condicion.nota && <p>{condicion.nota}</p>}
          {mostrarFuentes(condicion.fuente_ids || condicion.fuente_id)}
        </div>
      );
    }

    if (elemento.tipo === "suelo") {
      return (
        <div key={elemento.tipo}>
          {fichaAbierta.suelo.texturas?.length > 0 && (
            <p>Texturas: {fichaAbierta.suelo.texturas.join(", ")}</p>
          )}
          {fichaAbierta.suelo.descripcion && (
            <p>{fichaAbierta.suelo.descripcion}</p>
          )}
          {mostrarFuentes(
            fichaAbierta.suelo.fuente_ids || fichaAbierta.suelo.fuente_id,
          )}
        </div>
      );
    }

    if (elemento.tipo === "drenaje") {
      return (
        <div key={elemento.tipo}>
          <p>{fichaAbierta.drenaje.descripcion}</p>
          {mostrarFuentes(
            fichaAbierta.drenaje.descripcion_fuente_ids ||
              fichaAbierta.drenaje.descripcion_fuente_id ||
              fichaAbierta.drenaje.fuente_ids ||
              fichaAbierta.drenaje.fuente_id,
          )}
        </div>
      );
    }

    if (elemento.tipo === "observacion") {
      const observacion = fichaAbierta.observaciones.find(
        (item) => item.id === elemento.observacion_id,
      );
      if (!observacion) return null;
      return (
        <div key={elemento.observacion_id}>
          <p>{observacion.descripcion}</p>
          {mostrarFuentes(observacion.fuente_ids || observacion.fuente_id)}
        </div>
      );
    }

    return (
      <div key={elemento.texto}>
        <p>{elemento.texto}</p>
        {mostrarFuentes(elemento.fuente_ids || elemento.fuente_id)}
      </div>
    );
  };

  return (
    <main className="page-shell">
      <header className="intro">
        <p className="eyebrow">AGRICULTURA · LOS SANTOS, PANAMÁ</p>
        <h1>Suelo y clima de Los Santos</h1>
        <p className="intro-copy">
          Consulta información para planificar tus cultivos
        </p>
      </header>

      <section className="cultivos" aria-labelledby="cultivos-title">
        <div className="section-heading">
          <h2 id="cultivos-title">Cultivos</h2>
          <span>{cultivosData.cultivos.length} opciones</span>
        </div>
        <div className="cultivos-grid">
          {cultivosData.cultivos.map((cultivo, index) => (
            <article
              className={`cultivo cultivo--${index % 2 === 0 ? "verde" : "azul"}`}
              key={cultivo.id}
            >
              <span className="cultivo-marker" aria-hidden="true" />
              <h3>{cultivo.nombre}</h3>
              <p>{cultivo.descripcion}</p>
              {fichas[cultivo.id] && (
                <button
                  aria-controls={
                    cultivoConFichaAbierta === cultivo.id
                      ? "ficha-cultivo"
                      : undefined
                  }
                  aria-expanded={cultivoConFichaAbierta === cultivo.id}
                  className="cultivo-action"
                  onClick={() => setCultivoConFichaAbierta(cultivo.id)}
                  type="button"
                >
                  Ver condiciones
                </button>
              )}
            </article>
          ))}
        </div>
        {fichaAbierta && (
          <section
            aria-labelledby="ficha-cultivo-titulo"
            aria-live="polite"
            className="ficha"
            id="ficha-cultivo"
          >
            <header className="ficha-header">
              <div>
                <p className="ficha-eyebrow">Ficha de cultivo</p>
                <h2 id="ficha-cultivo-titulo">{fichaAbierta.nombre}</h2>
                <p className="ficha-cientifico">
                  {fichaAbierta.nombre_cientifico}
                </p>
              </div>
              <button
                className="ficha-close"
                onClick={() => setCultivoConFichaAbierta(null)}
                type="button"
              >
                Cerrar ficha
              </button>
            </header>

            {fichaAbierta.alcance && (
              <p className="ficha-alcance">{fichaAbierta.alcance}</p>
            )}

            {!fichaAbierta.apartados?.length && (
              <dl className="condiciones-lista">
                {fichaAbierta.condiciones.map((condicion) => (
                  <div className="condicion" key={condicion.id}>
                    <dt>{condicion.nombre}</dt>
                    <dd>{formatearCondicion(condicion)}</dd>
                    {condicion.periodo && (
                      <p className="condicion-detalle">{condicion.periodo}</p>
                    )}
                    {condicion.nota && (
                      <p className="condicion-nota">{condicion.nota}</p>
                    )}
                  </div>
                ))}
              </dl>
            )}

            {!fichaAbierta.apartados?.length &&
              (fichaAbierta.manejo?.epoca_seca ||
              fichaAbierta.factores_climaticos?.length > 0 ||
              fichaAbierta.suelo?.texturas?.length > 0 ||
              fichaAbierta.suelo?.descripcion ||
              fichaAbierta.drenaje ||
              fichaAbierta.observaciones?.length > 0 ||
              fichaAbierta.fuentes?.length > 0) && (
              <div className="ficha-extra">
                {fichaAbierta.manejo?.epoca_seca && (
                  <div>
                    <h3>Época seca</h3>
                    <p>{fichaAbierta.manejo.epoca_seca}</p>
                  </div>
                )}
                {fichaAbierta.factores_climaticos?.length > 0 && (
                  <div>
                    <h3>Factores climáticos</h3>
                    {fichaAbierta.factores_climaticos.map((factor) => (
                      <p key={factor.id}>
                        <strong>{factor.nombre}:</strong> {factor.descripcion}
                      </p>
                    ))}
                  </div>
                )}
                {(fichaAbierta.suelo?.texturas?.length > 0 ||
                  fichaAbierta.suelo?.descripcion) && (
                  <div>
                    <h3>Suelo</h3>
                    {fichaAbierta.suelo.texturas?.length > 0 && (
                      <p>{fichaAbierta.suelo.texturas.join(", ")}</p>
                    )}
                    {fichaAbierta.suelo.descripcion && (
                      <p>{fichaAbierta.suelo.descripcion}</p>
                    )}
                  </div>
                )}
                {fichaAbierta.drenaje && (
                  <div>
                    <h3>Drenaje del suelo</h3>
                    <p>{fichaAbierta.drenaje.descripcion}</p>
                    {fichaAbierta.drenaje.consideraciones.length > 0 && (
                      <ul>
                        {fichaAbierta.drenaje.consideraciones.map(
                          (consideracion) => (
                            <li key={consideracion}>{consideracion}</li>
                          ),
                        )}
                      </ul>
                    )}
                    {fuenteDrenaje && (
                      <p>
                        <a
                          href={fuenteDrenaje.url}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {fuenteDrenaje.titulo}
                        </a>
                      </p>
                    )}
                  </div>
                )}
                {fichaAbierta.observaciones?.length > 0 && (
                  <div>
                    <h3>Observaciones</h3>
                    {fichaAbierta.observaciones.map((observacion) => (
                      <p key={observacion.id}>{observacion.descripcion}</p>
                    ))}
                  </div>
                )}
                {fichaAbierta.fuentes?.map((fuente) => (
                  <div key={fuente.id}>
                    <h3>Fuente</h3>
                    <p>{fuente.institucion}</p>
                    {fuente.anio_documento && (
                      <p>Año: {fuente.anio_documento}</p>
                    )}
                    {fuente.paginas?.length > 0 && (
                      <p>Páginas: {fuente.paginas.join(", ")}</p>
                    )}
                    {fuente.tipo_paginacion && (
                      <p>{fuente.tipo_paginacion}</p>
                    )}
                    {fuente.pagina && <p>Página: {fuente.pagina}</p>}
                    {fuente.seccion && <p>{fuente.seccion}</p>}
                    <a
                      href={fuente.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {fuente.titulo}
                    </a>
                  </div>
                ))}
              </div>
            )}

            {fichaAbierta.aviso && (
              <p className="ficha-aviso">{fichaAbierta.aviso}</p>
            )}

            {fichaAbierta.apartados?.length > 0 && (
              <>
                <div className="ficha-apartados">
                  {fichaAbierta.apartados.map((apartado) => (
                    <section key={apartado.id}>
                      <h3>{apartado.nombre}</h3>
                      {apartado.elementos.map(renderElementoApartado)}
                    </section>
                  ))}
                </div>
                <section className="ficha-fuentes" aria-labelledby="fuentes-frijol">
                  <h3 id="fuentes-frijol">Fuentes</h3>
                  {fichaAbierta.fuentes.map((fuente) => (
                    <p key={fuente.id}>
                      <strong>{fuente.institucion}</strong>
                      {fuente.paginas?.length > 0 &&
                        ` · Páginas ${fuente.paginas.join(" y ")}`}
                      {fuente.seccion && ` · ${fuente.seccion}`}
                      {" · "}
                      <a
                        href={fuente.url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {fuente.titulo}
                      </a>
                    </p>
                  ))}
                </section>
              </>
            )}
          </section>
        )}
      </section>

      <FormularioParcela cultivos={cultivosData.cultivos} />
    </main>
  );
}

export default App;
