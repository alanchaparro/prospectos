/**
 * Odontología Feb 2026:
 * - Agendamientos-prospectos: clientes únicos (ya sabemos 372)
 * - De esos mismos 372, cuántos generaron presupuesto en Feb 2026
 * Uso: node scripts/odontologia-feb26-agendamientos-presupuesto.js
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

function normalizarLinea(s) {
  if (!s) return '';
  return String(s).trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function toDate(d) {
  if (d instanceof Date) return d;
  if (typeof d === 'string') return new Date(d);
  return new Date(d);
}

const fromDate = startOfMonth(new Date(2026, 1));
const rangeEnd = endOfMonth(new Date(2026, 1));
const lineaNorm = 'odontologia';

const data = getDatasets();
const agendamientos = data.agendamientos || [];
const presupuestos = data.presupuestosContratos || [];

// 1. Clientes únicos en agendamientos-prospectos Feb 2026 Odontología
const idsAgendamientosOdontologiaFeb26 = new Set();
for (const a of agendamientos) {
  if (a.linea != null && normalizarLinea(a.linea) !== lineaNorm) continue;
  const d = a.fecha_agendamiento ? toDate(a.fecha_agendamiento) : null;
  if (!d || !isWithinInterval(d, { start: fromDate, end: rangeEnd })) continue;
  const id = idCanonico(a.id_prospecto);
  if (id) idsAgendamientosOdontologiaFeb26.add(id);
}

// 2. De esos mismos clientes, cuántos tienen presupuesto en Feb 2026
const idsConPresupuestoFeb26 = new Set();
for (const p of presupuestos) {
  const id = idCanonico(p.id_prospecto);
  if (!id || !idsAgendamientosOdontologiaFeb26.has(id)) continue;
  const d = p.fecha_presupuesto ? toDate(p.fecha_presupuesto) : null;
  if (!d || !isWithinInterval(d, { start: fromDate, end: rangeEnd })) continue;
  idsConPresupuestoFeb26.add(id);
}

console.log('--- Odontología Feb 2026 ---');
console.log('Agendamientos-prospectos (clientes únicos):', idsAgendamientosOdontologiaFeb26.size);
console.log('De esos mismos clientes, generaron presupuesto en Feb 2026:', idsConPresupuestoFeb26.size);
