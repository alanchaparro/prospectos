/**
 * Verifica cuántos agendamientos-prospectos hay en Feb 2026 (clientes únicos)
 * Mismo criterio que la web: atendidos + prospectos, fecha de agendamiento en el rango
 * Uso: node scripts/verificar-agendamientos-feb26.js
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

const fromDate = startOfMonth(new Date(2026, 1));
const rangeEnd = endOfMonth(new Date(2026, 1));

const data = getDatasets();
const agendamientos = data.agendamientos || [];

// Feb 2026, todas las líneas
const idsUnicosTodos = new Set();
for (const a of agendamientos) {
  const d = a.fecha_agendamiento ? (a.fecha_agendamiento instanceof Date ? a.fecha_agendamiento : new Date(a.fecha_agendamiento)) : null;
  if (!d || !isWithinInterval(d, { start: fromDate, end: rangeEnd })) continue;
  const id = idCanonico(a.id_prospecto);
  if (id) idsUnicosTodos.add(id);
}

// Feb 2026, solo Odontología
const lineaNorm = 'odontologia';
const idsUnicosOdontologia = new Set();
for (const a of agendamientos) {
  if (a.linea != null && normalizarLinea(a.linea) !== lineaNorm) continue;
  const d = a.fecha_agendamiento ? (a.fecha_agendamiento instanceof Date ? a.fecha_agendamiento : new Date(a.fecha_agendamiento)) : null;
  if (!d || !isWithinInterval(d, { start: fromDate, end: rangeEnd })) continue;
  const id = idCanonico(a.id_prospecto);
  if (id) idsUnicosOdontologia.add(id);
}

console.log('--- Agendamientos-prospectos Feb 2026 (clientes únicos) ---');
console.log('Total clientes únicos (todas las líneas):', idsUnicosTodos.size);
console.log('Clientes únicos Odontología:', idsUnicosOdontologia.size);
