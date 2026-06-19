// src/services/panel.service.js
/**
 * Orquestador del ciclo agentico del M1 Panel IA.
 *
 * Flujo:
 *   1. Recibe la pregunta + historial del chat (mensajes previos del user
 *      y respuestas previas del asistente).
 *   2. Construye el contexto Gemini con un system prompt en castellano.
 *   3. Loop hasta respuesta final o MAX_ITERATIONS:
 *      - Llama al provider (Gemini).
 *      - Si pide function calls: ejecuta cada tool, reinyecta resultados.
 *      - Si responde texto: termina.
 *   4. Devuelve { respuesta, traza } — la traza lista todas las tools
 *      invocadas en el turno (util para debugging en el frontend).
 *
 * MAX_ITERATIONS es la red de seguridad contra loops infinitos: una
 * tool que devuelve datos ambiguos podria hacer que el LLM pida la
 * misma info una y otra vez. Con 8 iteraciones cubrimos casos
 * legitimos de hasta 4-5 tools encadenadas y cortamos lo demas.
 */
import * as Provider from './panel/provider.js'
import { getDeclarations, runTool } from './panel/tools.js'

const MAX_ITERATIONS = 8

const SYSTEM_PROMPT = `Sos el asistente del Panel IA de FieldStock, un sistema de gestion de
inventario de herramientas y materiales para una empresa constructora.
Tenes acceso de SOLO LECTURA a los datos del sistema a traves de tools.

Reglas:
- Respondes siempre en castellano rioplatense, conciso y directo.
- Si la pregunta requiere datos, llamas a las tools necesarias antes de responder.
  Podes encadenar varias tools en un mismo turno (ej: listar_obras → obra_por_id).
- Si una tool devuelve { error: ... }, decile al usuario que no se pudo obtener
  ese dato puntual y sugeri reformular. No inventes datos.
- Si la pregunta es de accion (crear, modificar, eliminar, dar de baja, etc.),
  respondes que solo podes consultar informacion en esta version — las acciones
  hay que hacerlas desde los modulos correspondientes.
- Cuando devolves listas, usa formato breve (bullets o tabla simple).
  No repitas IDs UUID a menos que el usuario los pida explicitamente.
- Si la respuesta involucra dinero, formatea como "$1.234.567" con puntos
  de miles. La moneda del sistema es ARS (no lo aclares cada vez).
- Si no podes responder con los datos disponibles, deci que no tenes esa
  informacion. No inventes.`

/** Convierte el historial del frontend [{ role, content }] al shape Gemini. */
function historialAGemini(historial = []) {
  return historial
    .filter(m => m && typeof m.content === 'string' && m.content.trim())
    .map(m => ({
      role:  m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
}

/**
 * Punto de entrada principal — el controller llama aca.
 *
 * @param {string} pregunta  Mensaje nuevo del usuario.
 * @param {Array}  historial Turnos previos: [{ role: 'user'|'assistant', content }].
 * @returns {Promise<{ respuesta: string, traza: Array }>}
 */
export async function responder(pregunta, historial = []) {
  if (!pregunta || typeof pregunta !== 'string' || !pregunta.trim()) {
    const err = new Error('El mensaje no puede estar vacio'); err.status = 400; throw err
  }

  const contents = [
    ...historialAGemini(historial),
    { role: 'user', parts: [{ text: pregunta }] },
  ]
  const tools = getDeclarations()
  const traza = []

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const { text, functionCalls } = await Provider.chat({
      system:   SYSTEM_PROMPT,
      contents,
      tools,
    })

    // Caso 1: el modelo respondio sin pedir tools — fin del turno.
    if ((!functionCalls || functionCalls.length === 0) && text) {
      return { respuesta: text, traza }
    }

    // Caso 2: el modelo pidio tools. Ejecutamos todas y reinyectamos.
    if (functionCalls && functionCalls.length > 0) {
      // Append del turno del modelo al historial Gemini.
      contents.push({
        role:  'model',
        parts: functionCalls.map(fc => ({
          functionCall: { name: fc.name, args: fc.args },
        })),
      })

      // Ejecutamos en paralelo. runTool() jamas tira: si la tool falla,
      // devuelve { error } y el LLM decide que hacer.
      const results = await Promise.all(
        functionCalls.map(async (fc) => {
          const result = await runTool(fc.name, fc.args)
          traza.push({ tool: fc.name, args: fc.args, ok: !result?.error })
          return { name: fc.name, result }
        })
      )

      // Append de los functionResponse en un solo turno user.
      contents.push({
        role:  'user',
        parts: results.map(r => ({
          functionResponse: { name: r.name, response: r.result },
        })),
      })
      continue
    }

    // Caso 3: respuesta vacia (sin text ni functionCalls). Raro pero defensivo.
    return {
      respuesta: 'No pude generar una respuesta. Reformula la pregunta, por favor.',
      traza,
    }
  }

  // Llegamos al cap — no resolvimos en MAX_ITERATIONS turnos.
  return {
    respuesta:
      'No pude resolver tu pregunta en este turno (se llego al limite de iteraciones). ' +
      'Probá reformularla en partes mas chicas.',
    traza,
  }
}
