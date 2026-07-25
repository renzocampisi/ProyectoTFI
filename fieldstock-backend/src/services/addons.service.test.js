const mockChain = {
  update: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  eq:     jest.fn().mockReturnThis(),
}
mockChain.then = (resolve) => resolve({ error: null })

jest.mock('../config/supabase.js', () => ({
  supabase: { from: jest.fn(() => mockChain) },
}))

jest.mock('./suscripcion.service.js', () => ({ getActual: jest.fn() }))
jest.mock('./mercadopago.service.js', () => ({ actualizarMontoPreapproval: jest.fn() }))
jest.mock('./email.service.js', () => ({ enviarComprobantePago: jest.fn() }))
jest.mock('./empresa.service.js', () => ({ get: jest.fn() }))
jest.mock('./central-reporte.service.js', () => ({ reportar: jest.fn() }))

import * as AddonsService from './addons.service.js'
import { supabase } from '../config/supabase.js'
import * as SuscripcionService from './suscripcion.service.js'
import * as MercadoPagoService from './mercadopago.service.js'
import * as EmailService from './email.service.js'
import * as EmpresaService from './empresa.service.js'

beforeEach(() => {
  jest.clearAllMocks()
  mockChain.update.mockReturnThis()
  mockChain.insert.mockReturnThis()
  mockChain.eq.mockReturnThis()
  mockChain.then = (resolve) => resolve({ error: null })
  supabase.from.mockImplementation(() => mockChain)
  EmpresaService.get.mockResolvedValue({ nombre: 'Constructora Demo' })
})

describe('addons.service.calcularDetalle / calcularMontoTotal', () => {
  it('solo el plan base si no hay extras', () => {
    const s = { plan: { nombre: 'Básico', precio_mensual: 29.99 }, empleados_extra: 0, herramientas_seguimiento_cupo: 0 }
    expect(AddonsService.calcularDetalle(s)).toEqual([{ concepto: 'Plan Básico', monto: 29.99 }])
    expect(AddonsService.calcularMontoTotal(s)).toBe(29.99)
  })

  it('suma línea de empleados extra y de herramientas con seguimiento', () => {
    const s = { plan: { nombre: 'Básico', precio_mensual: 29.99 }, empleados_extra: 2, herramientas_seguimiento_cupo: 3 }
    const detalle = AddonsService.calcularDetalle(s)
    expect(detalle).toEqual([
      { concepto: 'Plan Básico', monto: 29.99 },
      { concepto: '2 empleados extra', monto: 5.98 },
      { concepto: '3 herramientas con seguimiento', monto: 29.97 },
    ])
    expect(AddonsService.calcularMontoTotal(s)).toBeCloseTo(65.94, 2)
  })
})

describe('addons.service.actualizarExtras', () => {
  const suscripcionBase = {
    id: 's-1', mp_preapproval_id: 'pre-1',
    plan: { nombre: 'Básico', precio_mensual: 29.99 },
    empleados_extra: 0, herramientas_seguimiento_cupo: 0,
  }

  it('rechaza cantidades negativas con 400', async () => {
    await expect(
      AddonsService.actualizarExtras({ empleadosExtra: -1, herramientasCupo: 0, payerEmail: 'x@x.com' })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('rechaza si todavía no hay plan elegido', async () => {
    SuscripcionService.getActual.mockResolvedValue({ id: 's-1', plan: null })
    await expect(
      AddonsService.actualizarExtras({ empleadosExtra: 1, herramientasCupo: 0, payerEmail: 'x@x.com' })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('rechaza si no hay preapproval activo', async () => {
    SuscripcionService.getActual.mockResolvedValue({ ...suscripcionBase, mp_preapproval_id: null })
    await expect(
      AddonsService.actualizarExtras({ empleadosExtra: 1, herramientasCupo: 0, payerEmail: 'x@x.com' })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('actualiza el monto en MP, persiste los extras, registra el evento y manda el comprobante', async () => {
    SuscripcionService.getActual.mockResolvedValue(suscripcionBase)

    const data = await AddonsService.actualizarExtras({ empleadosExtra: 2, herramientasCupo: 1, payerEmail: 'dueno@empresa.com' })

    expect(MercadoPagoService.actualizarMontoPreapproval).toHaveBeenCalledWith('pre-1', expect.closeTo(45.96, 2))
    expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({ empleados_extra: 2, herramientas_seguimiento_cupo: 1 }))
    expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'AJUSTE_EXTRAS', mp_preapproval_id: 'pre-1' }))
    expect(EmailService.enviarComprobantePago).toHaveBeenCalledWith(expect.objectContaining({
      to: 'dueno@empresa.com', nombreEmpresa: 'Constructora Demo',
    }))
    expect(data.montoTotal).toBeCloseTo(45.96, 2)
  })
})
