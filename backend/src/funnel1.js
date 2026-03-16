/**
 * Funnel 1: Agrupación por tiempo. Métricas por período sin cruce de prospectos.
 * Por cada período: prospectos únicos, agendamientos únicos, presupuestos únicos, contratos.
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

/** Teléfono normalizado (últimos 9 dígitos) para cruce con Clientes y telefonos */
function normalizarTelefono(t) {
  if (!t) return '';
  const d = String(t).replace(/\D/g, '');
  return d.length <= 9 ? d : d.slice(-9);
}

/**
 * @param {{ pautas: Array<{id_prospecto, fecha_contacto, linea?}>, ... }} data
 * @param {{ from: string, to: string, granularity: 'day'|'week'|'month', linea?: string }} params
 */
export function computeFunnel1(data, params) {
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

  const agendamientosInRange = agendamientosFiltrados.filter((a) => {
    const d = toDate(a.fecha_agendamiento);
    return isWithinInterval(d, { start: fromDate, end: rangeEnd });
  });

  const clientesMap = new Map();
  (data.clientes || []).forEach((c) => {
    const id = idClienteCanonico(c.id);
    if (id) clientesMap.set(id, c);
  });

  const presupuestosInRange = data.presupuestosContratos.filter((pc) => {
    const dPres = pc.fecha_presupuesto ? toDate(pc.fecha_presupuesto) : null;
    const dCont = pc.fecha_contrato ? toDate(pc.fecha_contrato) : dPres;
    const enRangoFecha = (dPres && isWithinInterval(dPres, { start: fromDate, end: rangeEnd })) ||
      (dCont && isWithinInterval(dCont, { start: fromDate, end: rangeEnd }));
    if (!enRangoFecha) return false;
    const id = idClienteCanonico(pc.id_prospecto);
    if (!id) return false;
    if (lineaNorm) {
      const cli = clientesMap.get(id);
      if (cli && cli.linea != null && normalizarLinea(cli.linea) !== lineaNorm) return false;
    }
    return true;
  });

  const periods = new Map(); // periodKey -> { period, prospectos, agendamientos, presupuestos, contratos }

  function ensurePeriod(date) {
    const key = periodKey(date, granularity);
    if (!periods.has(key)) {
      periods.set(key, {
        period: key,
        label: format(getPeriodStart(date, granularity), granularity === 'month' ? 'MMM yyyy' : granularity === 'week' ? "'Sem' w yyyy" : 'dd/MM/yyyy', { locale: LOCALE }),
        prospectos: new Set(),
        pautasList: [],
        agendamientos: new Set(),
        presupuestos: new Set(),
        contratos: new Set(),
        contratosTotal: 0,
      });
    }
    return periods.get(key);
  }

  for (const p of pautas) {
    const d = toDate(p.fecha_contacto);
    if (!isWithinInterval(d, { start: fromDate, end: rangeEnd })) continue;
    const rec = ensurePeriod(d);
    rec.prospectos.add(p.id_prospecto);
    rec.pautasList.push(p);
  }

  for (const a of agendamientosInRange) {
    const d = toDate(a.fecha_agendamiento);
    const rec = ensurePeriod(d);
    rec.agendamientos.add(a.id_prospecto);
  }

  // Un cliente único cuenta una sola vez: si tiene varios presupuestos, solo el primero (fecha más antigua)
  const primerPresupuestoPorCliente = new Map();
  for (const pc of presupuestosInRange) {
    const id = idClienteCanonico(pc.id_prospecto);
    if (!id || !pc.fecha_presupuesto) continue;
    const d = toDate(pc.fecha_presupuesto);
    const existing = primerPresupuestoPorCliente.get(id);
    if (!existing || d < toDate(existing.fecha_presupuesto)) {
      primerPresupuestoPorCliente.set(id, pc);
    }
  }
  for (const pc of primerPresupuestoPorCliente.values()) {
    const d = toDate(pc.fecha_presupuesto);
    if (!isWithinInterval(d, { start: fromDate, end: rangeEnd })) continue;
    const rec = ensurePeriod(d);
    const id = idClienteCanonico(pc.id_prospecto);
    if (!rec.agendamientos.has(id)) continue;
    rec.presupuestos.add(id);
  }

  // Contratos desde clientes: contract_date en rango, tiene_contrato, control calidad = confirmado, tipo cliente = titular, Línea
  const clientesConContrato = (data.clientes || []).filter((c) => {
    const id = idClienteCanonico(c.id);
    if (!id || !c.tiene_contrato || !c.contract_date) return false;
    if (c.control_calidad_confirmado === false) return false;
    if (c.es_titular === false) return false;
    const d = toDate(c.contract_date);
    if (!isWithinInterval(d, { start: fromDate, end: rangeEnd })) return false;
    if (lineaNorm && (c.linea == null || normalizarLinea(c.linea) !== lineaNorm)) return false;
    return true;
  });
  const contratosUnicosPorPeriodo = new Map();
  for (const c of clientesConContrato) {
    const id = idClienteCanonico(c.id);
    const d = toDate(c.contract_date);
    const rec = ensurePeriod(d);
    rec.contratosTotal = (rec.contratosTotal || 0) + 1;
    if (!contratosUnicosPorPeriodo.has(rec.period)) contratosUnicosPorPeriodo.set(rec.period, new Set());
    contratosUnicosPorPeriodo.get(rec.period).add(id);
  }
  for (const [periodKey, ids] of contratosUnicosPorPeriodo) {
    const rec = periods.get(periodKey);
    if (rec) ids.forEach((id) => rec.contratos.add(id));
  }
  if (clientesConContrato.length === 0 && (data.clientes || []).length === 0) {
    for (const pc of presupuestosInRange) {
      if (pc.fecha_contrato || pc.tiene_contrato) {
        const d = pc.fecha_contrato ? toDate(pc.fecha_contrato) : pc.fecha_presupuesto ? toDate(pc.fecha_presupuesto) : null;
        if (d && isWithinInterval(d, { start: fromDate, end: rangeEnd })) {
          const rec = ensurePeriod(d);
          rec.contratosTotal = (rec.contratosTotal || 0) + 1;
          rec.contratos.add(idClienteCanonico(pc.id_prospecto));
        }
      }
    }
  }

  // Rellenar períodos vacíos en el rango
  const allKeys = new Set(periods.keys());
  let cur = new Date(fromDate);
  while (cur <= lastPeriodStart) {
    const key = periodKey(cur, granularity);
    if (!allKeys.has(key)) ensurePeriod(cur);
    if (granularity === 'day') cur.setDate(cur.getDate() + 1);
    else if (granularity === 'week') cur.setDate(cur.getDate() + 7);
    else cur.setMonth(cur.getMonth() + 1);
  }

  const clientesYTelefonos = data.clientesYTelefonos || null;

  const sortedKeys = [...periods.keys()].sort();
  return sortedKeys.map((key) => {
    const r = periods.get(key);
    const agendamientosCanon = new Set([...r.agendamientos].map(idClienteCanonico).filter(Boolean));
    const phonesAgendamientos = new Set();
    if (clientesYTelefonos) {
      for (const id of agendamientosCanon) {
        const tels = clientesYTelefonos.get(id);
        if (tels) tels.forEach((t) => phonesAgendamientos.add(t));
      }
    }
    const prospectosAgendadosSet = new Set();
    for (const p of r.pautasList || []) {
      const idCanon = idClienteCanonico(p.id_prospecto);
      if (idCanon && agendamientosCanon.has(idCanon)) {
        prospectosAgendadosSet.add('id:' + idCanon);
      } else if (p.telefono && phonesAgendamientos.has(p.telefono)) {
        prospectosAgendadosSet.add('tel:' + p.telefono);
      }
    }
    const prospectos_agendados = prospectosAgendadosSet.size;

    // Secuencia lógica "de prospectos": solo los que vienen de Pautas (por id o por teléfono)
    const prospectoPhones = new Set();
    const prospectoIds = new Set();
    for (const p of r.pautasList || []) {
      if (p.telefono) prospectoPhones.add(p.telefono);
      const idCanon = idClienteCanonico(p.id_prospecto);
      if (idCanon && /^\d+$/.test(String(idCanon))) prospectoIds.add(idCanon);
    }
    const prospectoClientIds = new Set(prospectoIds);
    if (clientesYTelefonos) {
      for (const [id, tels] of clientesYTelefonos) {
        if (tels && (tels instanceof Set ? [...tels] : [tels]).some((t) => prospectoPhones.has(t))) prospectoClientIds.add(id);
      }
    }
    const presupuestos_de_prospectos = [...r.presupuestos].filter((id) => prospectoClientIds.has(id)).length;
    const contratos_de_prospectos = [...r.contratos].filter((id) => prospectoClientIds.has(id)).length;
    const clientes_unicos_de_prospectos = contratos_de_prospectos;

    return {
      period: r.period,
      label: r.label,
      prospectos: r.prospectos.size,
      prospectos_agendados,
      agendamientos: r.agendamientos.size,
      presupuestos: r.presupuestos.size,
      presupuestos_de_prospectos,
      contratos: r.contratosTotal ?? r.contratos.size,
      contratos_de_prospectos,
      clientes_unicos: r.contratos.size,
      clientes_unicos_de_prospectos,
    };
  });
}
