import type { Funnel1Row } from '../api/types';
import type { Categoria } from './Filters';
import styles from './Funnel1View.module.css';

interface Funnel1ViewProps {
  data: Funnel1Row[];
  categoria?: Categoria;
}

interface FunnelStage {
  key: string;
  label: string;
  total: number;
  deProspectos: number;
  prospectosViejos: number;
  otros: number;
}

function aggregateStages(rows: Funnel1Row[]): FunnelStage[] {
  const sum = (key: keyof Funnel1Row) =>
    rows.reduce((acc, r) => acc + (Number((r as unknown as Record<string, number>)[key]) || 0), 0);

  const prospectos = sum('prospectos');
  const prospectosViejos = sum('prospectos_viejos');
  const otrasFuentes = sum('otras_fuentes');
  const universoTotal = sum('universo_total');

  return [
    {
      key: 'universo',
      label: 'Universo total',
      total: Math.max(universoTotal, prospectos + prospectosViejos + otrasFuentes),
      deProspectos: prospectos,
      prospectosViejos,
      otros: otrasFuentes,
    },
    {
      key: 'prospectos',
      label: 'Prospectos',
      total: prospectos,
      deProspectos: prospectos,
      prospectosViejos: 0,
      otros: 0,
    },
    {
      key: 'agendamientos',
      label: 'Agendamientos',
      total: sum('agendamientos'),
      deProspectos: sum('agendamientos_de_prospectos'),
      prospectosViejos: sum('agendamientos_prospectos_viejos'),
      otros: sum('agendamientos_otras_fuentes'),
    },
    {
      key: 'presupuestos',
      label: 'Presupuestos',
      total: sum('presupuestos'),
      deProspectos: sum('presupuestos_de_prospectos'),
      prospectosViejos: sum('presupuestos_prospectos_viejos'),
      otros: sum('presupuestos_otras_fuentes'),
    },
    {
      key: 'contratos',
      label: 'Contratos',
      total: sum('contratos'),
      deProspectos: sum('contratos_de_prospectos'),
      prospectosViejos: sum('contratos_prospectos_viejos'),
      otros: sum('contratos_otras_fuentes'),
    },
    {
      key: 'clientes_unicos',
      label: 'Clientes únicos',
      total: sum('clientes_unicos'),
      deProspectos: sum('clientes_unicos_de_prospectos'),
      prospectosViejos: sum('clientes_unicos_prospectos_viejos'),
      otros: sum('clientes_unicos_otras_fuentes'),
    },
  ];
}

