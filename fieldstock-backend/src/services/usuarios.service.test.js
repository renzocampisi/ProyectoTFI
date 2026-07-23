const mockChain = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
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
