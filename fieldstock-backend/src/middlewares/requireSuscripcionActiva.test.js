jest.mock('../services/suscripcion.service.js', () => ({
  getActual: jest.fn(),
  calcularEstadoEfectivo: jest.fn(),
}))

import { requireSuscripcionActiva } from './requireSuscripcionActiva.js'
import * as SuscripcionService from '../services/suscripcion.service.js'

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('requireSuscripcionActiva', () => {
  it('deja pasar sin consultar la suscripción si la ruta está exceptuada', async () => {
    const req = { path: '/suscripcion' }
    const res = mockRes()
    const next = jest.fn()

    await requireSuscripcionActiva(req, res, next)

    expect(SuscripcionService.getActual).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('deja pasar rutas anidadas de una excepción (/usuarios/me)', async () => {
    const req = { path: '/usuarios/me' }
    const res = mockRes()
    const next = jest.fn()

    await requireSuscripcionActiva(req, res, next)

    expect(next).toHaveBeenCalledWith()
  })

  it('no confunde /usuarios/me con /usuarios/otro-id (no debe ser exceptuada)', async () => {
    SuscripcionService.getActual.mockResolvedValue({ estado: 'ACTIVA' })
    SuscripcionService.calcularEstadoEfectivo.mockReturnValue('ACTIVA')
    const req = { path: '/usuarios/algun-id' }
    const res = mockRes()
    const next = jest.fn()

    await requireSuscripcionActiva(req, res, next)

    expect(SuscripcionService.getActual).toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith()
  })

  it('deja pasar si el estado efectivo no es BLOQUEADA', async () => {
    SuscripcionService.getActual.mockResolvedValue({ estado: 'PRUEBA' })
    SuscripcionService.calcularEstadoEfectivo.mockReturnValue('PRUEBA')
    const req = { path: '/herramientas' }
    const res = mockRes()
    const next = jest.fn()

    await requireSuscripcionActiva(req, res, next)

    expect(next).toHaveBeenCalledWith()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('corta con 402 si el estado efectivo es BLOQUEADA', async () => {
    SuscripcionService.getActual.mockResolvedValue({ estado: 'VENCIDA' })
    SuscripcionService.calcularEstadoEfectivo.mockReturnValue('BLOQUEADA')
    const req = { path: '/herramientas' }
    const res = mockRes()
    const next = jest.fn()

    await requireSuscripcionActiva(req, res, next)

    expect(res.status).toHaveBeenCalledWith(402)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }))
    expect(next).not.toHaveBeenCalled()
  })

  it('propaga errores inesperados a next(err)', async () => {
    SuscripcionService.getActual.mockRejectedValue(new Error('db down'))
    const req = { path: '/herramientas' }
    const res = mockRes()
    const next = jest.fn()

    await requireSuscripcionActiva(req, res, next)

    expect(next).toHaveBeenCalledWith(expect.any(Error))
  })
})
