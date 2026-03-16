# Embudo de ventas – Web

Aplicación web para visualizar el funnel de ventas (prospectos → agendamientos → presupuestos → contratos) con dos vistas: métricas por período (Funnel 1) y conversión por coincidencias (Funnel 2).

## Requisitos

- Node.js 20+
- (Opcional) Docker y Docker Compose

## Ejecución en local

### Backend

```bash
cd backend
npm install
npm run dev
```

API en `http://localhost:4000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App en `http://localhost:3000`. El proxy de Vite redirige `/api` al backend.

### Datos

- **Con Excel:** Coloca los archivos en la carpeta `data/`:
  - `Pautas-ThinkChat-2025-2026.xlsx`
  - `agendamientos-prospectos.xlsx`
  - `Presupuestos y contratos.xlsx`
- **Sin Excel:** La app usa datos de prueba (mock) automáticamente.

Ver `data/README.md` para el detalle de columnas esperadas.

## Ejecución con Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:4000
- La carpeta `data/` se monta en el contenedor del backend para leer los Excel.

## APIs

- `GET /api/health` – Estado y si se usan datos mock.
- `GET /api/funnel1?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=day|week|month` – Funnel 1 (métricas por período).
- `GET /api/funnel2?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=day|week|month` – Funnel 2 (coincidencias/conversión).

## Repositorio Git

El proyecto está preparado para subir a Git. **Los archivos Excel (`.xlsx`) no se versionan**: están en `.gitignore` para no subir datos sensibles.

- Quien clone el repo debe colocar sus propios Excel en `data/` (ver `data/README.md`). Sin ellos, la app usa datos de prueba.

### Subir / actualizar en GitHub

Repositorio: [github.com/alanchaparro/prospectos](https://github.com/alanchaparro/prospectos)

```bash
git add .
git commit -m "Embudo de ventas: frontend, backend Python, Docker"
git branch -M main
git remote add origin https://github.com/alanchaparro/prospectos.git
git push -u origin main
```

Para actualizar después de cambios: `git add .` → `git commit -m "mensaje"` → `git push`.

## Documentación

- `REGLAS_NEGOCIO_EMBUDO_VENTAS.md` – Reglas de negocio del embudo.
- `ANALISIS_WEB_FUNNEL_VENTAS.md` – Análisis funcional y técnico.
