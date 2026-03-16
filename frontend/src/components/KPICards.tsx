import type { Funnel1Row } from '../api/types';
import type { Categoria } from './Filters';
import styles from './KPICards.module.css';

interface KPICardsProps {
  data: Funnel1Row[];
  categoria?: Categoria;
}

function sum(rows: Funnel1Row[], key: keyof Funnel1Row): number {
  return rows.reduce(
    (acc, r) => acc + (Number((r as unknown as Record<string, number>)[key]) || 0),
    0
  );
}

export function KPICards({ data, categoria = 'todas' }: KPICardsProps) {
  const safeData = Array.isArray(data) ? data : [];

  const prospectos = sum(safeData, 'prospectos');
  const prospectosAgendados = sum(safeData, 'prospectos_agendados');
  const agendamientos = sum(safeData, 'agendamientos');
  const agendamientosOtras = Math.max(0, agendamientos - prospectosAgendados);
  const presupuestos = sum(safeData, 'presupuestos');
  const presupuestosMeta = sum(safeData, 'presupuestos_de_prospectos');
  const presupuestosOtras = Math.max(0, presupuestos - presupuestosMeta);
  const clientesUnicos = sum(safeData, 'clientes_unicos');
  const clientesUnicosMeta = sum(safeData, 'clientes_unicos_de_prospectos');
  const clientesUnicosOtras = Math.max(0, clientesUnicos - clientesUnicosMeta);

  const pctAgendados = prospectos > 0 ? (prospectosAgendados / prospectos) * 100 : 0;
  const pctPresupuestados = agendamientos > 0 ? (presupuestos / agendamientos) * 100 : 0;
  const pctPresupuestadosOtras = agendamientosOtras > 0 ? (presupuestosOtras / agendamientosOtras) * 100 : 0;
  const pctPresupuestadosMeta = prospectosAgendados > 0 ? (presupuestosMeta / prospectosAgendados) * 100 : 0;
  const pctVentaMeta = clientesUnicos > 0 ? (clientesUnicosMeta / clientesUnicos) * 100 : 0;
  const pctVentaOtras = clientesUnicos > 0 ? (clientesUnicosOtras / clientesUnicos) * 100 : 0;

  if (!safeData.length) {
    return null;
  }

  return (
    <section className={styles.kpiSection}>
      <h2 className={styles.kpiTitle}>KPIs</h2>
      <div className={styles.cards}>
        <div className={styles.card}>
          <div className={styles.cardLabel}>% Prospectos agendados (META)</div>
          <div className={styles.cardValue}>{pctAgendados.toFixed(1)}%</div>
          <div className={styles.cardDetail}>
            {prospectosAgendados.toLocaleString()} de {prospectos.toLocaleString()} prospectos
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>
            % Clientes presupuestados {categoria === 'todas' ? '' : categoria === 'meta' ? '(META)' : '(Otras fuentes)'}
          </div>
          <div className={styles.cardValue}>
            {(categoria === 'otras' ? pctPresupuestadosOtras : categoria === 'meta' ? pctPresupuestadosMeta : pctPresupuestados).toFixed(1)}%
          </div>
          <div className={styles.cardDetail}>
            {categoria === 'otras'
              ? `${presupuestosOtras.toLocaleString()} de ${agendamientosOtras.toLocaleString()} agendados (Otras)`
              : categoria === 'meta'
                ? `${presupuestosMeta.toLocaleString()} de ${prospectosAgendados.toLocaleString()} agendados (META)`
                : `${presupuestos.toLocaleString()} de ${agendamientos.toLocaleString()} agendados`}
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>% Ventas de META (clientes únicos)</div>
          <div className={styles.cardValue}>
            {(categoria === 'otras' ? pctVentaOtras : pctVentaMeta).toFixed(1)}%
          </div>
          <div className={styles.cardDetail}>
            {categoria === 'otras'
              ? `${clientesUnicosOtras.toLocaleString()} de ${clientesUnicos.toLocaleString()} clientes únicos (Otras)`
              : `${clientesUnicosMeta.toLocaleString()} de ${clientesUnicos.toLocaleString()} clientes únicos (META)`}
          </div>
        </div>
      </div>
    </section>
  );
}
