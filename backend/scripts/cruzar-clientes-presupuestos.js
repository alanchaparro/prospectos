/**
 * Cruza clientes únicos con contrato (Feb 2026 Odontología) vs:
 * - Presupuestos y contratos.xlsx
 * - agendamientos-prospectos.xlsx
 * Criterio: ID de cliente (idCanonico)
 * Uso: node scripts/cruzar-clientes-presupuestos.js
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
const lineaNorm = 'odontologia';

const data = getDatasets();

// 1. Clientes únicos con contrato (Feb 2026 Odontología) - mismo criterio que la web
const clientesConContrato = (data.clientes || []).filter((c) => {
  if (!c.id || !c.tiene_contrato || !c.contract_date) return false;
  if (c.control_calidad_confirmado === false) return false;
  if (c.es_titular === false) return false;
  const d = c.contract_date instanceof Date ? c.contract_date : new Date(c.contract_date);
  if (!isWithinInterval(d, { start: fromDate, end: rangeEnd })) return false;
  if (c.linea == null || normalizarLinea(c.linea) !== lineaNorm) return false;
  return true;
});

const idsClientesUnicosContrato = new Set(clientesConContrato.map((c) => idCanonico(c.id)).filter(Boolean));

// 2. Clientes en agendamientos-prospectos (Feb 2026, Odontología) - mismo criterio que la web
const agendamientos = data.agendamientos || [];
const idsAgendamientosFeb26 = new Set();
for (const a of agendamientos) {
  if (a.linea != null && normalizarLinea(a.linea) !== lineaNorm) continue;
  const d = a.fecha_agendamiento ? (a.fecha_agendamiento instanceof Date ? a.fecha_agendamiento : new Date(a.fecha_agendamiento)) : null;
  if (!d || !isWithinInterval(d, { start: fromDate, end: rangeEnd })) continue;
  const id = idCanonico(a.id_prospecto);
  if (id) idsAgendamientosFeb26.add(id);
}

// 3. Clientes en Presupuestos y contratos (Feb 2026, status 5/10/15)
const presupuestos = data.presupuestosContratos || [];
const idsPresupuestoFeb26 = new Set();
for (const p of presupuestos) {
  const d = p.fecha_presupuesto ? (p.fecha_presupuesto instanceof Date ? p.fecha_presupuesto : new Date(p.fecha_presupuesto)) : null;
  if (!d || !isWithinInterval(d, { start: fromDate, end: rangeEnd })) continue;
  const id = idCanonico(p.id_prospecto);
  if (id) idsPresupuestoFeb26.add(id);
}

// Cruce: clientes únicos contrato vs agendamientos
const coincidenciasContratoAgendamientos = [...idsClientesUnicosContrato].filter((id) => idsAgendamientosFeb26.has(id));

// Cruce: clientes únicos contrato vs presupuestos
const coincidenciasContratoPresupuestos = [...idsClientesUnicosContrato].filter((id) => idsPresupuestoFeb26.has(id));

console.log('--- Cruce Feb 2026 Odontología (ID cliente canónico) ---');
console.log('Clientes únicos con contrato:', idsClientesUnicosContrato.size);
console.log('');
console.log('vs agendamientos-prospectos (Feb 2026):');
console.log('  Clientes en agendamientos:', idsAgendamientosFeb26.size);
console.log('  Coincidencias:', coincidenciasContratoAgendamientos.length);
console.log('');
console.log('vs Presupuestos y contratos (Feb 2026):');
console.log('  Clientes en presupuestos:', idsPresupuestoFeb26.size);
console.log('  Coincidencias:', coincidenciasContratoPresupuestos.length);
