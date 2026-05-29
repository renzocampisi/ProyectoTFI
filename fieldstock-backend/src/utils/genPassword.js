// src/utils/genPassword.js
/**
 * Generador de passwords aleatorias para nuevos usuarios.
 *
 * Usa crypto.randomBytes (CSPRNG) en vez de Math.random para tener entropía
 * real. La password vuelve al frontend UNA SOLA VEZ en la respuesta de
 * crear-usuario, y el dueño la copia al modal de éxito para pasársela al
 * nuevo usuario por fuera (WhatsApp/persona).
 *
 * Alfabeto: mayúsculas + minúsculas + dígitos. Excluimos 0, O, 1, l, I para
 * evitar confusión al dictar la pass por WhatsApp/teléfono.
 *
 * Largo default: 8. Suficiente para el modelo de amenaza (uso interno de
 * empresa pequeña, sin exposición pública del endpoint de login). Si en el
 * futuro queremos endurecerlo, basta con cambiar el default.
 */
import crypto from 'crypto'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

export function genPassword(length = 8) {
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) {
    // El módulo introduce un sesgo mínimo (ALPHABET.length=55 no es divisor
    // de 256), pero es aceptable para el uso. Si quisiéramos eliminarlo
    // totalmente, habría que descartar bytes >= floor(256/55)*55.
    out += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return out
}
