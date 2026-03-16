import express from 'express';
import cors from 'cors';
import { getDatasets, isUsingMock, clearCache, getExcelHeaders } from './loadData.js';
import { computeFunnel1 } from './funnel1.js';
import { computeFunnel2 } from './funnel2.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Carga de datos en segundo plano para no bloquear el arranque (evita 502 con Excel grandes)
let dataReady = null;
function waitData() {
  if (!dataReady) {
    dataReady = new Promise((resolve) => {
      setImmediate(() => {
        try {
          getDatasets();
          console.log('Datos cargados. Origen:', isUsingMock() ? 'MOCK' : 'Excel en /data');
        } catch (err) {
          console.error('Error al cargar datos, se usará mock:', err.message);
          clearCache();
          getDatasets();
        }
        resolve();
      });
    });
  }
  return dataReady;
}

app.get('/api/health', async (req, res) => {
  await waitData();
  res.json({ ok: true, mock: isUsingMock() });
});

/** Diagnóstico: columnas que ve el backend en cada Excel */
app.get('/api/debug/headers', (req, res) => {
  try {
    const headers = getExcelHeaders();
    res.json(headers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/** Verificar conteo de contratos (mismo criterio que funnel): from, to, linea */
app.get('/api/debug/contratos', async (req, res) => {
  try {
    await waitData();
    const from = req.query.from || '2026-02-01';
    const to = req.query.to || '2026-02-28';
    const linea = req.query.linea ? String(req.query.linea).trim() : undefined;
    const data = getDatasets();
    const result = computeFunnel1(data, { from, to, granularity: 'month', linea });
    const periodKey = from.slice(0, 7); // 2026-02
    const row = result.find((r) => r.period === periodKey);
    res.json({
      from,
      to,
      linea: linea || 'todas',
      period: periodKey,
      contratos: row ? row.contratos : 0,
      dataPeriods: result.map((r) => ({ period: r.period, contratos: r.contratos })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Los demás endpoints ya llaman getDatasets() que usa la caché; asegurar que la carga haya arrancado
app.get('/api/lineas', async (req, res) => {
  try {
    await waitData();
    const data = getDatasets();
    const lineas = [...new Set(data.pautas.map((p) => p.linea).filter(Boolean))].sort();
    res.json({ lineas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/funnel1', async (req, res) => {
  try {
    await waitData();
    const from = req.query.from;
    const to = req.query.to;
    const granularity = (req.query.granularity || 'month').toLowerCase();
    const linea = req.query.linea ? String(req.query.linea).trim() : undefined;
    if (!from || !to) {
      return res.status(400).json({ error: 'Faltan parámetros: from, to (YYYY-MM-DD)' });
    }
    if (!['day', 'week', 'month'].includes(granularity)) {
      return res.status(400).json({ error: 'granularity debe ser day, week o month' });
    }
    const data = getDatasets();
    const result = computeFunnel1(data, { from, to, granularity, linea });
    res.json({ granularity, linea: linea || null, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/funnel2', async (req, res) => {
  try {
    await waitData();
    const from = req.query.from;
    const to = req.query.to;
    const granularity = (req.query.granularity || 'month').toLowerCase();
    const linea = req.query.linea ? String(req.query.linea).trim() : undefined;
    if (!from || !to) {
      return res.status(400).json({ error: 'Faltan parámetros: from, to (YYYY-MM-DD)' });
    }
    if (!['day', 'week', 'month'].includes(granularity)) {
      return res.status(400).json({ error: 'granularity debe ser day, week o month' });
    }
    const data = getDatasets();
    const result = computeFunnel2(data, { from, to, granularity, linea });
    res.json({ granularity, linea: linea || null, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/** Fuerza recarga de Excel (llamar tras actualizar archivos en /data) */
app.post('/api/reload', async (req, res) => {
  try {
    clearCache();
    dataReady = null;
    await waitData();
    res.json({ ok: true, mock: isUsingMock() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API embudo de ventas en http://0.0.0.0:${PORT}`);
});
