import { useState, useEffect, useCallback } from 'react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { Filters, type Categoria } from './components/Filters';
import { Funnel1View } from './components/Funnel1View';
import { KPICards } from './components/KPICards';
import { LoadingOverlay } from './components/LoadingOverlay';
import { fetchFunnel1, fetchLineas, healthCheck } from './api/client';
import type { Granularity, Funnel1Row } from './api/types';

const defaultTo = format(new Date(), 'yyyy-MM-dd');
const defaultFrom = format(subMonths(new Date(), 6), 'yyyy-MM-dd');

export default function App() {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [mesAnio, setMesAnio] = useState('');
  const [categoria, setCategoria] = useState<Categoria>('todas');
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [linea, setLinea] = useState('');
  const [lineas, setLineas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mock, setMock] = useState<boolean | null>(null);
  const [funnel1, setFunnel1] = useState<Funnel1Row[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let effectiveFrom = from;
    let effectiveTo = to;
    if (mesAnio && /^\d{4}-\d{2}$/.test(mesAnio)) {
      const [y, m] = mesAnio.split('-').map(Number);
      const d = new Date(y, m - 1, 1);
      effectiveFrom = format(startOfMonth(d), 'yyyy-MM-dd');
      effectiveTo = format(endOfMonth(d), 'yyyy-MM-dd');
    }
    try {
      const r1 = await fetchFunnel1(effectiveFrom, effectiveTo, granularity, linea || undefined);
      setFunnel1(Array.isArray(r1?.data) ? r1.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar datos');
      setFunnel1([]);
    } finally {
      setLoading(false);
    }
  }, [from, to, mesAnio, granularity, linea]);

  useEffect(() => {
    healthCheck()
      .then((r) => setMock(r.mock ?? false))
      .catch(() => setMock(false));
    fetchLineas()
      .then((r) => setLineas(r.lineas || []))
      .catch(() => setLineas([]));
  }, []);

  // Carga inicial solo al montar; el resto de veces se aplica al hacer clic en "Aplicar"
  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>
          Embudo de ventas
        </h1>
        {mock !== null && (
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {mock ? 'Usando datos de prueba (mock). Coloca los Excel en /data para datos reales.' : 'Datos cargados desde Excel en /data'}
          </p>
        )}
      </header>

      <Filters
        from={from}
        to={to}
        mesAnio={mesAnio}
        categoria={categoria}
        onMesAnioChange={setMesAnio}
        onCategoriaChange={setCategoria}
        granularity={granularity}
        linea={linea}
        lineas={lineas}
        onFromChange={setFrom}
        onToChange={setTo}
        onGranularityChange={setGranularity}
        onLineaChange={setLinea}
        onApply={load}
        loading={loading}
      />

      {error && (
        <div
          style={{
            padding: '1rem',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 'var(--radius)',
            marginBottom: '1rem',
            color: '#fca5a5',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <LoadingOverlay message="Cargando datos del embudo…" />
      ) : (
        <>
          <KPICards data={funnel1} categoria={categoria} />
          <Funnel1View data={funnel1} categoria={categoria} />
        </>
      )}
    </div>
  );
}
