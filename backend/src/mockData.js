/**
 * Datos de prueba para desarrollo cuando no hay Excel en /data.
 * Genera prospectos, agendamientos y presupuestos/contratos con fechas 2025-2026.
 */
import { addDays, subDays, format } from 'date-fns';

const base = new Date(2025, 0, 1); // 1 ene 2025

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(from, to) {
  const d = new Date(from.getTime() + Math.random() * (to - from));
  return format(d, 'yyyy-MM-dd');
}

/** Generar pautas: id_prospecto, fecha_contacto */
export function getMockPautas() {
  const rows = [];
  for (let i = 1; i <= 200; i++) {
    const d = randomDate(base, new Date(2026, 5, 30));
    rows.push({
      id_prospecto: `P${i}`,
      email: `prospecto${i}@test.com`,
      fecha_contacto: d,
      origen: ['Instagram', 'Facebook', 'Google'][randomInt(0, 2)],
    });
  }
  return rows;
}

/** Agendamientos: solo una parte de los prospectos (coinciden por id_prospecto) */
export function getMockAgendamientos(pautas) {
  const rows = [];
  const subset = pautas.filter(() => Math.random() < 0.35); // ~35% agendan
  subset.forEach((p, i) => {
    const fechaContacto = new Date(p.fecha_contacto);
    const fechaAge = addDays(fechaContacto, randomInt(1, 14));
    rows.push({
      id_prospecto: p.id_prospecto,
      fecha_agendamiento: format(fechaAge, 'yyyy-MM-dd'),
      clinica: ['Sede Norte', 'Sede Centro', 'Sede Sur'][randomInt(0, 2)],
    });
  });
  return rows;
}

/** Presupuestos y contratos: subconjunto de los que agendaron */
export function getMockPresupuestosContratos(agendamientos) {
  const rows = [];
  const withPresupuesto = agendamientos.filter(() => Math.random() < 0.6);
  withPresupuesto.forEach((a) => {
    const fechaAge = new Date(a.fecha_agendamiento);
    const fechaPres = addDays(fechaAge, randomInt(0, 7));
    const tieneContrato = Math.random() < 0.5;
    rows.push({
      id_prospecto: a.id_prospecto,
      fecha_presupuesto: format(fechaPres, 'yyyy-MM-dd'),
      fecha_contrato: tieneContrato ? format(addDays(fechaPres, randomInt(1, 5)), 'yyyy-MM-dd') : null,
      tiene_contrato: tieneContrato ? 'Sí' : 'No',
    });
  });
  return rows;
}

export function buildMockDatasets() {
  const pautas = getMockPautas();
  const agendamientos = getMockAgendamientos(pautas);
  const presupuestosContratos = getMockPresupuestosContratos(agendamientos);
  return { pautas, agendamientos, presupuestosContratos };
}
