# Análisis: Web moderna – Embudo de ventas (Funnel)

Documento de análisis para construir una aplicación web que visualice el embudo de ventas según las reglas de negocio y los datos de Pautas, Agendamientos, Presupuestos y Contratos.

---

## 1. Fuentes de datos

| Origen | Archivo | Contenido |
|--------|---------|-----------|
| **Pautas** | `Pautas-ThinkChat-2025-2026.xlsx` | Prospectos interesados (contactos por pautas en redes sociales) |
| **Agendamientos** | `agendamientos-prospectos.xlsx` | Prospectos que agendaron turno para conocer la clínica |
| **Conversión** | `Presupuestos y contratos.xlsx` | Presupuestos generados y contratos firmados (conversión) |

**Requisito de cruce:** Para el funnel por tiempo hay que poder relacionar un mismo **prospecto/cliente** entre los tres archivos (por ejemplo: ID, email, teléfono o combinación que identifique de forma única).

---

## 2. Funnel 1: Por calendario (agrupación en el tiempo)

Objetivo: un **calendario independiente** donde se ubica el **tiempo** (día, semana o mes) y, para cada período, se agrupan y muestran las métricas del embudo.

### 2.1 Métricas a mostrar por período

| Orden | Etapa | Métrica | Descripción |
|-------|--------|---------|-------------|
| 1 | Pautas | **Prospectos únicos** | Cantidad de contactos únicos que ingresaron por pautas en ese período |
| 2 | Agendamientos | **Agendamientos únicos** | Cantidad de prospectos únicos que agendaron turno en ese período |
| 3 | Presupuesto | **Clientes con presupuesto únicos** | Cantidad de clientes únicos con presupuesto en ese período |
| 4 | Contrato | **Contratos** | Cantidad de contratos firmados en ese período |

Todas las métricas deben ser **únicas por prospecto/cliente** en el período seleccionado (evitar duplicados si un mismo contacto aparece varias veces).

### 2.2 Niveles de tiempo (granularidad)

- **Día:** agrupar por fecha.
- **Semana:** agrupar por semana (ej. lunes a domingo o semana laboral).
- **Mes:** agrupar por mes.

El usuario debe poder **elegir el rango de fechas** y la **granularidad** (día / semana / mes) para ver el funnel.

### 2.3 Flujo de datos para Funnel 1

```
[Pautas-ThinkChat]     →  Prospectos únicos por fecha (fecha de contacto/registro)
[agendamientos]         →  Agendamientos únicos por fecha (fecha de agendamiento)
[Presupuestos y contratos] →  Presupuestos únicos y contratos por fecha (fecha de presupuesto / fecha de contrato)
```

Se necesita en cada Excel al menos un campo de **fecha** para ubicar el registro en el tiempo:

- Pautas: fecha de contacto o de alta del prospecto.
- Agendamientos: fecha del turno o fecha de agendamiento.
- Presupuestos/Contratos: fecha de presupuesto y fecha de firma de contrato.

### 2.4 Visualización sugerida para Funnel 1

- **Selector:** rango de fechas (desde / hasta) + granularidad (día / semana / mes).
- **Vista principal:**
  - Eje horizontal: períodos de tiempo (ej. días o semanas del rango).
  - Por cada período: barras o números con los 4 valores (prospectos únicos, agendamientos únicos, presupuestos únicos, contratos).
- Opcional: gráfico de embudo clásico (por etapa) para un período elegido, o mini-embudos por período.

---

## 3. Estructura esperada de los Excel (para desarrollo)

Para implementar el funnel por calendario hace falta definir cómo vienen los datos. A continuación, una propuesta de columnas mínimas; debe validarse con los archivos reales.

### 3.1 Pautas-ThinkChat-2025-2026.xlsx

| Campo sugerido | Uso |
|----------------|-----|
| Identificador único (ID, email, teléfono, etc.) | Cruce con agendamientos y presupuestos |
| Fecha de contacto / alta | Agrupación en el tiempo para “prospectos únicos” |
| Origen (red, campaña, pauta) | Opcional: filtros por canal |

### 3.2 agendamientos-prospectos.xlsx

| Campo sugerido | Uso |
|----------------|-----|
| Identificador del prospecto | Cruce con Pautas y Presupuestos/Contratos |
| Fecha del turno o de agendamiento | Agrupación en el tiempo para “agendamientos únicos” |
| Clínica / sede | Opcional: filtros por clínica |

### 3.3 Presupuestos y contratos.xlsx

| Campo sugerido | Uso |
|----------------|-----|
| Identificador del cliente/prospecto | Cruce con Pautas y Agendamientos |
| Fecha de presupuesto | Agrupación para “clientes con presupuesto únicos” |
| Fecha de contrato / firma | Agrupación para “contratos” |
| Indicador de si hay contrato firmado | Diferenciar presupuesto vs contrato |

Cuando tengas los archivos en el proyecto, se puede ajustar el mapeo exacto de columnas y nombres.

---

## 4. Propuesta de stack para la web moderna

Alineado con **proyecto dockerizado** y una experiencia actual:

