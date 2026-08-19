// scanMatch.service.js orquesta sobre compras.service, materiales.service y
// el provider de Gemini — se mockean esos tres módulos directamente en vez
// de supabase (a diferencia de compras.service.test.js), porque acá no hay
// queries propias, solo composición de llamadas ya testeadas en sus
// services de origen.
jest.mock('./compras.service.js', () => ({
  getById:  jest.fn(),
  addItem:  jest.fn(),
  recibir:  jest.fn(),
}))
jest.mock('./materiales.service.js', () => ({
  create: jest.fn(),
}))
jest.mock('./panel/provider.js', () => ({
  chat: jest.fn(),
}))

import * as ScanMatchService from './scanMatch.service.js'
import * as ComprasService   from './compras.service.js'
import * as MaterialesService from './materiales.service.js'
import * as Provider         from './panel/provider.js'

const compraBase = {
  id: 'compra-1',
  numero: 'OC-00001',
  estado: 'CONFIRMADA',
  proveedor_nombre: 'Extra Power',
  items: [
    { id: 'item-1', material_nombre: 'Válvula esférica', material_unidad: 'unidad', material: { nombre: 'Válvula esférica', marca: 'Genebre', unidad: 'unidad' }, cantidad: 10, cantidad_recibida: 0 },
    { id: 'item-2', material_nombre: 'Caño Sch 40 2"',    material_unidad: 'metro',  material: { nombre: 'Caño Sch 40 2"', marca: null, unidad: 'metro' },  cantidad: 20, cantidad_recibida: 5 },
  ],
}

beforeEach(() => {
  jest.resetAllMocks()
  ComprasService.getById.mockResolvedValue(compraBase)
})

// ─────────────────────────────────────────────────────────────
describe('scanMatch.service.proponer', () => {
  const buffer = Buffer.from('fake-image-bytes')

  it('rechaza si falta el archivo', async () => {
    await expect(ScanMatchService.proponer('compra-1', { buffer: null, mimeType: 'image/jpeg' }))
      .rejects.toThrow('archivo')
  })

  it('rechaza si la compra no existe', async () => {
    ComprasService.getById.mockResolvedValueOnce(null)
    await expect(ScanMatchService.proponer('compra-x', { buffer, mimeType: 'image/jpeg' }))
      .rejects.toThrow('no encontrada')
  })

  it('rechaza si la compra no está en un estado receptible', async () => {
    ComprasService.getById.mockResolvedValueOnce({ ...compraBase, estado: 'BORRADOR' })
    await expect(ScanMatchService.proponer('compra-1', { buffer, mimeType: 'image/jpeg' }))
      .rejects.toThrow('BORRADOR')
  })

  it('devuelve la propuesta parseada, mapeando itemId válidos', async () => {
    Provider.chat.mockResolvedValue({
      text: JSON.stringify({
        items: [
          { textoProveedor: 'VALV ESF DN50', cantidadDetectada: 10, unidadDetectada: 'un', compraItemId: 'item-1', confianza: 'alta' },
          { textoProveedor: 'CAÑO 2 PULG', cantidadDetectada: 6, unidadDetectada: 'mts', compraItemId: 'item-2', confianza: 'media' },
        ],
      }),
    })

    const data = await ScanMatchService.proponer('compra-1', { buffer, mimeType: 'image/jpeg' })

    expect(Provider.chat).toHaveBeenCalledWith(expect.objectContaining({
      responseSchema: expect.any(Object),
      contents: expect.arrayContaining([
        expect.objectContaining({
          parts: expect.arrayContaining([
            expect.objectContaining({ inlineData: { mimeType: 'image/jpeg', data: buffer.toString('base64') } }),
          ]),
        }),
      ]),
    }))
    expect(data.compraNumero).toBe('OC-00001')
    expect(data.items).toHaveLength(2)
    expect(data.items[0]).toMatchObject({ compraItemId: 'item-1', confianza: 'alta' })
    expect(data.candidatos).toHaveLength(2)
  })

  it('anula un compraItemId alucinado que no pertenece a la compra', async () => {
    Provider.chat.mockResolvedValue({
      text: JSON.stringify({
        items: [{ textoProveedor: 'ITEM RARO', cantidadDetectada: 3, compraItemId: 'item-inventado', confianza: 'baja' }],
      }),
    })

    const data = await ScanMatchService.proponer('compra-1', { buffer, mimeType: 'image/jpeg' })
    expect(data.items[0].compraItemId).toBeNull()
  })

  it('falla con mensaje claro si Gemini no devuelve texto', async () => {
    Provider.chat.mockResolvedValue({ text: null })
    await expect(ScanMatchService.proponer('compra-1', { buffer, mimeType: 'image/jpeg' }))
      .rejects.toThrow('No se pudo leer')
  })

  it('falla con mensaje claro si la respuesta no es JSON parseable', async () => {
    Provider.chat.mockResolvedValue({ text: 'esto no es json' })
    await expect(ScanMatchService.proponer('compra-1', { buffer, mimeType: 'image/jpeg' }))
      .rejects.toThrow('interpretar')
  })
})

