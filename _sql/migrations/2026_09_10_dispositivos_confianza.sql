-- Migration: 2026-09-10 — Dispositivo de confianza para el login 2FA
--
-- Estado: PENDIENTE de aplicar. Al correrla en el editor de Supabase,
-- guardar la query como "2026_09_10_dispositivos_confianza".
--
-- Ver _plans/dispositivo-confianza/architecture.html (Etapa 1) y
-- implementation.html (Etapa 2, paso 1).
--
-- Qué hace: cada fila es un dispositivo que un usuario no-ADMIN marcó como
-- "de confianza" al verificar el código 2FA. Mientras la fila esté vigente,
-- ese equipo saltea el segundo factor en el login (la contraseña se sigue
-- verificando siempre — baja de 2FA a 1FA, nunca a 0).
--
-- La VIGENCIA se calcula en el service, no se persiste. Una fila está
-- vigente si:  revocado_at IS NULL
--          AND ultimo_uso  > now() - interval '30 days'   (inactividad)
--          AND created_at  > now() - interval '90 days'   (tope duro)
-- Ver fieldstock-backend/src/services/dispositivos-confianza.service.js.
--
-- Análisis de impacto (reglas SQL de CLAUDE.md):
--   - DROP/ALTER: ninguno. Solo CREATE TABLE nueva.
--   - Vistas dependientes: ninguna. No toca `usuarios`, `usuarios_resumen`,
--     `herramientas_completas` ni `dispositivos_rastreo` (GPS, sin relación).
--   - RPCs: ninguna cambia de firma.
--   - Campos renombrados: ninguno.
--   - FK contra auth.users(id) (no la tabla pública `usuarios`), mismo
--     criterio que 2026_06_13_presupuestos_infra.sql. auth.users.id === usuarios.id.
--   - RLS habilitada sin políticas: el backend entra con SUPABASE_SERVICE_KEY
--     (bypassa RLS), igual que el resto de las tablas de negocio.

create table if not exists usuario_dispositivos_confianza (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references auth.users(id) on delete cascade,
  token_hash  text not null unique,          -- sha-256 hex del token opaco; el crudo nunca se guarda
  descripcion text,                           -- derivada del user-agent, solo cosmética para la lista
  created_at  timestamptz not null default now(),
  ultimo_uso  timestamptz not null default now(),
  revocado_at timestamptz                     -- null = vigente
);

-- Listar / revocar todos los equipos de un usuario.
create index if not exists idx_usuario_dispositivos_confianza_usuario
  on usuario_dispositivos_confianza (usuario_id);

-- El login busca por hash del token; el unique de token_hash ya cubre este acceso.

alter table usuario_dispositivos_confianza enable row level security;
-- Sin políticas: acceso solo desde el backend con SUPABASE_SERVICE_KEY.
