/**
 * Carga datos desde Excel en /data o usa mock para desarrollo.
 * Normaliza filas a: id_prospecto, fecha_contacto | fecha_agendamiento | fecha_presupuesto, fecha_contrato, tiene_contrato
 */
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { findColumnKey, findColumnKeyContains, parseDate } from './config.js';
import { buildMockDatasets } from './mockData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');

function normalizeRow(row, idKeys, dateKeys, fallbackIdSubstrings, fallbackDateSubstrings) {
  let idKey = findColumnKey(row, idKeys);
  if (!idKey && fallbackIdSubstrings) idKey = findColumnKeyContains(row, fallbackIdSubstrings);
  if (!idKey) idKey = Object.keys(row)[0]; // primera columna como último recurso
  const id = idKey && row[idKey] != null ? String(row[idKey]).trim() : null;
  if (!id) return null;

  const out = { id_prospecto: id };
  for (const { key, aliases } of dateKeys) {
    let col = findColumnKey(row, [key, ...(aliases || [])]);
    if (!col && fallbackDateSubstrings) col = findColumnKeyContains(row, fallbackDateSubstrings);
    if (col && row[col] != null) {
      out[key] = row[col];
    }
  }
  return out;
}

/** Carga hoja Excel. rangeStart: fila donde empiezan encabezados (0 = primera fila, 1 = segunda fila por si hay título). */
function loadSheet(filePath, sheetName = 0, rangeStart = 0) {
  try {
    const wb = XLSX.readFile(filePath, { cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[typeof sheetName === 'number' ? sheetName : sheetName]];
    if (!sheet) return [];
    const opts = rangeStart > 0 ? { range: rangeStart } : {};
    return XLSX.utils.sheet_to_json(sheet, opts);
  } catch (e) {
    return [];
  }
}

/** Devuelve true si las claves de la primera fila parecen encabezados de Pautas (fecha, línea, contactos, etc.) */
function looksLikePautasHeader(keys) {
  if (!keys || keys.length === 0) return false;
  const k = keys.join(' ').toLowerCase();
  const hasDate = /fecha|ingreso|date|creacion|alta/.test(k);
  const hasLinea = /linea|línea|producto|categoria|odontolog/.test(k);
  const hasContacto = /contacto/.test(k);
  return hasDate || hasLinea || hasContacto;
}

/** Encuentra la primera columna de la fila cuyo valor parseDate acepte (para no depender del nombre) */
function findAnyDateValue(row) {
  for (const key of Object.keys(row)) {
    const val = row[key];
    if (val == null || val === '') continue;
    const d = parseDate(val);
    if (d && !isNaN(d.getTime())) return d;
  }
  return null;
}

/** Devuelve los encabezados (primera fila) de cada Excel para diagnóstico */
export function getExcelHeaders() {
  const result = { pautas: null, agendamientos: null, presupuestosContratos: null };
  try {
    const pautasPath = path.join(DATA_DIR, 'Pautas-ThinkChat-2025-2026.xlsx');
    const pautasRaw = loadSheet(pautasPath);
    if (pautasRaw.length > 0) result.pautas = Object.keys(pautasRaw[0]);
  } catch (e) {
    result.pautas = { error: e.message };
  }
  try {
    const agePath = path.join(DATA_DIR, 'agendamientos-prospectos.xlsx');
    const ageRaw = loadSheet(agePath);
    if (ageRaw.length > 0) result.agendamientos = Object.keys(ageRaw[0]);
  } catch (e) {
    result.agendamientos = { error: e.message };
  }
  try {
    const presPath = path.join(DATA_DIR, 'Presupuestos y contratos.xlsx');
    const presRaw = loadSheet(presPath);
    if (presRaw.length > 0) result.presupuestosContratos = Object.keys(presRaw[0]);
  } catch (e) {
    result.presupuestosContratos = { error: e.message };
  }
  return result;
}

/** Claves para columna de categoría/producto (Odontología, etc.). No confundir con columna "Linea" que a veces es teléfono. */
const LINEA_KEYS = ['Línea', 'producto', 'Producto', 'categoria', 'Categoría', 'línea', 'linea', 'Linea'];

/** Valor parece categoría (ej. "Odontología") y no número de teléfono */
function looksLikeCategory(val) {
  if (val == null || val === '') return false;
  const s = String(val).trim();
  if (s.length > 15) return false;
  return /\p{L}/u.test(s) || s.length < 10;
}

/** Dado raw, elige la columna que contiene la categoría (Odontología, etc.), no la que tiene solo números (teléfono). */
function resolveLineaColumn(raw) {
  if (!raw || raw.length === 0) return null;
  const first = raw[0];
  const candidates = [];
  for (const key of Object.keys(first)) {
    const k = key.toLowerCase();
    if (/línea|linea|producto|categoria|odontolog/.test(k)) candidates.push(key);
  }
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  let best = null;
  let bestScore = -1;
  const sample = raw.slice(0, Math.min(500, raw.length));
  for (const col of candidates) {
    let categoryLike = 0;
    for (const row of sample) {
      const v = row[col];
      if (v != null && v !== '' && looksLikeCategory(v)) categoryLike++;
    }
    if (categoryLike > bestScore) {
      bestScore = categoryLike;
      best = col;
    }
  }
  return best || candidates[0];
}

/** Nombres de columnas que pueden contener la fecha de ingreso/contacto. */
const DATE_COL_SUBSTRINGS = /fecha|ingreso|date|creacion|alta|fech|ultimo|último/i;

/** Para una fila, obtiene la primera fecha válida probando columnas de fecha y luego cualquier columna. */
function getFechaFromRow(row, dateColumnNames) {
  for (const col of dateColumnNames) {
    const val = row[col];
    if (val == null && val === '') continue;
    const d = parseDate(val);
    if (d && !isNaN(d.getTime())) return d;
  }
  return findAnyDateValue(row);
}

/** Normalizar teléfono para cruce (últimos 9 dígitos). */
function normalizarTelefono(t) {
  if (!t) return '';
  const d = String(t).replace(/\D/g, '');
  if (d.length <= 9) return d;
  return d.slice(-9);
}

/** Columna teléfono en Pautas: "Linea" (sin tilde) = 595...; "Línea" (con tilde) = categoría. */
function findTelefonoColPautas(raw, lineaColResolved) {
  const firstRow = raw[0];
  if (!firstRow) return null;
  const keys = Object.keys(firstRow);
  const lineaLike = keys.filter((k) => /^l[ií]nea$/i.test(k.trim()));
  if (lineaLike.length >= 2) {
    const other = lineaLike.find((k) => k !== lineaColResolved);
    if (other) return other;
  }
  if (lineaLike.length === 1 && lineaColResolved !== lineaLike[0]) {
    const col = lineaLike[0];
    const sample = raw.slice(0, 50).filter((r) => r[col] != null && String(r[col]).replace(/\D/g, '').length >= 8);
    if (sample.length > 10) return col;
  }
  const byName = findColumnKey(firstRow, ['telefono', 'teléfono', 'phone', 'celular', 'Linea']) || findColumnKeyContains(firstRow, ['telefono', 'tel', 'phone', 'celular']);
  if (byName && byName !== lineaColResolved) return byName;
  for (const k of keys) {
    if (k === lineaColResolved) continue;
    const sample = raw.slice(0, 100).filter((r) => r[k] != null && String(r[k]).replace(/\D/g, '').length >= 8);
    if (sample.length >= 20) return k;
  }
  return null;
}

/** Procesa raw (array de objetos fila) y devuelve filas normalizadas; usado para elegir mejor (hoja, range). */
function processPautasRaw(raw) {
  if (!raw || raw.length === 0) return [];
  const dateKeys = [{ key: 'fecha_contacto', aliases: ['fecha', 'fecha_alta', 'fecha_contacto', 'Fecha', 'fecha de ingreso', 'fecha_ingreso', 'fecha ingreso', 'Fecha de ingreso', 'fecha_de_ingreso', 'Fecha de Ingreso', 'ingreso', 'fecha_creacion', 'Fech', 'Último Est', 'ultimo', 'Fech'] }];
  const fallbackDate = ['fecha', 'ingreso', 'date', 'creacion', 'alta', 'fech', 'ultimo'];
  const lineaColResolved = resolveLineaColumn(raw);
  const telefonoCol = findTelefonoColPautas(raw, lineaColResolved);
  const firstRow = raw[0];
  let dateColumnNames = Object.keys(firstRow).filter((k) => DATE_COL_SUBSTRINGS.test(String(k)));
  if (dateColumnNames.length === 0) dateColumnNames = Object.keys(firstRow);
  return raw
    .map((row, i) => {
      const lineaCol = lineaColResolved || findColumnKey(row, LINEA_KEYS) || findColumnKeyContains(row, ['producto', 'categoria', 'odontolog', 'Línea', 'línea', 'linea']);
      const lineaVal = lineaCol && row[lineaCol] != null ? String(row[lineaCol]).trim() : null;
      let fecha_contacto = getFechaFromRow(row, dateColumnNames);
      if (!fecha_contacto || isNaN(fecha_contacto.getTime())) return null;
      const r = { id_prospecto: `fila_${i}`, fecha_contacto };
      if (lineaVal) r.linea = lineaVal;
      if (telefonoCol && row[telefonoCol] != null && row[telefonoCol] !== '') {
        const tel = normalizarTelefono(String(row[telefonoCol]));
        if (tel.length >= 8) r.telefono = tel;
      }
      if (!r.telefono) {
        for (const [col, v] of Object.entries(row)) {
          if (v == null || v === '') continue;
          const d = String(v).replace(/\D/g, '');
          if (d.length < 8 || d.length > 15) continue;
          if (/fecha|date|meta|id|#/i.test(col)) continue;
          const tel = normalizarTelefono(String(v));
          if (tel.length >= 8) {
            r.telefono = tel;
            break;
          }
        }
      }
      return r;
    })
    .filter(Boolean)
    .map((r) => ({
      ...r,
      fecha_contacto: r.fecha_contacto instanceof Date ? r.fecha_contacto : parseDate(r.fecha_contacto) || (r.fecha_contacto && new Date(r.fecha_contacto)),
    }))
    .filter((r) => r.fecha_contacto && !isNaN(r.fecha_contacto.getTime()));
}

export function loadPautas() {
  const filePath = path.join(DATA_DIR, 'Pautas-ThinkChat-2025-2026.xlsx');
  let raw = loadSheet(filePath, 0, 0);
  if (raw.length > 0 && !looksLikePautasHeader(Object.keys(raw[0]))) {
    const withRange1 = loadSheet(filePath, 0, 1);
    if (withRange1.length > 0) raw = withRange1;
  }
  if (raw.length === 0) {
    for (let s = 1; s <= 5; s++) {
      const other = loadSheet(filePath, s, 0);
      if (other.length > 0) {
        if (looksLikePautasHeader(Object.keys(other[0]))) { raw = other; break; }
        const other1 = loadSheet(filePath, s, 1);
        if (other1.length > 0) { raw = other1; break; }
      }
    }
  }
  if (raw.length === 0) return null;
  // Cada fila con fecha válida = 1 contacto (id_prospecto = fila_i). No exigir columna ID para no perder filas.
  const rows = processPautasRaw(raw);
  return rows.length > 0 ? rows : null;
}

/** Columnas que pueden indicar el estado del agendamiento (solo usamos "atendidos"/"Atendido") */
const AGENDAMIENTO_ESTADO_KEYS = ['status_nombre', 'status', 'estado', 'Estado', 'estado agendamiento'];

/** Columna "unidad de negocio" = Línea en la web (en el Excel suele ser "unidad" con valores ODONTOL, etc.) */
const AGENDAMIENTO_LINEA_KEYS = ['unidad', 'unidad de negocio', 'Unidad de negocio', 'linea', 'Línea', 'línea'];

/** Unificar valores de unidad de negocio con los nombres de Línea que vienen de Pautas (para que el filtro coincida) */
function normalizarLineaAgendamiento(val) {
  if (!val || typeof val !== 'string') return val;
  const s = val.trim().toUpperCase();
  if (s === 'ODONTOL' || s === 'ODONTOLOGIA') return 'Odontologia';
  if (s === 'EPEM') return 'Epem';
  return val.trim();
}

/** True si el valor indica "atendidos" (solo esos se cargan). Acepta variantes. */
function esEstadoAtendido(val) {
  if (val == null || val === '') return false;
  const s = String(val).trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  return s === 'atendidos' || s === 'atendido' || /atendido/.test(s) || /asistido/.test(s) || s === 'atendida' || s === 'atendidas';
}

/** Devuelve la columna estado, o null (ej. status_nombre con valor "Atendido") */
function findEstadoColumn(row) {
  return findColumnKey(row, AGENDAMIENTO_ESTADO_KEYS) || findColumnKeyContains(row, ['estado', 'status']);
}

/** Columna que indica si es prospecto (prospe = SI en el Excel); solo esos entran en el embudo. */
const AGENDAMIENTO_PROSPECTO_KEYS = ['prospe', 'prospecto', 'es prospecto', 'prospecto_sn', 'es_prospecto'];

/** True si el valor indica que es prospecto (SI, Sí, Yes, 1, etc.) */
function esProspectoAgendamiento(val) {
  if (val == null && val !== 0) return false;
  const s = String(val).trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  return s === 'si' || s === 'sí' || s === 'yes' || s === '1' || s === 'true' || s === 's';
}

function findProspectoAgendamientoColumn(row) {
  return findColumnKey(row, AGENDAMIENTO_PROSPECTO_KEYS) || findColumnKeyContains(row, ['prospe', 'prospecto']);
}

/** Devuelve la columna unidad de negocio (Línea), o null */
function findUnidadNegocioColumn(row) {
  return findColumnKey(row, AGENDAMIENTO_LINEA_KEYS) || findColumnKeyContains(row, ['unidad', 'negocio', 'linea', 'línea']);
}

export function loadAgendamientos() {
  const filePath = path.join(DATA_DIR, 'agendamientos-prospectos.xlsx');
  const raw = loadSheet(filePath);
  if (raw.length === 0) return null;
  const idKeys = ['client_i', 'client_id', 'id_prospecto', 'email', 'telefono', 'id', 'contacto', 'agenda'];
  const dateKeys = [{ key: 'fecha_agendamiento', aliases: ['fecha_agendamien', 'fecha_agendamiento', 'fecha', 'fecha_turno', 'fecha de agendamiento', 'Fecha', 'fecha agendamiento'] }];
  const fallbackId = ['client', 'id', 'email', 'mail', 'telefono', 'celular', 'whatsapp', 'contacto', 'agenda'];
  const fallbackDate = ['fecha_agendam', 'fecha', 'turno', 'agendamiento', 'date'];
  const estadoCol = findEstadoColumn(raw[0]);
  const prospectoCol = findProspectoAgendamientoColumn(raw[0]);
  const unidadCol = findUnidadNegocioColumn(raw[0]);
  let filteredRaw = raw;
  if (estadoCol) {
    filteredRaw = filteredRaw.filter((row) => esEstadoAtendido(row[estadoCol]));
    if (filteredRaw.length === 0) filteredRaw = raw;
  }
  if (prospectoCol) {
    filteredRaw = filteredRaw.filter((row) => esProspectoAgendamiento(row[prospectoCol]));
  }
  return filteredRaw
    .map((row, i) => {
      let r = normalizeRow(row, idKeys, dateKeys, fallbackId, fallbackDate);
      if (!r) {
        const dateVal = findColumnKey(row, [dateKeys[0].key, ...dateKeys[0].aliases]) || findColumnKeyContains(row, fallbackDate);
        const fecha = dateVal ? parseDate(row[dateVal]) : findAnyDateValue(row);
        if (!fecha || isNaN(fecha.getTime())) return null;
        const idCol = findColumnKey(row, idKeys) || findColumnKeyContains(row, fallbackId) || Object.keys(row)[0];
        const id = idCol && row[idCol] != null ? String(row[idCol]).trim() : null;
        r = { id_prospecto: id || `ag_${i}`, fecha_agendamiento: fecha };
      }
      const fecha_agendamiento = r.fecha_agendamiento instanceof Date ? r.fecha_agendamiento : parseDate(r.fecha_agendamiento) || (r.fecha_agendamiento && new Date(r.fecha_agendamiento));
      if (!fecha_agendamiento || isNaN(fecha_agendamiento.getTime())) return null;
      const lineaVal = unidadCol && row[unidadCol] != null ? normalizarLineaAgendamiento(String(row[unidadCol])) : null;
      return {
        ...r,
        fecha_agendamiento,
        ...(lineaVal ? { linea: lineaVal } : {}),
      };
    })
    .filter(Boolean);
}

/** Columnas estado en Presupuestos. Solo se usan presupuestos con status 5, 10 o 15. */
const PRESUPUESTO_ESTADO_KEYS = ['estado', 'Estado', 'status', 'estado_id', 'id_estado'];
const PRESUPUESTO_ESTADOS_VALIDOS = new Set([5, 10, 15]);

function findPresupuestoEstadoColumn(row) {
  return findColumnKey(row, PRESUPUESTO_ESTADO_KEYS) || findColumnKeyContains(row, ['estado', 'status']);
}

/** True si el estado es uno de los válidos para presupuestos (5, 10, 15) */
function esEstadoPresupuestoValido(val) {
  if (val == null && val !== 0) return false;
  const n = Number(val);
  if (!Number.isNaN(n)) return PRESUPUESTO_ESTADOS_VALIDOS.has(n);
  const s = String(val).trim();
  return s === '5' || s === '10' || s === '15';
}

/** Para comparar con agendamientos: mismo id en ambos (ej. 253642). Priorizar columnas de cliente. */
const PRESUPUESTO_ID_KEYS = ['client_id', 'client_i', 'id_cliente', 'id_prospecto', 'email', 'telefono', 'id'];
const PRESUPUESTO_ID_FALLBACK = ['client_id', 'client_i', 'id_cliente', 'client', 'cliente'];

export function loadPresupuestosContratos() {
  const filePath = path.join(DATA_DIR, 'Presupuestos y contratos.xlsx');
  const raw = loadSheet(filePath);
  if (raw.length === 0) return null;
  const idKeys = PRESUPUESTO_ID_KEYS;
  const dateKeys = [
    { key: 'fecha_presupuesto', aliases: ['fecha_presupuesto', 'fecha presupuesto', 'fecha', 'Fecha'] },
    { key: 'fecha_contrato', aliases: ['fecha_contrato', 'fecha_firma', 'Fecha contrato'] },
  ];
  const estadoCol = findPresupuestoEstadoColumn(raw[0]);
  let rawFiltrado = estadoCol ? raw.filter((row) => esEstadoPresupuestoValido(row[estadoCol])) : raw;
  if (rawFiltrado.length === 0 && estadoCol) rawFiltrado = raw;
  const rows = rawFiltrado.map((row) => {
    const r = normalizeRow(row, idKeys, dateKeys, PRESUPUESTO_ID_FALLBACK, ['fecha', 'presupuesto', 'contrato']);
    if (!r) return null;
    const contratoCol = findColumnKey(row, ['tiene_contrato', 'contrato', 'firmado']);
    r.tiene_contrato = contratoCol ? String(row[contratoCol] || '').toLowerCase().includes('sí') || String(row[contratoCol] || '').toLowerCase().includes('si') : !!r.fecha_contrato;
    r.fecha_presupuesto = r.fecha_presupuesto instanceof Date ? r.fecha_presupuesto : parseDate(r.fecha_presupuesto) || (r.fecha_presupuesto && new Date(r.fecha_presupuesto));
    r.fecha_contrato = r.fecha_contrato instanceof Date ? r.fecha_contrato : parseDate(r.fecha_contrato) || (r.fecha_contrato && new Date(r.fecha_contrato));
    return r;
  }).filter(Boolean);
  return rows;
}

/** Normalizar unidad de negocio de clientes (ODONTOL, ODONTOLOGI SI -> Odontologia, etc.) */
function normalizarLineaCliente(val) {
  if (!val || typeof val !== 'string') return val ? String(val).trim() : null;
  const s = val.trim().toUpperCase();
  if (s === 'ODONTOL' || s === 'ODONTOLOGIA' || s === 'ODONTOLOGI SI' || s.startsWith('ODONTOLOGI')) return 'Odontologia';
  if (s === 'EPEM') return 'Epem';
  return val.trim();
}

/** Id canónico (253642, "253642", "253642.0" → mismo id para no duplicar) */
function idClienteCanonicoLoad(val) {
  if (val == null && val !== 0) return '';
  const s = String(val).trim();
  const n = Number(s);
  if (Number.isFinite(n)) return String(Math.floor(n));
  return s;
}

/** Normalizar texto para comparar "Confirmado" / "CONFIRMADO" */
function normalizarControlCalidad(val) {
  if (val == null || val === '') return '';
  return String(val).trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/** Carga clientes.xlsx: id, contract_date, tiene_contrato, unidad de negocio, estado de control de calidad. */
export function loadClientes() {
  const filePath = path.join(DATA_DIR, 'clientes.xlsx');
  const raw = loadSheet(filePath);
  if (raw.length === 0) return null;
  const first = raw[0];
  const idCol = findColumnKey(first, ['id', 'id_cliente', 'client_id', 'client_i']) || findColumnKeyContains(first, ['id', 'client']);
  const contractDateCol = findColumnKey(first, ['contract_date', 'fecha_contrato', 'fecha contrato']) || findColumnKeyContains(first, ['contract_date', 'contract', 'fecha_contrato', 'fecha contrato']);
  const tieneContratoCol = findColumnKey(first, ['tiene_contrato', 'tiene contrato', 'contrato', 'si tiene contrato']) || findColumnKeyContains(first, ['contrato', 'tiene_contrato', 'contract']);
  const unidadCol = findColumnKey(first, ['unidad de negocio', 'unidad_neg', 'unidad', 'Unidad de negocio']) || findColumnKeyContains(first, ['unidad', 'negocio', 'linea', 'línea']);
  const controlCalidadCol = findColumnKey(first, ['estado de control de calidad', 'estado_control', 'estado control calidad']) || findColumnKeyContains(first, ['control de calidad', 'control calidad', 'estado control', 'estado_control']);
  const tipoClienteCol = findColumnKey(first, ['tipo de cliente', 'tipo_cli', 'tipo cliente']) || findColumnKeyContains(first, ['tipo cliente', 'tipo_cliente', 'tipo_cli']);
  return raw.map((row) => {
    const idRaw = idCol != null && row[idCol] != null ? String(row[idCol]).trim() : null;
    if (!idRaw) return null;
    const id = idClienteCanonicoLoad(idRaw);
    const contractDateVal = contractDateCol ? row[contractDateCol] : null;
    const contract_date = contractDateVal ? (parseDate(contractDateVal) || (contractDateVal instanceof Date ? contractDateVal : null)) : null;
    const tieneContratoVal = tieneContratoCol ? row[tieneContratoCol] : null;
    const v = String(tieneContratoVal ?? '').trim();
    const tiene_contrato = v !== '' && /^s[ií]$|^yes$|^1$|^true$/i.test(v);
    const unidadVal = unidadCol && row[unidadCol] != null ? normalizarLineaCliente(String(row[unidadCol])) : null;
    const controlCalidadVal = controlCalidadCol && row[controlCalidadCol] != null ? String(row[controlCalidadCol]).trim() : '';
    const control_calidad_confirmado = controlCalidadCol
      ? normalizarControlCalidad(controlCalidadVal) === 'confirmado'
      : true;
    const tipoClienteVal = tipoClienteCol && row[tipoClienteCol] != null ? String(row[tipoClienteCol]).trim() : '';
    const es_titular = tipoClienteCol ? normalizarControlCalidad(tipoClienteVal) === 'titular' : true;
    return {
      id,
      contract_date: contract_date && !isNaN(contract_date.getTime()) ? contract_date : null,
      tiene_contrato: !!tiene_contrato,
      linea: unidadVal || null,
      control_calidad_confirmado,
      es_titular,
    };
  }).filter((c) => c && c.id);
}

/** Cliente_id -> Set de teléfonos normalizados (un cliente puede tener varios). */
export function loadClientesYTelefonos() {
  const filePath = path.join(DATA_DIR, 'Clientes y telefonos.xlsx');
  try {
    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets['Consulta1'] || wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet);
    if (raw.length === 0) return null;
    const first = raw[0];
    const idCol = Object.keys(first).find((k) => /cliente_id|id/i.test(k)) || 'Cliente_id';
    const telCol = Object.keys(first).find((k) => /telefono|tel[eé]fono|phone/i.test(k)) || 'Número de telefono';
    const map = new Map();
    for (const row of raw) {
      const idRaw = row[idCol] != null ? String(row[idCol]).trim() : '';
      const id = idRaw ? idClienteCanonicoLoad(idRaw) : '';
      const tel = row[telCol] != null ? normalizarTelefono(String(row[telCol])) : '';
      if (id && tel.length >= 8) {
        if (!map.has(id)) map.set(id, new Set());
        map.get(id).add(tel);
      }
    }
    return map.size ? map : null;
  } catch (e) {
    return null;
  }
}

let cached = null;
let useMock = null;

export function getDatasets() {
  if (cached) return cached;
  const pautas = loadPautas();
  const agendamientos = loadAgendamientos();
  const presupuestosContratos = loadPresupuestosContratos();
  const clientes = loadClientes();
  const clientesYTelefonos = loadClientesYTelefonos();
  const hasPautas = pautas && pautas.length > 0;
  const hasAgendamientos = agendamientos && agendamientos.length > 0;
  const hasPresupuestos = presupuestosContratos && presupuestosContratos.length > 0;
  if (hasPautas) {
    useMock = false;
    cached = {
      pautas,
      agendamientos: agendamientos || [],
      presupuestosContratos: presupuestosContratos || [],
      clientes: clientes || [],
      clientesYTelefonos: clientesYTelefonos || null,
    };
    return cached;
  }
  useMock = true;
  cached = buildMockDatasets();
  // Normalizar fechas en mock (vienen como string yyyy-MM-dd)
  cached.pautas = cached.pautas.map((p) => ({ ...p, fecha_contacto: new Date(p.fecha_contacto) }));
  cached.agendamientos = cached.agendamientos.map((a) => ({ ...a, fecha_agendamiento: new Date(a.fecha_agendamiento) }));
  cached.presupuestosContratos = cached.presupuestosContratos.map((p) => ({
    ...p,
    fecha_presupuesto: p.fecha_presupuesto ? new Date(p.fecha_presupuesto) : null,
    fecha_contrato: p.fecha_contrato ? new Date(p.fecha_contrato) : null,
  }));
  return cached;
}

export function isUsingMock() {
  if (useMock === null) getDatasets();
  return useMock;
}

/** Fuerza recarga de datos en la próxima petición (útil al reemplazar Excel) */
export function clearCache() {
  cached = null;
  useMock = null;
}
