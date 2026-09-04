// armadoVocabulario.service.js solo hace queries directas contra Supabase —
// se mockea el chain, mismo patrón que compras.service.test.js.
const mockChain = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq:     jest.fn().mockReturnThis(),
  order:  jest.fn().mockReturnThis(),
  limit:  jest.fn().mockReturnThis(),
  single:      jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
}
mockChain.then = (resolve) => resolve({ data: [], error: null })

jest.mock('../config/supabase.js', () => ({
  supabase: { from: jest.fn(() => mockChain) },
}))

import * as ArmadoVocabulario from './armadoVocabulario.service.js'
import { supabase } from '../config/supabase.js'

beforeEach(() => {
  jest.resetAllMocks()
  mockChain.select.mockReturnThis()
  mockChain.insert.mockReturnThis()
  mockChain.update.mockReturnThis()
  mockChain.eq.mockReturnThis()
  mockChain.order.mockReturnThis()
  mockChain.limit.mockReturnThis()
  mockChain.single.mockResolvedValue({ data: null, error: null })
  mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
  mockChain.then = (resolve) => resolve({ data: [], error: null })
  supabase.from.mockImplementation(() => mockChain)
})

describe('armadoVocabulario.service.buscarRelevante', () => {
  it('devuelve [] si el texto no tiene palabras útiles (3+ letras)', async () => {
    const out = await ArmadoVocabulario.buscarRelevante('de un la')
    expect(out).toEqual([])
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('filtra por coincidencia de palabras y mapea el material', async () => {
    mockChain.then = (resolve) => resolve({
      data: [
        { texto_normalizado: 'cano inox 2 pulgadas', material_id: 'mat-cano', veces_confirmado: 3,
          materiales: { id: 'mat-cano', nombre: 'Caño Inoxidable', marca: 'Famiq', unidad: 'metro' } },
        { texto_normalizado: 'valvula mariposa', material_id: 'mat-valv', veces_confirmado: 1,
          materiales: { id: 'mat-valv', nombre: 'Válvula esférica', marca: null, unidad: 'unidad' } },
      ],
      error: null,
    })

    const out = await ArmadoVocabulario.buscarRelevante('caño inox de 2"')

    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      textoAprendido: 'cano inox 2 pulgadas', materialId: 'mat-cano',
      materialNombre: 'Caño Inoxidable', vecesConfirmado: 3,
    })
  })

  it('respeta el tope `limite`', async () => {
    mockChain.then = (resolve) => resolve({
      data: [
        { texto_normalizado: 'codo 90 azul', material_id: 'mat-1', veces_confirmado: 5, materiales: { nombre: 'Codo A' } },
        { texto_normalizado: 'codo 90 verde', material_id: 'mat-2', veces_confirmado: 4, materiales: { nombre: 'Codo B' } },
      ],
      error: null,
    })
    const out = await ArmadoVocabulario.buscarRelevante('codo 90', { limite: 1 })
    expect(out).toHaveLength(1)
  })

  it('propaga el error de Supabase', async () => {
    mockChain.then = (resolve) => resolve({ data: null, error: new Error('caído') })
    await expect(ArmadoVocabulario.buscarRelevante('caño inox')).rejects.toThrow('caído')
  })
})

describe('armadoVocabulario.service.registrarCorreccion', () => {
  it('no hace nada si falta texto o materialId', async () => {
    await ArmadoVocabulario.registrarCorreccion({ textoOriginal: '', materialId: 'mat-1' })
    await ArmadoVocabulario.registrarCorreccion({ textoOriginal: 'algo', materialId: null })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('crea una fila nueva con veces_confirmado=1 si no existía', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
    mockChain.single.mockResolvedValue({ data: { id: 'voc-1', veces_confirmado: 1 }, error: null })

    await ArmadoVocabulario.registrarCorreccion({ textoOriginal: 'Caño Inox', materialId: 'mat-cano' })

    expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({
      texto_normalizado: 'cano inox', material_id: 'mat-cano', veces_confirmado: 1,
    }))
  })

  it('incrementa veces_confirmado si la equivalencia ya existía', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: { id: 'voc-1', veces_confirmado: 2 }, error: null })
    mockChain.single.mockResolvedValue({ data: { id: 'voc-1', veces_confirmado: 3 }, error: null })

    await ArmadoVocabulario.registrarCorreccion({ textoOriginal: 'caño inox', materialId: 'mat-cano' })

    expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({ veces_confirmado: 3 }))
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'voc-1')
  })
})
