# Datos del embudo de ventas

Coloca aquí los archivos Excel para que la aplicación cargue datos reales:

- **Pautas-ThinkChat-2025-2026.xlsx** – Prospectos (contactos por pautas)
- **agendamientos-prospectos.xlsx** – Prospectos que agendaron turno
- **Presupuestos y contratos.xlsx** – Presupuestos y contratos firmados
- **clientes.xlsx** (opcional) – Id de clientes en común con Presupuestos para unirlos si hace falta
- **Clientes y telefonos.xlsx** (referencia futura) – Id cliente con teléfonos; disponible para cruces o análisis posteriores

Si no hay archivos, la app usa **datos de prueba** (mock).

## Columnas esperadas (encabezados)

### Pautas
- Identificador: `id_prospecto`, `email`, `telefono` o `id`
- **Fecha de ingreso** (primer contacto): columna **`Fecha Ingreso`** (o `fecha de ingreso`, `fecha_ingreso`, etc.). Es la **primera fecha de contacto** con el prospecto. El backend la usa para agrupar prospectos por período (día/semana/mes).
- **Fecha** (gestión): columna **`Fecha`** en el Excel. Es la **fecha de gestión** o **última gestión** del contacto. No se usa hoy para el embudo; queda disponible para análisis.
- Línea (opcional): `linea`, `línea`, `producto`, `categoria` — para filtrar por ej. Odontología

**Métrica futura:** Se requerirá medir el **tiempo desde fecha de ingreso (primer contacto) hasta que el prospecto cierra contrato** (ciclo de cierre). Para eso se usarán: `Fecha Ingreso` (Pautas) como origen y `contract_date` (clientes) o fecha de contrato como cierre.

### Agendamientos
- Identificador: `client_i`, `client_id`, `id_prospecto`, `email`, `telefono`, `id`, `agenda`
- Fecha: `fecha_agendamien`, `fecha_agendamiento`, `fecha_turno` o `fecha`
- **Estado:** solo filas con estado **"Atendido"** (columna `status_nombre` o `estado`).
- **Prospecto:** solo filas marcadas como prospecto (columna `prospe` = SI, o `prospecto` = Sí/Yes/1). Sin este filtro se contarían todos los atendidos, no solo prospectos.
- **Línea (unidad de negocio):** columna `unidad` (valores ej. ODONTOL, EPEM). Se normalizan a los nombres de Línea de Pautas (Odontologia, Epem) para que el filtro en la web coincida.

### Presupuestos y contratos
- Identificador (debe coincidir con prospectos de la fecha filtrada): `id_prospecto`, `id_cliente`, `client_id`, `client_i`, `email`, `telefono` o `id`
- Fechas: `fecha_presupuesto`, `fecha_contrato`
- **Estado:** solo se cargan filas con **status/estado 5, 10 o 15**; el resto se excluye para presupuestos.
- Contrato: `tiene_contrato` (Sí/No) o columna que indique si firmó
- **Clave:** en el embudo solo se cuentan presupuestos/contratos cuyo **cliente (id_cliente / client_id) coincide con los clientes de agendamientos-prospectos** (mismo `client_i` / id que en agendamientos). El filtro Línea y las fechas se aplican a agendamientos; los presupuestos deben ser de esos mismos clientes.

### clientes.xlsx
- **id:** `id`, `id_cliente`, `client_id`, `client_i` (mismo id que agendamientos).
- **Contrato:** columna **`contract_date`** (fecha de contrato) y columna **si tiene contrato** (Sí/Yes/1) para que las fechas coincidan con el filtro Desde–Hasta.
- **Estado de control de calidad:** columna **`estado de control de calidad`** (o similar). Solo se cuentan como contrato las filas con valor **"Confirmado"** (se ignora mayúsculas/acentos).
- **Tipo de cliente:** columna **`tipo de cliente`** (o similar). Solo se cuentan como contrato los clientes **"Titular"** (se ignora mayúsculas/acentos).
- **Unidad de negocio:** columna de unidad/línea; debe coincidir con el filtro **Línea** de la web (ej. Odontologia, EPEM). Se normaliza igual que en agendamientos (ODONTOL → Odontologia).
- Los **contratos** del embudo se calculan desde clientes cuando existe este archivo: tiene contrato, `contract_date` en el rango, **estado de control de calidad = Confirmado** y unidad = Línea seleccionada.
- Presupuestos y contratos solo se cuentan si el cliente está en agendamientos y (cuando hay clientes.xlsx) la unidad de negocio coincide con la Línea filtrada.

## Si todo sale en cero o no se leen los datos

Abre en el navegador (o con curl): **GET** `http://localhost:4000/api/debug/headers`  
Ahí verás los **nombres de columnas** que el backend detecta en cada Excel. Si no coinciden con lo que espera la app, ajusta los encabezados en el Excel o coméntalo para mapear esas columnas en el código. La app intenta detectar columnas que contengan "fecha", "ingreso", "id", "email", "linea", etc., aunque tengan otro nombre exacto.
