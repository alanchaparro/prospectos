/**
 * Analiza columnas de Pautas y Clientes y telefonos para identificar teléfonos
 * Uso: node scripts/analizar-columnas.js
 */
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');

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

function pareceTelefono(val) {
  if (val == null || val === '') return false;
  const s = String(val).trim();
  const digitos = s.replace(/\D/g, '');
  return digitos.length >= 8 && digitos.length <= 15 && /^\d+$/.test(digitos);
}

function analizar(nombre, filePath) {
  const raw = loadSheet(filePath);
  if (raw.length === 0) {
    console.log(`${nombre}: sin datos\n`);
    return;
  }
  const cols = Object.keys(raw[0]);
  console.log(`\n=== ${nombre} ===`);
  console.log('Columnas:', cols.join(' | '));
  console.log('Filas:', raw.length);
  console.log('');
  for (const col of cols) {
    const valores = raw.slice(0, 5).map((r) => r[col]).filter((v) => v != null && v !== '');
    const conTelefono = valores.filter(pareceTelefono).length;
    const ejemplos = valores.slice(0, 3).map((v) => String(v).slice(0, 30));
    const sugerencia = conTelefono > 0 || col.toLowerCase().includes('tel') || col.toLowerCase().includes('phone') || col.toLowerCase().includes('cel') || col.toLowerCase().includes('fono') ? ' → POSIBLE TELÉFONO' : '';
    console.log(`  "${col}": ${ejemplos.join(' | ')} ${sugerencia}`);
  }
}

analizar('Pautas-ThinkChat-2025-2026.xlsx', path.join(DATA_DIR, 'Pautas-ThinkChat-2025-2026.xlsx'));
analizar('Clientes y telefonos.xlsx', path.join(DATA_DIR, 'Clientes y telefonos.xlsx'));

// Buscar columna teléfono en Clientes y telefonos (todas las hojas, todas las columnas)
const ctPath = path.join(DATA_DIR, 'Clientes y telefonos.xlsx');
const wb = XLSX.readFile(ctPath);
console.log('\n=== Buscando teléfonos en Clientes y telefonos ===');
for (const sheetName of wb.SheetNames) {
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (json.length === 0) continue;
  const cols = Object.keys(json[0]);
  for (const col of cols) {
    const muestras = json.slice(0, 100).map((r) => r[col]).filter((v) => v != null && v !== '');
    const conFormatoTel = muestras.filter((v) => {
      const d = String(v).replace(/\D/g, '');
      return d.length >= 8 && d.length <= 15;
    });
    if (conFormatoTel.length > 5) {
      console.log(`Hoja "${sheetName}" columna "${col}": ${conFormatoTel.length} de 100 con formato tel. Ejemplos:`, conFormatoTel.slice(0, 3));
    }
  }
}
