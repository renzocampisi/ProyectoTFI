const mockChain = {
  select:      jest.fn().mockReturnThis(),
  insert:      jest.fn().mockReturnThis(),
  update:      jest.fn().mockReturnThis(),
  eq:          jest.fn().mockReturnThis(),
  is:          jest.fn().mockReturnThis(),
  order:       jest.fn().mockReturnThis(),
  single:      jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
}
mockChain.then = (resolve) => resolve({ data: [], error: null })

jest.mock('../config/supabase.js', () => ({
  supabase: { from: jest.fn(() => mockChain) },
}))

import * as DispositivosConfianza from './dispositivos-confianza.service.js'
import { supabase } from '../config/supabase.js'

beforeEach(() => {
  jest.clearAllMocks()
  mockChain.select.mockReturnThis()
  mockChain.insert.mockReturnThis()
  mockChain.update.mockReturnThis()
  mockChain.eq.mockReturnThis()
  mockChain.is.mockReturnThis()
  mockChain.order.mockReturnThis()
  mockChain.single.mockResolvedValue({ data: null, error: null })
  mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
  mockChain.then = (resolve) => resolve({ data: [], error: null })
  supabase.from.mockImplementation(() => mockChain)
})

describe('DispositivosConfianza.registrar', () => {
  it('inserta hash del token (nunca el crudo) y devuelve { id, token }', async () => {
    mockChain.single.mockResolvedValue({ data: { id: 'disp-1' }, error: null })

    const r = await DispositivosConfianza.registrar('u-1', 'Mozilla/5.0 (Windows) Chrome/120.0')

    expect(supabase.from).toHaveBeenCalledWith('usuario_dispositivos_confianza')
    const insertArg = mockChain.insert.mock.calls[0][0]
    expect(insertArg.usuario_id).toBe('u-1')
    expect(insertArg.token_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(insertArg.token_hash).not.toBe(r.token)
    expect(insertArg.descripcion).toBe('Chrome en Windows')
    expect(r).toEqual({ id: 'disp-1', token: expect.any(String) })
  })

  it('propaga el error de Supabase si el insert falla', async () => {
    mockChain.single.mockResolvedValue({ data: null, error: new Error('db down') })
    await expect(DispositivosConfianza.registrar('u-1', '')).rejects.toThrow('db down')
  })
})

describe('DispositivosConfianza.validarYUsar', () => {
  it('sin usuarioId o token → false, sin pegarle a Supabase', async () => {
    expect(await DispositivosConfianza.validarYUsar(null, 'tok')).toBe(false)
    expect(await DispositivosConfianza.validarYUsar('u-1', null)).toBe(false)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('token que no existe para ese usuario → false', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await DispositivosConfianza.validarYUsar('u-1', 'tok')).toBe(false)
  })

  it('token vigente → true y actualiza ultimo_uso', async () => {
    mockChain.maybeSingle.mockResolvedValue({
      data: {
        id: 'disp-1',
        created_at: new Date().toISOString(),
        ultimo_uso: new Date().toISOString(),
        revocado_at: null,
      },
      error: null,
    })

    const ok = await DispositivosConfianza.validarYUsar('u-1', 'tok')

    expect(ok).toBe(true)
    expect(mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ ultimo_uso: expect.any(String) })
    )
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'disp-1')
  })

  it('token revocado → false', async () => {
    mockChain.maybeSingle.mockResolvedValue({
      data: {
        id: 'disp-1',
        created_at: new Date().toISOString(),
        ultimo_uso: new Date().toISOString(),
        revocado_at: new Date().toISOString(),
      },
      error: null,
    })
    expect(await DispositivosConfianza.validarYUsar('u-1', 'tok')).toBe(false)
  })

  it('sin uso hace más de 30 días → false (inactividad)', async () => {
    const hace31dias = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()
    mockChain.maybeSingle.mockResolvedValue({
      data: { id: 'disp-1', created_at: hace31dias, ultimo_uso: hace31dias, revocado_at: null },
      error: null,
    })
    expect(await DispositivosConfianza.validarYUsar('u-1', 'tok')).toBe(false)
  })

  it('creado hace más de 90 días → false (tope duro), aunque el uso sea reciente', async () => {
    const hace91dias = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString()
    mockChain.maybeSingle.mockResolvedValue({
      data: { id: 'disp-1', created_at: hace91dias, ultimo_uso: new Date().toISOString(), revocado_at: null },
      error: null,
    })
    expect(await DispositivosConfianza.validarYUsar('u-1', 'tok')).toBe(false)
  })
})

describe('DispositivosConfianza.listar', () => {
  it('lista por usuario ordenado por ultimo_uso desc', async () => {
    mockChain.then = (resolve) => resolve({ data: [{ id: 'disp-1' }], error: null })
    const data = await DispositivosConfianza.listar('u-1')
    expect(mockChain.eq).toHaveBeenCalledWith('usuario_id', 'u-1')
    expect(mockChain.order).toHaveBeenCalledWith('ultimo_uso', { ascending: false })
    expect(data).toEqual([{ id: 'disp-1' }])
  })
})

describe('DispositivosConfianza.revocarUno', () => {
  it('marca revocado_at, filtrando por id Y usuario_id', async () => {
    mockChain.then = (resolve) => resolve({ error: null })
    await DispositivosConfianza.revocarUno('u-1', 'disp-1')
    expect(mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ revocado_at: expect.any(String) })
    )
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'disp-1')
    expect(mockChain.eq).toHaveBeenCalledWith('usuario_id', 'u-1')
  })

  it('propaga el error de Supabase', async () => {
    mockChain.then = (resolve) => resolve({ error: new Error('update failed') })
    await expect(DispositivosConfianza.revocarUno('u-1', 'disp-1')).rejects.toThrow('update failed')
  })
})

describe('DispositivosConfianza.revocarTodos', () => {
  it('marca revocado_at en todas las filas vigentes del usuario', async () => {
    mockChain.then = (resolve) => resolve({ error: null })
    await DispositivosConfianza.revocarTodos('u-1')
    expect(mockChain.eq).toHaveBeenCalledWith('usuario_id', 'u-1')
    expect(mockChain.is).toHaveBeenCalledWith('revocado_at', null)
  })
})
