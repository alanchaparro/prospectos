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
  otros: number;
  /** Solo para Universo total: prospectos viejos (segmento medio) */
  prospectosViejos?: number;
}

function aggregateStages(rows: Funnel1Row[]): FunnelStage[] {
  const sum = (key: keyof Funnel1Row) =>
    rows.reduce((acc, r) => acc + (Number((r as unknown as Record<string, number>)[key]) || 0), 0);

  const prospectos = sum('prospectos');
  const prospectosViejos = sum('prospectos_viejos');
  const otrasFuentes = sum('otras_fuentes');
  const universoTotal = sum('universo_total');
  const agendamientos = sum('agendamientos');
  const prospectosAgendados = sum('prospectos_agendados');
  const presupuestos = sum('presupuestos');
  const presupuestosDeProspectos = sum('presupuestos_de_prospectos');
  const contratos = sum('contratos');
  const contratosDeProspectos = sum('contratos_de_prospectos');
  const clientesUnicos = sum('clientes_unicos');
  const clientesUnicosDeProspectos = sum('clientes_unicos_de_prospectos');

  const universo = Math.max(universoTotal, prospectos + prospectosViejos + otrasFuentes);

  return [
    {
      key: 'universo',
      label: 'Universo total',
      total: universo,
      deProspectos: prospectos,
      prospectosViejos,
      otros: otrasFuentes,
    },
    {
      key: 'prospectos',
      label: 'Prospectos',
      total: prospectos,
      deProspectos: prospectos,
      otros: 0,
    },
    {
      key: 'agendamientos',
      label: 'Agendamientos',
      total: agendamientos,
      deProspectos: prospectosAgendados,
      otros: Math.max(0, agendamientos - prospectosAgendados),
    },
    {
      key: 'presupuestos',
      label: 'Presupuestos',
      total: presupuestos,
      deProspectos: presupuestosDeProspectos,
      otros: Math.max(0, presupuestos - presupuestosDeProspectos),
    },
    {
      key: 'contratos',
      label: 'Contratos',
      total: contratos,
      deProspectos: contratosDeProspectos,
      otros: Math.max(0, contratos - contratosDeProspectos),
    },
    {
      key: 'clientes_unicos',
      label: 'Clientes únicos',
      total: clientesUnicos,
      deProspectos: clientesUnicosDeProspectos,
      otros: Math.max(0, clientesUnicos - clientesUnicosDeProspectos),
    },
  ];
}

export function Funnel1View({ data, categoria = 'todas' }: Funnel1ViewProps) {
  const safeData = Array.isArray(data) ? data : [];
  if (!safeData.length) {
    return (
      <div className={styles.empty}>
        No hay datos para el rango y granularidad seleccionados.
      </div>
    );
  }

  const stages = aggregateStages(safeData);
  const maxTotal = Math.max(1, stages[0].total);

  const showMeta = categoria === 'todas' || categoria === 'meta';
  const showOtras = categoria === 'todas' || categoria === 'otras';

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Funnel 1 – Métricas por período</h2>
      <p className={styles.subtitle}>
        Conteo por etapa; categoría META = prospectos, Otras fuentes = resto.
      </p>

      <div className={styles.funnelWrap}>
        <div className={styles.funnelTitle}>SALES FUNNEL</div>
        <div className={styles.funnelBars}>
          {stages.map((stage, index) => {
            const metaCount = stage.deProspectos;
            const otrasCount = stage.otros;
            const viejosCount = stage.prospectosViejos ?? 0;
            const metaPct = stage.total > 0 ? (metaCount / stage.total) * 100 : 0;
            const otrasPct = stage.total > 0 ? (otrasCount / stage.total) * 100 : 0;
            const viejosPct = stage.total > 0 ? (viejosCount / stage.total) * 100 : 0;
            const hasSegments = stage.otros > 0 || viejosCount > 0;
            const isUniverso = stage.prospectosViejos !== undefined;

            const displayCount = isUniverso && categoria === 'otras'
              ? viejosCount + otrasCount
              : categoria === 'meta'
                ? metaCount
                : categoria === 'otras'
                  ? otrasCount
                  : stage.total;
            const widthPct = maxTotal > 0 ? (Math.max(displayCount, 1) / maxTotal) * 100 : 0;

            return (
              <div key={stage.key} className={styles.funnelRow}>
                <div className={styles.funnelLabel}>
                  <span className={styles.stageName}>{stage.label}</span>
                  <span className={styles.stageCount}>
                    {stage.total.toLocaleString()}
                    {hasSegments && categoria === 'todas' && (
                      <span className={styles.segmentDetail}>
                        {isUniverso
                          ? ` (${metaCount} Prospectos, ${viejosCount} Prospectos viejos, ${otrasCount} Otras fuentes)`
                          : ` (${metaCount} META, ${otrasCount} Otras fuentes)`}
                      </span>
                    )}
                  </span>
                </div>
                <div
                  className={styles.barOuter}
                  style={{ width: `${Math.max(10, widthPct)}%` }}
                >
                  <div className={styles.barInner} data-stage={index + 1}>
                    {isUniverso && (showMeta || showOtras) ? (
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
                                title={`Prospectos (mes): ${metaCount}`}
                                data-color-stage={0}
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
                          {metaPct > 0 && metaPct < 8 && (
                            <span className={styles.segmentLabelSmall}>{metaPct.toFixed(0)}%</span>
                          )}
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
                            <span className={`${styles.segmentLabelSmall} ${styles.segmentLabelOnLight}`}>
                              {otrasPct.toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div
                        className={`${styles.barSegment} ${styles.solo}`}
                        style={{ width: '100%' }}
                        data-segment-type={
                          isUniverso
                            ? (categoria === 'meta' ? 'meta' : categoria === 'otras' ? 'otras' : 'universo')
                            : (categoria === 'meta' ? 'meta' : categoria === 'otras' ? 'otras' : undefined)
                        }
                      >
                        <span className={styles.segmentLabel}>
                          {(isUniverso && categoria === 'otras' ? viejosCount + otrasCount : displayCount).toLocaleString()} ({categoria === 'todas' ? '100' : '100'}%)
                        </span>
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
            <span className={styles.legendSwatch} data-type="de" /> Prospectos (mes) / META
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
              <th>Agendados (META)</th>
              <th>Agendamientos</th>
              <th>Presupuestos</th>
              <th>Presup. (META)</th>
              <th>Contratos</th>
              <th>Contratos (META)</th>
              <th>Clientes únicos</th>
              <th>Clientes ún. (META)</th>
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
                <td>{row.agendamientos}</td>
                <td>{row.presupuestos}</td>
                <td>{row.presupuestos_de_prospectos}</td>
                <td>{row.contratos}</td>
                <td>{row.contratos_de_prospectos}</td>
                <td>{row.clientes_unicos}</td>
                <td>{row.clientes_unicos_de_prospectos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