// ─────────────────────────────────────────────────────────────
describe('scanMatch.service.confirmar', () => {
  it('rechaza un array vacío', async () => {
    await expect(ScanMatchService.confirmar('compra-1', [])).rejects.toThrow('No se enviaron items')
  })

  it('rechaza cantidadRecibida <= 0', async () => {
    await expect(
      ScanMatchService.confirmar('compra-1', [{ compraItemId: 'item-1', cantidadRecibida: 0 }])
    ).rejects.toThrow('mayor a 0')
  })

  it('rechaza una línea sin compraItemId, materialIdExistente ni materialNuevo', async () => {
    await expect(
      ScanMatchService.confirmar('compra-1', [{ cantidadRecibida: 5 }])
    ).rejects.toThrow('materialNuevo')
  })

  it('convierte delta a total absoluto contra cantidad_recibida real antes de llamar a recibir()', async () => {
    ComprasService.recibir.mockResolvedValue({ id: 'compra-1', estado: 'RECIBIDA_PARCIAL' })

    await ScanMatchService.confirmar('compra-1', [
      { compraItemId: 'item-1', cantidadRecibida: 10 }, // previo 0 → total 10
      { compraItemId: 'item-2', cantidadRecibida: 6 },  // previo 5 → total 11
    ])

    expect(ComprasService.recibir).toHaveBeenCalledWith('compra-1', {
      items: [
        { itemId: 'item-1', cantidadRecibida: 10 },
        { itemId: 'item-2', cantidadRecibida: 11 },
      ],
    })
  })

  it('crea el material nuevo y lo suma a la compra vía addItem con skipEstadoCheck antes de recibir', async () => {
    MaterialesService.create.mockResolvedValue({ id: 'mat-nuevo' })
    ComprasService.addItem.mockResolvedValue({ id: 'item-nuevo' })
    ComprasService.recibir.mockResolvedValue({ id: 'compra-1' })

    await ScanMatchService.confirmar('compra-1', [
      { materialNuevo: { nombre: 'Bulón M12', marca: 'Tacsa', unidad: 'unidad' }, cantidadRecibida: 8 },
    ])

    expect(MaterialesService.create).toHaveBeenCalledWith({ nombre: 'Bulón M12', marca: 'Tacsa', unidad: 'unidad' })
    expect(ComprasService.addItem).toHaveBeenCalledWith(
      'compra-1',
      { materialId: 'mat-nuevo', cantidad: 8, precioUnitario: 0 },
      { skipEstadoCheck: true }
    )
    expect(ComprasService.recibir).toHaveBeenCalledWith('compra-1', {
      items: [{ itemId: 'item-nuevo', cantidadRecibida: 8 }],
    })
  })

  it('material existente-pero-no-pedido: suma vía addItem sin crear material', async () => {
    ComprasService.addItem.mockResolvedValue({ id: 'item-nuevo' })
    ComprasService.recibir.mockResolvedValue({ id: 'compra-1' })

    await ScanMatchService.confirmar('compra-1', [
      { materialIdExistente: 'mat-existente', cantidadRecibida: 4 },
    ])

    expect(MaterialesService.create).not.toHaveBeenCalled()
    expect(ComprasService.addItem).toHaveBeenCalledWith(
      'compra-1',
      { materialId: 'mat-existente', cantidad: 4, precioUnitario: 0 },
      { skipEstadoCheck: true }
    )
  })
})
