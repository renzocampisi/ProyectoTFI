// Tests del service de Presupuestos. Mismo patron de mocks que
// compras.service.test.js: chainable mock para .from(), separado para
// storage.
const mockChain = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  eq:     jest.fn().mockReturnThis(),
  in:     jest.fn().mockReturnThis(),
  order:  jest.fn().mockReturnThis(),
  limit:  jest.fn().mockReturnThis(),
  single:      jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
}
mockChain.then = (resolve) => resolve({ data: [], error: null })

const mockStorage = {
  createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.test/url' }, error: null }),
  upload:          jest.fn().mockResolvedValue({ data: { path: 'PR-00001.pdf' }, error: null }),
  remove:          jest.fn().mockResolvedValue({ data: [], error: null }),
}

jest.mock('../config/supabase.js', () => ({
  supabase: {
    from: jest.fn(() => mockChain),
    rpc:  jest.fn().mockResolvedValue({ data: 'PR-00001', error: null }),
    storage: { from: jest.fn(() => mockStorage) },
  },
}))

import * as PresupuestosService from './presupuestos.service.js'
import { supabase } from '../config/supabase.js'

beforeEach(() => {
  jest.resetAllMocks()
  mockChain.select.mockReturnThis()
  mockChain.insert.mockReturnThis()
  mockChain.update.mockReturnThis()
  mockChain.delete.mockReturnThis()
  mockChain.upsert.mockReturnThis()
  mockChain.eq.mockReturnThis()
  mockChain.in.mockReturnThis()
  mockChain.order.mockReturnThis()
  mockChain.limit.mockReturnThis()
  mockChain.single.mockResolvedValue({ data: null, error: null })
  mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
  mockChain.then = (resolve) => resolve({ data: [], error: null })
  supabase.from.mockImplementation(() => mockChain)
  supabase.rpc.mockResolvedValue({ data: 'PR-00001', error: null })

  mockStorage.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.test/url' }, error: null })
  mockStorage.upload.mockResolvedValue({ data: { path: 'PR-00001.pdf' }, error: null })
  mockStorage.remove.mockResolvedValue({ data: [], error: null })
  supabase.storage.from.mockImplementation(() => mockStorage)
})

// ─────────────────────────────────────────────────────────────
describe('presupuestos.service.create', () => {
  it('rechaza si no viene obraId', async () => {
    await expect(PresupuestosService.create({})).rejects.toThrow('obraId')
  })

  it('rechaza si la obra no existe', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null }) // obra no encontrada
    await expect(
      PresupuestosService.create({ obraId: 'o-1' })
    ).rejects.toThrow('Obra no encontrada')
  })

  it('rechaza % ganancia fuera de rango', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: { id: 'o-1', estado: 'ACTIVA' }, error: null })
    await expect(
      PresupuestosService.create({ obraId: 'o-1', porcentajeGanancia: 150 })
    ).rejects.toThrow('porcentajeGanancia')
  })

  it('toma el % default de config_sistema si no viene en el body', async () => {
    // 1) Validar obra existe
    mockChain.maybeSingle.mockResolvedValueOnce({ data: { id: 'o-1', estado: 'ACTIVA' }, error: null })
    // 2) Leer config para default
    mockChain.maybeSingle.mockResolvedValueOnce({ data: { value: '15' }, error: null })
    // 3) Insert del presupuesto
    mockChain.single.mockResolvedValueOnce({
      data: { id: 'p-1', numero: 'PR-00001', estado: 'BORRADOR', porcentaje_ganancia: 15 },
      error: null,
    })

    const result = await PresupuestosService.create({ obraId: 'o-1' })

    expect(supabase.rpc).toHaveBeenCalledWith('generar_numero_presupuesto')
    expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({
      porcentaje_ganancia: 15,
      estado: 'BORRADOR',
    }))
    expect(result.numero).toBe('PR-00001')
  })
})

// ─────────────────────────────────────────────────────────────
describe('presupuestos.service.addInsumo', () => {
  it('rechaza si el presupuesto no esta en BORRADOR', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: { estado: 'APROBADO' }, error: null })
    await expect(
      PresupuestosService.addInsumo('p-1', { materialId: 'm-1', cantidad: 5, precioUnitario: 100 })
    ).rejects.toThrow(/BORRADOR/)
  })

  it('rechaza cantidad <= 0', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: { estado: 'BORRADOR' }, error: null })
    await expect(
      PresupuestosService.addInsumo('p-1', { materialId: 'm-1', cantidad: 0, precioUnitario: 100 })
    ).rejects.toThrow('cantidad')
  })

  it('rechaza precio negativo', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: { estado: 'BORRADOR' }, error: null })
    await expect(
      PresupuestosService.addInsumo('p-1', { materialId: 'm-1', cantidad: 5, precioUnitario: -10 })
    ).rejects.toThrow('precioUnitario')
  })

  it('inserta el insumo en BORRADOR', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: { estado: 'BORRADOR' }, error: null })
    mockChain.single.mockResolvedValueOnce({
      data: { id: 'i-1', material_id: 'm-1', cantidad: 5, precio_unitario: 100 },
      error: null,
    })

    const result = await PresupuestosService.addInsumo('p-1', {
      materialId: 'm-1', cantidad: 5, precioUnitario: 100,
    })

    expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({
      presupuesto_id: 'p-1',
      material_id:    'm-1',
      cantidad:       5,
      precio_unitario: 100,
    }))
    expect(result.id).toBe('i-1')
  })
})

