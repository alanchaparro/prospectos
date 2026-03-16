/**
 * Configuración y mapeo de columnas esperadas en los Excel.
 * Ajustar nombres según las columnas reales de cada archivo.
 */
export const EXCEL_FILES = {
  pautas: {
    file: 'Pautas-ThinkChat-2025-2026.xlsx',
    idKeys: ['id_prospecto', 'email', 'telefono', 'id'], // primera que exista
    dateKey: 'fecha_contacto',
    dateAliases: ['fecha', 'fecha_alta', 'fecha_contacto', 'Fecha'],
  },
  agendamientos: {
    file: 'agendamientos-prospectos.xlsx',
    idKeys: ['id_prospecto', 'email', 'telefono', 'id'],
    dateKey: 'fecha_agendamiento',
    dateAliases: ['fecha', 'fecha_turno', 'fecha_agendamiento', 'Fecha'],
  },
  presupuestosContratos: {
    file: 'Presupuestos y contratos.xlsx',
    idKeys: ['id_prospecto', 'id_cliente', 'email', 'telefono', 'id'],
    datePresupuesto: 'fecha_presupuesto',
    dateContrato: 'fecha_contrato',
    dateAliases: ['fecha', 'fecha_presupuesto', 'fecha_contrato', 'Fecha'],
    contratoKey: 'tiene_contrato',
    contratoAliases: ['tiene_contrato', 'contrato', 'firmado', 'estado'],
  },
};

/** Normalizar clave de objeto: primera que coincida (case-insensitive) */
export function findColumnKey(row, keys) {
  const lower = (s) => String(s || '').trim().toLowerCase();
  const rowKeys = Object.keys(row).map(lower);
  for (const k of keys) {
    const idx = rowKeys.findIndex((r) => r === lower(k));
    if (idx >= 0) return Object.keys(row)[idx];
  }
  return null;
}

/** Buscar columna cuyo nombre contenga alguna de las subcadenas (flexible para Excel con nombres variables) */
export function findColumnKeyContains(row, substrings) {
  if (!Array.isArray(substrings) || substrings.length === 0) return null;
  const lower = (s) => String(s || '').trim().toLowerCase();
  const keys = Object.keys(row);
  for (const sub of substrings) {
    const found = keys.find((k) => lower(k).includes(lower(sub)));
    if (found) return found;
  }
  return null;
}

const MESES_ES = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };

/** Obtener valor de fecha desde celda Excel (número de serie o string) */
export function parseDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    // Excel serial: días desde 1900-01-01; interpretar en hora local para coincidir con Excel
    const dayNum = Math.floor(value);
    const frac = value - dayNum;
    const d = new Date(1900, 0, dayNum);
    if (frac > 0 && frac < 1) d.setMilliseconds(d.getMilliseconds() + frac * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(value).trim();
  // YYYY-MM-DD HH:mm:ss o YYYY-MM-DD (fecha de agendamiento desde Excel)
  const iso = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (iso) {
    const year = parseInt(iso[1], 10);
    const month = parseInt(iso[2], 10) - 1;
    const day = parseInt(iso[3], 10);
    const h = iso[4] != null ? parseInt(iso[4], 10) : 0;
    const m = iso[5] != null ? parseInt(iso[5], 10) : 0;
    const sec = iso[6] != null ? parseInt(iso[6], 10) : 0;
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const d = new Date(year, month, day, h, m, sec);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  const match = s.match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s*(\d{4})/i);
  if (match) {
    const mes = MESES_ES[match[1].toLowerCase()];
    const anio = parseInt(match[2], 10);
    if (mes != null && anio) {
      const d = new Date(anio, mes, 1);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  // DD/MM/YYYY o D/M/YYYY (común en Excel latino)
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10) - 1;
    const year = parseInt(dmy[3], 10);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  // Fecha embebida en texto (ej. "Gestionado p 01/02/2026" o "Chat abandor 02/01")
  const embedded = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (embedded) {
    const day = parseInt(embedded[1], 10);
    const month = parseInt(embedded[2], 10) - 1;
    let year = parseInt(embedded[3], 10);
    if (year < 100) year += year < 50 ? 2000 : 1900;
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}
