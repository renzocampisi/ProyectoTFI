const mockChain = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq:     jest.fn().mockReturnThis(),
  ilike:  jest.fn().mockReturnThis(),
  order:  jest.fn().mockReturnThis(),
  single:      jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
}
mockChain.then = (resolve) => resolve({ data: [], error: null })

jest.mock('../config/supabase.js', () => ({
  supabase: { from: jest.fn(() => mockChain) },
}))

jest.mock('./remitos.service.js', () => ({
  addItem:     jest.fn().mockResolvedValue(undefined),
  addMaterial: jest.fn().mockResolvedValue(undefined),
}))

import * as KitsService from './kits.service.js'
import { supabase } from '../config/supabase.js'
import * as RemitosService from './remitos.service.js'

const kitCrudo = (overrides = {}) => ({
  id: 'kit-1', nombre: 'Kit soldadura', descripcion: 'Para soldar', activo: true, created_at: '2026-01-01',
  kit_herramientas: [{ herramienta: { id: 'h-1', nombre: 'Soldadora', codigo_qr: 'FS-SOL-1', estado: 'DISPONIBLE' } }],
  kit_materiales:   [{ cantidad: 3, material: { id: 'm-1', nombre: 'Electrodos', unidad: 'unidad', stock_actual: 10 } }],
  ...overrides,
})

beforeEach(() => {
  jest.resetAllMocks()
  mockChain.select.mockReturnThis()
  mockChain.insert.mockReturnThis()
  mockChain.update.mockReturnThis()
  mockChain.delete.mockReturnThis()
  mockChain.eq.mockReturnThis()
  mockChain.ilike.mockReturnThis()
  mockChain.order.mockReturnThis()
  mockChain.single.mockResolvedValue({ data: null, error: null })
  mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
  mockChain.then = (resolve) => resolve({ data: [], error: null })
  supabase.from.mockImplementation(() => mockChain)
  RemitosService.addItem.mockResolvedValue(undefined)
  RemitosService.addMaterial.mockResolvedValue(undefined)
})

describe('kits.service.getById', () => {
  it('aplana kit_herramientas/kit_materiales a herramientas/materiales', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: kitCrudo(), error: null })
    const data = await KitsService.getById('kit-1')
    expect(data.herramientas).toEqual([{ id: 'h-1', nombre: 'Soldadora', codigo_qr: 'FS-SOL-1', estado: 'DISPONIBLE' }])
    expect(data.materiales).toEqual([{ id: 'm-1', nombre: 'Electrodos', unidad: 'unidad', stock_actual: 10, cantidad: 3 }])
  })

  it('devuelve null si el kit no existe', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(KitsService.getById('inexistente')).resolves.toBeNull()
  })
})

describe('kits.service.getByHerramienta', () => {
  it('devuelve solo los kits activos que incluyen esa herramienta', async () => {
    mockChain.then = (resolve) => resolve({
      data: [
        kitCrudo(),
        kitCrudo({ id: 'kit-2', nombre: 'Kit pintura', kit_herramientas: [{ herramienta: { id: 'h-9', nombre: 'Compresor' } }] }),
      ],
      error: null,
    })

    const data = await KitsService.getByHerramienta('h-1')

    expect(supabase.from).toHaveBeenCalledWith('kits')
    expect(mockChain.eq).toHaveBeenCalledWith('activo', true)
    expect(data).toHaveLength(1)
    expect(data[0].id).toBe('kit-1')
  })

  it('devuelve array vacío si ningún kit incluye la herramienta', async () => {
    mockChain.then = (resolve) => resolve({ data: [kitCrudo()], error: null })
    const data = await KitsService.getByHerramienta('h-inexistente')
    expect(data).toEqual([])
  })

  it('propaga el error de Supabase', async () => {
    mockChain.then = (resolve) => resolve({ data: null, error: new Error('db down') })
    await expect(KitsService.getByHerramienta('h-1')).rejects.toThrow('db down')
  })
})

