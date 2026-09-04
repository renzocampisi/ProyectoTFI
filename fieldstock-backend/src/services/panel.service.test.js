// panel.service.js no tenía tests — se agrega uno acotado solo para la
// extracción de imágenes (planos del historial de obra), que es lógica
// nueva y fácil de romper en silencio: si el redactado falla, el LLM
// terminaría repitiendo una URL firmada larguísima como texto.
jest.mock('./panel/provider.js', () => ({ chat: jest.fn() }))
jest.mock('./panel/tools.js', () => ({
  getDeclarations: jest.fn(() => []),
  runTool: jest.fn(),
}))
jest.mock('./panel/writeTools.js', () => ({
  getWriteDeclarations: jest.fn(() => []),
  findWriteTool: jest.fn(() => null),
  previewWriteTool: jest.fn(),
  executeWriteTool: jest.fn(),
}))

import * as PanelService from './panel.service.js'
import * as Provider from './panel/provider.js'
import { runTool, getDeclarations } from './panel/tools.js'
import { getWriteDeclarations, findWriteTool } from './panel/writeTools.js'

beforeEach(() => {
  // resetAllMocks (no clearAllMocks) vacía también el mockResolvedValueOnce
  // que no se haya consumido — pero de paso borra las implementaciones por
  // default seteadas en la factory de jest.mock(), así que hay que
  // re-establecerlas acá (mismo criterio que ya usa armado.service.test.js).
  jest.resetAllMocks()
  getDeclarations.mockReturnValue([])
  getWriteDeclarations.mockReturnValue([])
  findWriteTool.mockReturnValue(null)
})

describe('panel.service.responder — imágenes de planos', () => {
  it('separa las URLs de planos hacia `imagenes` y las saca del texto que ve el modelo', async () => {
    // Turno 1: el modelo pide historial_obra.
    Provider.chat.mockResolvedValueOnce({
      text: null,
      functionCalls: [{ name: 'historial_obra', args: { obraId: 'obra-1' } }],
    })
    runTool.mockResolvedValueOnce({
      obra: { nombre: 'Sector Hornos' },
      planos: [{ id: 'pl-1', url: 'https://signed.test/foto.png', createdAt: '2026-06-10' }],
    })
    // Turno 2: el modelo ya tiene el resultado y responde en texto.
    Provider.chat.mockResolvedValueOnce({
      text: 'La obra tiene 1 foto de plano.',
      functionCalls: [],
    })

    const out = await PanelService.responder('dame el historial de sector hornos', [])

    expect(out.imagenes).toEqual(['https://signed.test/foto.png'])
    expect(out.respuesta).toBe('La obra tiene 1 foto de plano.')

    // El functionResponse reinyectado al modelo no debe contener la URL cruda.
    const segundaLlamada = Provider.chat.mock.calls[1][0]
    const functionResponseTexto = JSON.stringify(segundaLlamada.contents)
    expect(functionResponseTexto).not.toContain('https://signed.test/foto.png')
    expect(functionResponseTexto).toContain('no repitas la URL')
  })

  it('sin planos en el resultado: imagenes queda vacío', async () => {
    Provider.chat.mockResolvedValueOnce({
      text: null,
      functionCalls: [{ name: 'listar_obras', args: {} }],
    })
    runTool.mockResolvedValueOnce({ total: 0, items: [] })
    Provider.chat.mockResolvedValueOnce({ text: 'No hay obras.', functionCalls: [] })

    const out = await PanelService.responder('¿qué obras hay?', [])
    expect(out.imagenes).toEqual([])
  })

  it('respuesta directa sin tools: imagenes vacío, no llama a runTool', async () => {
    Provider.chat.mockResolvedValueOnce({ text: 'Hola, ¿en qué te ayudo?', functionCalls: [] })

    const out = await PanelService.responder('hola', [])
    expect(out.imagenes).toEqual([])
    expect(runTool).not.toHaveBeenCalled()
  })
})
