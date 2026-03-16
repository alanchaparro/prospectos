# Backend API – Embudo de ventas (Python)

API del embudo de ventas implementada en **Python** con FastAPI y pandas.

## Requisitos

- Python 3.12+
- Dependencias: `pip install -r requirements.txt`

## Estructura

```
backend_python/
  app/
    main.py         # FastAPI, rutas /api/*
    config.py       # parse_date, columnas, normalización
    load_data.py    # Carga de Excel (pandas), get_datasets
    funnel_dates.py # Períodos (día/semana/mes)
    funnel1.py      # Funnel 1 por tiempo
    funnel2.py      # Funnel 2 por coincidencias
  requirements.txt
  Dockerfile
```

## Ejecución local

```bash
cd backend_python
pip install -r requirements.txt
export DATA_DIR=../data   # o la ruta donde están los .xlsx
uvicorn app.main:app --host 0.0.0.0 --port 4000
```

## Docker

El `docker-compose` del proyecto raíz usa este backend:

```bash
docker compose build backend
docker compose up -d backend
```

El volumen `./data` se monta en `/app/data`; los Excel deben estar en `data/`.

## Endpoints

- `GET /api/health` – Estado y origen de datos (mock/Excel).
- `GET /api/lineas` – Lista de líneas (para filtro).
- `GET /api/funnel1?from=...&to=...&granularity=month&linea=...` – Métricas por período.
- `GET /api/funnel2?from=...&to=...&granularity=month&linea=...` – Coincidencias por período.
- `POST /api/reload` – Fuerza recarga de Excel.
- `GET /api/debug/headers` – Columnas detectadas en cada Excel.
- `GET /api/debug/contratos` – Comprobación de conteo de contratos.
