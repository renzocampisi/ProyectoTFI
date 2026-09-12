// src/shared/utils/trustedDevice.js
/**
 * Token de "dispositivo de confianza" para el login 2FA
 * (ver _plans/dispositivo-confianza/). Vive en localStorage con clave propia
 * `fs-trusted-device` — prefijo distinto a `sb-*` a propósito, para que
 * clearSupabaseStorage() (logout, on401 de api.js) no lo borre. Solo lo
 * borra una revocación explícita (acá o en "Mi perfil").
 */
const KEY = 'fs-trusted-device'

/** @returns {{ id: string, token: string } | null} */
export function leerToken() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    const stored = JSON.parse(localStorage.getItem(KEY))
    if (!stored?.id || !stored?.token) return null
    return stored
  } catch {
    return null
  }
}

export function guardar({ id, token }) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    localStorage.setItem(KEY, JSON.stringify({ id, token }))
  } catch {
    // localStorage puede tirar QuotaExceeded/SecurityError en modo privado —
    // el login ya entró igual, best-effort.
  }
}

export function borrar() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    localStorage.removeItem(KEY)
  } catch {
    // idem guardar()
  }
}
