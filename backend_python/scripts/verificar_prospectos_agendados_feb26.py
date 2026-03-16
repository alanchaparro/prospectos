#!/usr/bin/env python3
"""
Verificación: cuántos prospectos (Pautas Feb 2026 Odontología) se registraron
en agendamientos (Feb 2026 Odontología). Replica la lógica del funnel para dar
una respuesta correcta y desglosada.
"""
import os
import sys
from pathlib import Path

# Raíz del backend para importar app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("DATA_DIR", str(Path(__file__).resolve().parent.parent.parent / "data"))

from app.config import id_cliente_canonico, normalizar_linea
from app.funnel_dates import get_period_end, get_period_start, is_within_interval, period_key, to_date
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
    clientes_y_telefonos = raw.get("clientesYTelefonos") or {}

    # Parámetros: Feb 2026, Odontología
    from_str, to_str = "2026-02-01", "2026-02-28"
    granularity = "month"
    linea = "Odontologia"
    linea_norm = normalizar_linea(linea) if linea else ""

    from_date = get_period_start(from_str, granularity)
    to_limit = to_date(to_str)
    range_end = get_period_end(to_limit, granularity)

    # Filtrar por línea
    pautas_filtro = [p for p in pautas if p.get("linea") and normalizar_linea(p.get("linea")) == linea_norm]
    agendamientos_filtro = [a for a in agendamientos if a.get("linea") and normalizar_linea(a.get("linea")) == linea_norm]

    # En rango de fechas
    pautas_en_rango = [p for p in pautas_filtro if is_within_interval(to_date(p["fecha_contacto"]), from_date, range_end)]
    agendamientos_en_rango = [
        a for a in agendamientos_filtro
        if is_within_interval(to_date(a["fecha_agendamiento"]), from_date, range_end)
    ]

    # IDs canónicos de quienes tienen agendamiento en Feb 2026 Odontología
    agendamientos_canon = {id_cliente_canonico(a.get("id_prospecto")) for a in agendamientos_en_rango if id_cliente_canonico(a.get("id_prospecto"))}

    # Teléfonos de esos clientes (desde Clientes y telefonos)
    phones_agendamientos = set()
    for cid in agendamientos_canon:
        tels = clientes_y_telefonos.get(cid)
        if tels:
            phones_agendamientos.update(tels if isinstance(tels, (set, list)) else [tels])

    # Prospectos agendados: match por ID o por teléfono
    prospectos_agendados_set = set()
    match_por_id = 0
    match_por_tel = 0
    pautas_sin_telefono = 0
    pautas_con_telefono = 0
    pautas_id_numerico = 0
    pautas_id_fila = 0

    for p in pautas_en_rango:
        id_canon = id_cliente_canonico(p.get("id_prospecto"))
        tel = p.get("telefono")
        if tel:
            pautas_con_telefono += 1
        else:
            pautas_sin_telefono += 1
        if id_canon and (id_canon or "").isdigit():
            pautas_id_numerico += 1
        else:
            pautas_id_fila += 1

        if id_canon and id_canon in agendamientos_canon:
            prospectos_agendados_set.add("id:" + id_canon)
            match_por_id += 1
        elif tel and tel in phones_agendamientos:
            prospectos_agendados_set.add("tel:" + tel)
            match_por_tel += 1

    # Clientes con agendamiento que tienen teléfono en CYT
    clientes_agend_con_telefono = sum(1 for cid in agendamientos_canon if clientes_y_telefonos.get(cid))

    print()
    print("=" * 70)
    print("VERIFICACIÓN: Prospectos agendados — Feb 2026 Odontología")
    print("=" * 70)
    print()
    print("1. VOLÚMENES FILTRADOS")
    print(f"   • Prospectos (Pautas) en Feb 2026 Odontología:     {len(pautas_en_rango)}")
    print(f"   • Agendamientos (registros) en Feb 2026 Odontología: {len(agendamientos_en_rango)}")
    print(f"   • Clientes únicos con agendamiento en el período:  {len(agendamientos_canon)}")
    print()
    print("2. PAUTAS EN EL PERÍODO")
    print(f"   • Con teléfono cargado:    {pautas_con_telefono}")
    print(f"   • Sin teléfono:            {pautas_sin_telefono}")
    print(f"   • Con ID numérico (fila):  {pautas_id_numerico} (resto id tipo fila_X)")
    print(f"   • Con ID tipo fila_X:      {pautas_id_fila}")
    print()
    print("3. CRUCE CON AGENDAMIENTOS (Clientes y telefonos)")
    print(f"   • Clientes agendados que tienen teléfono en CYT:   {clientes_agend_con_telefono} de {len(agendamientos_canon)}")
    print(f"   • Teléfonos distintos de esos clientes:            {len(phones_agendamientos)}")
    print()
    print("4. PROSPECTOS AGENDADOS (coincidencia Pautas <-> Agendamientos)")
    print(f"   • Match por ID (prospecto tiene mismo id que cliente agendado): {match_por_id}")
    print(f"   • Match por teléfono (tel de pauta en phones de agendados):    {match_por_tel}")
    print(f"   • Total único (id + tel sin duplicar):              {len(prospectos_agendados_set)}")
    print()
    print("=" * 70)
    print(f"RESPUESTA: En Feb 2026 Odontología, según la misma lógica de la web,")
    print(f"           los prospectos que se registraron en agendamientos son: {len(prospectos_agendados_set)}")
    print("=" * 70)
    print()
    if len(prospectos_agendados_set) != 30:
        print("NOTA: Si la web muestra 30, este script usa los mismos datos y lógica;")
        print("      la diferencia puede deberse a caché o a que la web esté leyendo otro período/línea.")
    else:
        print("NOTA: El número coincide con lo que muestra la web (30).")


if __name__ == "__main__":
    main()
