export type Granularity = 'day' | 'week' | 'month';

export interface Funnel1Row {
  period: string;
  label: string;
  prospectos: number;
  prospectos_agendados: number;
  agendamientos: number;
  agendamientos_de_prospectos: number;
  agendamientos_prospectos_viejos: number;
  agendamientos_otras_fuentes: number;
  presupuestos: number;
  presupuestos_de_prospectos: number;
  presupuestos_prospectos_viejos: number;
  presupuestos_otras_fuentes: number;
  contratos: number;
  contratos_de_prospectos: number;
  contratos_prospectos_viejos: number;
  contratos_otras_fuentes: number;
  clientes_unicos: number;
  clientes_unicos_de_prospectos: number;
  clientes_unicos_prospectos_viejos: number;
  clientes_unicos_otras_fuentes: number;
  prospectos_viejos: number;
  otras_fuentes: number;
  universo_total: number;
}

export interface Funnel1Response {
  granularity: Granularity;
  data: Funnel1Row[];
}
