// src/config/central.js
/**
 * Config del panel central multi-cliente (ver architecture-multi-cliente.html).
 *
 * `CENTRAL_URL` vacío significa "esta instancia actúa de central, no reporta
 * a nadie" — es el caso normal en la instancia que usa Renzo. En cada
 * instancia-cliente, apunta al backend de la instancia central.
 *
 * No falla fast al importar (a diferencia de config/supabase.js): la
 * mayoría de las instancias del sistema pueden no tener esto configurado
 * y tienen que poder levantar igual.
 */
import 'dotenv/config'

export function getCentralUrl() {
  return process.env.CENTRAL_URL?.trim() || null
}

export function getProvisioningSecret() {
  return process.env.CENTRAL_PROVISIONING_SECRET?.trim() || null
}
