-- Migration: 2026-07-24 — Estanterías: liberar número/QR al borrar + evitar duplicados
--
-- Estado: APLICADA en remoto via Supabase MCP (apply_migration
-- "estanterias_numeracion_y_duplicados" y "estanterias_codigo_qr_activa",
-- dos llamadas separadas, unificadas acá en un solo archivo). Se versiona
-- acá para historial.
--
-- Bug reportado: borrar una estantería (soft delete) dejaba su número y
-- su codigo_qr reservados para siempre (UNIQUE simple), así que la
-- numeración visible saltaba cada vez que se borraba una del medio. Se
-- reemplazan por índices únicos parciales (solo sobre activa=true) para
-- que un número/código de una estantería borrada se pueda reusar — ver
-- estanterias.service.js (siguienteNumeroLibre) y getByQR (filtro
-- activa=true agregado en el mismo día tras encontrarlo en code review).
--
-- Además: UNIQUE(herramienta_id, material_id) en estanteria_items no
-- servía para nada — con NULL de por medio (NULL <> NULL en SQL), nunca
-- detectaba duplicados. Se reemplaza por dos índices únicos parciales,
-- uno por columna, para que un material o herramienta no pueda estar en
-- más de una estantería a la vez.

alter table estanterias drop constraint estanterias_numero_key;
create unique index estanterias_numero_activa_key on estanterias(numero) where activa = true;

alter table estanterias drop constraint estanterias_codigo_qr_key;
create unique index estanterias_codigo_qr_activa_key on estanterias(codigo_qr) where activa = true;

alter table estanteria_items drop constraint unico_item;
create unique index estanteria_items_material_unico on estanteria_items(material_id) where material_id is not null;
create unique index estanteria_items_herramienta_unico on estanteria_items(herramienta_id) where herramienta_id is not null;
