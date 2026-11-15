import assert from "node:assert/strict";
import { test } from "node:test";
import { MESES, evaluarAlerta, extraerMeses, respaldoValido } from "./estacionalidad.js";

test("clasifica umbrales, datos faltantes y temperatura por cultivo", () => {
  const mes = { lluvia: 2, humedad: 65, temperatura: 25 };
  const referencia = { minimo: 20, maximo: 25 };
  assert.equal(evaluarAlerta({ ...mes, lluvia: 1.99 }, referencia), "roja");
  assert.equal(evaluarAlerta({ ...mes, humedad: 64.9 }, referencia), "roja");
  assert.equal(evaluarAlerta({ ...mes, lluvia: null, humedad: 64 }, referencia), "roja");
  assert.equal(evaluarAlerta(mes, referencia), "amarilla");
  assert.equal(evaluarAlerta({ ...mes, lluvia: 4.5 }, referencia), "amarilla");
  assert.equal(evaluarAlerta({ ...mes, lluvia: 4.51 }, referencia), "verde");
  assert.equal(evaluarAlerta({ ...mes, lluvia: 5, temperatura: 26 }, referencia), "temperatura");
  assert.equal(evaluarAlerta({ ...mes, lluvia: 5 }, null), "sin-referencia");
  assert.equal(evaluarAlerta({ ...mes, lluvia: 5, humedad: null }, referencia), "insuficiente");
});

test("extrae y valida los doce meses y las coordenadas del respaldo", () => {
  const meses = extraerMeses({ valorMensual: (parametro, mes) =>
    mes === "JAN" && parametro === "T2M" ? 25 : null });
  const zona = { latitud: 7.765, longitud: -80.275 };
  const respaldo = { ...zona, periodo: "2001 - 2025", meses };
  assert.equal(meses.length, 12);
  assert.deepEqual(meses.map((mes) => mes.id), MESES.map(([id]) => id));
  assert.equal(respaldoValido(respaldo, zona), true);
  assert.equal(respaldoValido(respaldo, { ...zona, longitud: 0 }), false);
  assert.equal(respaldoValido({ ...respaldo, meses: meses.slice(1) }, zona), false);
  assert.equal(respaldoValido({ ...respaldo, meses: [{ ...meses[0], humedad: 101 }, ...meses.slice(1)] }, zona), false);
});
