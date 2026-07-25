-- Migration: 2026-07-23 — Add-ons self-service (empleados extra + cupo de herramientas con seguimiento)
--
-- Estado: APLICADA en remoto via Supabase MCP (apply_migration
-- "addons_empleados_y_seguimiento"). Se versiona acá para historial.
--
-- Suma a `suscripcion` los dos contadores que addons.service.js necesita
-- para calcular el monto total (plan + extras) y validar cupos. Ver
-- fieldstock-backend/src/services/addons.service.js.

alter table suscripcion
  add column empleados_extra int not null default 0,
  add column herramientas_seguimiento_cupo int not null default 0;
