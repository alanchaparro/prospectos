/**
 * Cruce Pautas-ThinkChat-2025-2026.xlsx vs Clientes y telefonos.xlsx
 * Coincidencias por: id cliente (canónico) y/o teléfono normalizado
 * Uso: node scripts/cruzar-pautas-clientes-telefonos.js
 */
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');

function idCanonico(val) {
  if (val == null && val !== 0) return '';
  const s = String(val).trim();
  const n = Number(s);
  if (Number.isFinite(n)) return String(Math.floor(n));
  return s;
}

function normalizarTel(t) {
  if (!t) return '';
  const d = String(t).replace(/\D/g, '');
  if (d.length <= 9) return d;
  return d.slice(-9); // 595991816836 o 0995627467 → últimos 9 dígitos
}

function loadSheet(filePath, rangeStart = 0) {
  try {
    const wb = XLSX.readFile(filePath, { cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return [];
    const opts = rangeStart > 0 ? { range: rangeStart } : {};
    return XLSX.utils.sheet_to_json(sheet, opts);
  } catch (e) {
    return [];
  }
}

// 1. Pautas: teléfono en columna "Linea" (sin tilde) - ej. 595991816836
const pautasPath = path.join(DATA_DIR, 'Pautas-ThinkChat-2025-2026.xlsx');
const pautasRaw = loadSheet(pautasPath);
const telsPautas = new Set();
const TEL_COL_PAUTAS = 'Linea';
for (const row of pautasRaw) {
  const raw = row[TEL_COL_PAUTAS];
  if (raw != null && raw !== '') {
    const t = normalizarTel(String(raw));
    if (t.length >= 8) telsPautas.add(t);
  }
}

// 2. Clientes y telefonos: hoja "Consulta1", columna "Número de telefono" - ej. 0995627467
const ctPath = path.join(DATA_DIR, 'Clientes y telefonos.xlsx');
const wbCT = XLSX.readFile(ctPath);
const sheetCT = wbCT.Sheets['Consulta1'] || wbCT.Sheets[wbCT.SheetNames[0]];
const ctRaw = XLSX.utils.sheet_to_json(sheetCT);
if (ctRaw.length === 0) {
  console.log('No se pudo cargar Clientes y telefonos.xlsx');
  process.exit(1);
}

const telsClientesTel = new Set();
const TEL_COL_CT = Object.keys(ctRaw[0] || {}).find((k) => /telefono|tel[eé]fono|phone/i.test(k)) || 'Número de telefono';
for (const row of ctRaw) {
  const raw = row[TEL_COL_CT];
  if (raw != null && raw !== '') {
    const t = normalizarTel(String(raw));
    if (t.length >= 8) telsClientesTel.add(t);
  }
}

const coincidenciasTel = [...telsPautas].filter((t) => t && telsClientesTel.has(t));

console.log('--- Cruce Pautas vs Clientes y telefonos (por teléfono) ---');
console.log('Pautas: columna "Linea" → teléfonos únicos:', telsPautas.size);
console.log('Clientes y telefonos: hoja Consulta1, columna teléfono → únicos:', telsClientesTel.size);
console.log('');
console.log('Coincidencias por teléfono:', coincidenciasTel.length);
console.log('¿Hay coincidencias?', coincidenciasTel.length > 0 ? 'SÍ' : 'NO');