// ─────────────────────────────────────────────────────────────
describe('presupuestos.service.addCosto', () => {
  it('rechaza categoria invalida', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: { estado: 'BORRADOR' }, error: null })
    await expect(
      PresupuestosService.addCosto('p-1', { categoria: 'BITCOIN', descripcion: 'x', costoUnitario: 100 })
    ).rejects.toThrow('categoria')
  })

  it('rechaza si falta descripcion', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: { estado: 'BORRADOR' }, error: null })
    await expect(
      PresupuestosService.addCosto('p-1', { categoria: 'MANO_OBRA', descripcion: '   ', costoUnitario: 100 })
    ).rejects.toThrow('descripcion')
  })

  it('inserta el costo en BORRADOR', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: { estado: 'BORRADOR' }, error: null })
    mockChain.single.mockResolvedValueOnce({
      data: { id: 'c-1', categoria: 'MANO_OBRA', descripcion: 'Electricista', cantidad: 8, costo_unitario: 1500 },
      error: null,
    })

    const result = await PresupuestosService.addCosto('p-1', {
      categoria: 'MANO_OBRA', descripcion: 'Electricista', cantidad: 8, unidad: 'horas', costoUnitario: 1500,
    })

    expect(result.categoria).toBe('MANO_OBRA')
  })
})

// ─────────────────────────────────────────────────────────────
describe('presupuestos.service.enviarAprobacion', () => {
  it('rechaza si no esta en BORRADOR', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: { estado: 'APROBADO' }, error: null })
    await expect(PresupuestosService.enviarAprobacion('p-1')).rejects.toThrow(/BORRADOR/)
  })

  it('rechaza si no tiene items', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: { estado: 'BORRADOR', obra_id: 'o-1' }, error: null })
    // Counts de insumos y costos: ambos 0
    mockChain.then = (resolve) => resolve({ count: 0, error: null })
    await expect(PresupuestosService.enviarAprobacion('p-1')).rejects.toThrow(/items/)
  })
})

// ─────────────────────────────────────────────────────────────
describe('presupuestos.service.rechazar', () => {
  it('rechaza si no esta EN_APROBACION', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: { estado: 'BORRADOR' }, error: null })
    await expect(PresupuestosService.rechazar('p-1', 'motivo')).rejects.toThrow(/EN_APROBACION/)
  })

  it('actualiza estado a RECHAZADO con motivo', async () => {
    mockChain.maybeSingle
      .mockResolvedValueOnce({ data: { estado: 'EN_APROBACION', obra_id: 'o-1' }, error: null }) // getCabecera
      .mockResolvedValueOnce({ data: { estado: 'EN_APROBACION' }, error: null }) // sincronizarEstadoObra
    mockChain.single.mockResolvedValueOnce({
      data: { id: 'p-1', estado: 'RECHAZADO', motivo_rechazo: 'precios muy altos' },
      error: null,
    })

    const result = await PresupuestosService.rechazar('p-1', 'precios muy altos')

    expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({
      estado: 'RECHAZADO',
      motivo_rechazo: 'precios muy altos',
    }))
    expect(result.estado).toBe('RECHAZADO')
  })
})

// ─────────────────────────────────────────────────────────────
describe('presupuestos.service.getPdfSignedUrl', () => {
  it('devuelve null si no hay pdf_url', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: { pdf_url: null }, error: null })
    const result = await PresupuestosService.getPdfSignedUrl('p-1')
    expect(result).toBeNull()
    expect(mockStorage.createSignedUrl).not.toHaveBeenCalled()
  })

  it('genera signed URL con TTL 3600s cuando hay pdf', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: { pdf_url: 'PR-00001.pdf' }, error: null })
    const result = await PresupuestosService.getPdfSignedUrl('p-1')
    expect(supabase.storage.from).toHaveBeenCalledWith('presupuestos-pdf')
    expect(mockStorage.createSignedUrl).toHaveBeenCalledWith('PR-00001.pdf', 3600)
    expect(result.url).toBe('https://signed.test/url')
  })
})

// ─────────────────────────────────────────────────────────────
describe('presupuestos.service.uploadPdf', () => {
  const buffer = Buffer.from('fake-pdf-content')

  it('rechaza mimetype distinto de PDF', async () => {
    await expect(
      PresupuestosService.uploadPdf('p-1', { buffer, mimetype: 'image/png' })
    ).rejects.toThrow('PDF')
  })

  it('rechaza archivo vacio', async () => {
    await expect(
      PresupuestosService.uploadPdf('p-1', { buffer: Buffer.alloc(0), mimetype: 'application/pdf' })
    ).rejects.toThrow('vacío')
  })

  it('rechaza archivo > 5 MB', async () => {
    await expect(
      PresupuestosService.uploadPdf('p-1', { buffer: Buffer.alloc(6 * 1024 * 1024), mimetype: 'application/pdf' })
    ).rejects.toThrow('5 MB')
  })
})
