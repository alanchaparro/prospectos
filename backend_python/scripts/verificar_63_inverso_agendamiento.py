#!/usr/bin/env python3
"""
1) Verifica que los 63 clientes unicos (contratos de prospectos Feb 2026 Odontologia)
   tengan su numero de telefono registrado en Clientes y telefonos.
2) Analisis a la inversa: desde cada uno de esos 63 clientes, obtener todos sus
   telefonos de CYT y agregarlos (sin reemplazar) al prospecto que coincidio por telefono,
   para ver si asi aumentan las coincidencias con agendamientos.
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("DATA_DIR", str(Path(__file__).resolve().parent.parent.parent / "data"))

from app.config import id_cliente_canonico, normalizar_linea, normalizar_telefono
from app.funnel_dates import get_period_end, get_period_start, is_within_interval, to_date
from app.load_data import get_datasets


def _to_records(df):
    if df is None or (hasattr(df, "empty") and df.empty):
        return []
    if hasattr(df, "to_dict"):
        return df.to_dict("records")
    return list(df)


def main():
    DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parent.parent.parent / "data"))

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
    agendamientos_filtro = [a for a in agendamientos if a.get("linea") and normalizar_linea(a.get("linea")) == linea_norm]
    agendamientos_en_rango = [
        a for a in agendamientos_filtro
        if is_within_interval(to_date(a["fecha_agendamiento"]), from_date, range_end)
    ]
    agendamientos_canon = {id_cliente_canonico(a.get("id_prospecto")) for a in agendamientos_en_rango if id_cliente_canonico(a.get("id_prospecto"))}

    # Clientes con contrato Feb 2026 Odontologia
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

    # Prospecto -> client_ids (por telefono en CYT)
    prospecto_phones = {p.get("telefono") for p in pautas_en_rango if p.get("telefono")}
    prospecto_client_ids = set()
    for cid, tels in (clientes_y_telefonos or {}).items():
        t = list(tels) if isinstance(tels, set) else [tels]
        if any(ph in prospecto_phones for ph in t):
            prospecto_client_ids.add(cid)

    # Los 63: clientes que cerraron contrato Y son prospectos
    los_63 = ids_contrato_feb26 & prospecto_client_ids

    # --- 1) Verificacion: los 63 tienen telefono en CYT? ---
    con_telefono = 0
    sin_telefono = 0
    phones_por_cliente_63 = {}
    for cid in los_63:
        tels = clientes_y_telefonos.get(cid)
        if tels:
            con_telefono += 1
            phones_por_cliente_63[cid] = set(tels) if isinstance(tels, (set, list)) else {tels}
        else:
            sin_telefono += 1
            phones_por_cliente_63[cid] = set()

    print()
    print("=" * 70)
    print("1) VERIFICACION: Los 63 (contratos de prospectos) y CYT")
    print("=" * 70)
    print("   Clientes unicos que cerraron contrato (prospectos): 63")
    print("   De los 63, con al menos 1 telefono en CYT:         ", con_telefono)
    print("   De los 63, SIN telefono en CYT:                   ", sin_telefono)
    if sin_telefono > 0:
        print("   (Esos", sin_telefono, "no tienen numero en Clientes y telefonos)")

    # --- 2) Inverso: por cada prospecto, si su telefono coincide con alguno de los 63, agregar los demas telefonos de ese cliente (no reemplazar, agregar) ---
    # phones_agend = telefonos de los 372 agendados (para matchear "prospectos agendados")
    phones_agend = set()
    for cid in agendamientos_canon:
        tels = clientes_y_telefonos.get(cid)
        if tels:
            phones_agend.update(tels if isinstance(tels, (set, list)) else [tels])

    # Para cada prospecto en pautas_en_rango: telefono original + opcionalmente telefonos "nuevos" del cliente (63) al que matchea
    # prospecto index i -> set de todos los telefonos (original + agregados desde CYT del cliente vinculado)
    prospectos_phones_enriquecidos = []
    for p in pautas_en_rango:
        tel_pauta = p.get("telefono")
        phones_prospecto = {tel_pauta} if tel_pauta else set()
        # Buscar si este prospecto matchea a alguno de los 63 (por telefono)
        for cid in los_63:
            cyt_phones = phones_por_cliente_63.get(cid, set())
            if tel_pauta and tel_pauta in cyt_phones:
                # Agregar todos los telefonos de ese cliente (no reemplazar, agregar)
                phones_prospecto.update(cyt_phones)
                break
        prospectos_phones_enriquecidos.append(phones_prospecto)

    # Prospectos agendados SIN enriquecimiento (solo telefono Pauta): match si tel_pauta in phones_agend, dedup por tel
    match_sin_enriquecer = set()
    for p in pautas_en_rango:
        t = p.get("telefono")
        if t and t in phones_agend:
            match_sin_enriquecer.add("tel:" + t)

    # Prospectos agendados CON enriquecimiento: match si CUALQUIER telefono del prospecto (original + agregados) esta en phones_agend, dedup por prospecto
    match_con_enriquecer = set()
    for i, phones_prospecto in enumerate(prospectos_phones_enriquecidos):
        if any(t in phones_agend for t in phones_prospecto if t):
            match_con_enriquecer.add(i)

    # Dedup por telefono para comparar con la web (30)
    match_con_enriquecer_por_tel = set()
    for i, phones_prospecto in enumerate(prospectos_phones_enriquecidos):
        if any(t in phones_agend for t in phones_prospecto if t):
            for t in phones_prospecto:
                if t and t in phones_agend:
                    match_con_enriquecer_por_tel.add("tel:" + t)
                    break

    print()
    print("=" * 70)
    print("2) ANALISIS A LA INVERSA (agregar numero del cliente en CYT al prospecto)")
    print("=" * 70)
    print("   Prospectos en periodo:                             ", len(pautas_en_rango))
    print("   Phones de agendados (372 clientes, CYT):           ", len(phones_agend))
    print()
    print("   Prospectos agendados SIN enriquecer (solo tel Pauta, dedup por tel): ", len(match_sin_enriquecer))
    print("   Prospectos agendados CON enriquecer (tel Pauta + teles CYT del 63):  ", len(match_con_enriquecer), "(unicos por prospecto)")
    print("   Mismo con dedup por telefono:                      ", len(match_con_enriquecer_por_tel))
    print()
    if len(match_con_enriquecer) > len(match_sin_enriquecer):
        print("   -> Enriquecer (agregar teles de CYT del cliente) suma", len(match_con_enriquecer) - len(match_sin_enriquecer), "prospectos mas que coinciden con agendamiento.")
    else:
        print("   -> No se suman coincidencias nuevas con este enriquecimiento (los 63 ya matcheaban por telefono).")
    print("=" * 70)


if __name__ == "__main__":
    main()
