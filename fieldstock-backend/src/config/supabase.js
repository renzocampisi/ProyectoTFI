// src/config/supabase.js
/**
 * Cliente Supabase para el BACKEND.
 *
 * IMPORTANTE: usa SUPABASE_SERVICE_KEY (service role) — bypassa RLS.
 * No exponer NUNCA esta key al frontend. El frontend usa la ANON_KEY
 * para Supabase Auth únicamente (ver supabaseClient.js del frontend).
 *
 * Si arranca el backend sin las variables, falla fast con un Error claro.
 */
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY

if (!url || !key) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en el .env')
}

export const supabase = createClient(url, key)
