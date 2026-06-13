-- Migration: 2026-06-12 — Comprobante de pago en Compras
--
-- Parte 1/3 de la feature "subir comprobante de pago" del modulo Compras.
-- Setup de infra (Storage + columna en compras). El backend y el frontend
-- vienen en partes 2 y 3.
--
-- Estado: APLICADA en remoto el 2026-06-12 via Supabase MCP (apply_migration
-- "compras_comprobante_url_storage"). Se versiona aca para que el repo
-- tenga historial completo del schema.
--
-- Decisiones:
-- - Bucket PRIVADO porque ningun cliente publico se conecta a Storage
--   directo. El backend (con SERVICE_KEY) hace upload/download y, cuando
--   el frontend necesita mostrar el archivo, el backend genera un signed
--   URL temporal (~1h). Como no hay accesos publicos, no hace falta crear
--   policies de RLS sobre storage.objects (todo el trafico pasa por el
--   service role que las ignora).
-- - Tamano max por archivo: 5 MiB. Suficiente para un recibo de transferencia
--   en PDF o una foto del comprobante en JPG/PNG.
-- - `comprobante_url` guarda el PATH dentro del bucket (ej. `OC-00001.pdf`),
--   NO una URL publica. Cuando hay que mostrar el archivo, el backend
--   construye el signed URL al vuelo.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comprobantes-compras',
  'comprobantes-compras',
  false,
  5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE compras
  ADD COLUMN IF NOT EXISTS comprobante_url text;
