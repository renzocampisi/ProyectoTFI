const mockChain = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq:     jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
}
mockChain.then = (resolve) => resolve({ count: 0, error: null })

const mockAuthAdmin = {
  createUser: jest.fn(),
  deleteUser: jest.fn().mockResolvedValue({}),
}

jest.mock('../config/supabase.js', () => ({
  supabase: {
    from: jest.fn(() => mockChain),
    auth: { admin: {
      createUser: (...args) => mockAuthAdmin.createUser(...args),
      deleteUser: (...args) => mockAuthAdmin.deleteUser(...args),
    } },
  },
}))

jest.mock('./suscripcion.service.js', () => ({ getActual: jest.fn() }))

import * as UsuariosService from './usuarios.service.js'
import { supabase } from '../config/supabase.js'
import * as SuscripcionService from './suscripcion.service.js'

beforeEach(() => {
  jest.clearAllMocks()
  mockChain.select.mockReturnThis()
  mockChain.insert.mockReturnThis()
  mockChain.update.mockReturnThis()
  mockChain.eq.mockReturnThis()
  mockChain.single.mockResolvedValue({ data: { id: 'u-2', nombre: 'Nuevo', role: 'OPERARIO' }, error: null })
  mockChain.then = (resolve) => resolve({ count: 0, error: null })
  supabase.from.mockImplementation(() => mockChain)
  mockAuthAdmin.createUser.mockResolvedValue({ data: { user: { id: 'u-2' } }, error: null })
})

describe('usuarios.service.create — cupo de empleados', () => {
  const nuevo = { email: 'nuevo@empresa.com', nombre: 'Nuevo', role: 'OPERARIO' }

  it('permite crear si el plan no tiene límite (max_usuarios null)', async () => {
    SuscripcionService.getActual.mockResolvedValue({ plan: { max_usuarios: null }, empleados_extra: 0 })
    await expect(UsuariosService.create(nuevo)).resolves.toBeDefined()
    expect(mockAuthAdmin.createUser).toHaveBeenCalled()
  })

  it('permite crear si todavía no hay plan (PRUEBA)', async () => {
    SuscripcionService.getActual.mockResolvedValue({ plan: null, empleados_extra: 0 })
    await expect(UsuariosService.create(nuevo)).resolves.toBeDefined()
  })

  it('rechaza con 403 si ya se llegó al cupo del plan (sin extras)', async () => {
    SuscripcionService.getActual.mockResolvedValue({ plan: { max_usuarios: 3 }, empleados_extra: 0 })
    mockChain.then = (resolve) => resolve({ count: 3, error: null })
    await expect(UsuariosService.create(nuevo)).rejects.toMatchObject({ status: 403 })
    expect(mockAuthAdmin.createUser).not.toHaveBeenCalled()
  })

  it('permite crear por arriba del límite del plan si hay empleados_extra que lo cubren', async () => {
    SuscripcionService.getActual.mockResolvedValue({ plan: { max_usuarios: 3 }, empleados_extra: 2 })
    mockChain.then = (resolve) => resolve({ count: 4, error: null }) // 4 activos, cupo = 3 + 2 = 5
    await expect(UsuariosService.create(nuevo)).resolves.toBeDefined()
  })

  it('rechaza con 403 aunque haya extras si ya se llegó al cupo ampliado', async () => {
    SuscripcionService.getActual.mockResolvedValue({ plan: { max_usuarios: 3 }, empleados_extra: 2 })
    mockChain.then = (resolve) => resolve({ count: 5, error: null }) // cupo = 5, ya hay 5
    await expect(UsuariosService.create(nuevo)).rejects.toMatchObject({ status: 403 })
  })
})

describe('usuarios.service.create — dni y direccion (feature Empleados)', () => {
  it('incluye dni y direccion en el INSERT cuando vienen en el payload', async () => {
    SuscripcionService.getActual.mockResolvedValue({ plan: { max_usuarios: null }, empleados_extra: 0 })

    await UsuariosService.create({
      email: 'nuevo@empresa.com', nombre: 'Nuevo', role: 'OPERARIO',
      dni: '30123456', direccion: 'Av. Siempreviva 742',
    })

    expect(mockChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ dni: '30123456', direccion: 'Av. Siempreviva 742' })
    )
  })

  it('inserta null si dni/direccion no vienen', async () => {
    SuscripcionService.getActual.mockResolvedValue({ plan: { max_usuarios: null }, empleados_extra: 0 })

    await UsuariosService.create({ email: 'nuevo@empresa.com', nombre: 'Nuevo', role: 'OPERARIO' })

    expect(mockChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ dni: null, direccion: null })
    )
  })
})

describe('usuarios.service.update — dni y direccion', () => {
  it('actualiza dni y direccion cuando vienen en el body', async () => {
    mockChain.single.mockResolvedValueOnce({ data: { id: 'u-1', dni: '30123456' }, error: null })

    await UsuariosService.update('u-1', { dni: '30123456', direccion: 'Calle Falsa 123' })

    expect(mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ dni: '30123456', direccion: 'Calle Falsa 123' })
    )
  })

  it('no toca dni/direccion si no vienen en el body', async () => {
    mockChain.single.mockResolvedValueOnce({ data: { id: 'u-1' }, error: null })

    await UsuariosService.update('u-1', { nombre: 'Otro nombre' })

    const campos = mockChain.update.mock.calls[0][0]
    expect(campos).not.toHaveProperty('dni')
    expect(campos).not.toHaveProperty('direccion')
  })
})
