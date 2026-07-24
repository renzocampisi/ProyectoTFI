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
jest.mock('./empresa.service.js', () => ({ get: jest.fn() }))
jest.mock('./suscripcion.service.js', () => ({ getEstado: jest.fn() }))

import * as CentralReporteService from './central-reporte.service.js'
import { supabase } from '../config/supabase.js'
import * as EmpresaService from './empresa.service.js'
import * as SuscripcionService from './suscripcion.service.js'

const OLD_ENV = process.env
const mockFetch = jest.fn()
global.fetch = mockFetch

beforeEach(() => {
  jest.clearAllMocks()
  process.env = { ...OLD_ENV }
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
  EmpresaService.get.mockResolvedValue({ nombre: 'Constructora Demo' })
  SuscripcionService.getEstado.mockResolvedValue({
    plan: { codigo: 'BASICO', nombre: 'Básico' }, empleados_extra: 0, herramientas_seguimiento_cupo: 0,
  })
})

afterAll(() => { process.env = OLD_ENV; delete global.fetch })

describe('central-reporte.service.reportar', () => {
  it('no hace nada si CENTRAL_URL no está configurada', async () => {
    delete process.env.CENTRAL_URL
    await CentralReporteService.reportar()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('genera y persiste una client_key nueva la primera vez, y manda el provisioning secret', async () => {
    process.env.CENTRAL_URL = 'https://central.test'
    process.env.CENTRAL_PROVISIONING_SECRET = 'secreto-compartido'
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null }) // no existe instancia todavía
    mockChain.single.mockResolvedValue({ data: { id: 'i-1', client_key: 'clave-nueva', registrada_at: null }, error: null })
    mockFetch.mockResolvedValue({ ok: true })

    await CentralReporteService.reportar()

    expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({ client_key: expect.any(String) }))
    expect(mockFetch).toHaveBeenCalledWith(
      'https://central.test/api/central/reportar',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-client-key': 'clave-nueva', 'x-provisioning-secret': 'secreto-compartido' }),
      })
    )
    // Se marca como registrada tras un reporte exitoso.
    expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({ registrada_at: expect.any(String) }))
  })

  it('no manda el provisioning secret si la instancia ya está registrada', async () => {
    process.env.CENTRAL_URL = 'https://central.test'
    process.env.CENTRAL_PROVISIONING_SECRET = 'secreto-compartido'
    mockChain.maybeSingle.mockResolvedValue({
      data: { id: 'i-1', client_key: 'clave-existente', registrada_at: '2026-01-01T00:00:00Z' }, error: null,
    })
    mockFetch.mockResolvedValue({ ok: true })

    await CentralReporteService.reportar()

    const headers = mockFetch.mock.calls[0][1].headers
    expect(headers['x-client-key']).toBe('clave-existente')
    expect(headers['x-provisioning-secret']).toBeUndefined()
    expect(mockChain.update).not.toHaveBeenCalled()
  })

  it('no propaga el error si falla la red — fire-and-forget', async () => {
    process.env.CENTRAL_URL = 'https://central.test'
    mockChain.maybeSingle.mockResolvedValue({ data: { id: 'i-1', client_key: 'x', registrada_at: '2026-01-01' }, error: null })
    mockFetch.mockRejectedValue(new Error('network down'))

    await expect(CentralReporteService.reportar()).resolves.toBeUndefined()
  })
})
