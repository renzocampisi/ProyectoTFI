// src/shared/utils/supabaseClient.js
/**
 * Cliente Supabase del FRONTEND — usado EXCLUSIVAMENTE para Auth.
 *
 * IMPORTANTE: usa la ANON_KEY (pública, segura para el browser).
 * Toda lectura/escritura de datos pasa por el BACKEND (vía api.js), nunca
 * directo a Supabase desde acá. El backend usa SERVICE_KEY para bypassear
 * RLS y centralizar la lógica de negocio.
 *
 * Único uso legítimo en el frontend: `useAuth.jsx` (signIn, signOut,
 * onAuthStateChange).
 *
 * Los fallbacks 'http://localhost' / 'placeholder' evitan que crashee
 * el build si faltan envs — pero en runtime Auth fallará hasta que se
 * configure el .env del frontend.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  || 'http://localhost'
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnon)
