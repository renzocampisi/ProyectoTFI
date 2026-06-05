// fieldstock-backend/scripts/create-operario.js
/**
 * Script one-off para crear (o resetear) un usuario de testing con rol
 * OPERARIO. Lo pidió el dueño para poder probar la app desde la vista
 * de operario sin tener que crear el user a mano desde el dashboard.
 *
 * Credenciales fijas (sólo para entornos de desarrollo / staging):
 *   email:    operario@fieldstock.com
 *   password: operario123
 *   rol:      OPERARIO
 *
 * Idempotente: si el user ya existe en auth.users, le resetea la password y
 * se asegura de que tenga el perfil correcto en la tabla `usuarios`.
 *
 * Uso:
 *   node fieldstock-backend/scripts/create-operario.js
 *
 * Requiere SUPABASE_URL y SUPABASE_SERVICE_KEY en el .env del backend.
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const EMAIL    = 'operario@fieldstock.com'
const PASSWORD = 'operario123'
const NOMBRE   = 'Operario de Prueba'
const ROLE     = 'OPERARIO'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY
if (!url || !key) {
  console.error('[create-operario] Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en el .env')
  process.exit(1)
}

const supabase = createClient(url, key)

async function findAuthUserByEmail(email) {
  // El admin API no expone search por email — paginamos hasta encontrarlo.
  // Para una DB con pocos usuarios alcanza con la primera página.
  let page = 1
  const perPage = 200
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const hit = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (hit) return hit
    if (data.users.length < perPage) return null
    page += 1
  }
}

async function main() {
  console.log(`[create-operario] Buscando ${EMAIL} en auth.users...`)
  let authUser = await findAuthUserByEmail(EMAIL)

  if (authUser) {
    console.log(`[create-operario] Existe en auth.users (id=${authUser.id}). Reseteando password...`)
    const { error: errUpd } = await supabase.auth.admin.updateUserById(authUser.id, {
      password:      PASSWORD,
      email_confirm: true,
    })
    if (errUpd) {
      console.error('[create-operario] Error reseteando password:', errUpd.message)
      process.exit(1)
    }
  } else {
    console.log('[create-operario] No existe. Creando en auth.users...')
    const { data, error } = await supabase.auth.admin.createUser({
      email:         EMAIL,
      password:      PASSWORD,
      email_confirm: true,
    })
    if (error) {
      console.error('[create-operario] Error creando auth.user:', error.message)
      process.exit(1)
    }
    authUser = data.user
    console.log(`[create-operario] Creado en auth.users (id=${authUser.id}).`)
  }

  // Perfil en `usuarios`. Upsert por id.
  const { data: perfil, error: errSel } = await supabase
    .from('usuarios').select('id, role, activo').eq('id', authUser.id).maybeSingle()
  if (errSel) {
    console.error('[create-operario] Error leyendo tabla usuarios:', errSel.message)
    process.exit(1)
  }

  if (perfil) {
    console.log(`[create-operario] Perfil existente (role=${perfil.role}, activo=${perfil.activo}). Sincronizando...`)
    const { error: errUp } = await supabase
      .from('usuarios')
      .update({ role: ROLE, activo: true, nombre: NOMBRE, updated_at: new Date().toISOString() })
      .eq('id', authUser.id)
    if (errUp) {
      console.error('[create-operario] Error actualizando perfil:', errUp.message)
      process.exit(1)
    }
  } else {
    console.log('[create-operario] Creando perfil en tabla usuarios...')
    const { error: errIns } = await supabase
      .from('usuarios')
      .insert({ id: authUser.id, nombre: NOMBRE, role: ROLE, activo: true })
    if (errIns) {
      console.error('[create-operario] Error insertando perfil:', errIns.message)
      process.exit(1)
    }
  }

  console.log('')
  console.log('[create-operario] OK ✓')
  console.log('  email:    ' + EMAIL)
  console.log('  password: ' + PASSWORD)
  console.log('  role:     ' + ROLE)
}

main().catch(err => {
  console.error('[create-operario] Error inesperado:', err)
  process.exit(1)
})