describe('kits.service.create', () => {
  it('rechaza sin nombre con status 400', async () => {
    await expect(
      KitsService.create({ herramientaIds: ['h-1'] })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('rechaza sin herramientas ni materiales con status 400', async () => {
    await expect(
      KitsService.create({ nombre: 'Kit vacío' })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('crea el kit y su composición, y devuelve el kit aplanado', async () => {
    mockChain.single.mockResolvedValue({ data: { id: 'kit-1' }, error: null })
    mockChain.maybeSingle.mockResolvedValue({ data: kitCrudo(), error: null })

    const data = await KitsService.create({
      nombre: 'Kit soldadura', herramientaIds: ['h-1'], materiales: [{ materialId: 'm-1', cantidad: 3 }],
    })

    expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Kit soldadura' }))
    expect(data.id).toBe('kit-1')
  })
})

describe('kits.service.update', () => {
  it('rechaza con 404 si el kit no existe', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(
      KitsService.update('inexistente', { nombre: 'X' })
    ).rejects.toMatchObject({ status: 404 })
  })

  it('actualiza nombre/descripción sin tocar la composición si no vienen', async () => {
    mockChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'kit-1' }, error: null }) // chequeo de existencia
      .mockResolvedValueOnce({ data: kitCrudo(), error: null })       // getById final
    mockChain.then = (resolve) => resolve({ error: null })

    await KitsService.update('kit-1', { nombre: 'Nuevo nombre' })

    expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Nuevo nombre' }))
    // delete solo se llama al reemplazar composición — sin herramientaIds/materiales no debería tocarla
    expect(mockChain.delete).not.toHaveBeenCalled()
  })
})

describe('kits.service.remove', () => {
  it('hace soft delete (activo=false)', async () => {
    mockChain.then = (resolve) => resolve({ error: null })
    await KitsService.remove('kit-1')
    expect(mockChain.update).toHaveBeenCalledWith({ activo: false })
  })
})

describe('kits.service.agregarARemito', () => {
  it('rechaza con 404 si el remito no existe', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(
      KitsService.agregarARemito('remito-1', 'kit-1')
    ).rejects.toMatchObject({ status: 404 })
  })

  it('rechaza si el remito no está en BORRADOR', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: { estado: 'CONFIRMADO' }, error: null })
    await expect(
      KitsService.agregarARemito('remito-1', 'kit-1')
    ).rejects.toMatchObject({ status: 400 })
  })

  it('rechaza con 409 si alguna herramienta del kit no está disponible', async () => {
    mockChain.maybeSingle
      .mockResolvedValueOnce({ data: { estado: 'BORRADOR' }, error: null })
      .mockResolvedValueOnce({ data: kitCrudo({ kit_herramientas: [{ herramienta: { id: 'h-1', nombre: 'Soldadora', estado: 'EN_OBRA' } }] }), error: null })

    await expect(
      KitsService.agregarARemito('remito-1', 'kit-1')
    ).rejects.toMatchObject({ status: 409 })
    expect(RemitosService.addItem).not.toHaveBeenCalled()
  })

  it('rechaza con 409 si falta stock de algún material', async () => {
    mockChain.maybeSingle
      .mockResolvedValueOnce({ data: { estado: 'BORRADOR' }, error: null })
      .mockResolvedValueOnce({
        data: kitCrudo({
          kit_herramientas: [],
          kit_materiales: [{ cantidad: 50, material: { id: 'm-1', nombre: 'Electrodos', unidad: 'unidad', stock_actual: 5 } }],
        }),
        error: null,
      })

    await expect(
      KitsService.agregarARemito('remito-1', 'kit-1')
    ).rejects.toMatchObject({ status: 409 })
  })

  it('agrega cada herramienta y material del kit al remito', async () => {
    mockChain.maybeSingle
      .mockResolvedValueOnce({ data: { estado: 'BORRADOR' }, error: null })
      .mockResolvedValueOnce({ data: kitCrudo(), error: null })

    const resultado = await KitsService.agregarARemito('remito-1', 'kit-1')

    expect(RemitosService.addItem).toHaveBeenCalledWith('remito-1', { herramientaId: 'h-1' })
    expect(RemitosService.addMaterial).toHaveBeenCalledWith('remito-1', { materialId: 'm-1', cantidad: 3, unidad: 'unidad' })
    expect(resultado).toEqual({ kit: 'Kit soldadura', herramientasAgregadas: 1, materialesAgregados: 1 })
  })
})
