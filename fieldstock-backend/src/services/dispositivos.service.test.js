const mockChain = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq:     jest.fn().mockReturnThis(),
  order:  jest.fn().mockReturnThis(),
  single:      jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
}
mockChain.then = (resolve) => resolve({ count: 0, error: null })

jest.mock('../config/supabase.js', () => ({
  supabase: { from: jest.fn(() => mockChain) },
}))

jest.mock('./suscripcion.service.js', () => ({ getActual: jest.fn() }))
jest.mock('./central-reporte.service.js', () => ({ reportar: jest.fn() }))

import * as DispositivosService from './dispositivos.service.js'
import { supabase } from '../config/supabase.js'
import * as SuscripcionService from './suscripcion.service.js'

beforeEach(() => {
  jest.clearAllMocks()
  mockChain.select.mockReturnThis()
  mockChain.insert.mockReturnThis()
  mockChain.update.mockReturnThis()
  mockChain.eq.mockReturnThis()
  mockChain.order.mockReturnThis()
  mockChain.single.mockResolvedValue({ data: null, error: null })
  mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
  mockChain.then = (resolve) => resolve({ count: 0, error: null })
  supabase.from.mockImplementation(() => mockChain)
})

describe('dispositivos.service.crear', () => {
  it('rechaza sin codigoQR', async () => {
    await expect(DispositivosService.crear({})).rejects.toMatchObject({ status: 400 })
  })

  it('inserta el dispositivo nuevo en estado LIBRE por default', async () => {
    mockChain.single.mockResolvedValue({ data: { id: 'd-1', codigo_qr: 'FS-DEV-ABC123', estado: 'LIBRE' }, error: null })
    const data = await DispositivosService.crear({ codigoQR: 'FS-DEV-ABC123' })
    expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({ codigo_qr: 'FS-DEV-ABC123' }))
    expect(data.estado).toBe('LIBRE')
  })
})

describe('dispositivos.service.getByCodigoQR', () => {
  it('tira 404 si no existe ningún dispositivo con ese código', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(DispositivosService.getByCodigoQR('FS-DEV-X')).rejects.toMatchObject({ status: 404 })
  })

  it('devuelve el dispositivo si existe', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: { id: 'd-1', codigo_qr: 'FS-DEV-1' }, error: null })
    const data = await DispositivosService.getByCodigoQR('FS-DEV-1')
    expect(data.id).toBe('d-1')
  })
})

describe('dispositivos.service.emparejar', () => {
  it('rechaza sin herramientaId', async () => {
    await expect(DispositivosService.emparejar({ codigoQR: 'FS-DEV-1' })).rejects.toMatchObject({ status: 400 })
  })

  it('rechaza con 403 si ya se usó todo el cupo contratado', async () => {
    SuscripcionService.getActual.mockResolvedValue({ herramientas_seguimiento_cupo: 2 })
    mockChain.then = (resolve) => resolve({ count: 2, error: null })
    await expect(
      DispositivosService.emparejar({ codigoQR: 'FS-DEV-1', herramientaId: 'h-1' })
    ).rejects.toMatchObject({ status: 403 })
  })

  it('rechaza con 409 si el dispositivo no está LIBRE (conflicto de concurrencia)', async () => {
    SuscripcionService.getActual.mockResolvedValue({ herramientas_seguimiento_cupo: 5 })
    mockChain.then = (resolve) => resolve({ count: 0, error: null })
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null }) // el UPDATE no afectó ninguna fila
    await expect(
      DispositivosService.emparejar({ codigoQR: 'FS-DEV-1', herramientaId: 'h-1' })
    ).rejects.toMatchObject({ status: 409 })
  })

  it('empareja el dispositivo con la herramienta cuando hay cupo y está LIBRE', async () => {
    SuscripcionService.getActual.mockResolvedValue({ herramientas_seguimiento_cupo: 5 })
    mockChain.then = (resolve) => resolve({ count: 1, error: null })
    mockChain.maybeSingle.mockResolvedValue({ data: { id: 'd-1', estado: 'EMPAREJADO', herramienta_id: 'h-1' }, error: null })

    const data = await DispositivosService.emparejar({ codigoQR: 'FS-DEV-1', herramientaId: 'h-1' })

    expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({ estado: 'EMPAREJADO', herramienta_id: 'h-1' }))
    expect(mockChain.eq).toHaveBeenCalledWith('estado', 'LIBRE')
    expect(data.estado).toBe('EMPAREJADO')
  })
})

describe('dispositivos.service.liberar / darDeBaja', () => {
  it('liberar vuelve el dispositivo a LIBRE y limpia la herramienta', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: { id: 'd-1', estado: 'LIBRE', herramienta_id: null }, error: null })
    const data = await DispositivosService.liberar('d-1')
    expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({ estado: 'LIBRE', herramienta_id: null }))
    expect(data.estado).toBe('LIBRE')
  })

  it('liberar tira 404 si el dispositivo no existe', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(DispositivosService.liberar('no-existe')).rejects.toMatchObject({ status: 404 })
  })

  it('darDeBaja marca el dispositivo como BAJA', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: { id: 'd-1', estado: 'BAJA' }, error: null })
    const data = await DispositivosService.darDeBaja('d-1')
    expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({ estado: 'BAJA', herramienta_id: null }))
    expect(data.estado).toBe('BAJA')
  })
})
