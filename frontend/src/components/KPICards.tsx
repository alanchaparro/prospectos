import type { Funnel1Row } from '../api/types';
import styles from './KPICards.module.css';

interface KPICardsProps {
  data: Funnel1Row[];
}

function sum(rows: Funnel1Row[], key: keyof Funnel1Row): number {
  return rows.reduce(
    (acc, r) => acc + (Number((r as unknown as Record<string, number>)[key]) || 0),
    0
  );
}

export function KPICards({ data }: KPICardsProps) {
  const safeData = Array.isArray(data) ? data : [];

  if (!safeData.length) {
    return null;
  }

  const prospectos = sum(safeData, 'prospectos');
  const prospectosViejos = sum(safeData, 'prospectos_viejos');
  const totalClientesVendidos = sum(safeData, 'clientes_unicos');
  const totalMeta = prospectos + prospectosViejos;
  const totalProspectos = sum(safeData, 'universo_total');

  return (
    <section className={styles.kpiSection}>
      <h2 className={styles.kpiTitle}>KPIs</h2>
      <div className={styles.cards}>
        <div className={styles.card}>
          <div className={styles.cardLabel}>Total Clientes Vendidos</div>
          <div className={styles.cardValue}>{totalClientesVendidos.toLocaleString()}</div>
          <div className={styles.cardDetail}>
            Clientes únicos vendidos en el período seleccionado
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>Total Meta</div>
          <div className={styles.cardValue}>{totalMeta.toLocaleString()}</div>
          <div className={styles.cardDetail}>
            {prospectos.toLocaleString()} prospectos + {prospectosViejos.toLocaleString()} prospectos viejos
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>Total Prospectos</div>
          <div className={styles.cardValue}>{totalProspectos.toLocaleString()}</div>
          <div className={styles.cardDetail}>
            Universo total acumulado del período seleccionado
          </div>
        </div>
      </div>
    </section>
  );
}
