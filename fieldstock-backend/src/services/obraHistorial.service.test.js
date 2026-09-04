// obraHistorial.service.js agrega de muchas tablas distintas — el mock
// despacha por nombre de tabla en vez de un chain único compartido.
// Todo lo referenciado dentro de jest.mock() tiene que empezar con "mock"
// (regla del hoisting de babel-plugin-jest-hoist).
function mockMakeChain(result = { data: [], error: null }) {
  const chain = {
    select: jest.fn(() => chain),
    eq:     jest.fn(() => chain),
    neq:    jest.fn(() => chain),
    in:     jest.fn(() => chain),
    order:  jest.fn(() => chain),
    limit:  jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    maybeSingle: jest.fn().mockResolvedValue(result),
    single:      jest.fn().mockResolvedValue(result),
  }
  chain.then = (resolve) => resolve(result)
  return chain
}

const mockTablas = {}
function mockSetTabla(nombre, result) { mockTablas[nombre] = mockMakeChain(result) }

const mockStorage = {
  createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.test/plano.jpg' }, error: null }),
  upload:          jest.fn().mockResolvedValue({ data: { path: 'obra-1/123.jpg' }, error: null }),
}

jest.mock('../config/supabase.js', () => ({
  supabase: {
    from:    jest.fn((t) => mockTablas[t] ?? mockMakeChain()),
    storage: { from: jest.fn(() => mockStorage) },
  },
}))

import * as ObraHistorial from './obraHistorial.service.js'
import { supabase } from '../config/supabase.js'

const OBRA = {
  id: 'obra-1', nombre: 'Sector Hornos', estado: 'FINALIZADA',
  fecha_inicio: '2026-06-01', fecha_fin: '2026-06-30', horas_hombre: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  for (const k of Object.keys(mockTablas)) delete mockTablas[k]
  mockSetTabla('obras', { data: OBRA, error: null })
  mockSetTabla('remitos', { data: [], error: null })
  mockSetTabla('presupuestos', { data: [], error: null })
  mockSetTabla('remito_materiales', { data: [], error: null })
  mockSetTabla('remito_items', { data: [], error: null })
  mockSetTabla('presupuesto_insumos', { data: [], error: null })
  mockSetTabla('presupuesto_costos', { data: [], error: null })
  mockSetTabla('obra_planos', { data: [], error: null })
  mockSetTabla('obra_inconvenientes', { data: [], error: null })
  mockSetTabla('obra_costos_no_anticipados', { data: [], error: null })
  mockStorage.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.test/plano.jpg' }, error: null })
  mockStorage.upload.mockResolvedValue({ data: { path: 'obra-1/123.jpg' }, error: null })
})

describe('obraHistorial.service.getHistorial', () => {
  it('404 si la obra no existe', async () => {
    mockSetTabla('obras', { data: null, error: null })
    await expect(ObraHistorial.getHistorial('obra-x')).rejects.toThrow('Obra no encontrada')
  })

  it('agrega duración, insumos, mano de obra, planos, inconvenientes y costos', async () => {
    mockSetTabla('remitos', { data: [{ id: 'r-1', numero: 'FS-1', estado: 'CERRADO' }], error: null })
    mockSetTabla('presupuestos', { data: [{ id: 'p-1', numero: 'PR-1', estado: 'APROBADO' }], error: null })
    mockSetTabla('remito_materiales', {
      data: [{ material_id: 'm-1', descripcion_libre: null, cantidad_egreso: 5, unidad: 'metro', materiales: { nombre: 'Caño' } }],
      error: null,
    })
    mockSetTabla('presupuesto_insumos', {
      data: [{ material_id: 'm-1', cantidad: 5, materiales: { nombre: 'Caño', unidad: 'metro' } }],
      error: null,
    })
    mockSetTabla('presupuesto_costos', {
      data: [{ descripcion: 'Oficial x 3 días', cantidad: 3, costo_unitario: 1000, subtotal: 3000 }],
      error: null,
    })
    mockSetTabla('obra_planos', { data: [{ id: 'pl-1', storage_path: 'obra-1/123.jpg', created_at: '2026-06-10' }], error: null })
    mockSetTabla('obra_inconvenientes', { data: [{ id: 'i-1', descripcion: 'Lluvia', created_at: '2026-06-05' }], error: null })
    mockSetTabla('obra_costos_no_anticipados', { data: [{ id: 'c-1', descripcion: 'Alquiler grúa', monto: 5000, created_at: '2026-06-20' }], error: null })

    const out = await ObraHistorial.getHistorial('obra-1')

    expect(out.obra).toMatchObject({ nombre: 'Sector Hornos', duracionDias: 29 })
    expect(out.insumosUtilizados).toEqual([{ materialId: 'm-1', nombre: 'Caño', cantidad: 5, unidad: 'metro' }])
    expect(out.insumosPresupuestados).toEqual([{ materialId: 'm-1', nombre: 'Caño', cantidad: 5, unidad: 'metro' }])
    expect(out.manoObra).toEqual([{ descripcion: 'Oficial x 3 días', cantidad: 3, costoUnitario: 1000, subtotal: 3000 }])
    expect(out.planos).toEqual([{ id: 'pl-1', url: 'https://signed.test/plano.jpg', createdAt: '2026-06-10' }])
    expect(out.inconvenientes).toHaveLength(1)
    expect(out.costosNoAnticipados).toHaveLength(1)
  })

  it('herramienta con fecha_baja DENTRO del rango de la obra: rotaEnEstaObra true', async () => {
    mockSetTabla('remitos', { data: [{ id: 'r-1', numero: 'FS-1', estado: 'CERRADO' }], error: null })
    mockSetTabla('remito_items', {
      data: [{ herramienta_id: 'h-1', herramientas: { id: 'h-1', nombre: 'Taladro', estado: 'BAJA', fecha_baja: '2026-06-15', motivo_baja: 'Se rompió el motor' } }],
      error: null,
    })

    const out = await ObraHistorial.getHistorial('obra-1')
    expect(out.herramientas).toEqual([
      { herramientaId: 'h-1', nombre: 'Taladro', rotaEnEstaObra: true, motivoBaja: 'Se rompió el motor' },
    ])
  })

  it('herramienta con fecha_baja FUERA del rango: no se le atribuye la rotura a esta obra', async () => {
    mockSetTabla('remitos', { data: [{ id: 'r-1', numero: 'FS-1', estado: 'CERRADO' }], error: null })
    mockSetTabla('remito_items', {
      data: [{ herramienta_id: 'h-1', herramientas: { id: 'h-1', nombre: 'Taladro', estado: 'BAJA', fecha_baja: '2026-08-01', motivo_baja: 'Se rompió en otra obra' } }],
      error: null,
    })

    const out = await ObraHistorial.getHistorial('obra-1')
    expect(out.herramientas).toEqual([
      { herramientaId: 'h-1', nombre: 'Taladro', rotaEnEstaObra: false, motivoBaja: null },
    ])
  })

  it('obra sin remitos: lista de herramientas vacía, no consulta remito_items', async () => {
    const out = await ObraHistorial.getHistorial('obra-1')
    expect(out.herramientas).toEqual([])
    expect(supabase.from).not.toHaveBeenCalledWith('remito_items')
  })
})

