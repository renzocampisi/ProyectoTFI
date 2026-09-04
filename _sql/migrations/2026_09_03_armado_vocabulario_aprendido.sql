-- Vocabulario aprendido de Kits de Montaje ("Lectura de planos").
-- Ver _plans/planos/architecture.html y implementation.html.
--
-- Cada fila es una equivalencia texto→material que el usuario confirmó al
-- corregir la propuesta de la IA en la revisión de /armado. Se usa como
-- contexto adicional (in-context learning) en la próxima interpretación,
-- sumado al catálogo. Sin empresa_id: el sistema es single-tenant por
-- instancia (ver auth-publico.service.js), así que el aislamiento por
-- empresa ya viene dado por tener cada cliente su propia base.

create table if not exists armado_vocabulario_aprendido (
  id                uuid primary key default gen_random_uuid(),
  texto_normalizado text not null,
  material_id       uuid not null references materiales(id) on delete cascade,
  veces_confirmado  integer not null default 1,
  updated_at        timestamptz not null default now()
);

create index if not exists idx_armado_vocabulario_texto
  on armado_vocabulario_aprendido (texto_normalizado);

-- Evita duplicar la misma equivalencia texto+material — registrarCorreccion()
-- hace upsert sobre esta combinación e incrementa veces_confirmado.
create unique index if not exists uq_armado_vocabulario_texto_material
  on armado_vocabulario_aprendido (texto_normalizado, material_id);

alter table armado_vocabulario_aprendido enable row level security;
-- Sin políticas: el backend accede siempre con SUPABASE_SERVICE_KEY
-- (bypassa RLS), igual criterio que el resto de las tablas de negocio.
