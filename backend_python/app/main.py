# API embudo de ventas (FastAPI)
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import funnel1, load_data

_load_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _load_task
    _load_task = asyncio.create_task(asyncio.to_thread(load_data.get_datasets))
    yield
    _load_task = None
    load_data.clear_cache()


app = FastAPI(title="API Embudo de Ventas", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


async def ensure_data():
    global _load_task
    try:
        if _load_task is not None:
            await _load_task
            _load_task = None
        load_data.get_datasets()
    except Exception as e:
        print("Error al cargar datos:", e)
        load_data.clear_cache()
        _load_task = asyncio.create_task(asyncio.to_thread(load_data.get_datasets))
        await _load_task
        _load_task = None
        load_data.get_datasets()


@app.get("/api/health")
async def health():
    await ensure_data()
    return {"ok": True, "mock": load_data.is_using_mock()}


@app.get("/api/debug/headers")
def debug_headers():
    try:
        return load_data.get_excel_headers()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/debug/contratos")
async def debug_contratos(
    from_: str = Query("2026-02-01", alias="from"),
    to: str = Query("2026-02-28", alias="to"),
    linea: str = None,
):
    try:
        await ensure_data()
        data = load_data.get_datasets()
        result = funnel1.compute_funnel1(data, {"from": from_, "to": to, "granularity": "month", "linea": linea})
        period_key = from_[:7]
        row = next((r for r in result if r["period"] == period_key), None)
        return {
            "from": from_,
            "to": to,
            "linea": linea or "todas",
            "period": period_key,
            "contratos": row["contratos"] if row else 0,
            "dataPeriods": [{"period": r["period"], "contratos": r["contratos"]} for r in result],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/debug/telefonos")
async def debug_telefonos(
    prefix: str = "",
    limit: int = 100,
    tiene_contrato: bool | None = None,
):
    try:
        await ensure_data()
        data = load_data.get_phone_registry(prefix=prefix, limit=limit, tiene_contrato=tiene_contrato)
        return {
            "prefix": prefix or None,
            "limit": limit,
            "tiene_contrato": tiene_contrato,
            "count": len(data),
            "data": data,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/lineas")
async def get_lineas():
    try:
        await ensure_data()
        data = load_data.get_datasets()
        pautas = data.get("pautas")
        if pautas is None or (hasattr(pautas, "empty") and pautas.empty):
            return {"lineas": []}
        if hasattr(pautas, "columns") and "linea" in pautas.columns:
            lineas = sorted(pautas["linea"].dropna().unique().tolist())
        else:
            lineas = sorted({r.get("linea") for r in _to_records(pautas) if r.get("linea")})
        return {"lineas": lineas}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/supervisores")
async def get_supervisores():
    try:
        await ensure_data()
        return {"supervisores": load_data.get_supervisores()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _to_records(df):
    if df is None or (hasattr(df, "empty") and df.empty):
        return []
    if hasattr(df, "to_dict"):
        return df.to_dict("records")
    return list(df)


@app.get("/api/funnel1")
async def get_funnel1(
    from_: str = Query(None, alias="from"),
    to: str = Query(None, alias="to"),
    granularity: str = "month",
    linea: str = None,
    supervisor: str = None,
):
    if not from_ or not to:
        raise HTTPException(status_code=400, detail="Faltan parametros: from, to (YYYY-MM-DD)")
    if granularity.lower() not in ("day", "week", "month"):
        raise HTTPException(status_code=400, detail="granularity debe ser day, week o month")
    try:
        await ensure_data()
        data = load_data.get_datasets()
        data = {
            "pautas": _to_records(data.get("pautas")),
            "agendamientos": _to_records(data.get("agendamientos")),
            "presupuestosContratos": _to_records(data.get("presupuestosContratos")),
            "clientes": _to_records(data.get("clientes")),
            "clientesYTelefonos": data.get("clientesYTelefonos"),
            "ventas": _to_records(data.get("ventas")),
        }
        result = funnel1.compute_funnel1(
            data,
            {
                "from": from_,
                "to": to,
                "granularity": granularity.lower(),
                "linea": linea,
                "supervisor": supervisor,
            },
        )
        return {"granularity": granularity.lower(), "linea": linea or None, "supervisor": supervisor or None, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/reload")
async def reload():
    try:
        load_data.clear_cache()
        await ensure_data()
        return {"ok": True, "mock": load_data.is_using_mock()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=4000)
