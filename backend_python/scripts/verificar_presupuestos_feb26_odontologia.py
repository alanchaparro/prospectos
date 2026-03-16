#!/usr/bin/env python3
"""
Verifica que los numeros de Presupuestos y Presupuestos de prospectos
para Feb 2026 Odontologia sean correctos (143 y 16) y por que hay mas de 400 contratos.
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("DATA_DIR", str(Path(__file__).resolve().parent.parent.parent / "data"))

from app.config import id_cliente_canonico, normalizar_linea
from app.funnel_dates import get_period_end, get_period_start, is_within_interval, to_date
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
    presupuestos_contratos = _to_records(raw.get("presupuestosContratos"))
    clientes_y_telefonos = raw.get("clientesYTelefonos") or {}

    from_str, to_str = "2026-02-01", "2026-02-28"
    granularity = "month"
    linea = "Odontologia"
    linea_norm = normalizar_linea(linea) if linea else ""
    from_date = get_period_start(from_str, granularity)
    to_limit = to_date(to_str)
    range_end = get_period_end(to_limit, granularity)

    clientes_map = {id_cliente_canonico(c.get("id")): c for c in clientes if id_cliente_canonico(c.get("id"))}

    # Agendamientos Feb 2026 Odontologia (clientes unicos)
    agendamientos_filtro = [a for a in agendamientos if a.get("linea") and normalizar_linea(a.get("linea")) == linea_norm]
    agendamientos_en_rango = [
        a for a in agendamientos_filtro
        if is_within_interval(to_date(a["fecha_agendamiento"]), from_date, range_end)
    ]
    ids_agendamiento_feb26 = {id_cliente_canonico(a.get("id_prospecto")) for a in agendamientos_en_rango if id_cliente_canonico(a.get("id_prospecto"))}

    # Presupuestos: filtrar por fecha en rango, estado 5/10/15 ya aplicado en load, y linea (via clientes_map)
    presupuestos_feb26 = []
    for pc in presupuestos_contratos:
        d_pres = to_date(pc.get("fecha_presupuesto")) if pc.get("fecha_presupuesto") else None
        d_cont = to_date(pc.get("fecha_contrato")) if pc.get("fecha_contrato") else d_pres
        en_rango = (d_pres and is_within_interval(d_pres, from_date, range_end)) or (d_cont and is_within_interval(d_cont, from_date, range_end))
        if not en_rango:
            continue
        cid = id_cliente_canonico(pc.get("id_prospecto"))
        if not cid:
            continue
        if linea_norm:
            cli = clientes_map.get(cid)
            if cli and cli.get("linea") is not None and normalizar_linea(cli["linea"]) != linea_norm:
                continue
        presupuestos_feb26.append(pc)

    # Primer presupuesto por cliente (fecha mas antigua)
    primer_presupuesto = {}
    for pc in presupuestos_feb26:
        cid = id_cliente_canonico(pc.get("id_prospecto"))
        if not cid or not pc.get("fecha_presupuesto"):
            continue
        d = to_date(pc["fecha_presupuesto"])
        if cid not in primer_presupuesto or d < to_date(primer_presupuesto[cid]["fecha_presupuesto"]):
            primer_presupuesto[cid] = pc

    # REGLA DEL FUNNEL: solo contar presupuesto si el cliente tuvo AGENDAMIENTO en el mismo periodo (Feb 2026)
    presupuestos_con_agendamiento_en_periodo = []
    for pc in primer_presupuesto.values():
        d = to_date(pc["fecha_presupuesto"])
        if not is_within_interval(d, from_date, range_end):
            continue
        cid = id_cliente_canonico(pc.get("id_prospecto"))
        if cid not in ids_agendamiento_feb26:
            continue
        presupuestos_con_agendamiento_en_periodo.append(pc)

    ids_presupuestos_143 = {id_cliente_canonico(pc.get("id_prospecto")) for pc in presupuestos_con_agendamiento_en_periodo}

    # Prospectos (Pautas Feb 2026 Odontologia) -> client_ids por telefono
    pautas_filtro = [p for p in pautas if p.get("linea") and normalizar_linea(p.get("linea")) == linea_norm]
    pautas_en_rango = [p for p in pautas_filtro if is_within_interval(to_date(p["fecha_contacto"]), from_date, range_end)]
    prospecto_phones = {p.get("telefono") for p in pautas_en_rango if p.get("telefono")}
    prospecto_client_ids = set()
    for cid, tels in (clientes_y_telefonos or {}).items():
        t = list(tels) if isinstance(tels, set) else [tels]
        if any(ph in prospecto_phones for ph in t):
            prospecto_client_ids.add(cid)

    # Presupuestos de prospectos = de los 143, cuantos son clientes en prospecto_client_ids
    presupuestos_de_prospectos_ids = ids_presupuestos_143 & prospecto_client_ids

    # Contratos Feb 2026 Odontologia (total)
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
    total_contratos_feb26 = len(clientes_con_contrato)

    # Cuantos de los que cerraron contrato tenian agendamiento en Feb 2026?
    ids_contrato = {id_cliente_canonico(c["id"]) for c in clientes_con_contrato}
    contratos_con_agendamiento_feb26 = ids_contrato & ids_agendamiento_feb26

    print()
    print("=" * 70)
    print("VERIFICACION: Presupuestos y Contratos Feb 2026 Odontologia")
    print("=" * 70)
    print()
    print("1) PRESUPUESTOS (estado 5/10/15, fecha en Feb 2026, linea Odontologia)")
    print("   Filas en Presupuestos y contratos con fecha en rango:     ", len(presupuestos_feb26))
    print("   Clientes unicos (primer presupuesto por cliente):         ", len(primer_presupuesto))
    print()
    print("2) REGLA DEL FUNNEL: solo contar si el cliente AGENDO en Feb 2026")
    print("   Clientes unicos con agendamiento en Feb 2026 Odontologia: ", len(ids_agendamiento_feb26))
    print("   De los presupuestos en rango, clientes que ademas agendaron en Feb 26:", len(ids_presupuestos_143))
    print("   -> PRESUPUESTOS (web) = clientes unicos con presupuesto en Feb 26 Y agendamiento en Feb 26:", len(ids_presupuestos_143))
    print()
    print("3) PRESUPUESTOS DE PROSPECTOS (cliente vinculado a Pautas Feb 26 por telefono)")
    print("   De esos", len(ids_presupuestos_143), "clientes, cuantos son 'prospectos' (match por tel en CYT):", len(presupuestos_de_prospectos_ids))
    print("   -> PRESUPUESTOS DE PROSPECTOS (web) =", len(presupuestos_de_prospectos_ids))
    print()
    print("4) CONTRATOS Feb 2026 Odontologia (clientes.xlsx)")
    print("   Total clientes unicos con contrato en Feb 2026 Odontologia:", total_contratos_feb26)
    print("   De esos, cuantos tenian agendamiento en Feb 2026:          ", len(contratos_con_agendamiento_feb26))
    print()
    print("5) POR QUE PRESUPUESTOS (143) ES MENOR QUE CONTRATOS (400+)?")
    print("   Porque el funnel solo cuenta PRESUPUESTOS de clientes que agendaron EN EL MISMO MES (Feb 2026).")
    print("   Muchos de los 400+ contratos son de clientes que agendaron en otro mes (ej. enero o antes)")
    print("   y cerraron contrato en febrero. Esos no entran en 'presupuestos' del periodo Feb 2026.")
    print()
    print("   Resumen:")
    print("   - Presupuestos (143) = clientes con presupuesto en Feb 26 Y que agendaron en Feb 26.")
    print("   - Contratos (", total_contratos_feb26, ") = todos los que cerraron contrato en Feb 26 (agendaron cuando sea).", sep="")
    print()
    print("6) CONFIRMACION")
    if len(ids_presupuestos_143) == 143 and len(presupuestos_de_prospectos_ids) == 16:
        print("   Los numeros 143 y 16 son CORRECTOS segun la logica actual del funnel.")
    else:
        print("   Presupuestos calculados:", len(ids_presupuestos_143), "(esperado 143)")
        print("   Presupuestos de prospectos:", len(presupuestos_de_prospectos_ids), "(esperado 16)")
    print("=" * 70)


if __name__ == "__main__":
    main()
