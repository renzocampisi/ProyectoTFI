// src/config/supabase.js
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY

if (!url || !key) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en el .env')
}

export const supabase = createClient(url, key)
