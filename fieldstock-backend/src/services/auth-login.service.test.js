// Tests del login con segundo factor por mail (ver _plans/login-2fl/).
// Se mockean los dos clientes Supabase: el de auth (anon, sin persistir)
// y el service-role (solo se usa para leer el perfil).

const mockAuth = {
  signInWithPassword: jest.fn(),
  signInWithOtp:      jest.fn(),
}

const mockPerfilChain = {
  select:      jest.fn().mockReturnThis(),
  eq:          jest.fn().mockReturnThis(),
  maybeSingle: jest.fn(),
}

jest.mock('../config/supabaseAuth.js', () => ({
  // getter para diferir la evaluación de mockAuth (jest hoistea el mock
  // por encima de las const de arriba), mismo truco que auth-publico.test.
  get supabaseAuth() { return { auth: mockAuth } },
}))

jest.mock('../config/supabase.js', () => ({
  supabase: { from: jest.fn(() => mockPerfilChain) },
}))

import * as AuthLoginService from './auth-login.service.js'

// El rate limit es un Map a nivel de módulo que persiste entre tests del
// archivo — por eso cada test usa un email distinto (y el de rate limit
// el suyo propio).
function sesionOk(id = 'u-1') {
  return {
    data: { user: { id }, session: { access_token: 'at-123', refresh_token: 'rt-123' } },
    error: null,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockPerfilChain.select.mockReturnThis()
  mockPerfilChain.eq.mockReturnThis()
  mockAuth.signInWithPassword.mockResolvedValue(sesionOk())
  mockAuth.signInWithOtp.mockResolvedValue({ data: {}, error: null })
  mockPerfilChain.maybeSingle.mockResolvedValue({
    data: { id: 'u-1', role: 'ENCARGADO', activo: true },
    error: null,
  })
})

describe('AuthLoginService.login', () => {
  test('contraseña inválida → 422 y NO se manda código', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } })

    await expect(
      AuthLoginService.login({ email: 'a@t.com', password: 'mala', ip: '1.0.0.1' })
    ).rejects.toMatchObject({ status: 422 })

    expect(mockAuth.signInWithOtp).not.toHaveBeenCalled()
  })

  test('contraseña OK + rol ADMIN → devuelve { session }, sin código', async () => {
    mockPerfilChain.maybeSingle.mockResolvedValue({
      data: { id: 'u-1', role: 'ADMIN', activo: true }, error: null,
    })

    const r = await AuthLoginService.login({ email: 'admin@t.com', password: 'ok', ip: '1.0.0.2' })

    expect(r).toEqual({ session: { access_token: 'at-123', refresh_token: 'rt-123' } })
    expect(mockAuth.signInWithOtp).not.toHaveBeenCalled()
  })

  test('contraseña OK + rol no-ADMIN → manda código y devuelve { requiereCodigo }', async () => {
    const r = await AuthLoginService.login({ email: 'enc@t.com', password: 'ok', ip: '1.0.0.3' })

    expect(r).toEqual({ requiereCodigo: true, email: 'enc@t.com' })
    expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({
      email: 'enc@t.com',
      options: { shouldCreateUser: false },
    })
    expect(r.session).toBeUndefined()
  })

  test('cuenta con activo:false → 422', async () => {
    mockPerfilChain.maybeSingle.mockResolvedValue({
      data: { id: 'u-1', role: 'ENCARGADO', activo: false }, error: null,
    })

    await expect(
      AuthLoginService.login({ email: 'inact@t.com', password: 'ok', ip: '1.0.0.4' })
    ).rejects.toMatchObject({ status: 422 })
    expect(mockAuth.signInWithOtp).not.toHaveBeenCalled()
  })

  test('auth.users sin perfil en usuarios → 422', async () => {
    mockPerfilChain.maybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(
      AuthLoginService.login({ email: 'sinperfil@t.com', password: 'ok', ip: '1.0.0.5' })
    ).rejects.toMatchObject({ status: 422 })
  })

  test('el 6º intento seguido para el mismo mail+IP → 429', async () => {
    const args = { email: 'rl@t.com', password: 'ok', ip: '9.9.9.9' }
    for (let i = 0; i < 5; i++) await AuthLoginService.login(args)

    await expect(AuthLoginService.login(args)).rejects.toMatchObject({ status: 429 })
  })

  test('si falla el envío del código → 502 con mensaje reintentable', async () => {
    mockAuth.signInWithOtp.mockResolvedValue({ data: {}, error: { message: 'smtp down' } })

    await expect(
      AuthLoginService.login({ email: 'otpfail@t.com', password: 'ok', ip: '1.0.0.6' })
    ).rejects.toMatchObject({ status: 502, message: expect.stringContaining('código') })
  })
})
