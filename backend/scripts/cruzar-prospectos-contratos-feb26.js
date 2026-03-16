/**
 * Cruce: prospectos (Pautas Feb 2026) con clientes con contrato (Feb 2026)
 * Enlace por teléfono vía Clientes y telefonos.xlsx (mismo criterio: últimos 9 dígitos)
 * Uso: node scripts/cruzar-prospectos-contratos-feb26.js
 */
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatasets } from '../src/loadData.js';
import { parseDate } from '../src/config.js';
import { isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');

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

function normalizarTel(t) {
  if (!t) return '';
  const d = String(t).replace(/\D/g, '');
  if (d.length <= 9) return d;
  return d.slice(-9);
}

const fromDate = startOfMonth(new Date(2026, 1));
const rangeEnd = endOfMonth(new Date(2026, 1));

const data = getDatasets();

// 1. Clientes con contrato en Feb 2026 (todas las líneas)
const clientesConContrato = (data.clientes || []).filter((c) => {
  if (!c.id || !c.tiene_contrato || !c.contract_date) return false;
  if (c.control_calidad_confirmado === false) return false;
  if (c.es_titular === false) return false;
  const d = c.contract_date instanceof Date ? c.contract_date : new Date(c.contract_date);
  if (!isWithinInterval(d, { start: fromDate, end: rangeEnd })) return false;
  return true;
});
const idsConContrato = new Set(clientesConContrato.map((c) => idCanonico(c.id)).filter(Boolean));

// 2. Teléfonos de esos clientes (desde Clientes y telefonos)
const ctPath = path.join(DATA_DIR, 'Clientes y telefonos.xlsx');
const wbCT = XLSX.readFile(ctPath);
const sheetCT = wbCT.Sheets['Consulta1'] || wbCT.Sheets[wbCT.SheetNames[0]];
const ctRaw = XLSX.utils.sheet_to_json(sheetCT);
const telColCT = Object.keys(ctRaw[0] || {}).find((k) => /telefono|tel[eé]fono|phone/i.test(k)) || 'Número de telefono';
const idColCT = Object.keys(ctRaw[0] || {}).find((k) => /cliente_id|id/i.test(k)) || 'Cliente_id';

const telsDeClientesConContrato = new Set();
for (const row of ctRaw) {
  const id = row[idColCT] != null ? idCanonico(String(row[idColCT])) : '';
  if (!idsConContrato.has(id)) continue;
  const raw = row[telColCT];
  if (raw != null && raw !== '') {
    const t = normalizarTel(String(raw));
    if (t.length >= 8) telsDeClientesConContrato.add(t);
  }
}

// 3. Prospectos en Feb 2026 (Pautas: Fecha Ingreso en feb 2026, teléfono en "Linea")
const pautasPath = path.join(DATA_DIR, 'Pautas-ThinkChat-2025-2026.xlsx');
const wbP = XLSX.readFile(pautasPath, { cellDates: true });
const pautasRaw = XLSX.utils.sheet_to_json(wbP.Sheets[wbP.SheetNames[0]]);
const telsProspectosFeb26 = new Set();
const colFecha = Object.keys(pautasRaw[0] || {}).find((k) => /fecha|ingreso/i.test(k)) || 'Fecha Ingreso';
const colTelPautas = 'Linea';

for (const row of pautasRaw) {
  const fechaVal = row[colFecha];
  const d = fechaVal ? parseDate(fechaVal) : null;
  if (!d || !isWithinInterval(d, { start: fromDate, end: rangeEnd })) continue;
  const raw = row[colTelPautas];
  if (raw != null && raw !== '') {
    const t = normalizarTel(String(raw));
    if (t.length >= 8) telsProspectosFeb26.add(t);
  }
}

// 4. Coincidencias: prospectos (tel) que están en clientes con contrato (tel)
const coincidencias = [...telsProspectosFeb26].filter((t) => telsDeClientesConContrato.has(t));

console.log('--- Prospectos (Feb 2026) vs Clientes con contrato (Feb 2026) — por teléfono ---');
console.log('Clientes con contrato Feb 2026 (ids únicos):', idsConContrato.size);
console.log('Teléfonos de esos clientes (desde Clientes y telefonos):', telsDeClientesConContrato.size);
console.log('Prospectos Feb 2026 (teléfonos únicos en Pautas):', telsProspectosFeb26.size);
console.log('');
console.log('Coincidencias (prospecto con tel que además es cliente con contrato):', coincidencias.length);
