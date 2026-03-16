/**
 * Funnel 2: Mismo calendario que Funnel 1, pero métricas por coincidencias.
 * Por cada período (prospectos que entraron por Pautas en ese período):
 * cuántos de esos mismos prospectos coinciden en agendamientos, presupuestos y contratos.
 */
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfDay,
  endOfWeek,
  endOfMonth,
  format,
  parseISO,
  isWithinInterval,
} from 'date-fns';
import { es } from 'date-fns/locale';

const LOCALE = es;

function toDate(d) {
  if (d instanceof Date) return d;
  if (typeof d === 'string') return parseISO(d);
  return new Date(d);
}

function getPeriodStart(date, granularity) {
  const d = toDate(date);
  if (granularity === 'day') return startOfDay(d);
  if (granularity === 'week') return startOfWeek(d, { weekStartsOn: 1, locale: LOCALE });
  return startOfMonth(d);
}

function periodKey(date, granularity) {
  const start = getPeriodStart(date, granularity);
  return format(start, granularity === 'day' ? 'yyyy-MM-dd' : granularity === 'week' ? "yyyy-'W'I" : 'yyyy-MM');
}

/** Normaliza para comparar Línea sin acentos (Odontología = Odontologia) */
function normalizarLinea(s) {
  if (!s) return '';
  return String(s).trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/** Id de cliente canónico (253642 === "253642" === "253642.0" para no duplicar) */
function idClienteCanonico(val) {
  if (val == null && val !== 0) return '';
  const s = String(val).trim();
  const n = Number(s);
  if (Number.isFinite(n)) return String(Math.floor(n));
  return s;
}

/**
 * @param {{ pautas: Array<{id_prospecto, fecha_contacto, linea?}>, agendamientos, presupuestosContratos }} data
 * @param {{ from, to, granularity, linea?: string }} params
 */
export function computeFunnel2(data, params) {
  const { from, to, granularity, linea } = params;
  const fromDate = getPeriodStart(from, granularity);
  const toLimit = toDate(to);
  const rangeEnd = granularity === 'day' ? endOfDay(toLimit) : granularity === 'week' ? endOfWeek(toLimit, { weekStartsOn: 1 }) : endOfMonth(toLimit);
  const lastPeriodStart = getPeriodStart(to, granularity);

  const lineaNorm = linea ? normalizarLinea(linea) : '';
  const pautas = lineaNorm
    ? data.pautas.filter((p) => p.linea && normalizarLinea(p.linea) === lineaNorm)
    : data.pautas;
  const agendamientosFiltrados = lineaNorm
    ? data.agendamientos.filter((a) => a.linea && normalizarLinea(a.linea) === lineaNorm)
    : data.agendamientos;

  const pautasInRange = pautas.filter((p) => {
    const d = toDate(p.fecha_contacto);
    return isWithinInterval(d, { start: fromDate, end: rangeEnd });
  });

  const agendamientosEnRango = agendamientosFiltrados.filter((a) => {
    const d = toDate(a.fecha_agendamiento);
    return isWithinInterval(d, { start: fromDate, end: rangeEnd });
  });
  const idsAgendamientos = new Set(agendamientosEnRango.map((a) => idClienteCanonico(a.id_prospecto)).filter(Boolean));

  const clientesList = data.clientes || [];
  const clientesMap = new Map(clientesList.map((c) => [idClienteCanonico(c.id), c]).filter(([id]) => id));

  const presupuestosEnRango = data.presupuestosContratos.filter((pc) => {
    const dPres = pc.fecha_presupuesto ? toDate(pc.fecha_presupuesto) : null;
    const dCont = pc.fecha_contrato ? toDate(pc.fecha_contrato) : null;
    const d = dPres || dCont;
    if (!d || !isWithinInterval(d, { start: fromDate, end: rangeEnd })) return false;
    const id = idClienteCanonico(pc.id_prospecto);
    if (!id || !idsAgendamientos.has(id)) return false;
    if (lineaNorm) {
      const cli = clientesMap.get(id);
      if (cli && cli.linea != null && normalizarLinea(cli.linea) !== lineaNorm) return false;
    }
    return true;
  });
  const idsPresupuesto = new Set(presupuestosEnRango.map((p) => idClienteCanonico(p.id_prospecto)));

  const contratosFromClientes = clientesList.filter((c) => {
    const id = idClienteCanonico(c.id);
    if (!id || !c.tiene_contrato || !c.contract_date) return false;
    if (c.control_calidad_confirmado === false) return false;
    if (c.es_titular === false) return false;
    const d = toDate(c.contract_date);
    if (!isWithinInterval(d, { start: fromDate, end: rangeEnd })) return false;
    if (lineaNorm && (c.linea == null || normalizarLinea(c.linea) !== lineaNorm)) return false;
    return true;
  });
  const idsContrato = clientesList.length > 0
    ? new Set(contratosFromClientes.map((c) => idClienteCanonico(c.id)))
    : new Set(presupuestosEnRango.filter((p) => p.tiene_contrato || p.fecha_contrato).map((p) => idClienteCanonico(p.id_prospecto)));

  const periods = new Map(); // periodKey -> { prospectos: Set, ... }

  for (const p of pautasInRange) {
    const d = toDate(p.fecha_contacto);
    const key = periodKey(d, granularity);
    if (!periods.has(key)) {
      periods.set(key, {
        period: key,
        label: format(getPeriodStart(d, granularity), granularity === 'month' ? 'MMM yyyy' : granularity === 'week' ? "'Sem' w yyyy" : 'dd/MM/yyyy', { locale: LOCALE }),
        prospectos: new Set(),
      });
    }
    periods.get(key).prospectos.add(p.id_prospecto);
  }

  // Rellenar períodos vacíos en el rango
  const allKeys = new Set(periods.keys());
  let cur = new Date(fromDate);
  while (cur <= lastPeriodStart) {
    const key = periodKey(cur, granularity);
    if (!allKeys.has(key)) {
      periods.set(key, {
        period: key,
        label: format(getPeriodStart(cur, granularity), granularity === 'month' ? 'MMM yyyy' : granularity === 'week' ? "'Sem' w yyyy" : 'dd/MM/yyyy', { locale: LOCALE }),
        prospectos: new Set(),
      });
    }
    if (granularity === 'day') cur.setDate(cur.getDate() + 1);
    else if (granularity === 'week') cur.setDate(cur.getDate() + 7);
    else cur.setMonth(cur.getMonth() + 1);
  }

  const result = [];
  for (const [key, rec] of periods) {
    const ids = [...rec.prospectos];
    const conAgendamiento = ids.filter((id) => idsAgendamientos.has(idClienteCanonico(id))).length;
    const conPresupuesto = ids.filter((id) => idsPresupuesto.has(idClienteCanonico(id))).length;
    const conContrato = ids.filter((id) => idsContrato.has(idClienteCanonico(id))).length;
    result.push({
      period: rec.period,
      label: rec.label,
      prospectos: ids.length,
      coinciden_agendamiento: conAgendamiento,
      coinciden_presupuesto: conPresupuesto,
      coinciden_contrato: conContrato,
    });
  }
  result.sort((a, b) => a.period.localeCompare(b.period));
  return result;
}