| Capa | Tecnología sugerida | Motivo |
|------|---------------------|--------|
| Frontend | React + TypeScript (o Next.js si se quiere SSR/API integrada) | Componentes reutilizables, gráficos y calendario |
| Gráficos / Funnel | Recharts, Chart.js o similar | Gráficos de barras, funnel y series temporales |
| Calendario / fechas | date-fns o Day.js + selector de rango (ej. react-datepicker) | Agrupación por día/semana/mes |
| Backend API | Node.js (Express/Fastify) o Python (FastAPI) | Servir datos agregados y leer Excel/DB |
| Datos | Leer Excel (ej. xlsx/SheetJS en Node; openpyxl/pandas en Python) o ETL a SQLite/PostgreSQL | Un solo lugar de verdad para agregaciones |
| Contenedores | Docker + docker-compose | App y, si aplica, base de datos en contenedores |

La app podría exponer:
- **Pantalla principal:** selector de fechas + granularidad → tabla/gráfico con las 4 métricas por período.
- **Detalle (opcional):** al hacer clic en un período, desglose o lista de prospectos/agendamientos/presupuestos/contratos de ese período.

---

## 5. Resumen de entregables para Funnel 1

1. **Carga de datos:** lectura de los 3 Excel (o importación a base de datos).
2. **Lógica de agregación:** por rango de fechas y granularidad (día/semana/mes), calcular:
   - Prospectos únicos (desde Pautas).
   - Agendamientos únicos (desde agendamientos).
   - Clientes con presupuesto únicos (desde Presupuestos y contratos).
   - Cantidad de contratos (desde Presupuestos y contratos).
3. **API (o funciones equivalentes):** endpoint(s) que reciban rango + granularidad y devuelvan las métricas por período.
4. **UI:** calendario/selector de tiempo + vista del funnel (tabla y/o gráficos) con esas métricas.

---

## 6. Funnel 2: Por calendario + coincidencias (conversión del mismo prospecto)

Objetivo: usar **el mismo calendario** que el Funnel 1 (rango de fechas + granularidad día/semana/mes), pero las métricas se basan en **coincidencias**: contar **el mismo prospecto** a través de las etapas. Así se analiza la conversión real: “de 100 prospectos, 10 llegaron a agendamiento y 5 cerraron”.

### 6.1 Diferencia con Funnel 1

| Funnel 1 | Funnel 2 |
|----------|----------|
| Cuenta **eventos por etapa** en cada período (cada fuente por separado). | Cuenta **prospectos que coinciden** entre etapas (mismo identificador en varias fuentes). |
| Ejemplo: en enero hubo 100 prospectos, 30 agendamientos, 15 presupuestos, 5 contratos (sin cruzar personas). | Ejemplo: de los 100 prospectos de enero, 10 están también en agendamientos, 5 en presupuestos, 5 en contratos. |

### 6.2 Métricas del Funnel 2 (siempre por período de tiempo)

Para cada período (día/semana/mes), se define una **cohorte**: los prospectos únicos que **ingresaron por Pautas en ese período**. Sobre esa cohorte se buscan coincidencias:

| Orden | Etapa | Métrica | Cómo se calcula |
|-------|--------|---------|------------------|
| 1 | Pautas | **Prospectos únicos** | Prospectos únicos con fecha en Pautas dentro del período (misma lógica que Funnel 1). |
| 2 | Coincidencia Pautas ↔ Agendamientos | **Prospectos que llegaron a agendamiento** | De los prospectos del paso 1, cuántos **coinciden** (mismo ID/email/teléfono) con al menos un registro en *agendamientos-prospectos*. |
| 3 | Coincidencia con Presupuestos | **Prospectos que tienen presupuesto** | De los prospectos del paso 1, cuántos **coinciden** con registros en *Presupuestos y contratos* (presupuesto). |
| 4 | Coincidencia con Contratos | **Prospectos que cerraron (contrato)** | De los prospectos del paso 1, cuántos **coinciden** con registros de contrato en *Presupuestos y contratos*. |

Así se puede leer: “En [período]: 100 prospectos → 10 llegaron a agendamiento → 5 tienen presupuesto → 5 cerraron contrato”.

### 6.3 Lógica de coincidencias (cómo “buscarlo”)

1. **Identificador único:** En los tres Excel debe existir un campo (o combinación de campos) que identifique al mismo prospecto/cliente: ID, email, teléfono, DNI, etc. Ese es el **clave de cruce**.
2. **Por período:** Para el período seleccionado se obtienen los **identificadores únicos** de Pautas (prospectos que entraron en ese período).
3. **Buscar en Agendamientos:** Para cada identificador de esa lista, se verifica si existe en *agendamientos-prospectos*. Los que existan se cuentan como “llegaron a agendamiento”.
4. **Buscar en Presupuestos y contratos:** Igual: para cada identificador de la cohorte, se busca en *Presupuestos y contratos* si tiene presupuesto y/o contrato. Se cuentan por separado “con presupuesto” y “con contrato”.

En resumen: **siempre se parte de los prospectos del período (Pautas) y se buscan coincidencias** en las otras dos fuentes mediante la clave de cruce.

