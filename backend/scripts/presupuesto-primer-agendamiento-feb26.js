/**
 * Clientes con presupuesto en Feb 2026 cuyo PRIMER agendamiento es Feb 2026
 * - Por cliente: primera fecha de agendamiento (min) debe caer en Feb 2026
 * - Presupuesto: fecha_presupuesto en Feb 2026 (status 5, 10, 15 ya aplicado en loadData)
 * Uso: node scripts/presupuesto-primer-agendamiento-feb26.js
 */
import { getDatasets } from '../src/loadData.js';
import { isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';

function idCanonico(val) {
  if (val == null && val !== 0) return '';
  const s = String(val).trim();
  const n = Number(s);
  if (Number.isFinite(n)) return String(Math.floor(n));
  return s;
}

function toDate(d) {
  if (d instanceof Date) return d;
  if (typeof d === 'string') return new Date(d);
  return new Date(d);
}

const fromDate = startOfMonth(new Date(2026, 1));
const rangeEnd = endOfMonth(new Date(2026, 1));

const data = getDatasets();
const agendamientos = data.agendamientos || [];
const presupuestos = data.presupuestosContratos || [];

// 1. Por cliente: primera fecha de agendamiento (mínima)
const primerAgendamientoPorCliente = new Map();
for (const a of agendamientos) {
  const id = idCanonico(a.id_prospecto);
  if (!id) continue;
  const d = a.fecha_agendamiento ? toDate(a.fecha_agendamiento) : null;
  if (!d || isNaN(d.getTime())) continue;
  const actual = primerAgendamientoPorCliente.get(id);
  if (!actual || d < actual) primerAgendamientoPorCliente.set(id, d);
}

// 2. Clientes cuyo primer agendamiento es Feb 2026
const idsPrimerAgendamientoFeb26 = new Set();
for (const [id, d] of primerAgendamientoPorCliente) {
  if (isWithinInterval(d, { start: fromDate, end: rangeEnd })) idsPrimerAgendamientoFeb26.add(id);
}

// 3. Presupuestos con fecha en Feb 2026 y cliente en ese set (primer agendamiento feb 2026)
const idsPresupuestoFeb26PrimerAgeFeb26 = new Set();
for (const p of presupuestos) {
  const id = idCanonico(p.id_prospecto);
  if (!id || !idsPrimerAgendamientoFeb26.has(id)) continue;
  const d = p.fecha_presupuesto ? toDate(p.fecha_presupuesto) : null;
  if (!d || !isWithinInterval(d, { start: fromDate, end: rangeEnd })) continue;
  idsPresupuestoFeb26PrimerAgeFeb26.add(id);
}

console.log('--- Presupuesto Feb 2026 con primer agendamiento en Feb 2026 ---');
console.log('Clientes con primer agendamiento en Feb 2026:', idsPrimerAgendamientoFeb26.size);
console.log('Clientes con presupuesto en Feb 2026 cuyo primer agendamiento es Feb 2026:', idsPresupuestoFeb26PrimerAgeFeb26.size);
