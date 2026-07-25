const mockSend = jest.fn()

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}))

jest.mock('../config/resend.js', () => ({
  getClient: jest.fn(() => ({ emails: { send: mockSend } })),
}))

import * as EmailService from './email.service.js'

const OLD_ENV = process.env

beforeEach(() => {
  jest.clearAllMocks()
  process.env = { ...OLD_ENV, RESEND_FROM_EMAIL: 'FieldStock AI <test@resend.dev>' }
})

afterAll(() => { process.env = OLD_ENV })

describe('email.service.enviarComprobantePago', () => {
  const detalle = [
    { concepto: 'Plan Básico', monto: 29.99 },
    { concepto: '2 empleados extra', monto: 5.98 },
  ]

  it('arma el email con el detalle y el total, y devuelve el id', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email-1' }, error: null })

    const id = await EmailService.enviarComprobantePago({
      to: 'dueno@empresa.com',
      nombreEmpresa: 'Constructora Demo',
      detalle,
      montoTotal: 35.97,
    })

    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      from: 'FieldStock AI <test@resend.dev>',
      to: 'dueno@empresa.com',
      subject: expect.stringContaining('Comprobante'),
      html: expect.stringContaining('Constructora Demo'),
    }))
    expect(mockSend.mock.calls[0][0].html).toContain('Plan Básico')
    expect(id).toBe('email-1')
  })

  it('tira 502 si Resend devuelve error', async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: 'dominio no verificado' } })

    await expect(
      EmailService.enviarComprobantePago({ to: 'x@x.com', nombreEmpresa: 'X', detalle, montoTotal: 1 })
    ).rejects.toMatchObject({ status: 502 })
  })

  it('tira error claro si falta RESEND_FROM_EMAIL', async () => {
    delete process.env.RESEND_FROM_EMAIL
    await expect(
      EmailService.enviarComprobantePago({ to: 'x@x.com', nombreEmpresa: 'X', detalle, montoTotal: 1 })
    ).rejects.toThrow('RESEND_FROM_EMAIL')
  })
})
