import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { obtenerClimaNASA } from "./nasaApi.js";

const fetchOriginal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

test("consulta coordenadas y conserva datos mensuales y valores faltantes", async () => {
  globalThis.fetch = async (url) => {
    const consulta = new URL(url).searchParams;
    assert.equal(consulta.get("latitude"), "7.765");
    assert.equal(consulta.get("longitude"), "-80.428");
    assert.match(consulta.get("parameters"), /ALLSKY_SFC_SW_DWN/);
    return {
      ok: true,
      json: async () => ({
        header: { range: "2001 - 2025", fill_value: -999 },
        properties: {
          parameter: {
            T2M: { JAN: 25.3, FEB: -999 },
            PRECTOTCORR: { JAN: 0.5, FEB: -1, ANN: 5 },
            RH2M: { JAN: 80, FEB: 101 },
            ALLSKY_SFC_SW_DWN: { JAN: 19 },
          },
        },
      }),
    };
  };
  const clima = await obtenerClimaNASA(7.765, -80.428);
  assert.equal(clima.periodo, "2001 - 2025");
  assert.equal(clima.valorMensual("T2M", "JAN"), 25.3);
  assert.equal(clima.valorMensual("T2M", "FEB"), null);
  assert.equal(clima.valorMensual("T2M", "MAR"), null);
  assert.equal(clima.valorMensual("PRECTOTCORR", "ANN"), 5);
  assert.equal(clima.valorMensual("PRECTOTCORR", "FEB"), null);
  assert.equal(clima.valorMensual("RH2M", "FEB"), null);
});

test("rechaza coordenadas inválidas antes de consultar", async () => {
  globalThis.fetch = () => assert.fail("No debe realizar una consulta");
  await assert.rejects(obtenerClimaNASA(91, 0), /coordenadas/);
  await assert.rejects(obtenerClimaNASA(0, -181), /coordenadas/);
});

test("notifica errores HTTP y respuestas incompletas", async () => {
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  await assert.rejects(obtenerClimaNASA(0, 0), /HTTP 503/);
  globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });
  await assert.rejects(obtenerClimaNASA(0, 0), /incompletos/);
});
