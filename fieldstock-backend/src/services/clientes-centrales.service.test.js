const mockChain = {
  select: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  eq:     jest.fn().mockReturnThis(),
  order:  jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
}
mockChain.then = (resolve) => resolve({ data: [], error: null })

jest.mock('../config/supabase.js', () => ({
  supabase: { from: jest.fn(() => mockChain) },
}))

import * as ClientesCentralesService from './clientes-centrales.service.js'
import { supabase } from '../config/supabase.js'

const OLD_ENV = process.env
const mockFetch = jest.fn()
global.fetch = mockFetch

beforeEach(() => {
  jest.clearAllMocks()
  process.env = { ...OLD_ENV, CENTRAL_PROVISIONING_SECRET: 'secreto-compartido' }
  mockChain.select.mockReturnThis()
  mockChain.upsert.mockReturnThis()
  mockChain.eq.mockReturnThis()
  mockChain.order.mockReturnThis()
  mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
  mockChain.then = (resolve) => resolve({ data: [], error: null })
  supabase.from.mockImplementation(() => mockChain)
})

afterAll(() => { process.env = OLD_ENV; delete global.fetch })

describe('clientes-centrales.service.registrarOActualizar', () => {
  const payload = { empresaNombre: 'Constructora Demo', urlBackend: 'https://cliente.test', planCodigo: 'BASICO', planNombre: 'Básico' }

  it('rechaza sin x-client-key', async () => {
    await expect(ClientesCentralesService.registrarOActualizar(payload, {})).rejects.toMatchObject({ status: 400 })
  })

  it('rechaza sin urlBackend en el payload', async () => {
    await expect(
      ClientesCentralesService.registrarOActualizar({ ...payload, urlBackend: undefined }, { 'x-client-key': 'k-1' })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('cliente nuevo: rechaza con 401 si el provisioning secret no matchea', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null }) // no existe todavía
    await expect(
      ClientesCentralesService.registrarOActualizar(payload, { 'x-client-key': 'k-1', 'x-provisioning-secret': 'otro' })
    ).rejects.toMatchObject({ status: 401 })
    expect(mockChain.upsert).not.toHaveBeenCalled()
  })

  it('cliente nuevo: registra si el provisioning secret matchea', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
    await ClientesCentralesService.registrarOActualizar(payload, { 'x-client-key': 'k-1', 'x-provisioning-secret': 'secreto-compartido' })
    expect(mockChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ client_key: 'k-1', empresa_nombre: 'Constructora Demo' }),
      { onConflict: 'client_key' }
    )
  })

  it('cliente ya conocido: actualiza sin pedir provisioning secret', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: { id: 'c-1' }, error: null })
    await ClientesCentralesService.registrarOActualizar(payload, { 'x-client-key': 'k-1' })
    expect(mockChain.upsert).toHaveBeenCalled()
  })
})

describe('clientes-centrales.service.getAll', () => {
  it('marca activo:false si el último reporte supera los 30 minutos, y nunca incluye client_key', async () => {
    const hace45min = new Date(Date.now() - 45 * 60 * 1000).toISOString()
    const hace5min  = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    mockChain.then = (resolve) => resolve({
      data: [
        { id: 'c-1', empresa_nombre: 'Vieja', ultimo_reporte_at: hace45min },
        { id: 'c-2', empresa_nombre: 'Nueva', ultimo_reporte_at: hace5min },
      ],
      error: null,
    })

    const data = await ClientesCentralesService.getAll()

    expect(data[0].activo).toBe(false)
    expect(data[1].activo).toBe(true)
    expect(mockChain.select).toHaveBeenCalledWith(expect.not.stringContaining('client_key'))
  })
})

describe('clientes-centrales.service.liberarDispositivoRemoto', () => {
  it('tira 404 si el cliente no existe', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(ClientesCentralesService.liberarDispositivoRemoto('c-x', 'FS-DEV-1')).rejects.toMatchObject({ status: 404 })
  })

  it('llama a la instancia del cliente con su client_key y devuelve el resultado', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: { url_backend: 'https://cliente.test', client_key: 'k-1' }, error: null })
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: { estado: 'LIBRE' } }) })

    const data = await ClientesCentralesService.liberarDispositivoRemoto('c-1', 'FS-DEV-1')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://cliente.test/api/central/acciones/liberar-dispositivo',
      expect.objectContaining({ headers: expect.objectContaining({ 'x-client-key': 'k-1' }) })
    )
    expect(data.data.estado).toBe('LIBRE')
  })

  it('reintenta una vez y después tira 502 con la causa probable si sigue fallando', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: { url_backend: 'https://cliente.test', client_key: 'k-1' }, error: null })
    mockFetch.mockRejectedValue(new Error('fetch failed'))

    await expect(ClientesCentralesService.liberarDispositivoRemoto('c-1', 'FS-DEV-1')).rejects.toMatchObject({ status: 502 })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  }, 10000)
})
