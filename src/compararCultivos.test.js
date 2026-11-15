import assert from "node:assert/strict";
import { test } from "node:test";
import { compararCultivos } from "./compararCultivos.js";
import cana from "../data/condiciones_cana_azucar.json" with { type: "json" };
import maiz from "../data/condiciones_maiz.json" with { type: "json" };

const datos = {
  tipo_suelo_id: null,
  temperatura_promedio_c: null,
  periodo_temperatura_id: null,
  historial_cultivos: [],
  abastecimiento_agua_id: null,
};

function comparar(ficha, clima) {
  return compararCultivos({ ...datos, clima_nasa: clima }, [ficha], [], [])[0];
}

test("la lluvia anual de caña aporta 20 puntos solo cuando es comparable", () => {
  const base = { mes: "JAN", periodo: "2001-2025", precipitacion_mm_dia: 3 };
  const dentro = comparar(cana, { ...base, precipitacion_anual_mm: 1200 });
  const fuera = comparar(cana, { ...base, precipitacion_anual_mm: 1501 });
  const sinAnual = comparar(cana, { ...base, precipitacion_anual_mm: null });
  assert.equal(dentro.porcentaje, 100);
  assert.equal(fuera.porcentaje, 0);
  assert.equal(dentro.factores.find((f) => f.id === "clima_nasa_precipitacion").resultado, "dentro");
  assert.equal(fuera.factores.find((f) => f.id === "clima_nasa_precipitacion").resultado, "fuera");
  assert.equal(sinAnual.factores.find((f) => f.id === "clima_nasa_precipitacion").resultado, "requiere_contexto");
  assert.equal(comparar(cana, { ...base, precipitacion_anual_mm: 1500 }).porcentaje, 100);
  const conTemperatura = { ...datos, temperatura_promedio_c: 31 };
  const evaluar = (anual) => compararCultivos(
    { ...conTemperatura, clima_nasa: { ...base, precipitacion_anual_mm: anual } },
    [cana], [], [],
  )[0].porcentaje;
  assert.equal(evaluar(1300), 100);
  assert.equal(evaluar(1501), 60);
  assert.equal(evaluar(null), 100);
});

test("la lluvia por ciclo y los datos sin rangos no afectan el puntaje", () => {
  const clima = {
    mes: "JAN", periodo: "2001-2025", precipitacion_mm_dia: 3,
    precipitacion_anual_mm: 1300, humedad_porcentaje: 80, radiacion_mj_m2_dia: 20,
  };
  const resultado = comparar(maiz, clima);
  assert.equal(resultado.porcentaje, comparar(maiz, null).porcentaje);
  for (const id of ["clima_nasa_precipitacion", "clima_nasa_humedad", "clima_nasa_radiacion"]) {
    assert.equal(resultado.factores.find((f) => f.id === id).resultado, "requiere_contexto");
  }
});
