# Analisis: Web moderna - Embudo de ventas

Documento de analisis del proyecto actual para visualizar el embudo de ventas con metricas por periodo.

---

## 1. Fuentes de datos

| Origen | Archivo | Contenido |
|--------|---------|-----------|
| Pautas | `Pautas-ThinkChat-2025-2026.xlsx` | Prospectos generados por pautas |
| Agendamientos | `agendamientos-prospectos.xlsx` | Prospectos atendidos con turno |
| Conversion | `Presupuestos y contratos.xlsx` | Presupuestos y contratos |
| Clientes | `clientes.xlsx` | Contratos confirmados y metadatos de cliente |
| Referencia | `Clientes y telefonos.xlsx` | Cruce cliente -> telefonos |

El proyecto actual opera sobre un unico funnel activo: `Funnel 1`.

---

## 2. Funnel 1

Objetivo: agrupar metricas comerciales por dia, semana o mes dentro de un rango de fechas.

### Metricas principales

| Etapa | Metrica |
|-------|---------|
| Pautas | Prospectos |
| Agendamientos | Agendamientos |
| Presupuestos | Presupuestos |
| Contratos | Contratos |

### Metricas derivadas usadas en la UI

| Metrica | Significado |
|---------|-------------|
| `prospectos_agendados` | Prospectos del periodo que luego aparecen como agendados |
| `presupuestos_de_prospectos` | Presupuestos de clientes que pudieron vincularse con prospectos del periodo |
| `contratos_de_prospectos` | Contratos de clientes vinculados con prospectos del periodo |
| `clientes_unicos` | Clientes unicos con contrato en el periodo |
| `clientes_unicos_de_prospectos` | Clientes unicos del periodo cuyo origen pudo asociarse a prospectos |
| `prospectos_viejos` | Clientes del periodo vinculados a prospectos de periodos anteriores |
| `otras_fuentes` | Clientes del periodo sin vinculo detectable con pautas |
| `universo_total` | Suma de prospectos del periodo, prospectos viejos y otras fuentes |

### Semantica de fechas

- Pautas: `Fecha Ingreso` es la fecha canonica de entrada al embudo.
- Agendamientos: fecha de agendamiento o de turno.
- Presupuestos: fecha de presupuesto.
- Contratos: `contract_date` de `clientes.xlsx` cuando existe.

---

## 3. Backend actual

El backend activo esta en `backend_python/` y usa:

| Capa | Tecnologia | Uso |
|------|------------|-----|
| API | FastAPI | Endpoints `/api/health`, `/api/lineas`, `/api/funnel1`, `/api/reload`, `/api/debug/*` |
| Datos | pandas + openpyxl | Lectura de Excel |
| Logica | Python | Normalizacion, cruces, agregacion y conteo |

El endpoint analitico principal es:

- `GET /api/funnel1?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=day|week|month&linea=...`

---

## 4. Frontend actual

El frontend esta implementado en `frontend/` con React, TypeScript y Vite.

La interfaz consume `Funnel 1` y presenta:

- filtros de fechas,
- filtro de linea,
- granularidad,
- KPIs,
- visualizacion tipo funnel,
- tabla por periodo.

---

## 5. Riesgos tecnicos actuales

- Parte del matching entre prospectos y clientes depende de heuristicas por telefono.
- Si Pautas no trae un identificador util, el sistema cae en identificadores sinteticos.
- La calidad de conteo depende de la consistencia real de encabezados en Excel.

---

## 6. Recomendaciones vigentes

1. Mantener `Funnel 1` como unico flujo analitico visible y documentado.
2. Robustecer tests del calculo de metricas.
3. Seguir documentando la semantica exacta de cada metrica visible en la UI.
4. Usar endpoints de debug para validar encabezados y contratos cuando cambian los Excel.
