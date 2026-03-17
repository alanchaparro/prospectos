# Funnel 1: metricas por periodo
from datetime import datetime, timedelta
from typing import Any, Dict, List, Set

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


def _to_phone_set(values) -> Set[str]:
    if not values:
        return set()
    if isinstance(values, (set, list, tuple)):
        return {str(v) for v in values if v}
    return {str(values)}


def compute_funnel1(data: Dict[str, Any], params: Dict[str, Any]) -> List[Dict]:
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
    clientes_y_telefonos = data.get("clientesYTelefonos") or {}

    if linea_norm:
        pautas = [p for p in pautas if p.get("linea") and normalizar_linea(p.get("linea")) == linea_norm]
        agendamientos = [a for a in agendamientos if a.get("linea") and normalizar_linea(a.get("linea")) == linea_norm]

    pautas_all = _to_records(data.get("pautas"))
    if linea_norm:
        pautas_all = [p for p in pautas_all if p.get("linea") and normalizar_linea(p.get("linea")) == linea_norm]

    telefono_a_periodos_pautas: Dict[str, Set[str]] = {}
    for p in pautas_all:
        tel = p.get("telefono")
        if not tel or len(str(tel).strip()) < 8:
            continue
        d = to_date(p.get("fecha_contacto")) if p.get("fecha_contacto") else None
        if not d:
            continue
        telefono_a_periodos_pautas.setdefault(tel, set()).add(period_key(d, granularity))

    agendamientos_in_range = [
        a for a in agendamientos if is_within_interval(to_date(a["fecha_agendamiento"]), from_date, range_end)
    ]

    clientes_map = {id_cliente_canonico(c.get("id")): c for c in clientes if id_cliente_canonico(c.get("id"))}

    presupuestos_in_range = []
    for pc in presupuestos_contratos:
        d_pres = to_date(pc["fecha_presupuesto"]) if pc.get("fecha_presupuesto") else None
        d_cont = to_date(pc["fecha_contrato"]) if pc.get("fecha_contrato") else d_pres
        en_rango = (d_pres and is_within_interval(d_pres, from_date, range_end)) or (
            d_cont and is_within_interval(d_cont, from_date, range_end)
        )
        if not en_rango:
            continue
        cid = id_cliente_canonico(pc.get("id_prospecto"))
        if not cid:
            continue
        if linea_norm:
            cli = clientes_map.get(cid)
            if cli and cli.get("linea") is not None and normalizar_linea(cli["linea"]) != linea_norm:
                continue
        presupuestos_in_range.append(pc)

    periods: Dict[str, Dict] = {}

    def ensure_period(d: datetime) -> Dict:
        key = period_key(d, granularity)
        if key not in periods:
            periods[key] = {
                "period": key,
                "label": period_label(d, granularity),
                "prospectos": set(),
                "pautas_list": [],
                "agendamientos": set(),
                "presupuestos": set(),
                "contratos": set(),
                "contratos_total": 0,
            }
        return periods[key]

    for p in pautas:
        d = to_date(p["fecha_contacto"])
        if not is_within_interval(d, from_date, range_end):
            continue
        rec = ensure_period(d)
        pid = p.get("id_prospecto")
        if pid:
            rec["prospectos"].add(pid)
        rec["pautas_list"].append(p)

    for a in agendamientos_in_range:
        d = to_date(a["fecha_agendamiento"])
        rec = ensure_period(d)
        cid = id_cliente_canonico(a.get("id_prospecto"))
        if cid:
            rec["agendamientos"].add(cid)

    primer_presupuesto = {}
    for pc in presupuestos_in_range:
        cid = id_cliente_canonico(pc.get("id_prospecto"))
        if not cid or not pc.get("fecha_presupuesto"):
            continue
        d = to_date(pc["fecha_presupuesto"])
        if cid not in primer_presupuesto or d < to_date(primer_presupuesto[cid]["fecha_presupuesto"]):
            primer_presupuesto[cid] = pc

    for pc in primer_presupuesto.values():
        d = to_date(pc["fecha_presupuesto"])
        if not is_within_interval(d, from_date, range_end):
            continue
        rec = ensure_period(d)
        cid = id_cliente_canonico(pc.get("id_prospecto"))
        if cid not in rec["agendamientos"]:
            continue
        rec["presupuestos"].add(cid)

    clientes_con_contrato = [
        c
        for c in clientes
        if id_cliente_canonico(c.get("id"))
        and c.get("tiene_contrato")
        and c.get("contract_date")
        and c.get("control_calidad_confirmado", True) is not False
        and c.get("es_titular", True) is not False
        and is_within_interval(to_date(c["contract_date"]), from_date, range_end)
        and (not linea_norm or (c.get("linea") and normalizar_linea(c["linea"]) == linea_norm))
    ]

    for c in clientes_con_contrato:
        cid = id_cliente_canonico(c["id"])
        d = to_date(c["contract_date"])
        rec = ensure_period(d)
        rec["contratos_total"] = rec.get("contratos_total", 0) + 1
        rec["contratos"].add(cid)

    if not clientes_con_contrato and not clientes:
        for pc in presupuestos_in_range:
            if pc.get("fecha_contrato") or pc.get("tiene_contrato"):
                d = to_date(pc.get("fecha_contrato") or pc.get("fecha_presupuesto"))
                if d and is_within_interval(d, from_date, range_end):
                    rec = ensure_period(d)
                    rec["contratos_total"] = rec.get("contratos_total", 0) + 1
                    rec["contratos"].add(id_cliente_canonico(pc.get("id_prospecto")))

    cur = from_date
    while cur <= last_period_start:
        ensure_period(cur)
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
        r = periods[key]
        periodo_actual = r["period"]

        agendamientos_canon = {id_cliente_canonico(x) for x in r["agendamientos"] if id_cliente_canonico(x)}
        phones_agendamientos = set()
        for cid in agendamientos_canon:
            phones_agendamientos.update(_to_phone_set(clientes_y_telefonos.get(cid)))

        prospectos_agendados_set = set()
        for p in r.get("pautas_list") or []:
            id_canon = id_cliente_canonico(p.get("id_prospecto"))
            if id_canon and id_canon in agendamientos_canon:
                prospectos_agendados_set.add("id:" + id_canon)
            elif p.get("telefono") and p["telefono"] in phones_agendamientos:
                prospectos_agendados_set.add("tel:" + p["telefono"])

        prospecto_phones = {p["telefono"] for p in (r.get("pautas_list") or []) if p.get("telefono")}
        prospecto_ids = {
            id_cliente_canonico(p.get("id_prospecto"))
            for p in (r.get("pautas_list") or [])
            if (id_cliente_canonico(p.get("id_prospecto")) or "").isdigit()
        }
        prospecto_client_ids = set(prospecto_ids)
        for cid, tels in (clientes_y_telefonos or {}).items():
            if any(ph in prospecto_phones for ph in _to_phone_set(tels)):
                prospecto_client_ids.add(cid)

        def classify_stage_ids(stage_ids: Set[str]) -> Dict[str, Set[str]]:
            same_period_ids: Set[str] = set()
            old_ids: Set[str] = set()
            other_ids: Set[str] = set()
            for cid in stage_ids:
                if cid in prospecto_client_ids:
                    same_period_ids.add(cid)
                    continue
                phones = _to_phone_set(clientes_y_telefonos.get(cid))
                if not phones:
                    other_ids.add(cid)
                    continue
                matched_same_period = False
                matched_old_period = False
                for tel in phones:
                    periodos_pauta = telefono_a_periodos_pautas.get(tel) or set()
                    if periodo_actual in periodos_pauta:
                        matched_same_period = True
                    if any(periodo != periodo_actual for periodo in periodos_pauta):
                        matched_old_period = True
                if matched_same_period:
                    same_period_ids.add(cid)
                elif matched_old_period:
                    old_ids.add(cid)
                else:
                    other_ids.add(cid)
            return {"meta": same_period_ids, "viejos": old_ids, "otras": other_ids}

        agendamientos_split = classify_stage_ids(r["agendamientos"])
        presupuestos_split = classify_stage_ids(r["presupuestos"])
        contratos_split = classify_stage_ids(r["contratos"])

        presupuestos_de_prospectos = len(presupuestos_split["meta"])
        contratos_de_prospectos = len(contratos_split["meta"])
        prospectos_viejos_count = len(contratos_split["viejos"])
        otras_fuentes_count = len(contratos_split["otras"])
        universo_total = len(r["prospectos"]) + prospectos_viejos_count + otras_fuentes_count

        result.append(
            {
                "period": r["period"],
                "label": r["label"],
                "prospectos": len(r["prospectos"]),
                "prospectos_agendados": len(prospectos_agendados_set),
                "agendamientos": len(r["agendamientos"]),
                "agendamientos_de_prospectos": len(agendamientos_split["meta"]),
                "agendamientos_prospectos_viejos": len(agendamientos_split["viejos"]),
                "agendamientos_otras_fuentes": len(agendamientos_split["otras"]),
                "presupuestos": len(r["presupuestos"]),
                "presupuestos_de_prospectos": presupuestos_de_prospectos,
                "presupuestos_prospectos_viejos": len(presupuestos_split["viejos"]),
                "presupuestos_otras_fuentes": len(presupuestos_split["otras"]),
                "contratos": r.get("contratos_total") or len(r["contratos"]),
                "contratos_de_prospectos": contratos_de_prospectos,
                "contratos_prospectos_viejos": len(contratos_split["viejos"]),
                "contratos_otras_fuentes": len(contratos_split["otras"]),
                "clientes_unicos": len(r["contratos"]),
                "clientes_unicos_de_prospectos": contratos_de_prospectos,
                "clientes_unicos_prospectos_viejos": len(contratos_split["viejos"]),
                "clientes_unicos_otras_fuentes": len(contratos_split["otras"]),
                "prospectos_viejos": prospectos_viejos_count,
                "otras_fuentes": otras_fuentes_count,
                "universo_total": universo_total,
            }
        )
    return result
