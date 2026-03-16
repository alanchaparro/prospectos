#!/usr/bin/env python3
"""
Cuantos prospectos de Pautas (Feb 2026 Odontologia) cerraron contrato
en ese mismo mes y ano (Feb 2026). Usa la misma logica que el funnel.
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("DATA_DIR", str(Path(__file__).resolve().parent.parent.parent / "data"))

from app.config import id_cliente_canonico, normalizar_linea
from app.funnel_dates import get_period_end, get_period_start, is_within_interval, period_key, period_label, to_date
from app.load_data import get_datasets


def _to_records(df):
    if df is None or (hasattr(df, "empty") and df.empty):
        return []
    if hasattr(df, "to_dict"):
        return df.to_dict("records")
    return list(df)


def main():
    print("Cargando datos...")
    raw = get_datasets()
    pautas = _to_records(raw.get("pautas"))
    agendamientos = _to_records(raw.get("agendamientos"))
    clientes = _to_records(raw.get("clientes"))
    clientes_y_telefonos = raw.get("clientesYTelefonos") or {}

    from_str, to_str = "2026-02-01", "2026-02-28"
    granularity = "month"
    linea = "Odontologia"
    linea_norm = normalizar_linea(linea) if linea else ""

    from_date = get_period_start(from_str, granularity)
    to_limit = to_date(to_str)
    range_end = get_period_end(to_limit, granularity)

    pautas_filtro = [p for p in pautas if p.get("linea") and normalizar_linea(p.get("linea")) == linea_norm]
    pautas_en_rango = [p for p in pautas_filtro if is_within_interval(to_date(p["fecha_contacto"]), from_date, range_end)]

    # Clientes con contrato en Feb 2026 Odontologia (misma logica que funnel)
    clientes_con_contrato = [
        c for c in clientes
        if id_cliente_canonico(c.get("id"))
        and c.get("tiene_contrato")
        and c.get("contract_date")
        and c.get("control_calidad_confirmado", True) is not False
        and c.get("es_titular", True) is not False
        and is_within_interval(to_date(c["contract_date"]), from_date, range_end)
        and (not linea_norm or (c.get("linea") and normalizar_linea(c["linea"]) == linea_norm))
    ]
    ids_contrato_feb26 = {id_cliente_canonico(c["id"]) for c in clientes_con_contrato}

    # Prospecto = de Pautas en el periodo. Identificamos "prospecto_client_ids" por ID o por telefono (CYT)
    prospecto_phones = {p["telefono"] for p in pautas_en_rango if p.get("telefono")}
    prospecto_ids = {id_cliente_canonico(p.get("id_prospecto")) for p in pautas_en_rango if (id_cliente_canonico(p.get("id_prospecto")) or "").isdigit()}
    prospecto_client_ids = set(prospecto_ids)
    for cid, tels in (clientes_y_telefonos or {}).items():
        if not tels:
            continue
        t = list(tels) if isinstance(tels, set) else [tels]
        if any(ph in prospecto_phones for ph in t):
            prospecto_client_ids.add(cid)

    # Cuantos de los que cerraron contrato en Feb 2026 son "prospectos" (de Pautas Feb 2026 Odontologia)
    contratos_de_prospectos = ids_contrato_feb26 & prospecto_client_ids

    print()
    print("=" * 70)
    print("Prospectos Feb 2026 Odontologia que cerraron contrato en Feb 2026")
    print("=" * 70)
    print()
    print("Prospectos (Pautas) en Feb 2026 Odontologia:           ", len(pautas_en_rango))
    print("Clientes con contrato en Feb 2026 Odontologia (total):  ", len(ids_contrato_feb26))
    print("De esos, identificados como prospectos (por tel/ID):    ", len(prospecto_client_ids), "client IDs")
    print()
    print("RESPUESTA: Prospectos que cerraron contrato en el mismo mes/ano:", len(contratos_de_prospectos))
    print("=" * 70)


if __name__ == "__main__":
    main()