describe('obraHistorial.service.registrarCierre', () => {
  it('actualiza horas_hombre cuando viene', async () => {
    await ObraHistorial.registrarCierre('obra-1', { horasHombre: 40 })
    expect(mockTablas.obras.update).toHaveBeenCalledWith({ horas_hombre: 40 })
  })

  it('rechaza horas_hombre negativas', async () => {
    await expect(ObraHistorial.registrarCierre('obra-1', { horasHombre: -5 }))
      .rejects.toThrow('horasHombre debe ser 0 o mayor')
  })

  it('inserta inconvenientes no vacíos, descarta strings en blanco', async () => {
    await ObraHistorial.registrarCierre('obra-1', { inconvenientes: ['Lluvia', '   ', 'Falta de material'] })
    expect(mockTablas.obra_inconvenientes.insert).toHaveBeenCalledWith([
      { obra_id: 'obra-1', descripcion: 'Lluvia' },
      { obra_id: 'obra-1', descripcion: 'Falta de material' },
    ])
  })

  it('inserta costos no anticipados válidos, descarta los incompletos', async () => {
    await ObraHistorial.registrarCierre('obra-1', {
      costosNoAnticipados: [
        { descripcion: 'Alquiler grúa', monto: 5000 },
        { descripcion: '', monto: 100 },        // sin descripción, se descarta
        { descripcion: 'Sin monto', monto: NaN }, // monto inválido, se descarta
      ],
    })
    expect(mockTablas.obra_costos_no_anticipados.insert).toHaveBeenCalledWith([
      { obra_id: 'obra-1', descripcion: 'Alquiler grúa', monto: 5000 },
    ])
  })

  it('sin ningún campo: no llama a ninguna tabla', async () => {
    await ObraHistorial.registrarCierre('obra-1', {})
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe('obraHistorial.service.agregarPlano', () => {
  it('rechaza mime no permitido', async () => {
    await expect(ObraHistorial.agregarPlano('obra-1', { buffer: Buffer.from('x'), mimeType: 'application/pdf' }))
      .rejects.toThrow('Tipo no permitido')
  })

  it('rechaza archivo mayor a 8 MB', async () => {
    const buffer = Buffer.alloc(9 * 1024 * 1024)
    await expect(ObraHistorial.agregarPlano('obra-1', { buffer, mimeType: 'image/png' }))
      .rejects.toThrow('supera 8 MB')
  })

  it('sube el archivo y crea la fila en obra_planos', async () => {
    mockSetTabla('obra_planos', { data: { id: 'pl-2', storage_path: 'obra-1/999.png' }, error: null })
    const buffer = Buffer.from('imagen-fake')

    await ObraHistorial.agregarPlano('obra-1', { buffer, mimeType: 'image/png' })

    expect(mockStorage.upload).toHaveBeenCalled()
    expect(mockTablas.obra_planos.insert).toHaveBeenCalledWith(
      expect.objectContaining({ obra_id: 'obra-1' })
    )
  })

  it('sin buffer: no hace nada (no sube, no inserta)', async () => {
    const out = await ObraHistorial.agregarPlano('obra-1', {})
    expect(out).toBeNull()
    expect(mockStorage.upload).not.toHaveBeenCalled()
  })
})
