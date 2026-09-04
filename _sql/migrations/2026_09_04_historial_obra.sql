-- Historial de Obra — ver _plans/historial-obra/architecture.html e
-- implementation.html.
--
-- Agrega lo que hoy no se registra en ningún lado: horas hombre (escalar,
-- opcional, en la cabecera de obra), inconvenientes y costos no anticipados
-- (listas, se cargan al finalizar), y las fotos de plano/croquis que se
-- adjuntan en Kits de Montaje (hoy se usan al vuelo contra Gemini y se
-- descartan). Todo lo demás que muestra el historial (insumos, mano de
-- obra, herramientas) se lee de tablas que ya existen — no hace falta
-- nada nuevo para eso.

ALTER TABLE obras ADD COLUMN IF NOT EXISTS horas_hombre numeric;

CREATE TABLE IF NOT EXISTS obra_inconvenientes (
  id          uuid primary key default gen_random_uuid(),
  obra_id     uuid not null references obras(id) on delete cascade,
  descripcion text not null,
  created_at  timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS idx_obra_inconvenientes_obra ON obra_inconvenientes(obra_id);

CREATE TABLE IF NOT EXISTS obra_costos_no_anticipados (
  id          uuid primary key default gen_random_uuid(),
  obra_id     uuid not null references obras(id) on delete cascade,
  descripcion text not null,
  monto       numeric not null,
  created_at  timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS idx_obra_costos_no_anticipados_obra ON obra_costos_no_anticipados(obra_id);

-- Una obra puede acumular varias fotos a lo largo de su vida (varias
-- interacciones con Kits de Montaje) — a diferencia del comprobante de
-- compra (uno solo por compra), acá es una lista.
CREATE TABLE IF NOT EXISTS obra_planos (
  id           uuid primary key default gen_random_uuid(),
  obra_id      uuid not null references obras(id) on delete cascade,
  storage_path text not null,
  created_at   timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS idx_obra_planos_obra ON obra_planos(obra_id);

ALTER TABLE obra_inconvenientes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE obra_costos_no_anticipados ENABLE ROW LEVEL SECURITY;
ALTER TABLE obra_planos                ENABLE ROW LEVEL SECURITY;
-- Sin políticas: el backend accede siempre con SUPABASE_SERVICE_KEY
-- (bypassa RLS), igual criterio que el resto de las tablas de negocio.

-- Bucket privado para las fotos de plano/croquis — mismo patrón que
-- 2026_06_12_compras_comprobante_storage.sql. Nadie accede a Storage
-- directo; el backend genera signed URLs temporales para mostrarlas.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'planos-obra',
  'planos-obra',
  false,
  8388608, -- 8 MiB, mismo límite que el multer de /armado/interpretar
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;
