#!/usr/bin/env python3
"""
Cruza prospectos (Pautas) con agendamientos usando varias claves: telefono, email, nombre.
Reporta cuantas coincidencias hay solo por telefono vs telefono+email vs telefono+nombre, etc.
Feb 2026 Odontologia.
"""
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("DATA_DIR", str(Path(__file__).resolve().parent.parent.parent / "data"))

import pandas as pd
from app.config import id_cliente_canonico, normalizar_linea, normalizar_telefono, parse_date
from app.funnel_dates import get_period_end, get_period_start, is_within_interval, to_date
from app.load_data import get_datasets


def _to_records(df):
    if df is None or (hasattr(df, "empty") and df.empty):
        return []
    if hasattr(df, "to_dict"):
        return df.to_dict("records")
    return list(df)


def normalizar_email(s):
    if not s or pd.isna(s):
        return ""
    s = str(s).strip().lower()
    s = re.sub(r"\s+", "", s)
    return s


def normalizar_nombre(s):
    if not s or pd.isna(s):
        return ""
    s = str(s).strip().lower()
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"[^\w\sáéíóúñü]", "", s, flags=re.I)
    return " ".join(s.split()) if s else ""


def main():
    DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parent.parent.parent / "data"))

    print("1. Descubriendo columnas en cada archivo...")
    # Pautas - todas las columnas
    pautas_raw = pd.read_excel(DATA_DIR / "Pautas-ThinkChat-2025-2026.xlsx", sheet_name=0, header=0, nrows=5)
    print("   Pautas:", list(pautas_raw.columns))

    try:
        age_raw = pd.read_excel(DATA_DIR / "agendamientos-prospectos.xlsx", sheet_name=0, nrows=2)
        print("   Agendamientos:", list(age_raw.columns))
    except Exception as e:
        print("   Agendamientos error:", e)

    try:
        cyt_raw = pd.read_excel(DATA_DIR / "Clientes y telefonos.xlsx", sheet_name="Consulta1", nrows=2)
        print("   Clientes y telefonos:", list(cyt_raw.columns))
    except Exception:
        try:
            cyt_raw = pd.read_excel(DATA_DIR / "Clientes y telefonos.xlsx", sheet_name=0, nrows=2)
            print("   Clientes y telefonos (hoja 0):", list(cyt_raw.columns))
        except Exception as e:
            print("   Clientes y telefonos error:", e)

    try:
        cli_raw = pd.read_excel(DATA_DIR / "clientes.xlsx", sheet_name=0, nrows=2)
        print("   Clientes:", list(cli_raw.columns))
    except Exception as e:
        print("   Clientes error:", e)

    print("\n2. Cargando datos completos (misma logica que el backend)...")
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

    # Cargar Pautas RAW de nuevo para tener columnas extra (Contacto, email si existe)
    df_pautas_full = pd.read_excel(DATA_DIR / "Pautas-ThinkChat-2025-2026.xlsx", sheet_name=0, header=0)
    date_substr = re.compile(r"fecha|ingreso|date|creacion|alta|fech|ultimo", re.I)
    date_cols = [c for c in df_pautas_full.columns if date_substr.search(str(c))]
    if not date_cols:
        date_cols = list(df_pautas_full.columns)
    # Resolver columna linea (categoria) y telefono
    linea_col = None
    for c in df_pautas_full.columns:
        if re.search(r"l[ií]nea|producto|categoria", str(c), re.I):
            linea_col = c
            break
    tel_col = None
    for c in df_pautas_full.columns:
        if str(c).strip().lower() == "linea" and c != linea_col:
            tel_col = c
            break
    if not tel_col:
        for c in df_pautas_full.columns:
            if re.search(r"telefono|phone|celular", str(c), re.I):
                tel_col = c
                break
    contacto_col = None
    for c in df_pautas_full.columns:
        if re.search(r"^contacto$", str(c).strip(), re.I):
            contacto_col = c
            break
    email_col = None
    for c in df_pautas_full.columns:
        if re.search(r"email|mail|correo", str(c), re.I):
            email_col = c
            break

    # Enriquecer pautas_en_rango con contacto y email desde el Excel por indice/fila
    # load_pautas usa id_prospecto = fila_i, asi que el indice i en el DataFrame es la fila
    # Pero load_pautas filtra por fecha y linea, asi que el orden no es 1:1 con df_pautas_full.
    # Mejor: construir set de telefonos y opcionalmente email/nombre por fila desde Excel para Feb 2026 Odontologia
    # y luego ver que columnas tienen datos
    pautas_con_extra = []
    for i, row in df_pautas_full.iterrows():
        # Fecha
        fecha = None
        for col in date_cols:
            v = row.get(col)
            if pd.notna(v) and v != "":
                fecha = parse_date(v)
                if fecha is not None:
                    break
        if fecha is None or not is_within_interval(fecha, from_date, range_end):
            continue
        linea_val = row.get(linea_col) if linea_col else None
        if linea_val is None or pd.isna(linea_val):
            continue
        if normalizar_linea(str(linea_val)) != linea_norm:
            continue
        tel = None
        if tel_col and pd.notna(row.get(tel_col)):
            t = normalizar_telefono(str(row[tel_col]))
            if len(t) >= 8:
                tel = t
        contacto = None
        if contacto_col and pd.notna(row.get(contacto_col)):
            contacto = normalizar_nombre(str(row[contacto_col]))
        email = None
        if email_col and pd.notna(row.get(email_col)):
            email = normalizar_email(str(row[email_col]))
        pautas_con_extra.append({"fila": i, "telefono": tel, "contacto": contacto, "email": email})

    # Clientes y telefonos: id -> {phones, emails?}  (solo tenemos phones en CYT)
    # clientes.xlsx: id -> email?, nombre?
    cyt_phones_by_cid = clientes_y_telefonos  # cid -> set(phones)
    # Cargar CYT completo por si tiene email
    try:
        cyt_df = pd.read_excel(DATA_DIR / "Clientes y telefonos.xlsx", sheet_name="Consulta1")
        cyt_cols = list(cyt_df.columns)
        cyt_id_col = next((c for c in cyt_cols if re.search(r"cliente_id|^id$", str(c), re.I)), cyt_cols[0])
        cyt_tel_col = next((c for c in cyt_cols if re.search(r"telefono|phone", str(c), re.I)), None)
        cyt_email_col = next((c for c in cyt_cols if re.search(r"email|mail|correo", str(c), re.I)), None)
        # Por cliente: telefono(s) y si hay email
        client_emails = {}
        if cyt_email_col:
            for _, row in cyt_df.iterrows():
                cid = id_cliente_canonico(row.get(cyt_id_col))
                if not cid:
                    continue
                em = normalizar_email(row.get(cyt_email_col))
                if em:
                    client_emails.setdefault(cid, set()).add(em)
    except Exception:
        cyt_email_col = None
        client_emails = {}

    # clientes.xlsx: id -> email, nombre?
    client_extra = {}
    try:
        cli_df = pd.read_excel(DATA_DIR / "clientes.xlsx", sheet_name=0)
        cli_cols = list(cli_df.columns)
        cli_id = next((c for c in cli_cols if re.search(r"id|client", str(c), re.I)), cli_cols[0])
        cli_email = next((c for c in cli_cols if re.search(r"email|mail|correo", str(c), re.I)), None)
        cli_nombre = next((c for c in cli_cols if re.search(r"nombre|name|cliente", str(c), re.I)), None)
        for _, row in cli_df.iterrows():
            cid = id_cliente_canonico(row.get(cli_id))
            if not cid:
                continue
            entry = {}
            if cli_email and pd.notna(row.get(cli_email)):
                entry["email"] = normalizar_email(str(row[cli_email]))
            if cli_nombre and pd.notna(row.get(cli_nombre)):
                entry["nombre"] = normalizar_nombre(str(row[cli_nombre]))
            if entry:
                client_extra[cid] = entry
    except Exception:
        pass

    # Para cada client_id en agendamientos_canon, tenemos: phones (CYT), opcional email/nombre (clientes)
    # Construir sets por tipo
    phones_agend = set()
    emails_agend = set()
    nombres_agend = set()
    for cid in agendamientos_canon:
        tels = cyt_phones_by_cid.get(cid)
        if tels:
            phones_agend.update(tels if isinstance(tels, (set, list)) else [tels])
        if cid in client_emails:
            emails_agend.update(client_emails[cid])
        extra = client_extra.get(cid, {})
        if extra.get("email"):
            emails_agend.add(extra["email"])
        if extra.get("nombre"):
            nombres_agend.add(extra["nombre"])

    # Contar PROSPECTOS UNICOS que hacen match (cada prospecto cuenta una vez)
    # Match solo telefono (como hoy)
    match_solo_tel = set()
    for i, p in enumerate(pautas_con_extra):
        if p.get("telefono") and p["telefono"] in phones_agend:
            match_solo_tel.add(i)

    # Match telefono O email
    match_tel_o_email = set()
    for i, p in enumerate(pautas_con_extra):
        if p.get("telefono") and p["telefono"] in phones_agend:
            match_tel_o_email.add(i)
        elif p.get("email") and p["email"] in emails_agend:
            match_tel_o_email.add(i)

    # Match telefono O email O nombre (contacto)
    match_tel_email_nombre = set()
    for i, p in enumerate(pautas_con_extra):
        if p.get("telefono") and p["telefono"] in phones_agend:
            match_tel_email_nombre.add(i)
        elif p.get("email") and p["email"] in emails_agend:
            match_tel_email_nombre.add(i)
        elif p.get("contacto") and len(p["contacto"]) >= 3 and p["contacto"] in nombres_agend:
            match_tel_email_nombre.add(i)

    print("\n3. RESULTADOS (Feb 2026 Odontologia)")
    print("   Prospectos en periodo:", len(pautas_con_extra))
    print("   Con telefono:", sum(1 for p in pautas_con_extra if p.get("telefono")))
    print("   Con email:", sum(1 for p in pautas_con_extra if p.get("email")))
    print("   Con contacto/nombre:", sum(1 for p in pautas_con_extra if p.get("contacto")))
    print("   Clientes unicos agendados:", len(agendamientos_canon))
    print("   Phones de agendados (CYT):", len(phones_agend))
    print("   Emails de agendados (CYT/clientes):", len(emails_agend))
    print("   Nombres de agendados (clientes):", len(nombres_agend))
    print()
    print("   Coincidencias SOLO por telefono:        ", len(match_solo_tel))
    print("   Coincidencias por telefono O email:     ", len(match_tel_o_email))
    print("   Coincidencias por telefono O email O nombre:", len(match_tel_email_nombre))
    print()
    if len(match_tel_o_email) > len(match_solo_tel):
        print("   -> Anadir email permite", len(match_tel_o_email) - len(match_solo_tel), "coincidencias mas.")
    if len(match_tel_email_nombre) > len(match_tel_o_email):
        print("   -> Anadir nombre permite", len(match_tel_email_nombre) - len(match_tel_o_email), "coincidencias mas.")
    if len(match_tel_email_nombre) <= len(match_solo_tel):
        print("   -> No hay columnas adicionales con datos suficientes para mas cruces en estos archivos.")


if __name__ == "__main__":
    main()
