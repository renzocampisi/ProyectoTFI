// provider.js no tenía tests — se agrega uno acotado al comportamiento
// nuevo: el retry con backoff ante errores transitorios de Gemini (503 /
// 429 / red), más la normalización de la respuesta y el mapeo de errores
// no reintentables. El SDK @google/genai se mockea entero.

const mockGenerateContent = jest.fn()
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn(() => ({ models: { generateContent: mockGenerateContent } })),
}))

import * as Provider from './provider.js'

beforeAll(() => {
  process.env.GEMINI_API_KEY = 'test-key'
})

beforeEach(() => {
  jest.clearAllMocks()
})

afterEach(() => {
  jest.useRealTimers()
})

// Respuesta cruda del SDK con una parte de texto y una function call.
function respuestaSDK({ text = 'hola', fnCalls = [] } = {}) {
  const parts = []
  if (text) parts.push({ text })
  for (const fc of fnCalls) parts.push({ functionCall: fc })
  return { candidates: [{ content: { parts } }] }
}

describe('provider.chat — normalización', () => {
  test('devuelve { text, functionCalls } al primer intento exitoso', async () => {
    mockGenerateContent.mockResolvedValueOnce(respuestaSDK({
      text: 'Respuesta',
      fnCalls: [{ name: 'listar_obras', args: { estado: 'ACTIVA' } }],
    }))

    const out = await Provider.chat({ system: 's', contents: [] })

    expect(out).toEqual({
      text: 'Respuesta',
      functionCalls: [{ id: undefined, name: 'listar_obras', args: { estado: 'ACTIVA' } }],
    })
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
  })

  test('text es null cuando el modelo solo pidió tools', async () => {
    mockGenerateContent.mockResolvedValueOnce(respuestaSDK({
      text: '',
      fnCalls: [{ name: 'x', args: {} }],
    }))

    const out = await Provider.chat({ system: 's', contents: [] })
    expect(out.text).toBeNull()
    expect(out.functionCalls).toHaveLength(1)
  })
})

describe('provider.chat — retry ante errores transitorios', () => {
  test('reintenta un 503 y devuelve el resultado del segundo intento', async () => {
    jest.useFakeTimers()
    const err503 = Object.assign(new Error('The model is overloaded'), { status: 503 })
    mockGenerateContent
      .mockRejectedValueOnce(err503)
      .mockResolvedValueOnce(respuestaSDK({ text: 'ok al fin' }))

    const p = Provider.chat({ system: 's', contents: [] })
    await jest.runAllTimersAsync()
    const out = await p

    expect(out.text).toBe('ok al fin')
    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
  })

  test('reintenta errores de red sin status numérico', async () => {
    jest.useFakeTimers()
    mockGenerateContent
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce(respuestaSDK({ text: 'recuperado' }))

    const p = Provider.chat({ system: 's', contents: [] })
    await jest.runAllTimersAsync()
    const out = await p

    expect(out.text).toBe('recuperado')
    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
  })

  test('agota los 4 intentos y tira el error mapeado si el 503 no cede', async () => {
    jest.useFakeTimers()
    const err503 = Object.assign(new Error('high demand'), { status: 503 })
    mockGenerateContent.mockRejectedValue(err503)

    const p = Provider.chat({ system: 's', contents: [] })
    const assertion = expect(p).rejects.toMatchObject({ status: 503 })
    await jest.runAllTimersAsync()
    await assertion

    expect(mockGenerateContent).toHaveBeenCalledTimes(4)
  })
})

describe('provider.chat — errores no reintentables', () => {
  test('un 400 (payload) se tira de una, sin reintentos', async () => {
    const err400 = Object.assign(new Error('invalid argument'), { status: 400 })
    mockGenerateContent.mockRejectedValueOnce(err400)

    await expect(Provider.chat({ system: 's', contents: [] })).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('Gemini API:'),
    })
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
  })

  test('un 401 (key inválida) se mapea a status 503 y no reintenta', async () => {
    const err401 = Object.assign(new Error('API key not valid'), { status: 401 })
    mockGenerateContent.mockRejectedValueOnce(err401)

    await expect(Provider.chat({ system: 's', contents: [] })).rejects.toMatchObject({ status: 503 })
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
  })
})
