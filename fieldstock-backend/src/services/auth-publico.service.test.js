const mockChain = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  eq:     jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
}
mockChain.then = (resolve) => resolve({ count: 0, error: null })

const mockAuthAdmin = {
  createUser: jest.fn().mockResolvedValue({ data: { user: { id: 'auth-1' } }, error: null }),
  deleteUser: jest.fn().mockResolvedValue({ data: null, error: null }),
}

jest.mock('../config/supabase.js', () => ({
  supabase: {
    from: jest.fn(() => mockChain),
    // Getter en vez de valor directo: jest.mock hoistea el require de este
    // módulo por encima de las const de arriba, así que una referencia
    // directa a mockAuthAdmin acá dispararía un TDZ error. El getter difiere
    // la evaluación hasta el primer `supabase.auth.admin...` real del test.
    get auth() { return { admin: mockAuthAdmin } },
  },
}))

jest.mock('./invitaciones.service.js', () => ({
  getVigentePorCodigo: jest.fn(),
  marcarUsada:         jest.fn().mockResolvedValue(undefined),
}))

jest.mock('./empresa.service.js', () => ({
  set: jest.fn().mockResolvedValue({ nombre: 'ACME' }),
}))

import * as AuthPublicoService from './auth-publico.service.js'
import { supabase } from '../config/supabase.js'
import * as InvitacionesService from './invitaciones.service.js'
import * as EmpresaService from './empresa.service.js'

const credencialesValidas = { email: 'nuevo@empresa.com', password: 'password123', nombre: 'Juan Pérez' }

beforeEach(() => {
  jest.resetAllMocks()
  mockChain.select.mockReturnThis()
  mockChain.insert.mockReturnThis()
  mockChain.eq.mockReturnThis()
  mockChain.single.mockResolvedValue({
    data: { id: 'auth-1', nombre: 'Juan Pérez', role: 'DUEÑO', activo: true },
    error: null,
  })
  mockChain.then = (resolve) => resolve({ count: 0, error: null })
  supabase.from.mockImplementation(() => mockChain)
  mockAuthAdmin.createUser.mockResolvedValue({ data: { user: { id: 'auth-1' } }, error: null })
  mockAuthAdmin.deleteUser.mockResolvedValue({ data: null, error: null })
  EmpresaService.set.mockResolvedValue({ nombre: 'ACME' })
})

describe('auth-publico.service.hayUsuarios', () => {
  it('devuelve false cuando la tabla usuarios está vacía', async () => {
    mockChain.then = (resolve) => resolve({ count: 0, error: null })
    await expect(AuthPublicoService.hayUsuarios()).resolves.toBe(false)
  })

  it('devuelve true cuando ya hay al menos un usuario', async () => {
    mockChain.then = (resolve) => resolve({ count: 3, error: null })
    await expect(AuthPublicoService.hayUsuarios()).resolves.toBe(true)
  })
})

describe('auth-publico.service.registrarDueño', () => {
  const empresa = { nombre: 'Construcciones ACME' }

  it('rechaza si falta el nombre de la empresa', async () => {
    await expect(
      AuthPublicoService.registrarDueño({ ...credencialesValidas, empresa: {} })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('rechaza password menor a 8 caracteres', async () => {
    await expect(
      AuthPublicoService.registrarDueño({ ...credencialesValidas, password: 'corta', empresa })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('rechaza con 409 si ya existe al menos un usuario (bootstrap cerrado)', async () => {
    mockChain.then = (resolve) => resolve({ count: 1, error: null })
    await expect(
      AuthPublicoService.registrarDueño({ ...credencialesValidas, empresa })
    ).rejects.toMatchObject({ status: 409 })
    expect(mockAuthAdmin.createUser).not.toHaveBeenCalled()
  })

  it('crea el auth.user, el perfil con role DUEÑO y guarda la empresa', async () => {
    const data = await AuthPublicoService.registrarDueño({ ...credencialesValidas, empresa })

    expect(mockAuthAdmin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'nuevo@empresa.com', password: 'password123', email_confirm: true })
    )
    const insertArg = mockChain.insert.mock.calls[0][0]
    expect(insertArg.role).toBe('DUEÑO')
    expect(EmpresaService.set).toHaveBeenCalledWith(empresa, 'auth-1')
    expect(data.usuario.role).toBe('DUEÑO')
  })

  it('hace rollback del auth.user si falla el INSERT del perfil', async () => {
    mockChain.single.mockResolvedValue({ data: null, error: new Error('insert falló') })
    await expect(
      AuthPublicoService.registrarDueño({ ...credencialesValidas, empresa })
    ).rejects.toMatchObject({ status: 500 })
    expect(mockAuthAdmin.deleteUser).toHaveBeenCalledWith('auth-1')
  })
})

describe('auth-publico.service.registrarConInvitacion', () => {
  it('rechaza si falta el código', async () => {
    await expect(
      AuthPublicoService.registrarConInvitacion({ ...credencialesValidas, codigo: '' })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('rechaza con 404 si el código no existe o ya fue usado', async () => {
    InvitacionesService.getVigentePorCodigo.mockResolvedValue(null)
    await expect(
      AuthPublicoService.registrarConInvitacion({ ...credencialesValidas, codigo: 'FS-INV-XXXXXX' })
    ).rejects.toMatchObject({ status: 404 })
    expect(mockAuthAdmin.createUser).not.toHaveBeenCalled()
  })

  it('crea el usuario con el role de la invitación y la marca usada', async () => {
    InvitacionesService.getVigentePorCodigo.mockResolvedValue({ id: 'inv-1', role: 'ENCARGADO' })
    mockChain.single.mockResolvedValue({
      data: { id: 'auth-1', nombre: 'Juan Pérez', role: 'ENCARGADO', activo: true },
      error: null,
    })

    const data = await AuthPublicoService.registrarConInvitacion({ ...credencialesValidas, codigo: 'FS-INV-ABC123' })

    const insertArg = mockChain.insert.mock.calls[0][0]
    expect(insertArg.role).toBe('ENCARGADO')
    expect(InvitacionesService.marcarUsada).toHaveBeenCalledWith('inv-1', 'auth-1')
    expect(data.usuario.role).toBe('ENCARGADO')
  })

  it('hace rollback del auth.user si falla el INSERT del perfil', async () => {
    InvitacionesService.getVigentePorCodigo.mockResolvedValue({ id: 'inv-1', role: 'OPERARIO' })
    mockChain.single.mockResolvedValue({ data: null, error: new Error('insert falló') })

    await expect(
      AuthPublicoService.registrarConInvitacion({ ...credencialesValidas, codigo: 'FS-INV-ABC123' })
    ).rejects.toMatchObject({ status: 500 })
    expect(mockAuthAdmin.deleteUser).toHaveBeenCalledWith('auth-1')
    expect(InvitacionesService.marcarUsada).not.toHaveBeenCalled()
  })
})
