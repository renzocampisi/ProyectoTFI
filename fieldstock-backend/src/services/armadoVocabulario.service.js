// src/services/armadoVocabulario.service.js
/**
 * Vocabulario aprendido de Kits de Montaje ("Lectura de planos").
 *
 * Cuando el usuario corrige en la revisión a qué material corresponde algo
 * que escribió, esa corrección se guarda como una equivalencia
 * texto→material. La próxima vez que alguien escriba algo parecido, esa
 * equivalencia se le pasa a Gemini como contexto extra junto al catálogo
 * (in-context learning por ejemplos, no fine-tuning). Ver
 * _plans/planos/architecture.html para el porqué de este diseño y qué
 * deliberadamente NO se aprende (nada de lo que la IA "ve" en una foto).
 *
 * Sin empresa_id: el sistema es single-tenant por instancia (ver
 * auth-publico.service.js), así que el aislamiento por empresa ya viene
 * dado por tener cada cliente su propia base — no hace falta filtrar acá.
 */
import { supabase } from '../config/supabase.js'

const TABLA = 'armado_vocabulario_aprendido'

// Mismo orden de magnitud que CAP_CATALOGO en armado.service.js — evita
// inflar el prompt si con el tiempo se acumulan muchas correcciones.
const LIMITE_DEFAULT = 30

function normalizar(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '') // saca acentos
    .replace(/\s+/g, ' ')
    .trim()
}

function palabras(texto) {
  // Palabras de 3+ letras: descarta "de", "un", "la"... que no aportan
  // señal y generarían falsos positivos en la coincidencia.
  return new Set(normalizar(texto).split(' ').filter(p => p.length >= 3))
}

/**
 * Devuelve el vocabulario aprendido relevante para un texto nuevo: filas
 * cuyo texto_normalizado comparte al menos una palabra con `texto`,
 * ordenadas por veces_confirmado descendente, topeadas a `limite`.
 *
 * Heurística simple de primera versión (coincidencia de palabras, no
 * búsqueda semántica) — ver riesgos en implementation.html.
 */
export async function buscarRelevante(texto, { limite = LIMITE_DEFAULT } = {}) {
  const propias = palabras(texto)
  if (!propias.size) return []

  const { data, error } = await supabase
    .from(TABLA)
    .select('texto_normalizado, material_id, veces_confirmado, materiales(id, nombre, marca, unidad)')
    .order('veces_confirmado', { ascending: false })
    .limit(500) // universo a filtrar en memoria; ver nota de escala abajo

  if (error) throw error

  // Filtramos en memoria en vez de con ilike por palabra porque son varias
  // palabras candidatas y Supabase no arma bien un OR dinámico de ilikes
  // legible. Si esta tabla crece mucho, conviene mover el filtro a una
  // función SQL con tsvector — no hace falta para el volumen actual.
  const relevante = (data || []).filter(fila => {
    const suyas = palabras(fila.texto_normalizado)
    for (const p of suyas) if (propias.has(p)) return true
    return false
  })

  return relevante.slice(0, limite).map(fila => ({
    textoAprendido: fila.texto_normalizado,
    materialId:     fila.material_id,
    materialNombre: fila.materiales?.nombre ?? null,
    materialMarca:  fila.materiales?.marca ?? null,
    vecesConfirmado: fila.veces_confirmado,
  }))
}

/**
 * Registra (o refuerza) que `textoOriginal` corresponde a `materialId`.
 * Upsert sobre (texto_normalizado, material_id): si ya existía, suma 1 a
 * veces_confirmado; si no, la crea con 1.
 */
export async function registrarCorreccion({ textoOriginal, materialId }) {
  const texto = normalizar(textoOriginal)
  if (!texto || !materialId) return null

  const { data: existente, error: errBusqueda } = await supabase
    .from(TABLA)
    .select('id, veces_confirmado')
    .eq('texto_normalizado', texto)
    .eq('material_id', materialId)
    .maybeSingle()
  if (errBusqueda) throw errBusqueda

  if (existente) {
    const { data, error } = await supabase
      .from(TABLA)
      .update({ veces_confirmado: existente.veces_confirmado + 1, updated_at: new Date().toISOString() })
      .eq('id', existente.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from(TABLA)
    .insert({ texto_normalizado: texto, material_id: materialId, veces_confirmado: 1 })
    .select()
    .single()
  if (error) throw error
  return data
}
