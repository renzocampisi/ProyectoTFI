-- Migration: agregar rol ADMIN al check constraint de usuarios
-- Date: 2026-06-02
--
-- Jerarquía conceptual: ADMIN > DUEÑO > ENCARGADO > OPERARIO.
-- ADMIN y DUEÑO tienen los MISMOS permisos por ahora — ADMIN existe como
-- rol separado para escalamiento futuro (multi-empresa, configuración global).
--
-- Sin riesgos sobre datos existentes (todos los rows actuales tienen roles
-- válidos en el conjunto anterior + ADMIN).

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_role_check;

ALTER TABLE usuarios ADD CONSTRAINT usuarios_role_check
  CHECK (role = ANY (ARRAY['ADMIN'::text, 'DUEÑO'::text, 'ENCARGADO'::text, 'OPERARIO'::text]));

COMMENT ON CONSTRAINT usuarios_role_check ON usuarios IS
  'Roles válidos. ADMIN > DUEÑO > ENCARGADO > OPERARIO. ADMIN y DUEÑO tienen mismos permisos hoy.';
