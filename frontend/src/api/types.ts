export type Granularity = 'day' | 'week' | 'month';

export interface Funnel1Row {
  period: string;
  label: string;
  prospectos: number;
  prospectos_agendados: number;
  agendamientos: number;
  presupuestos: number;
  presupuestos_de_prospectos: number;
  contratos: number;
  contratos_de_prospectos: number;
  clientes_unicos: number;
  clientes_unicos_de_prospectos: number;
  prospectos_viejos: number;
  otras_fuentes: number;
  universo_total: number;
}

export interface Funnel2Row {
  period: string;
  label: string;
  prospectos: number;
  coinciden_agendamiento: number;
  coinciden_presupuesto: number;
  coinciden_contrato: number;
}

export interface Funnel1Response {
  granularity: Granularity;
  data: Funnel1Row[];
}

export interface Funnel2Response {
  granularity: Granularity;
  data: Funnel2Row[];
}
