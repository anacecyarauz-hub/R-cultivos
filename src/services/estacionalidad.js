export const MESES = [
  ["JAN", "Enero", "ENE"], ["FEB", "Febrero", "FEB"],
  ["MAR", "Marzo", "MAR"], ["APR", "Abril", "ABR"],
  ["MAY", "Mayo", "MAY"], ["JUN", "Junio", "JUN"],
  ["JUL", "Julio", "JUL"], ["AUG", "Agosto", "AGO"],
  ["SEP", "Septiembre", "SEP"], ["OCT", "Octubre", "OCT"],
  ["NOV", "Noviembre", "NOV"], ["DEC", "Diciembre", "DIC"],
];

export function extraerMeses(clima) {
  return MESES.map(([id]) => ({
    id,
    lluvia: clima.valorMensual("PRECTOTCORR", id),
    temperatura: clima.valorMensual("T2M", id),
    humedad: clima.valorMensual("RH2M", id),
  }));
}

export function respaldoValido(respaldo, zona) {
  return respaldo && respaldo.latitud === zona.latitud &&
    respaldo.longitud === zona.longitud &&
    typeof respaldo.periodo === "string" && respaldo.periodo.length > 0 &&
    Array.isArray(respaldo.meses) && respaldo.meses.length === MESES.length &&
    respaldo.meses.every((mes, indice) => mes && mes.id === MESES[indice][0] &&
      [mes.lluvia, mes.temperatura, mes.humedad].every(
        (valor) => valor === null || Number.isFinite(valor),
      ) &&
      (mes.lluvia === null || mes.lluvia >= 0) &&
      (mes.humedad === null || (mes.humedad >= 0 && mes.humedad <= 100)));
}

export function evaluarAlerta(mes, referencia) {
  if (!mes) return "insuficiente";
  if ((mes.lluvia !== null && mes.lluvia < 2) ||
      (mes.humedad !== null && mes.humedad < 65)) return "roja";
  if (mes.lluvia === null || mes.humedad === null) return "insuficiente";
  if (mes.lluvia <= 4.5) return "amarilla";
  if (!referencia || mes.temperatura === null) return "sin-referencia";
  return mes.temperatura >= referencia.minimo && mes.temperatura <= referencia.maximo
    ? "verde" : "temperatura";
}
