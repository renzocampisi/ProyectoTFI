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

jest.mock('./planes.service.js', () => ({
  getByCodigo: jest.fn(),
}))

jest.mock('./central-reporte.service.js', () => ({ reportar: jest.fn() }))

jest.mock('./mercadopago.service.js', () => ({
  crearPreapproval:    jest.fn(),
  obtenerPreapproval:  jest.fn(),
  cancelarPreapproval: jest.fn(),
  obtenerPago:         jest.fn(),
  validarFirmaWebhook: jest.fn(),
}))

import * as SuscripcionService from './suscripcion.service.js'
import { supabase } from '../config/supabase.js'
import * as PlanesService from './planes.service.js'
import * as MercadoPagoService from './mercadopago.service.js'

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

describe('suscripcion.service.calcularEstadoEfectivo', () => {
  const hoy = new Date('2026-07-22T12:00:00Z')

  it('sin fila de suscripción, devuelve BLOQUEADA', () => {
    expect(SuscripcionService.calcularEstadoEfectivo(null, hoy)).toBe('BLOQUEADA')
  })

  it('PRUEBA dentro de los 7 días sigue en PRUEBA', () => {
    const s = { estado: 'PRUEBA', fecha_fin_prueba: '2026-07-25T00:00:00Z' }
    expect(SuscripcionService.calcularEstadoEfectivo(s, hoy)).toBe('PRUEBA')
  })

  it('PRUEBA vencida pasa directo a BLOQUEADA (sin gracia)', () => {
    const s = { estado: 'PRUEBA', fecha_fin_prueba: '2026-07-20T00:00:00Z' }
    expect(SuscripcionService.calcularEstadoEfectivo(s, hoy)).toBe('BLOQUEADA')
  })

  it('ACTIVA sin vencimiento futuro sigue ACTIVA', () => {
    const s = { estado: 'ACTIVA', fecha_vencimiento: '2026-08-01T00:00:00Z' }
    expect(SuscripcionService.calcularEstadoEfectivo(s, hoy)).toBe('ACTIVA')
  })

  it('ACTIVA vencida hace 2 días entra en gracia (VENCIDA)', () => {
    const s = { estado: 'ACTIVA', fecha_vencimiento: '2026-07-20T12:00:00Z' }
    expect(SuscripcionService.calcularEstadoEfectivo(s, hoy)).toBe('VENCIDA')
  })

  it('ACTIVA vencida hace más de 5 días (gracia) pasa a BLOQUEADA', () => {
    const s = { estado: 'ACTIVA', fecha_vencimiento: '2026-07-10T12:00:00Z' }
    expect(SuscripcionService.calcularEstadoEfectivo(s, hoy)).toBe('BLOQUEADA')
  })

  it('BLOQUEADA se mantiene BLOQUEADA', () => {
    expect(SuscripcionService.calcularEstadoEfectivo({ estado: 'BLOQUEADA' }, hoy)).toBe('BLOQUEADA')
  })
})

describe('suscripcion.service.crearPrueba', () => {
  it('inserta con estado PRUEBA y fecha_fin_prueba a 7 días', async () => {
    mockChain.single.mockResolvedValue({ data: { id: 's-1', estado: 'PRUEBA' }, error: null })
    await SuscripcionService.crearPrueba('u-1')

    const insertArg = mockChain.insert.mock.calls[0][0]
    expect(insertArg.estado).toBe('PRUEBA')
    expect(insertArg.creado_por).toBe('u-1')
    const inicio = new Date(insertArg.fecha_inicio_prueba)
    const fin    = new Date(insertArg.fecha_fin_prueba)
    const dias   = (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)
    expect(dias).toBeCloseTo(7, 1)
  })
})

