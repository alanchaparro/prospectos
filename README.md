# Embudo de ventas - Web

Aplicacion web para visualizar el funnel de ventas (prospectos -> agendamientos -> presupuestos -> contratos) con metricas por periodo.

## Requisitos

- Python 3.12+
- Node.js 20+ (solo para el frontend)
- Docker y Docker Compose (opcional)

## Ejecucion en local

### Backend Python

```bash
cd backend_python
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 4000
```

API en `http://localhost:4000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App en `http://localhost:3000`. El proxy de Vite redirige `/api` al backend Python.

### Datos

- Con Excel: coloca los archivos en `data/`:
  - `Pautas-ThinkChat-2025-2026.xlsx`
  - `agendamientos-prospectos.xlsx`
  - `Presupuestos y contratos.xlsx`
- Sin Excel: la app usa datos de prueba (mock).

Ver `data/README.md` para el detalle de columnas esperadas.

## Ejecucion con Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:4000
- La carpeta `data/` se monta en el contenedor del backend para leer los Excel.

## APIs

- `GET /api/health` - Estado y si se usan datos mock.
- `GET /api/funnel1?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=day|week|month` - Funnel 1.
- `GET /api/lineas` - Lineas disponibles para filtro.
- `POST /api/reload` - Recarga de Excel.

## Repositorio Git

Los archivos Excel (`.xlsx`, `.xls`) no se versionan. Quien clone el repo debe colocar sus propios archivos en `data/`.

## Documentacion

- `REGLAS_NEGOCIO_EMBUDO_VENTAS.md` - Reglas de negocio del embudo.
- `ANALISIS_WEB_FUNNEL_VENTAS.md` - Analisis funcional y tecnico.
- `docs/METRICAS_FUNNEL1.md` - Definicion de metricas visibles en la app.
- `backend_python/README.md` - Detalle tecnico del backend Python.
