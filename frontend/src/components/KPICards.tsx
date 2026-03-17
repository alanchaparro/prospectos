import { useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import type { Funnel1Row } from '../api/types';
import styles from './KPICards.module.css';

interface KPICardsProps {
  data: Funnel1Row[];
}

type CardId = 'clientes_vendidos' | 'total_meta' | 'total_prospectos' | 'ratio_configurable';
type MetricId = 'clientes_vendidos' | 'total_meta' | 'universo_total';

interface CardData {
  id: CardId;
  label: string;
  value: number | string;
  detail: string;
  tone: 'vendidos' | 'meta' | 'universo' | 'configurable';
  draggable?: boolean;
}

interface RatioConfig {
  numerator: MetricId;
  denominator: MetricId;
}

const DEFAULT_ORDER: CardId[] = ['clientes_vendidos', 'total_meta', 'total_prospectos', 'ratio_configurable'];
const DEFAULT_RATIO_CONFIG: RatioConfig = { numerator: 'clientes_vendidos', denominator: 'universo_total' };
const STORAGE_KEY_ORDER = 'prospectos:kpi-card-order';
const STORAGE_KEY_RATIO = 'prospectos:kpi-ratio-config';

function sum(rows: Funnel1Row[], key: keyof Funnel1Row): number {
  return rows.reduce(
    (acc, r) => acc + (Number((r as unknown as Record<string, number>)[key]) || 0),
    0
  );
}

function reorderCards(order: CardId[], draggedId: CardId, targetId: CardId): CardId[] {
  if (draggedId === targetId) {
    return order;
  }
  const next = [...order];
  const from = next.indexOf(draggedId);
  const to = next.indexOf(targetId);
  if (from === -1 || to === -1) {
    return order;
  }
  next.splice(from, 1);
  next.splice(to, 0, draggedId);
  return next;
}

function isMetricId(value: string): value is MetricId {
  return value === 'clientes_vendidos' || value === 'total_meta' || value === 'universo_total';
}

function sanitizeOrder(value: unknown): CardId[] {
  if (!Array.isArray(value)) {
    return DEFAULT_ORDER;
  }
  const filtered = value.filter(
    (item): item is CardId =>
      item === 'clientes_vendidos' ||
      item === 'total_meta' ||
      item === 'total_prospectos' ||
      item === 'ratio_configurable'
  );
  if (filtered.length !== DEFAULT_ORDER.length) {
    return DEFAULT_ORDER;
  }
  return filtered;
}

function sanitizeRatioConfig(value: unknown): RatioConfig {
  if (!value || typeof value !== 'object') {
    return DEFAULT_RATIO_CONFIG;
  }
  const candidate = value as Record<string, unknown>;
  const numerator = typeof candidate.numerator === 'string' && isMetricId(candidate.numerator)
    ? candidate.numerator
    : DEFAULT_RATIO_CONFIG.numerator;
  const denominator = typeof candidate.denominator === 'string' && isMetricId(candidate.denominator)
    ? candidate.denominator
    : DEFAULT_RATIO_CONFIG.denominator;
  return { numerator, denominator };
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.gearIcon}>
      <path
        d="M19.14 12.94a7.43 7.43 0 0 0 .05-.94 7.43 7.43 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.08 7.08 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.22-1.12.52-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22l-1.92 3.32a.5.5 0 0 0 .12.64l2.03 1.58a7.43 7.43 0 0 0-.05.94c0 .32.02.63.05.94L2.27 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.41 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54c.58-.22 1.12-.52 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function KPICards({ data }: KPICardsProps) {
  const safeData = Array.isArray(data) ? data : [];
  const [cardOrder, setCardOrder] = useState<CardId[]>(DEFAULT_ORDER);
  const [draggedCard, setDraggedCard] = useState<CardId | null>(null);
  const [ratioConfig, setRatioConfig] = useState<RatioConfig>(DEFAULT_RATIO_CONFIG);
  const [draftRatioConfig, setDraftRatioConfig] = useState<RatioConfig>(DEFAULT_RATIO_CONFIG);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  useEffect(() => {
    try {
      const storedOrder = window.localStorage.getItem(STORAGE_KEY_ORDER);
      const storedConfig = window.localStorage.getItem(STORAGE_KEY_RATIO);
      if (storedOrder) {
        setCardOrder(sanitizeOrder(JSON.parse(storedOrder)));
      }
      if (storedConfig) {
        const nextConfig = sanitizeRatioConfig(JSON.parse(storedConfig));
        setRatioConfig(nextConfig);
        setDraftRatioConfig(nextConfig);
      }
    } catch {
      setCardOrder(DEFAULT_ORDER);
      setRatioConfig(DEFAULT_RATIO_CONFIG);
      setDraftRatioConfig(DEFAULT_RATIO_CONFIG);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(cardOrder));
  }, [cardOrder]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY_RATIO, JSON.stringify(ratioConfig));
  }, [ratioConfig]);

  if (!safeData.length) {
    return null;
  }

  const prospectos = sum(safeData, 'prospectos');
  const prospectosViejos = sum(safeData, 'prospectos_viejos');
  const totalClientesVendidos = sum(safeData, 'clientes_unicos');
  const totalMeta = prospectos + prospectosViejos;
  const totalProspectos = sum(safeData, 'universo_total');

  const metricMap = useMemo(
    () => ({
      clientes_vendidos: {
        label: 'Clientes vendidos',
        value: totalClientesVendidos,
      },
      total_meta: {
        label: 'Total Meta',
        value: totalMeta,
      },
      universo_total: {
        label: 'Universo total',
        value: totalProspectos,
      },
    }),
    [totalClientesVendidos, totalMeta, totalProspectos]
  );

  const ratioNumerator = metricMap[ratioConfig.numerator];
  const ratioDenominator = metricMap[ratioConfig.denominator];
  const ratioValue = ratioDenominator.value > 0 ? (ratioNumerator.value / ratioDenominator.value) * 100 : 0;

  const cards: Record<CardId, CardData> = {
    clientes_vendidos: {
      id: 'clientes_vendidos',
      label: 'Total Clientes Vendidos',
      value: totalClientesVendidos,
      detail: 'Clientes unicos vendidos en el periodo seleccionado',
      tone: 'vendidos',
    },
    total_meta: {
      id: 'total_meta',
      label: 'Total Meta',
      value: totalMeta,
      detail: `${prospectos.toLocaleString()} prospectos + ${prospectosViejos.toLocaleString()} prospectos viejos`,
      tone: 'meta',
    },
    total_prospectos: {
      id: 'total_prospectos',
      label: 'Total Prospectos',
      value: totalProspectos,
      detail: 'Universo total acumulado del periodo seleccionado',
      tone: 'universo',
    },
    ratio_configurable: {
      id: 'ratio_configurable',
      label: 'Indicador Configurable',
      value: `${ratioValue.toFixed(1)}%`,
      detail: `${ratioNumerator.label} / ${ratioDenominator.label}`,
      tone: 'configurable',
      draggable: false,
    },
  };

  const visibleCards = cardOrder.map((cardId) => cards[cardId]);

  const handleDragStart = (cardId: CardId) => {
    if (cardId === 'ratio_configurable') {
      return;
    }
    setDraggedCard(cardId);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (targetId: CardId) => {
    if (!draggedCard || targetId === 'ratio_configurable') {
      return;
    }
    setCardOrder((current) => reorderCards(current, draggedCard, targetId));
    setDraggedCard(null);
  };

  const handleDragEnd = () => {
    setDraggedCard(null);
  };

  const handleSaveRatio = () => {
    setRatioConfig(draftRatioConfig);
    setIsConfigOpen(false);
  };

  return (
    <section className={styles.kpiSection}>
      <h2 className={styles.kpiTitle}>KPIs</h2>
      <div className={styles.cards}>
        {visibleCards.map((card) => (
          <div
            key={card.id}
            className={`${styles.card} ${styles[card.tone]} ${draggedCard === card.id ? styles.dragging : ''}`}
            draggable={card.draggable !== false}
            onDragStart={() => handleDragStart(card.id)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(card.id)}
            onDragEnd={handleDragEnd}
          >
            <div className={styles.cardHeader}>
              <div className={styles.dragHandle}>
                {card.draggable === false ? 'Configuracion' : 'Arrastrar'}
              </div>
              {card.id === 'ratio_configurable' && (
                <button
                  type="button"
                  className={styles.settingsButton}
                  onClick={() => {
                    setDraftRatioConfig(ratioConfig);
                    setIsConfigOpen((open) => !open);
                  }}
                  aria-label="Configurar indicador"
                >
                  <GearIcon />
                </button>
              )}
            </div>
            <div className={styles.cardLabel}>{card.label}</div>
            <div className={styles.cardValue}>{typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</div>
            <div className={styles.cardDetail}>{card.detail}</div>

            {card.id === 'ratio_configurable' && isConfigOpen && (
              <div className={styles.settingsPanel}>
                <label className={styles.field}>
                  <span>Numerador</span>
                  <select
                    value={draftRatioConfig.numerator}
                    onChange={(event) =>
                      setDraftRatioConfig((current) => ({
                        ...current,
                        numerator: event.target.value as MetricId,
                      }))
                    }
                  >
                    {Object.entries(metricMap).map(([metricId, metric]) => (
                      <option key={metricId} value={metricId}>
                        {metric.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Denominador</span>
                  <select
                    value={draftRatioConfig.denominator}
                    onChange={(event) =>
                      setDraftRatioConfig((current) => ({
                        ...current,
                        denominator: event.target.value as MetricId,
                      }))
                    }
                  >
                    {Object.entries(metricMap).map(([metricId, metric]) => (
                      <option key={metricId} value={metricId}>
                        {metric.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className={styles.settingsActions}>
                  <button type="button" className={styles.secondaryButton} onClick={() => setIsConfigOpen(false)}>
                    Cancelar
                  </button>
                  <button type="button" className={styles.primaryButton} onClick={handleSaveRatio}>
                    Guardar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
