// src/services/panel/provider.js
/**
 * Adapter del LLM para el M1 Panel IA.
 *
 * Aisla el SDK de Google Gemini detras de una interfaz minima `chat()`
 * que el orquestador (panel.service) puede consumir sin conocer la
 * estructura interna del SDK. Cambiar a Claude u OpenAI mas adelante es
 * reescribir ESTE archivo solo — panel.service y tools.js no se tocan.
 *
 * Decisiones:
 *   - Modelo: gemini-2.0-flash (tier gratuito, latencia baja, soporta
 *     function calling, calidad suficiente para Q&A sobre datos
 *     estructurados de un sistema interno).
 *   - Si falta GEMINI_API_KEY, el constructor del cliente es lazy: el
 *     primer `chat()` tira un error con `.status = 503` que el
 *     errorHandler global convierte en respuesta JSON clara.
 */
import { GoogleGenAI } from '@google/genai'

// gemini-2.5-flash: tier gratuito disponible, latencia baja, soporta function
// calling. Probamos gemini-2.0-flash inicialmente pero Google lo dejo con
// cuota 0 en el tier free para proyectos nuevos.
const MODEL = 'gemini-2.5-flash'

let _client = null

function getClient() {
  if (_client) return _client
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY no configurada en el backend')
    err.status = 503
    throw err
  }
  _client = new GoogleGenAI({ apiKey })
  return _client
}

/**
 * Llama al modelo con un turno y devuelve la respuesta normalizada.
 *
 * @param {object}  params
 * @param {string}  params.system    - System instruction (rol y reglas).
 * @param {Array}   params.contents  - Historial en formato Gemini:
 *                                     [{ role: 'user'|'model', parts: [...] }]
 * @param {Array=}  params.tools     - Array de function declarations Gemini:
 *                                     [{ name, description, parameters }]
 * @returns {Promise<{ text: string|null, functionCalls: Array<{ id?, name, args }> }>}
 *
 * Shape de salida estable:
 *   - text:          texto plano si el modelo respondio directo, null si pidio tools
 *   - functionCalls: array de tool calls que el orquestador tiene que ejecutar
 *
 * Cualquier error de transporte / cuota / key invalida se propaga con
 * `.status` mapeado para el errorHandler. Sin reintentos automaticos:
 * un fallo se reporta al usuario y este reformula.
 */
export async function chat({ system, contents, tools }) {
  const client = getClient()
  const config = { systemInstruction: system }
  if (tools && tools.length) {
    config.tools = [{ functionDeclarations: tools }]
  }

  let response
  try {
    response = await client.models.generateContent({
      model:    MODEL,
      contents,
      config,
    })
  } catch (err) {
    // Errores tipicos: 401 (key invalida), 429 (rate limit), 400 (payload).
    // Reempaquetar para que el errorHandler los devuelva con shape consistente.
    const wrapped = new Error(`Gemini API: ${err.message || 'error desconocido'}`)
    wrapped.status = err.status === 401 ? 503 : (err.status || 502)
    wrapped.cause  = err
    throw wrapped
  }

  // Normalizar respuesta. El SDK devuelve un GenerateContentResponse con
  // candidates[0].content.parts[] — cada part puede tener `text` o
  // `functionCall`. Mezclamos los textos y juntamos los function calls.
  const parts = response?.candidates?.[0]?.content?.parts ?? []
  const textPieces    = []
  const functionCalls = []
  for (const p of parts) {
    if (p.text) textPieces.push(p.text)
    if (p.functionCall) {
      functionCalls.push({
        id:   p.functionCall.id,    // gemini puede no enviar id, esta bien
        name: p.functionCall.name,
        args: p.functionCall.args || {},
      })
    }
  }
  const text = textPieces.length ? textPieces.join('') : null
  return { text, functionCalls }
}
