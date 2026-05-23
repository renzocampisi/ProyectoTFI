// ── Mock de Supabase (mockChainable) ──────────────────────────────
const mockChain = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq:     jest.fn().mockReturnThis(),
  ilike:  jest.fn().mockReturnThis(),
  order:  jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
}
// `mockChain` también es awaitable (resuelve a data/error) para queries que no terminan con .single()
mockChain.then = (resolve) => resolve({ data: [], error: null })

jest.mock('../config/supabase.js', () => ({
  supabase: {
    from: jest.fn(() => mockChain),
    rpc:  jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}))

// Importar DESPUÉS de los mocks
import * as HerramientasService from './herramientas.service.js'
import { supabase } from '../config/supabase.js'

beforeEach(() => {
  jest.clearAllMocks()
  // Reset del mockChain — clearAllMocks limpia las llamadas pero también borra los mockReturnThis
  mockChain.select.mockReturnThis()
  mockChain.insert.mockReturnThis()
  mockChain.update.mockReturnThis()
  mockChain.delete.mockReturnThis()
  mockChain.eq.mockReturnThis()
  mockChain.ilike.mockReturnThis()
  mockChain.order.mockReturnThis()
  mockChain.single.mockResolvedValue({ data: null, error: null })
  mockChain.then = (resolve) => resolve({ data: [], error: null })
})

describe('herramientas.service', () => {
  describe('getAll', () => {
    it('lee desde la vista "herramientas_completas" ordenada por created_at desc', async () => {
      await HerramientasService.getAll()
      expect(supabase.from).toHaveBeenCalledWith('herramientas_completas')
      expect(mockChain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    })

    it('aplica filtro por estado cuando se pasa', async () => {
      await HerramientasService.getAll({ estado: 'DISPONIBLE' })
      expect(mockChain.eq).toHaveBeenCalledWith('estado', 'DISPONIBLE')
    })

    it('aplica filtro por categoriaId cuando se pasa', async () => {
      await HerramientasService.getAll({ categoriaId: 'cat-1' })
      expect(mockChain.eq).toHaveBeenCalledWith('categoria_id', 'cat-1')
    })

    it('usa ilike para búsqueda por nombre (q) con wildcards', async () => {
      await HerramientasService.getAll({ q: 'taladro' })
      expect(mockChain.ilike).toHaveBeenCalledWith('nombre', '%taladro%')
    })

    it('usa ilike para búsqueda por codigoQR con wildcards', async () => {
      await HerramientasService.getAll({ codigoQR: 'FS-TAL' })
      expect(mockChain.ilike).toHaveBeenCalledWith('codigo_qr', '%FS-TAL%')
    })

    it('propaga el error si Supabase devuelve error', async () => {
      mockChain.then = (resolve) => resolve({ data: null, error: new Error('DB down') })
      await expect(HerramientasService.getAll()).rejects.toThrow('DB down')
    })
  })

  describe('getById', () => {
    it('busca por id en herramientas_completas y devuelve un único registro', async () => {
      mockChain.single.mockResolvedValue({ data: { id: 'h-1', nombre: 'Taladro' }, error: null })
      const result = await HerramientasService.getById('h-1')
      expect(supabase.from).toHaveBeenCalledWith('herramientas_completas')
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'h-1')
      expect(result).toEqual({ id: 'h-1', nombre: 'Taladro' })
    })

    it('lanza si el id no existe', async () => {
      mockChain.single.mockResolvedValue({ data: null, error: new Error('not found') })
      await expect(HerramientasService.getById('inexistente')).rejects.toThrow('not found')
    })
  })

  describe('create', () => {
    it('genera código QR con formato FS-{INICIALES}-{TIMESTAMP_BASE36}', async () => {
      mockChain.single.mockResolvedValue({ data: { id: 'h-new' }, error: null })
      await HerramientasService.create({ nombre: 'Taladro Bosch Profesional', categoriaId: 'cat-1' })

      const insertArg = mockChain.insert.mock.calls[0][0]
      expect(insertArg.codigo_qr).toMatch(/^FS-TBP-[0-9A-Z]+$/)
    })

    it('usa "XX" como iniciales cuando no se puede extraer del nombre', async () => {
      mockChain.single.mockResolvedValue({ data: { id: 'h-new' }, error: null })
      await HerramientasService.create({ nombre: '', categoriaId: 'cat-1' })

      const insertArg = mockChain.insert.mock.calls[0][0]
      expect(insertArg.codigo_qr).toMatch(/^FS-XX-[0-9A-Z]+$/)
    })

    it('usa máximo 3 iniciales aunque el nombre tenga más palabras', async () => {
      mockChain.single.mockResolvedValue({ data: { id: 'h-new' }, error: null })
      await HerramientasService.create({ nombre: 'Una Dos Tres Cuatro Cinco', categoriaId: 'c' })

      const insertArg = mockChain.insert.mock.calls[0][0]
      expect(insertArg.codigo_qr).toMatch(/^FS-UDT-[0-9A-Z]+$/)
    })

    it('aplica defaults: estado=DISPONIBLE y divisa=ARS', async () => {
      mockChain.single.mockResolvedValue({ data: { id: 'h-new' }, error: null })
      await HerramientasService.create({ nombre: 'Martillo', categoriaId: 'c' })

      const insertArg = mockChain.insert.mock.calls[0][0]
      expect(insertArg.estado).toBe('DISPONIBLE')
      expect(insertArg.divisa).toBe('ARS')
    })

    it('respeta el estadoInicial cuando se pasa', async () => {
      mockChain.single.mockResolvedValue({ data: { id: 'h-new' }, error: null })
      await HerramientasService.create({ nombre: 'Sierra', categoriaId: 'c', estadoInicial: 'EN_OBRA' })

      const insertArg = mockChain.insert.mock.calls[0][0]
      expect(insertArg.estado).toBe('EN_OBRA')
    })

    it('mapea camelCase del body a snake_case de la columna (numeroSerie → numero_serie, anioCompra → anio_compra)', async () => {
      mockChain.single.mockResolvedValue({ data: { id: 'h-new' }, error: null })
      await HerramientasService.create({
        nombre:      'Taladro',
        categoriaId: 'c',
        numeroSerie: 'SN-123',
        anioCompra:  2024,
      })

      const insertArg = mockChain.insert.mock.calls[0][0]
      expect(insertArg.numero_serie).toBe('SN-123')
      expect(insertArg.anio_compra).toBe(2024)
    })
  })

  describe('update', () => {
    it('solo incluye los campos que vienen definidos en el body', async () => {
      mockChain.single.mockResolvedValue({ data: { id: 'h-1' }, error: null })
      await HerramientasService.update('h-1', { nombre: 'Nuevo nombre' })

      const updateArg = mockChain.update.mock.calls[0][0]
      expect(updateArg).toEqual({ nombre: 'Nuevo nombre' })
      expect(updateArg).not.toHaveProperty('marca')
    })

    it('convierte strings vacíos a null en campos opcionales', async () => {
      mockChain.single.mockResolvedValue({ data: { id: 'h-1' }, error: null })
      await HerramientasService.update('h-1', { marca: '', modelo: '' })

      const updateArg = mockChain.update.mock.calls[0][0]
      expect(updateArg.marca).toBeNull()
      expect(updateArg.modelo).toBeNull()
    })
  })

  describe('updateEstado', () => {
    const ESTADOS_VALIDOS = ['DISPONIBLE', 'EN_OBRA', 'EN_MANTENIMIENTO', 'RESERVADA', 'BAJA']

    it.each(ESTADOS_VALIDOS)('acepta el estado válido del dominio: %s', async (estado) => {
      mockChain.single.mockResolvedValue({ data: { id: 'h-1', estado }, error: null })
      await expect(HerramientasService.updateEstado('h-1', estado)).resolves.toBeDefined()
      expect(mockChain.update).toHaveBeenCalledWith({ estado })
    })

    it('rechaza estados inválidos con error status 400', async () => {
      await expect(
        HerramientasService.updateEstado('h-1', 'ESTADO_INEXISTENTE')
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('ESTADO_INEXISTENTE') })
    })

    it('rechaza estados con casing incorrecto (es case-sensitive)', async () => {
      await expect(
        HerramientasService.updateEstado('h-1', 'disponible')
      ).rejects.toMatchObject({ status: 400 })
    })
  })

  describe('darDeBaja', () => {
    it('llama a la RPC dar_baja_herramienta con id y motivo', async () => {
      supabase.rpc.mockResolvedValue({ data: { ok: true }, error: null })
      await HerramientasService.darDeBaja('h-1', 'rotura irreparable')
      expect(supabase.rpc).toHaveBeenCalledWith('dar_baja_herramienta', {
        p_id:     'h-1',
        p_motivo: 'rotura irreparable',
      })
    })

    it('pasa null cuando no se provee motivo', async () => {
      supabase.rpc.mockResolvedValue({ data: { ok: true }, error: null })
      await HerramientasService.darDeBaja('h-1')
      expect(supabase.rpc).toHaveBeenCalledWith('dar_baja_herramienta', {
        p_id:     'h-1',
        p_motivo: null,
      })
    })

    it('propaga el error de la RPC', async () => {
      supabase.rpc.mockResolvedValue({ data: null, error: new Error('herramienta ya dada de baja') })
      await expect(HerramientasService.darDeBaja('h-1')).rejects.toThrow('herramienta ya dada de baja')
    })
  })

  describe('reactivar', () => {
    it('llama a la RPC reactivar_herramienta con el id', async () => {
      supabase.rpc.mockResolvedValue({ data: { ok: true }, error: null })
      await HerramientasService.reactivar('h-1')
      expect(supabase.rpc).toHaveBeenCalledWith('reactivar_herramienta', { p_id: 'h-1' })
    })
  })
})
