const mockPreApprovalCreate = jest.fn()
const mockPreApprovalGet    = jest.fn()
const mockPreApprovalUpdate = jest.fn()
const mockPaymentGet        = jest.fn()

jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn().mockImplementation(() => ({ mock: 'config' })),
  PreApproval: jest.fn().mockImplementation(() => ({
    create: mockPreApprovalCreate,
    get:    mockPreApprovalGet,
    update: mockPreApprovalUpdate,
  })),
  Payment: jest.fn().mockImplementation(() => ({
    get: mockPaymentGet,
  })),
}))

jest.mock('../config/mercadopago.js', () => ({
  getClient: jest.fn(() => ({ mock: 'client' })),
}))

import * as MercadoPagoService from './mercadopago.service.js'

const OLD_ENV = process.env

beforeEach(() => {
  jest.clearAllMocks()
  process.env = { ...OLD_ENV, MP_WEBHOOK_SECRET: 'test-secret' }
})

afterAll(() => { process.env = OLD_ENV })

describe('mercadopago.service.crearPreapproval', () => {
  it('arma el body con auto_recurring mensual en ARS y status pending', async () => {
    mockPreApprovalCreate.mockResolvedValue({ id: 'pre-1', init_point: 'https://mp.test/checkout' })

    const data = await MercadoPagoService.crearPreapproval({
      reason: 'FieldStock AI — Plan Obra',
      payerEmail: 'dueno@empresa.com',
      transactionAmount: 79,
      backUrl: 'https://app.test/facturacion',
      externalReference: 'suscripcion-1',
    })

    expect(mockPreApprovalCreate).toHaveBeenCalledWith({
      body: expect.objectContaining({
        reason: 'FieldStock AI — Plan Obra',
        payer_email: 'dueno@empresa.com',
        external_reference: 'suscripcion-1',
        back_url: 'https://app.test/facturacion',
        status: 'pending',
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: 79,
          currency_id: 'ARS',
        },
      }),
    })
    expect(data.init_point).toBe('https://mp.test/checkout')
  })
})

describe('mercadopago.service.obtenerPreapproval / cancelarPreapproval / obtenerPago', () => {
  it('obtenerPreapproval delega en preApproval.get', async () => {
    mockPreApprovalGet.mockResolvedValue({ id: 'pre-1', status: 'authorized' })
    const data = await MercadoPagoService.obtenerPreapproval('pre-1')
    expect(mockPreApprovalGet).toHaveBeenCalledWith({ id: 'pre-1' })
    expect(data.status).toBe('authorized')
  })

  it('cancelarPreapproval delega en preApproval.update con status cancelled', async () => {
    mockPreApprovalUpdate.mockResolvedValue({ id: 'pre-1', status: 'cancelled' })
    await MercadoPagoService.cancelarPreapproval('pre-1')
    expect(mockPreApprovalUpdate).toHaveBeenCalledWith({ id: 'pre-1', body: { status: 'cancelled' } })
  })

  it('obtenerPago delega en payment.get', async () => {
    mockPaymentGet.mockResolvedValue({ id: 'pay-1', status: 'approved' })
    const data = await MercadoPagoService.obtenerPago('pay-1')
    expect(mockPaymentGet).toHaveBeenCalledWith({ id: 'pay-1' })
    expect(data.status).toBe('approved')
  })
})

describe('mercadopago.service.validarFirmaWebhook', () => {
  // Firma calculada a mano con el mismo algoritmo que el service, para un
  // secret/manifest fijos — sirve como fixture de "firma real válida".
  const crypto = require('crypto')
  const secret = 'test-secret'
  const dataId = 'pay-123'
  const requestId = 'req-abc'
  const ts = '1700000000'
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
  const v1valida = crypto.createHmac('sha256', secret).update(manifest).digest('hex')

  it('acepta una firma válida', () => {
    const headers = { 'x-signature': `ts=${ts},v1=${v1valida}`, 'x-request-id': requestId }
    expect(MercadoPagoService.validarFirmaWebhook(headers, dataId)).toBe(true)
  })

  it('rechaza una firma alterada', () => {
    const headers = { 'x-signature': `ts=${ts},v1=${v1valida}deadbeef`, 'x-request-id': requestId }
    expect(MercadoPagoService.validarFirmaWebhook(headers, dataId)).toBe(false)
  })

  it('rechaza si falta el header x-signature o x-request-id', () => {
    expect(MercadoPagoService.validarFirmaWebhook({ 'x-request-id': requestId }, dataId)).toBe(false)
    expect(MercadoPagoService.validarFirmaWebhook({ 'x-signature': `ts=${ts},v1=${v1valida}` }, dataId)).toBe(false)
  })

  it('tira error claro si falta MP_WEBHOOK_SECRET', () => {
    delete process.env.MP_WEBHOOK_SECRET
    expect(() => MercadoPagoService.validarFirmaWebhook({}, dataId)).toThrow('MP_WEBHOOK_SECRET')
  })
})
