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
import { getWriteDeclarations, findWriteTool, previewWriteTool, executeWriteTool } from './panel/writeTools.js'

const MAX_ITERATIONS = 8

const SYSTEM_PROMPT = `Sos el asistente del Panel IA de FieldStock, un sistema de gestion de
inventario de herramientas y materiales para una empresa constructora.
Tenes acceso de LECTURA a los datos del sistema a traves de tools, y a un
numero acotado de tools de ACCION (hoy: sumar_stock_material,
actualizar_stock_minimo_material, crear_cliente, crear_proveedor,
crear_transporte, marcar_notificaciones_leidas).

Reglas:
- Respondes siempre en castellano rioplatense, conciso y directo.
- Si la pregunta requiere datos, llamas a las tools necesarias antes de responder.
  Podes encadenar varias tools en un mismo turno (ej: listar_obras → obra_por_id).
- Si una tool devuelve { error: ... }, decile al usuario que no se pudo obtener
  ese dato puntual y sugeri reformular. No inventes datos.
- Si la pregunta es una ACCION que tiene tool disponible (ej: sumar stock a un
  material), llama a esa tool UNA sola vez con los datos que el usuario dio.
  Nunca la ejecutas vos mismo ni le decis al usuario que ya se hizo — el sistema
  le va a mostrar una confirmacion antes de aplicarla, vos solo la proponés.
  Si te falta un dato obligatorio (ej: no sabes el materialId), primero llama a
  la tool de lectura correspondiente (ej: listar_materiales) para resolverlo por
  nombre antes de proponer la accion.
- Si la accion que piden NO tiene tool disponible todavia (crear remitos, dar de
  baja herramientas, etc.), respondes que esa accion puntual todavia no se puede
  hacer desde el chat — que la haga desde el modulo correspondiente.
- Cuando devolves listas, usa formato breve (bullets o tabla simple).
  No repitas IDs UUID a menos que el usuario los pida explicitamente.
- Si la respuesta involucra dinero, formatea como "$1.234.567" con puntos
  de miles. La moneda del sistema es ARS (no lo aclares cada vez).
- Si no podes responder con los datos disponibles, deci que no tenes esa
  informacion. No inventes.

VOCABULARIO DEL DOMINIO (importante para interpretar bien las preguntas):
- "Obra activa" → estado ACTIVA exacto.
- "Obra en proceso" → obras en PENDIENTE_PRESUPUESTO, EN_APROBACION o ACTIVA
  (cualquier obra que no este FINALIZADA ni RECHAZADA).
- "Remito activo / en curso / pendiente" → cualquier remito que NO este CERRADO.
  La maquina de estados es BORRADOR → CONFIRMADO → EN_TRANSITO → EN_OBRA →
  EN_RETORNO → EN_TRANSITO_RETORNO → CERRADO (7 estados).
  IMPORTANTE: no existe un estado literal "ACTIVO" en remitos.
  Para contar activos: llama a listar_remitos SIN filtro de estado y
  contas los items donde estado !== "CERRADO".
- "Herramienta activa / en uso" → estado EN_OBRA o RESERVADA (las que estan
  comprometidas con alguna obra).
- "Material agotado" → stock_actual = 0. "Material critico / bajo stock" →
  stock_actual <= stock_minimo (usa la tool materiales_bajo_stock).
- "Presupuesto pendiente de aprobacion" → estado EN_APROBACION.
- "Compra pendiente de recepcion" → estado CONFIRMADA (ya se hizo la orden
  pero no llego el material).`

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
  const tools = [...getDeclarations(), ...getWriteDeclarations()]
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

    // Caso 1.5: el modelo pidio una tool de ACCION. Nunca se ejecuta acá —
    // se corta el loop, se arma un preview read-only y se lo devolvemos al
    // frontend como propuesta pendiente de confirmación humana.
    const fcAccion = functionCalls?.find(fc => findWriteTool(fc.name))
    if (fcAccion) {
      // Si el modelo pidio mas de una tool en este mismo batch (otra accion,
      // o tools de lectura encadenadas), no las ejecutamos — cortamos el
      // turno en la primera accion propuesta. Quedan registradas en la
      // traza (ok:false) para que no desaparezcan en silencio.
      for (const fc of functionCalls) {
        if (fc === fcAccion) continue
        traza.push({ tool: fc.name, args: fc.args, ok: false })
      }
      const preview = await previewWriteTool(fcAccion.name, fcAccion.args)
      traza.push({ tool: fcAccion.name, args: fcAccion.args, ok: !preview?.error })
      if (preview?.error) {
        return { respuesta: `No pude preparar esa acción: ${preview.error}`, traza }
      }
      return {
        respuesta: preview.resumen,
        traza,
        accionPendiente: { tool: fcAccion.name, args: fcAccion.args, detalle: preview.detalle },
      }
    }

    // Caso 2: el modelo pidio tools de lectura. Ejecutamos todas y reinyectamos.
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

/**
 * Ejecuta una accion de escritura previamente propuesta por `responder()`
 * (campo `accionPendiente`), tras la confirmación explícita del usuario en
 * la UI. El controller llama aca directo — no pasa por el LLM de nuevo.
 *
 * @param {string} tool  Nombre de la write tool (ej: 'sumar_stock_material').
 * @param {object} args  Los mismos args que vinieron en `accionPendiente.args`.
 *
 * Vuelve a correr `previewWriteTool()` antes de ejecutar — no por
 * desconfianza del frontend, sino porque `preview()` es donde vive TODA
 * la validación (cantidad > 0, stockMinimo >= 0, nombre obligatorio, etc.);
 * `execute()` no la repite. Sin este paso, quien le pegue directo a este
 * endpoint (sin pasar por /panel/chat) se saltea esa validación por completo.
 */
export async function ejecutarAccion(tool, args) {
  if (!tool || typeof tool !== 'string') {
    const err = new Error('Falta el nombre de la acción a ejecutar'); err.status = 400; throw err
  }
  const preview = await previewWriteTool(tool, args)
  if (preview?.error) {
    const err = new Error(preview.error); err.status = 400; throw err
  }
  return executeWriteTool(tool, args)
}