### 6.4 Calendario (igual que Funnel 1)

- **Mismo selector:** rango de fechas (desde / hasta) y granularidad (día / semana / mes).
- **Misma agrupación en el tiempo:** cada período agrupa por la **fecha de entrada del prospecto** en Pautas (fecha de contacto/alta).
- La vista puede ser por período: por cada celda del calendario (o cada barra del gráfico), mostrar los 4 números del funnel de coincidencias.

### 6.5 Visualización sugerida para Funnel 2

- **Selector:** mismo que Funnel 1 (fechas + granularidad).
- **Vista principal:**
  - Embudo clásico por período: Prospectos → Agendados (coinciden) → Presupuesto (coinciden) → Contratos (coinciden).
  - Opcional: tabla con columnas [Período | Prospectos | Coinciden agendamiento | Coinciden presupuesto | Coinciden contrato] y tasas de conversión (ej. 10 %, 5 %).
- **Ejemplo de lectura:** “En la semana del 1 al 7 de marzo: 100 prospectos únicos; de esos, 10 coinciden con agendamientos; de esos, 5 con presupuesto; 5 con contrato.”

### 6.6 Resumen de entregables para Funnel 2

1. **Cruce por identificador:** función o proceso que, dado un conjunto de IDs de prospectos (de Pautas en un período), busque coincidencias en agendamientos y en presupuestos/contratos.
2. **Agregación por período:** para cada período del calendario, calcular las 4 métricas (prospectos únicos + 3 coincidencias).
3. **API:** endpoint(s) que reciban rango + granularidad y devuelvan las métricas del Funnel 2 por período.
4. **UI:** misma barra de tiempo que Funnel 1, con gráfico/tabla de embudo de coincidencias y, si se desea, tasas de conversión.

---

## 7. Stack tecnológico para el análisis de datos

### 7.1 Stack actual (implementado)

El backend de la API y el análisis de datos están implementados en **Python**:

| Capa | Tecnología | Uso |
|------|------------|-----|
| **Backend / API** | FastAPI (Python 3.12) | Rutas `/api/health`, `/api/lineas`, `/api/funnel1`, `/api/funnel2`, `/api/reload`, `/api/debug/*` |
| **Lectura de Excel** | pandas + openpyxl | Carga de .xlsx (Pautas, Agendamientos, Presupuestos, Clientes, Clientes y telefonos) |
| **Fechas y agregación** | datetime, timedelta | Parseo de fechas, rangos, agrupación por día/semana/mes |
| **Lógica de negocio** | Python (módulos `funnel1`, `funnel2`, `load_data`, `config`) | Funnel 1, Funnel 2, cruces por ID y por teléfono, deduplicación |
| **Frontend** | React, TypeScript, Vite, Recharts | UI, filtros, gráficos y tablas (sin cambios; consume la misma API) |

Carpeta del backend: **`backend_python/`**. El backend Node.js anterior queda en **`backend/`** como referencia legada (ya no se usa en `docker-compose`).

### 7.2 Ventajas del stack Python

- Ecosistema estándar para análisis (pandas, numpy), fácil extensión con notebooks o scripts.
- Misma API que el frontend espera; no se requieren cambios en el front.
- Despliegue con Docker: servicio `backend` construido desde `backend_python/Dockerfile`.

---

## 8. Semántica de fechas en Pautas (registro para métricas futuras)

En **Pautas-ThinkChat-2025-2026.xlsx**:

| Columna en Excel | Significado | Uso actual |
|------------------|-------------|------------|
| **Fecha Ingreso** | **Primera fecha de contacto** con el prospecto (canónica para “cuándo ingresó” al embudo). | Se usa para agrupar prospectos por período (día/semana/mes) en Funnel 1 y Funnel 2. |
| **Fecha** | **Fecha de gestión** o **última gestión** del contacto. | No se usa en el embudo actual; disponible para análisis. |

**Métrica futura prevista:** Medir **cuánto tiempo tardó desde la fecha de ingreso (primer contacto) hasta que el prospecto cerró contrato** (ciclo de cierre). Origen: `Fecha Ingreso` (Pautas). Cierre: `contract_date` (clientes.xlsx) o fecha de contrato. Requerirá cruce prospecto → cliente (p. ej. por teléfono vía Clientes y telefonos) para obtener ambas fechas.

---

## 9. Próximos pasos

1. Confirmar o ajustar la estructura de columnas de los Excel (ver sección 8 para semántica de fechas en Pautas), **y definir la clave de cruce única** (ID, email, teléfono, etc.) para las coincidencias del Funnel 2.
2. Decidir si los datos se leen siempre desde Excel o se cargan una vez a una base de datos.
3. Implementar Funnel 1 (backend de agregación + frontend con calendario y métricas).
4. Implementar Funnel 2 (lógica de coincidencias por identificador + misma UI de calendario + vista de conversión).

Si compartes las columnas reales de cada Excel (nombres y tipo de dato), se puede bajar este análisis a un mapeo exacto campo a campo y a los queries/scripts de agregación.
