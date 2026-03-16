import type { Granularity, Funnel1Response } from './types';

const API = '/api';

export async function fetchFunnel1(
  from: string,
  to: string,
  granularity: Granularity,
  linea?: string
): Promise<Funnel1Response> {
  const params = new URLSearchParams({ from, to, granularity });
  if (linea) params.set('linea', linea);
  const res = await fetch(`${API}/funnel1?${params}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchLineas(): Promise<{ lineas: string[] }> {
  const res = await fetch(`${API}/lineas`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function healthCheck(): Promise<{ ok: boolean; mock?: boolean }> {
  const res = await fetch(`${API}/health`);
  if (!res.ok) throw new Error('API no disponible');
  return res.json();
}
