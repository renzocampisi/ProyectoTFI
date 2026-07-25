const mockChain = {
  select: jest.fn().mockReturnThis(),
  eq:     jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
}

jest.mock('../config/supabase.js', () => ({
  supabase: { from: jest.fn(() => mockChain) },
}))

import { requireClaveCliente } from './requireClaveCliente.js'

function mockReqRes(headers = {}) {
  const req = { header: (name) => headers[name.toLowerCase()] }
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
  const next = jest.fn()
  return { req, res, next }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockChain.select.mockReturnThis()
  mockChain.eq.mockReturnThis()
  mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
})

describe('requireClaveCliente', () => {
  it('rechaza con 401 si falta el header x-client-key', async () => {
    const { req, res, next } = mockReqRes()
    await requireClaveCliente(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('rechaza con 401 si la clave no matchea ninguna instancia', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
    const { req, res, next } = mockReqRes({ 'x-client-key': 'clave-invalida' })
    await requireClaveCliente(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('deja pasar si la clave matchea', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: { id: 'i-1' }, error: null })
    const { req, res, next } = mockReqRes({ 'x-client-key': 'clave-valida' })
    await requireClaveCliente(req, res, next)
    expect(next).toHaveBeenCalledWith()
    expect(res.status).not.toHaveBeenCalled()
  })
})
