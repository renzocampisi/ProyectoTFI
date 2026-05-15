// src/services/remitos.service.js — agregar al final del archivo existente

// ── Eliminar remito cerrado ───────────────────────────────────
export async function eliminar(id) {
  // Solo se pueden eliminar remitos cerrados
  const { data: remito, error: errR } = await supabase
    .from('remitos').select('estado').eq('id', id).single()
  if (errR) throw errR

  if (remito.estado !== 'CERRADO') {
    const err = new Error('Solo se pueden eliminar remitos en estado CERRADO')
    err.status = 400; throw err
  }

  const { error } = await supabase
    .from('remitos').delete().eq('id', id)
  if (error) throw error
}
