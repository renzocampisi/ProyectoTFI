// src/middlewares/requireAuth.js
/**
 * Middleware de autenticación basado en Supabase Auth.
 *
 * Lee el JWT del header `Authorization: Bearer <token>`, lo valida contra
 * Supabase Auth (round-trip), y carga el perfil del usuario desde la tabla
 * `usuarios`. Si todo OK, expone `req.user` con la siguiente forma:
 *
 *   req.user = {
 *     id:       UUID (= auth.users.id = usuarios.id),
 *     email:    string,
 *     nombre:   string,
 *     telefono: string | null,
 *     role:     'DUEÑO' | 'ENCARGADO' | 'OPERARIO',
 *     activo:   boolean,
 *   }
 *
 * Devuelve 401 si:
 *   - falta el header Authorization
 *   - el JWT es inválido o expiró
 *   - el user no tiene perfil en la tabla `usuarios` (estado inconsistente)
 *   - el user está marcado como activo=false (acceso revocado)
 *
 * Performance: cada request hace 2 queries (getUser a Supabase + SELECT del
 * perfil). Para nuestra escala (~decenas de requests por minuto) está bien.
 * Si en el futuro la latencia molesta, se puede cachear el perfil por ~30s
 * por user_id.
 *
 * Se aplica de forma global en routes/index.js antes de las rutas de negocio.
 * Solo /health queda fuera (vive fuera del prefijo /api).
 */
import { supabase } from '../config/supabase.js'

export async function requireAuth(req, res, next) {
  try {
    const auth = req.header('authorization') || req.header('Authorization')
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, error: 'Falta token de autenticación' })
    }
    const token = auth.slice('Bearer '.length).trim()
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Token vacío' })
    }

    // Validar JWT contra Supabase Auth — el cliente con service_role tiene
    // permiso para invocar getUser(token) y resolver el user al que pertenece.
    const { data: { user }, error: errAuth } = await supabase.auth.getUser(token)
    if (errAuth || !user) {
      return res.status(401).json({ ok: false, error: 'Sesión inválida o expirada' })
    }

    // Cargar el perfil de la tabla usuarios (joineado con email vía la vista).
    const { data: perfil, error: errP } = await supabase
      .from('usuarios_resumen')
      .select('id, email, nombre, telefono, role, activo')
      .eq('id', user.id)
      .maybeSingle()

    if (errP) throw errP
    if (!perfil) {
      // El user existe en auth.users pero NO tiene perfil en usuarios.
      // Estado inconsistente — generalmente significa que faltó el INSERT
      // del seed después de crearlo en Auth. No lo dejamos pasar.
      return res.status(401).json({
        ok: false,
        error: 'Tu usuario no tiene perfil cargado. Contactá al administrador.'
      })
    }
    if (!perfil.activo) {
      return res.status(401).json({ ok: false, error: 'Cuenta desactivada' })
    }

    req.user = perfil
    next()
  } catch (err) {
    next(err)
  }
}