export function Funnel1View({ data, categoria = 'todas' }: Funnel1ViewProps) {
  const safeData = Array.isArray(data) ? data : [];
  if (!safeData.length) {
    return <div className={styles.empty}>No hay datos para el rango y granularidad seleccionados.</div>;
  }

  const stages = aggregateStages(safeData);
  const maxTotal = Math.max(1, stages[0].total);
  const showMeta = categoria === 'todas' || categoria === 'meta';
  const showOtras = categoria === 'todas' || categoria === 'otras';

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Funnel 1 - Métricas por período</h2>
      <p className={styles.subtitle}>Conteo por etapa con segmentación entre META, prospectos viejos y otras fuentes.</p>

      <div className={styles.funnelWrap}>
        <div className={styles.funnelTitle}>SALES FUNNEL</div>
        <div className={styles.funnelBars}>
          {stages.map((stage, index) => {
            const metaCount = stage.deProspectos;
            const viejosCount = stage.prospectosViejos;
            const otrasCount = stage.otros;
            const metaPct = stage.total > 0 ? (metaCount / stage.total) * 100 : 0;
            const viejosPct = stage.total > 0 ? (viejosCount / stage.total) * 100 : 0;
            const otrasPct = stage.total > 0 ? (otrasCount / stage.total) * 100 : 0;
            const hasOldSegment = viejosCount > 0;
            const hasSegments = otrasCount > 0 || viejosCount > 0;

            const displayCount =
              categoria === 'meta' ? metaCount : categoria === 'otras' ? viejosCount + otrasCount : stage.total;
            const widthPct = maxTotal > 0 ? (Math.max(displayCount, 1) / maxTotal) * 100 : 0;

            return (
              <div key={stage.key} className={styles.funnelRow}>
                <div className={styles.funnelLabel}>
                  <span className={styles.stageName}>{stage.label}</span>
                  <span className={styles.stageCount}>{stage.total.toLocaleString()}</span>
                  {hasSegments && categoria === 'todas' && (
                    <span className={styles.segmentDetail}>
                      {`${metaCount} META, ${viejosCount} Prospectos viejos, ${otrasCount} Otras fuentes`}
                    </span>
                  )}
                </div>
                <div className={styles.barOuter} style={{ width: `${Math.max(10, widthPct)}%` }}>
                  <div className={styles.barInner} data-stage={index + 1}>
                    {hasOldSegment && (showMeta || showOtras) ? (
                      (() => {
                        const totalViejosOtras = viejosCount + otrasCount;
                        const viejosPctNorm = totalViejosOtras > 0 ? (viejosCount / totalViejosOtras) * 100 : 0;
                        const otrasPctNorm = totalViejosOtras > 0 ? (otrasCount / totalViejosOtras) * 100 : 0;
                        const onlyViejosOtras = !showMeta && showOtras;
                        return (
                          <>
                            {showMeta && (
                              <div
                                className={`${styles.barSegment} ${styles.deProspectos}`}
                                style={{ width: `${metaPct}%` }}
                                title={`META: ${metaCount}`}
                                data-color-stage={index > 0 ? index - 1 : 0}
                              >
                                {metaPct >= 6 && (
                                  <span className={styles.segmentLabel}>
                                    {metaCount.toLocaleString()} ({metaPct.toFixed(0)}%)
                                  </span>
                                )}
                              </div>
                            )}
                            {viejosCount > 0 && (
                              <div
                                className={`${styles.barSegment} ${styles.prospectosViejos}`}
                                style={{ width: `${onlyViejosOtras ? viejosPctNorm : viejosPct}%` }}
                                title={`Prospectos viejos: ${viejosCount}`}
                              >
                                {(onlyViejosOtras ? viejosPctNorm : viejosPct) >= 6 && (
                                  <span className={styles.segmentLabel}>
                                    {viejosCount.toLocaleString()} ({(onlyViejosOtras ? viejosPctNorm : viejosPct).toFixed(0)}%)
                                  </span>
                                )}
                              </div>
                            )}
                            {showOtras && (
                              <div
                                className={`${styles.barSegment} ${styles.otros}`}
                                style={{ width: `${onlyViejosOtras ? otrasPctNorm : otrasPct}%` }}
                                title={`Otras fuentes: ${otrasCount}`}
                              >
                                {(onlyViejosOtras ? otrasPctNorm : otrasPct) >= 6 && (
                                  <span className={`${styles.segmentLabel} ${styles.segmentLabelOnLight}`}>
                                    {otrasCount.toLocaleString()} ({(onlyViejosOtras ? otrasPctNorm : otrasPct).toFixed(0)}%)
                                  </span>
                                )}
                              </div>
                            )}
                          </>
                        );
                      })()
                    ) : hasSegments && showMeta && showOtras ? (
                      <>
                        <div
                          className={`${styles.barSegment} ${styles.deProspectos}`}
                          style={{ width: `${metaPct}%` }}
                          title={`META: ${metaCount} (${metaPct.toFixed(1)}%)`}
                          data-color-stage={index > 0 ? index - 1 : 0}
                        >
                          {metaPct >= 8 && (
                            <span className={styles.segmentLabel}>
                              {metaCount.toLocaleString()} ({metaPct.toFixed(0)}%)
                            </span>
                          )}
                          {metaPct > 0 && metaPct < 8 && <span className={styles.segmentLabelSmall}>{metaPct.toFixed(0)}%</span>}
                        </div>
                        <div
                          className={`${styles.barSegment} ${styles.otros}`}
                          style={{ width: `${otrasPct}%` }}
                          title={`Otras fuentes: ${otrasCount} (${otrasPct.toFixed(1)}%)`}
                        >
                          {otrasPct >= 8 && (
                            <span className={`${styles.segmentLabel} ${styles.segmentLabelOnLight}`}>
                              {otrasCount.toLocaleString()} ({otrasPct.toFixed(0)}%)
                            </span>
                          )}
                          {otrasPct > 0 && otrasPct < 8 && (
                            <span className={`${styles.segmentLabelSmall} ${styles.segmentLabelOnLight}`}>{otrasPct.toFixed(0)}%</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div
                        className={`${styles.barSegment} ${styles.solo}`}
                        style={{ width: '100%' }}
                        data-segment-type={categoria === 'meta' ? 'meta' : categoria === 'otras' ? 'otras' : undefined}
                      >
                        <span className={styles.segmentLabel}>{displayCount.toLocaleString()} (100%)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={styles.legendSwatch} data-type="de" /> Prospectos del período / META
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendSwatch} data-type="viejos" /> Prospectos viejos
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendSwatch} data-type="otros" /> Otras fuentes
          </span>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Período</th>
              <th>Universo total</th>
              <th>Prospectos</th>
              <th>Prosp. viejos</th>
              <th>Otras fuentes</th>
              <th>Prospectos agendados</th>
              <th>Agend. (META)</th>
              <th>Agend. viejos</th>
              <th>Agend. otras</th>
              <th>Presup. (META)</th>
              <th>Presup. viejos</th>
              <th>Presup. otras</th>
              <th>Contratos (META)</th>
              <th>Contratos viejos</th>
              <th>Contratos otras</th>
              <th>Clientes únicos</th>
            </tr>
          </thead>
          <tbody>
            {safeData.map((row) => (
              <tr key={row.period}>
                <td>{row.label}</td>
                <td>{row.universo_total ?? row.prospectos + row.prospectos_viejos + row.otras_fuentes}</td>
                <td>{row.prospectos}</td>
                <td>{row.prospectos_viejos ?? 0}</td>
                <td>{row.otras_fuentes ?? 0}</td>
                <td>{row.prospectos_agendados}</td>
                <td>{row.agendamientos_de_prospectos}</td>
                <td>{row.agendamientos_prospectos_viejos}</td>
                <td>{row.agendamientos_otras_fuentes}</td>
                <td>{row.presupuestos_de_prospectos}</td>
                <td>{row.presupuestos_prospectos_viejos}</td>
                <td>{row.presupuestos_otras_fuentes}</td>
                <td>{row.contratos_de_prospectos}</td>
                <td>{row.contratos_prospectos_viejos}</td>
                <td>{row.contratos_otras_fuentes}</td>
                <td>{row.clientes_unicos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