describe('suscripcion.service.elegirPlan', () => {
  it('rechaza un plan inválido con 400', async () => {
    PlanesService.getByCodigo.mockResolvedValue(null)
    await expect(
      SuscripcionService.elegirPlan({ codigoPlan: 'INEXISTENTE', payerEmail: 'x@x.com', backUrl: 'https://app/facturacion' })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('rechaza un plan sin precio fijo (a medida, sin checkout automático)', async () => {
    PlanesService.getByCodigo.mockResolvedValue({ id: 'p-3', nombre: 'A medida', precio_mensual: null })
    await expect(
      SuscripcionService.elegirPlan({ codigoPlan: 'A_MEDIDA', payerEmail: 'x@x.com', backUrl: 'https://app/facturacion' })
    ).rejects.toMatchObject({ status: 400 })
    expect(MercadoPagoService.crearPreapproval).not.toHaveBeenCalled()
  })

  it('crea el preapproval y guarda plan_id + mp_preapproval_id', async () => {
    PlanesService.getByCodigo.mockResolvedValue({ id: 'p-2', nombre: 'Pro', precio_mensual: 79.99 })
    mockChain.maybeSingle.mockResolvedValue({ data: { id: 's-1' }, error: null })
    MercadoPagoService.crearPreapproval.mockResolvedValue({ id: 'pre-1', init_point: 'https://mp.test/checkout' })
    mockChain.then = (resolve) => resolve({ error: null })

    const data = await SuscripcionService.elegirPlan({ codigoPlan: 'PRO', payerEmail: 'dueno@x.com', backUrl: 'https://app/facturacion' })

    expect(MercadoPagoService.crearPreapproval).toHaveBeenCalledWith(
      expect.objectContaining({ transactionAmount: 79.99, payerEmail: 'dueno@x.com', externalReference: 's-1' })
    )
    expect(mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ plan_id: 'p-2', mp_preapproval_id: 'pre-1' })
    )
    expect(data.initPoint).toBe('https://mp.test/checkout')
  })
})

describe('suscripcion.service.procesarWebhook', () => {
  it('rechaza con 401 si la firma no valida', async () => {
    MercadoPagoService.validarFirmaWebhook.mockReturnValue(false)
    await expect(
      SuscripcionService.procesarWebhook({ type: 'payment', dataId: 'pay-1', headers: {}, query: {} })
    ).rejects.toMatchObject({ status: 401 })
    expect(MercadoPagoService.obtenerPago).not.toHaveBeenCalled()
  })

  it('type=preapproval authorized actualiza la suscripción a ACTIVA', async () => {
    MercadoPagoService.validarFirmaWebhook.mockReturnValue(true)
    mockChain.maybeSingle.mockResolvedValue({ data: { id: 's-1', estado: 'PRUEBA' }, error: null })
    MercadoPagoService.obtenerPreapproval.mockResolvedValue({ id: 'pre-1', status: 'authorized', payer_id: 999, next_payment_date: '2026-08-22T00:00:00Z' })
    mockChain.then = (resolve) => resolve({ error: null })

    await SuscripcionService.procesarWebhook({ type: 'preapproval', dataId: 'pre-1', headers: { 'x-signature': 'x', 'x-request-id': 'y' }, query: {} })

    expect(mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'ACTIVA', mp_payer_id: '999' })
    )
  })

  it('type=payment approved extiende el vencimiento un mes y registra COBRO', async () => {
    MercadoPagoService.validarFirmaWebhook.mockReturnValue(true)
    mockChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 's-1', estado: 'ACTIVA' }, error: null }) // getActual
      .mockResolvedValueOnce({ data: null, error: null }) // registrarEvento: no existe todavía
    MercadoPagoService.obtenerPago.mockResolvedValue({ id: 'pay-1', status: 'approved', transaction_amount: 79 })
    mockChain.then = (resolve) => resolve({ error: null })

    await SuscripcionService.procesarWebhook({ type: 'payment', dataId: 'pay-1', headers: { 'x-signature': 'x', 'x-request-id': 'y' }, query: {} })

    expect(mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'ACTIVA' })
    )
    expect(mockChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'COBRO', mp_payment_id: 'pay-1' })
    )
  })

  it('no duplica el evento si ya se procesó ese mp_payment_id (idempotencia)', async () => {
    MercadoPagoService.validarFirmaWebhook.mockReturnValue(true)
    mockChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 's-1', estado: 'ACTIVA' }, error: null }) // getActual
      .mockResolvedValueOnce({ data: { id: 'evt-1' }, error: null }) // ya existe
    MercadoPagoService.obtenerPago.mockResolvedValue({ id: 'pay-1', status: 'approved', transaction_amount: 79 })
    mockChain.then = (resolve) => resolve({ error: null })

    await SuscripcionService.procesarWebhook({ type: 'payment', dataId: 'pay-1', headers: { 'x-signature': 'x', 'x-request-id': 'y' }, query: {} })

    expect(mockChain.insert).not.toHaveBeenCalled()
  })

  it('sin suscripción activa en la instancia, no hace nada', async () => {
    MercadoPagoService.validarFirmaWebhook.mockReturnValue(true)
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })

    await SuscripcionService.procesarWebhook({ type: 'payment', dataId: 'pay-1', headers: { 'x-signature': 'x', 'x-request-id': 'y' }, query: {} })

    expect(MercadoPagoService.obtenerPago).not.toHaveBeenCalled()
  })
})

describe('suscripcion.service.cancelar', () => {
  it('rechaza con 400 si no hay preapproval activo', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: { id: 's-1', mp_preapproval_id: null }, error: null })
    await expect(SuscripcionService.cancelar()).rejects.toMatchObject({ status: 400 })
  })

  it('cancela en MP y marca la suscripción BLOQUEADA', async () => {
    mockChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 's-1', mp_preapproval_id: 'pre-1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: null }) // registrarEvento
    mockChain.then = (resolve) => resolve({ error: null })

    await SuscripcionService.cancelar()

    expect(MercadoPagoService.cancelarPreapproval).toHaveBeenCalledWith('pre-1')
    expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({ estado: 'BLOQUEADA' }))
  })
})
