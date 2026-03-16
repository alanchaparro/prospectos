# Funnel 2: coincidencias por período (prospectos que coinciden en agendamiento, presupuesto, contrato)
from datetime import timedelta
from typing import Any, Dict, List

from .config import id_cliente_canonico, normalizar_linea
from .funnel_dates import (
    get_period_end,
    get_period_start,
    is_within_interval,
    period_key,
    period_label,
    to_date,
)


def _to_records(df):
    if df is None or (hasattr(df, "empty") and df.empty):
        return []
    if hasattr(df, "to_dict"):
        return df.to_dict("records")
    return list(df)


def compute_funnel2(data: Dict[str, Any], params: Dict[str, Any]) -> List[Dict]:
    from_ = params.get("from") or ""
    to = params.get("to") or ""
    granularity = (params.get("granularity") or "month").lower()
    linea = (params.get("linea") or "").strip() or None

    from_date = get_period_start(from_, granularity)
    to_limit = to_date(to)
    range_end = get_period_end(to_limit, granularity)
    last_period_start = get_period_start(to, granularity)

    linea_norm = normalizar_linea(linea) if linea else ""
    pautas = _to_records(data.get("pautas"))
    agendamientos = _to_records(data.get("agendamientos"))
    clientes = _to_records(data.get("clientes"))
    presupuestos_contratos = _to_records(data.get("presupuestosContratos"))

    if linea_norm:
        pautas = [p for p in pautas if p.get("linea") and normalizar_linea(p.get("linea")) == linea_norm]
        agendamientos = [a for a in agendamientos if a.get("linea") and normalizar_linea(a.get("linea")) == linea_norm]

    pautas_in_range = [p for p in pautas if is_within_interval(to_date(p["fecha_contacto"]), from_date, range_end)]
    agendamientos_en_rango = [a for a in agendamientos if is_within_interval(to_date(a["fecha_agendamiento"]), from_date, range_end)]
    ids_agendamientos = {id_cliente_canonico(a["id_prospecto"]) for a in agendamientos_en_rango if id_cliente_canonico(a.get("id_prospecto"))}

    clientes_map = {id_cliente_canonico(c.get("id")): c for c in clientes if id_cliente_canonico(c.get("id"))}

    presupuestos_en_rango = []
    for pc in presupuestos_contratos:
        d_pres = to_date(pc.get("fecha_presupuesto")) if pc.get("fecha_presupuesto") else None
        d_cont = to_date(pc.get("fecha_contrato")) if pc.get("fecha_contrato") else None
        d = d_pres or d_cont
        if not d or not is_within_interval(d, from_date, range_end):
            continue
        cid = id_cliente_canonico(pc.get("id_prospecto"))
        if not cid or cid not in ids_agendamientos:
            continue
        if linea_norm:
            cli = clientes_map.get(cid)
            if cli and cli.get("linea") is not None and normalizar_linea(cli["linea"]) != linea_norm:
                continue
        presupuestos_en_rango.append(pc)
    ids_presupuesto = {id_cliente_canonico(p["id_prospecto"]) for p in presupuestos_en_rango}

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
    ids_contrato = {id_cliente_canonico(c["id"]) for c in clientes_con_contrato} if clientes else {
        id_cliente_canonico(p["id_prospecto"]) for p in presupuestos_en_rango if p.get("tiene_contrato") or p.get("fecha_contrato")
    }

    periods = {}
    for p in pautas_in_range:
        d = to_date(p["fecha_contacto"])
        key = period_key(d, granularity)
        if key not in periods:
            periods[key] = {"period": key, "label": period_label(d, granularity), "prospectos": set()}
        periods[key]["prospectos"].add(p.get("id_prospecto"))

    cur = from_date
    while cur <= last_period_start:
        key = period_key(cur, granularity)
        if key not in periods:
            periods[key] = {"period": key, "label": period_label(cur, granularity), "prospectos": set()}
        if granularity == "day":
            cur += timedelta(days=1)
        elif granularity == "week":
            cur += timedelta(days=7)
        else:
            if cur.month == 12:
                cur = cur.replace(year=cur.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            else:
                cur = cur.replace(month=cur.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)

    result = []
    for key in sorted(periods.keys()):
        rec = periods[key]
        ids = list(rec["prospectos"])
        con_agendamiento = sum(1 for id_ in ids if id_cliente_canonico(id_) in ids_agendamientos)
        con_presupuesto = sum(1 for id_ in ids if id_cliente_canonico(id_) in ids_presupuesto)
        con_contrato = sum(1 for id_ in ids if id_cliente_canonico(id_) in ids_contrato)
        result.append({
            "period": rec["period"],
            "label": rec["label"],
            "prospectos": len(ids),
            "coinciden_agendamiento": con_agendamiento,
            "coinciden_presupuesto": con_presupuesto,
            "coinciden_contrato": con_contrato,
        })
    return result
