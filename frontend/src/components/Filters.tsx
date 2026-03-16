import type { Granularity } from '../api/types';
import styles from './Filters.module.css';

/** Nombres mostrados para valores de Línea (el valor enviado al API no cambia). */
const LINEA_DISPLAY_NAMES: Record<string, string> = {
  Epem: 'MEDICINA ESTETICA',
};

const MESES_NOMBRES: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril', 5: 'Mayo', 6: 'Junio',
  7: 'Julio', 8: 'Agosto', 9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
};

const currentYear = new Date().getFullYear();
const MES_ANIO_OPCIONES: { value: string; label: string }[] = (() => {
  const out: { value: string; label: string }[] = [{ value: '', label: '— Mes / Año —' }];
  for (let y = currentYear - 2; y <= currentYear + 1; y++) {
    for (let m = 1; m <= 12; m++) {
      const value = `${y}-${String(m).padStart(2, '0')}`;
      out.push({ value, label: `${MESES_NOMBRES[m]} ${y}` });
    }
  }
  return out;
})();

function getLineaDisplayName(value: string): string {
  return LINEA_DISPLAY_NAMES[value] ?? value;
}

export type Categoria = 'todas' | 'meta' | 'otras';

interface FiltersProps {
  from: string;
  to: string;
  mesAnio: string;
  categoria: Categoria;
  onMesAnioChange: (v: string) => void;
  onCategoriaChange: (v: Categoria) => void;
  granularity: Granularity;
  linea: string;
  lineas: string[];
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onGranularityChange: (v: Granularity) => void;
  onLineaChange: (v: string) => void;
  onApply: () => void;
  loading?: boolean;
}

export function Filters({
  from,
  to,
  mesAnio,
  categoria,
  onMesAnioChange,
  onCategoriaChange,
  granularity,
  linea,
  lineas,
  onFromChange,
  onToChange,
  onGranularityChange,
  onLineaChange,
  onApply,
  loading,
}: FiltersProps) {
  return (
    <section className={styles.filters}>
      <div className={styles.row}>
        <label>
          <span>Categoría</span>
          <select
            value={categoria}
            onChange={(e) => onCategoriaChange(e.target.value as Categoria)}
          >
            <option value="todas">Todas</option>
            <option value="meta">META (prospectos)</option>
            <option value="otras">Otras fuentes</option>
          </select>
        </label>
        <label>
          <span>Línea</span>
          <select
            value={linea}
            onChange={(e) => onLineaChange(e.target.value)}
          >
            <option value="">Todas</option>
            {lineas.map((l) => (
              <option key={l} value={l}>{getLineaDisplayName(l)}</option>
            ))}
          </select>
        </label>
        <label className={styles.mesAnioLabel}>
          <span>Mes / Año</span>
          <select
            value={mesAnio}
            onChange={(e) => onMesAnioChange(e.target.value)}
          >
            {MES_ANIO_OPCIONES.map((opt) => (
              <option key={opt.value || 'empty'} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Desde</span>
          <input
            type="date"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
          />
        </label>
        <label>
          <span>Hasta</span>
          <input
            type="date"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
          />
        </label>
        <label>
          <span>Agrupar por</span>
          <select
            value={granularity}
            onChange={(e) => onGranularityChange(e.target.value as Granularity)}
          >
            <option value="day">Día</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
          </select>
        </label>
        <button type="button" onClick={onApply} disabled={loading} className={styles.applyBtn}>
          {loading && <span className={styles.btnSpinner} aria-hidden />}
          {loading ? 'Cargando…' : 'Aplicar'}
        </button>
      </div>
    </section>
  );
}
