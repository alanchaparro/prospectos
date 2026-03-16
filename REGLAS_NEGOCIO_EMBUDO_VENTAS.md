# Reglas de negocio – Embudo de ventas

Documento que define las etapas y reglas del proceso de ventas desde el primer contacto hasta la conversión en socio del seguro.

---

## Flujo del embudo

```
Redes sociales → Turno en clínica → Presupuesto → Contrato → Socio del seguro
```

---

## Etapas y reglas

### 1. Recepción del contacto (Pautas – Redes sociales)

- **Descripción:** El primer paso del embudo es recibir el contacto generado por las pautas publicitarias en redes sociales.
- **Reglas:**
  - El lead/prospecto ingresa al embudo únicamente cuando se registra un contacto proveniente de pautas de redes sociales.
  - Se debe poder identificar el origen del contacto (red social / campaña / pauta).
  - El contacto se considera **prospecto** a partir de este momento.

---

### 2. Agendamiento de turno en clínica

- **Descripción:** Al prospecto que proviene de pautas se le agenda un turno en una de las clínicas.
- **Reglas:**
  - Solo se agenda turno a contactos que ya están registrados como prospectos (etapa 1).
  - El prospecto debe tener asignada una clínica y fecha/hora de turno.
  - El estado del prospecto en esta etapa es **“Con turno agendado”** o equivalente.

---

### 3. Presupuesto de tratamientos (En clínica)

- **Descripción:** Durante o después de la atención en clínica se arma el presupuesto con los tratamientos que el prospecto debe realizarse.
- **Reglas:**
  - El presupuesto se genera en el contexto de la visita del prospecto a la clínica (turno ya realizado o en curso).
  - El presupuesto debe detallar los tratamientos indicados y sus costos/condiciones.
  - El prospecto permanece en etapa **“Con presupuesto”** hasta que decida sobre la oferta.

---

### 4. Firma del contrato de venta

- **Descripción:** Si al prospecto le convence la oferta, firma el contrato de venta.
- **Reglas:**
  - La firma del contrato solo aplica cuando el prospecto **acepta** el presupuesto (le gusta la propuesta).
  - Con la firma del contrato el prospecto deja de ser solo prospecto y pasa a ser **cliente/comprador** del servicio.
  - Se debe quedar registrada la fecha de firma y el contrato asociado.

---

### 5. Conversión en socio del seguro

- **Descripción:** Tras firmar el contrato de venta, la persona se convierte en socio del seguro.
- **Reglas:**
  - La condición para ser **socio del seguro** es tener un contrato de venta firmado.
  - A partir de este momento se aplican las reglas y beneficios de socio (según producto/seguro).
  - El embudo considera a esta persona como **convertida** (cierre de venta).

---

## Resumen de estados del embudo

| Orden | Etapa                    | Estado típico del contacto |
|------|--------------------------|----------------------------|
| 1    | Contacto por pautas      | Lead / Prospecto (nuevo)   |
| 2    | Turno agendado           | Prospecto con turno        |
| 3    | Presupuesto en clínica   | Prospecto con presupuesto  |
| 4    | Contrato firmado         | Cliente (venta cerrada)    |
| 5    | Socio del seguro         | Socio                      |

---

## Infraestructura y despliegue

- **El proyecto está dockerizado. El backend de la API es **Python** (FastAPI + pandas); ver `backend_python/`.** El desarrollo, las pruebas y el despliegue deben realizarse en entorno Docker, garantizando consistencia entre entornos y facilitando la portabilidad de la aplicación.

---

## Notas

- Cada etapa depende de haber cumplido la anterior.
- Los contactos que no firman contrato permanecen como prospectos (con o sin presupuesto) y pueden reingresar al flujo en etapas posteriores según criterios comerciales.
- Este documento sirve como referencia para procesos, sistemas y reportes del embudo de ventas.
