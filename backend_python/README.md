# Backend Python - Embudo de ventas

API del embudo de ventas implementada en Python con FastAPI y pandas.

## Requisitos

- Python 3.12+
- Dependencias: `pip install -r requirements.txt`

## Estructura

```text
backend_python/
  app/
    main.py
    config.py
    load_data.py
    funnel_dates.py
    funnel1.py
  tests/
    test_funnel1.py
  requirements.txt
  Dockerfile
```

## Ejecucion local

```bash
cd backend_python
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 4000
```

Si los Excel no estan en `../data`, define `DATA_DIR`.

## Endpoints

- `GET /api/health`
- `GET /api/lineas`
- `GET /api/funnel1?from=...&to=...&granularity=month&linea=...`
- `POST /api/reload`
- `GET /api/debug/headers`
- `GET /api/debug/contratos`
- `GET /api/debug/telefonos?prefix=961&limit=50&tiene_contrato=true`

## Tests

La carpeta `tests/` contiene pruebas de regresion para `funnel1`.

```bash
cd backend_python
pytest
```
