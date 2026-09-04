// armado.service.js compone services ya testeados en su origen (obras,
// presupuestos, remitos, compras, materiales) + el provider de Gemini. Se
// mockean esos módulos directamente en vez de supabase: acá no hay queries
// propias de negocio, solo orquestación.
jest.mock('./panel/provider.js',      () => ({ chat: jest.fn() }))
jest.mock('./materiales.service.js',  () => ({
  getAll: jest.fn(), getById: jest.fn(), create: jest.fn(), getPrecioReferencia: jest.fn(),
}))
jest.mock('./obras.service.js',       () => ({ getById: jest.fn(), create: jest.fn() }))
jest.mock('./presupuestos.service.js',() => ({ create: jest.fn(), addInsumo: jest.fn(), addCosto: jest.fn() }))
jest.mock('./remitos.service.js',     () => ({ create: jest.fn(), addMaterial: jest.fn() }))
jest.mock('./compras.service.js',     () => ({ create: jest.fn() }))
jest.mock('./armadoVocabulario.service.js', () => ({
  buscarRelevante: jest.fn(), registrarCorreccion: jest.fn(),
}))
jest.mock('./obraHistorial.service.js', () => ({ agregarPlano: jest.fn() }))

import * as ArmadoService  from './armado.service.js'
import * as Provider       from './panel/provider.js'
import * as Materiales     from './materiales.service.js'
import * as Obras          from './obras.service.js'
import * as Presupuestos   from './presupuestos.service.js'
import * as Remitos        from './remitos.service.js'
import * as Compras        from './compras.service.js'
import * as ArmadoVocabulario from './armadoVocabulario.service.js'
import * as ObraHistorial  from './obraHistorial.service.js'

const CATALOGO = [
  { id: 'mat-cano',  nombre: 'Caño Inoxidable', marca: 'Famiq',     unidad: 'metro',  stock_actual: 50 },
  { id: 'mat-codo',  nombre: 'Codo 90',         marca: 'Tassaroli', unidad: 'unidad', stock_actual: 4  },
  { id: 'mat-valv',  nombre: 'Válvula esférica',marca: null,        unidad: 'unidad', stock_actual: 0  },
]

const OBRA = { id: 'obra-1', nombre: 'Planta Norte' }

function respuestaIA(lineas) {
  Provider.chat.mockResolvedValue({ text: JSON.stringify({ lineas }) })
}

beforeEach(() => {
  jest.resetAllMocks()
  Materiales.getAll.mockResolvedValue(CATALOGO)
  Obras.getById.mockResolvedValue(OBRA)
  ArmadoVocabulario.buscarRelevante.mockResolvedValue([])
  ArmadoVocabulario.registrarCorreccion.mockResolvedValue({})
  ObraHistorial.agregarPlano.mockResolvedValue({})
})

// ─────────────────────────────────────────────────────────────
describe('armado.service.interpretar', () => {
  it('rechaza texto vacío', async () => {
    await expect(ArmadoService.interpretar({ texto: '   ', destino: 'REMITO' }))
      .rejects.toThrow('Escribí o dictá')
  })

  it('rechaza un destino inválido', async () => {
    await expect(ArmadoService.interpretar({ texto: 'algo', destino: 'FACTURA' }))
      .rejects.toThrow('destino inválido')
  })

  it('destino PRESUPUESTO no reparte por stock', async () => {
    respuestaIA([
      { textoOriginal: '3 metros de caño', cantidad: 3, unidad: 'metro', materialId: 'mat-cano', confianza: 'alta' },
    ])
    const { lineas } = await ArmadoService.interpretar({ texto: '3 metros de caño', destino: 'PRESUPUESTO' })
    expect(lineas[0]).toMatchObject({ materialId: 'mat-cano', cantidad: 3 })
    expect(lineas[0].alRemito).toBeUndefined()
    expect(lineas[0].motivo).toBeUndefined()
  })

  it('destino REMITO clasifica: completo, parcial, sin stock y sin match', async () => {
    respuestaIA([
      { textoOriginal: '3 metros de caño', cantidad: 3,  unidad: 'metro',  materialId: 'mat-cano', confianza: 'alta' },
      { textoOriginal: '10 codos',         cantidad: 10, unidad: 'unidad', materialId: 'mat-codo', confianza: 'alta' },
      { textoOriginal: '1 válvula',        cantidad: 1,  unidad: 'unidad', materialId: 'mat-valv', confianza: 'alta' },
      { textoOriginal: '2 bridas',         cantidad: 2,  unidad: 'unidad', materialId: '',         confianza: 'baja' },
    ])
    const { lineas } = await ArmadoService.interpretar({ texto: '...', destino: 'REMITO' })

    expect(lineas[0]).toMatchObject({ motivo: 'OK',       alRemito: 3,  aComprar: 0 })
    // stock 4 contra 10 pedidos → 4 salen, 6 se compran
    expect(lineas[1]).toMatchObject({ motivo: 'PARCIAL',  alRemito: 4,  aComprar: 6 })
    expect(lineas[2]).toMatchObject({ motivo: 'SIN_STOCK',alRemito: 0,  aComprar: 1 })
    expect(lineas[3]).toMatchObject({ motivo: 'SIN_MATCH',alRemito: 0,  aComprar: 2, materialId: null })
  })

  it('anula un materialId que no está en el catálogo', async () => {
    respuestaIA([
      { textoOriginal: 'algo raro', cantidad: 1, materialId: 'mat-inventado', confianza: 'baja' },
    ])
    const { lineas } = await ArmadoService.interpretar({ texto: '...', destino: 'REMITO' })
    expect(lineas[0].materialId).toBeNull()
    expect(lineas[0].motivo).toBe('SIN_MATCH')
  })

  it('falla claro si el modelo no devuelve JSON parseable', async () => {
    Provider.chat.mockResolvedValue({ text: 'no soy json' })
    await expect(ArmadoService.interpretar({ texto: '...', destino: 'REMITO' }))
      .rejects.toThrow('interpretar la respuesta')
  })

  // Lectura de planos: la foto es apoyo/verificación, nunca fuente de
  // cantidad. Ver _plans/planos/architecture.html.
  it('sin foto: arma contents con una sola part (regresión)', async () => {
    respuestaIA([{ textoOriginal: '3 metros de caño', cantidad: 3, materialId: 'mat-cano', confianza: 'alta' }])
    await ArmadoService.interpretar({ texto: '3 metros de caño', destino: 'PRESUPUESTO' })

    const { contents } = Provider.chat.mock.calls[0][0]
    expect(contents[0].parts).toHaveLength(1)
    expect(contents[0].parts[0]).toEqual({ text: '3 metros de caño' })
  })

  it('con foto: arma contents con la parte de texto + inlineData de la imagen', async () => {
    respuestaIA([{ textoOriginal: '3 metros de caño', cantidad: 3, materialId: 'mat-cano', confianza: 'alta' }])
    const foto = { buffer: Buffer.from('imagen-fake'), mimeType: 'image/png' }

    await ArmadoService.interpretar({ texto: '3 metros de caño', destino: 'PRESUPUESTO', foto })

    const { contents, system } = Provider.chat.mock.calls[0][0]
    expect(contents[0].parts).toHaveLength(2)
    expect(contents[0].parts[1]).toEqual({
      inlineData: { mimeType: 'image/png', data: foto.buffer.toString('base64') },
    })
    // El prompt debe dejar explícito que la imagen no decide cantidades.
    expect(system).toMatch(/nunca.*fuente de cantidad|apoyo y verificaci/i)
  })

  it('pasa el vocabulario aprendido relevante al prompt cuando existe', async () => {
    ArmadoVocabulario.buscarRelevante.mockResolvedValue([
      { textoAprendido: 'cano inox', materialId: 'mat-cano', materialNombre: 'Caño Inoxidable', materialMarca: 'Famiq', vecesConfirmado: 3 },
    ])
    respuestaIA([{ textoOriginal: 'caño inox', cantidad: 1, materialId: 'mat-cano', confianza: 'alta' }])

    await ArmadoService.interpretar({ texto: 'caño inox', destino: 'PRESUPUESTO' })

    expect(ArmadoVocabulario.buscarRelevante).toHaveBeenCalledWith('caño inox')
    const { system } = Provider.chat.mock.calls[0][0]
    expect(system).toContain('Caño Inoxidable')
  })

  it('cada línea devuelve materialIdPropuesto igual al materialId inicial', async () => {
    respuestaIA([{ textoOriginal: '3 metros de caño', cantidad: 3, materialId: 'mat-cano', confianza: 'alta' }])
    const { lineas } = await ArmadoService.interpretar({ texto: '3 metros de caño', destino: 'PRESUPUESTO' })
    expect(lineas[0].materialIdPropuesto).toBe('mat-cano')
  })
})

// ─────────────────────────────────────────────────────────────
describe('armado.service.confirmar', () => {
  it('exige obra existente o datos de obra nueva', async () => {
    await expect(ArmadoService.confirmar({
      destino: 'REMITO',
      lineas: [{ materialId: 'mat-cano', cantidad: 1, alRemito: 1 }],
    })).rejects.toThrow('obra')
  })

  it('rechaza una línea sin material asignado', async () => {
    await expect(ArmadoService.confirmar({
      destino: 'PRESUPUESTO', obraId: 'obra-1',
      lineas: [{ textoOriginal: '2 bridas', cantidad: 2 }],
    })).rejects.toThrow('no tiene material asignado')
  })

  it('PRESUPUESTO: crea el presupuesto y agrega insumos con precio de referencia', async () => {
    Presupuestos.create.mockResolvedValue({ id: 'pres-1' })
    Materiales.getPrecioReferencia.mockResolvedValue({ precio: 1200, fuente: 'ultima_compra' })

    const out = await ArmadoService.confirmar({
      destino: 'PRESUPUESTO', obraId: 'obra-1',
      lineas: [{ materialId: 'mat-cano', cantidad: 3, unidad: 'metro' }],
    })

    expect(Presupuestos.create).toHaveBeenCalledWith({ obraId: 'obra-1' })
    expect(Presupuestos.addInsumo).toHaveBeenCalledWith('pres-1', {
      materialId: 'mat-cano', cantidad: 3, precioUnitario: 1200,
    })
    expect(out).toMatchObject({ destino: 'PRESUPUESTO', presupuestoId: 'pres-1', insumos: 1 })
  })

  // La mano de obra es lo que necesitaba el Panel IA y el service no tenía;
  // es la razón por la que `crear_presupuesto_guiado` podía delegar acá.
  it('PRESUPUESTO con manoObra: agrega la linea de MANO_OBRA en jornales', async () => {
    Presupuestos.create.mockResolvedValue({ id: 'pres-mo', numero: 'PR-00009' })
    Materiales.getPrecioReferencia.mockResolvedValue(null)

    const out = await ArmadoService.confirmar({
      destino: 'PRESUPUESTO', obraId: 'obra-1',
      lineas: [{ materialId: 'mat-cano', cantidad: 2 }],
      manoObra: { empleados: 3, dias: 5, costoPorEmpleadoDia: 20000 },
    })

    expect(Presupuestos.addCosto).toHaveBeenCalledWith('pres-mo', expect.objectContaining({
      categoria:     'MANO_OBRA',
      cantidad:      15,      // 3 empleados x 5 dias
      unidad:        'jornal',
      costoUnitario: 20000,
    }))
    expect(out.costoManoObra).toBe(300000)
    expect(out.presupuestoNumero).toBe('PR-00009')
  })

  it('PRESUPUESTO sin manoObra: no agrega ninguna linea de costo', async () => {
    Presupuestos.create.mockResolvedValue({ id: 'pres-sin-mo', numero: 'PR-00010' })
    Materiales.getPrecioReferencia.mockResolvedValue(null)

    const out = await ArmadoService.confirmar({
      destino: 'PRESUPUESTO', obraId: 'obra-1',
      lineas: [{ materialId: 'mat-cano', cantidad: 2 }],
    })

    expect(Presupuestos.addCosto).not.toHaveBeenCalled()
    expect(out.costoManoObra).toBeNull()
  })

  it('PRESUPUESTO: rechaza manoObra con valores invalidos', async () => {
    Presupuestos.create.mockResolvedValue({ id: 'pres-x', numero: 'PR-00011' })
    Materiales.getPrecioReferencia.mockResolvedValue(null)

    await expect(ArmadoService.confirmar({
      destino: 'PRESUPUESTO', obraId: 'obra-1',
      lineas: [{ materialId: 'mat-cano', cantidad: 1 }],
      manoObra: { empleados: 0, dias: 5, costoPorEmpleadoDia: 100 },
    })).rejects.toThrow('empleados')
  })

  it('PRESUPUESTO: cae a precio 0 si el material nunca se compró', async () => {
    Presupuestos.create.mockResolvedValue({ id: 'pres-1' })
    Materiales.getPrecioReferencia.mockResolvedValue(null)

    await ArmadoService.confirmar({
      destino: 'PRESUPUESTO', obraId: 'obra-1',
      lineas: [{ materialId: 'mat-cano', cantidad: 2 }],
    })
    expect(Presupuestos.addInsumo).toHaveBeenCalledWith('pres-1',
      expect.objectContaining({ precioUnitario: 0 }))
  })

  it('REMITO: manda al remito lo disponible y a la orden de compra lo faltante', async () => {
    Materiales.getById.mockResolvedValue({ id: 'mat-codo', nombre: 'Codo 90', stock_actual: 4 })
    Remitos.create.mockResolvedValue({ id: 'rem-1' })
    Compras.create.mockResolvedValue({ id: 'oc-1' })

    const out = await ArmadoService.confirmar({
      destino: 'REMITO', obraId: 'obra-1', proveedorId: 'prov-1',
      lineas: [{ materialId: 'mat-codo', cantidad: 10, unidad: 'unidad', alRemito: 4, aComprar: 6 }],
    })

    // El remito queda vinculado a la obra por FK, no solo por nombre —
    // ver 2026_09_03_remitos_movimientos_obra_id.sql.
    expect(Remitos.create).toHaveBeenCalledWith(expect.objectContaining({ obraId: 'obra-1' }))
    expect(Remitos.addMaterial).toHaveBeenCalledWith('rem-1', {
      materialId: 'mat-codo', cantidad: 4, unidad: 'unidad',
    })
    expect(Compras.create).toHaveBeenCalledWith(expect.objectContaining({
      proveedorId: 'prov-1',
      items: [{ materialId: 'mat-codo', cantidad: 6, precioUnitario: 0 }],
    }))
    expect(out).toMatchObject({ remitoId: 'rem-1', compraId: 'oc-1' })
  })

  it('REMITO sin proveedor: no crea orden y devuelve los faltantes ("decidir después")', async () => {
    Materiales.getById.mockResolvedValue({ id: 'mat-codo', nombre: 'Codo 90', stock_actual: 4 })
    Remitos.create.mockResolvedValue({ id: 'rem-1' })

    const out = await ArmadoService.confirmar({
      destino: 'REMITO', obraId: 'obra-1',
      lineas: [{ materialId: 'mat-codo', materialNombre: 'Codo 90', cantidad: 10, unidad: 'unidad', alRemito: 4, aComprar: 6 }],
    })

    expect(Compras.create).not.toHaveBeenCalled()
    expect(out.compraId).toBeNull()
    expect(out.faltantes).toEqual([
      { materialId: 'mat-codo', nombre: 'Codo 90', cantidad: 6, unidad: 'unidad' },
    ])
  })

  it('REMITO: rechaza si el stock cambió entre interpretar y confirmar', async () => {
    // Se propuso sacar 4, pero para cuando confirma quedaba 1.
    Materiales.getById.mockResolvedValue({ id: 'mat-codo', nombre: 'Codo 90', stock_actual: 1 })

    await expect(ArmadoService.confirmar({
      destino: 'REMITO', obraId: 'obra-1',
      lineas: [{ textoOriginal: '10 codos', materialId: 'mat-codo', cantidad: 10, alRemito: 4, aComprar: 6 }],
    })).rejects.toThrow('Cambió el stock')

    expect(Remitos.create).not.toHaveBeenCalled()
  })

  it('crea la obra nueva cuando no viene obraId', async () => {
    Obras.create.mockResolvedValue({ id: 'obra-new', nombre: 'Planta Sur' })
    Presupuestos.create.mockResolvedValue({ id: 'pres-2' })
    Materiales.getPrecioReferencia.mockResolvedValue(null)

    const out = await ArmadoService.confirmar({
      destino: 'PRESUPUESTO',
      obraNueva: { nombre: 'Planta Sur', direccion: 'Ruta 9 km 3' },
      lineas: [{ materialId: 'mat-cano', cantidad: 1 }],
    })

    expect(Obras.create).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Planta Sur' }))
    expect(out.obraId).toBe('obra-new')
  })

  it('da de alta el material nuevo cuando la línea no matcheó nada', async () => {
    Materiales.create.mockResolvedValue({ id: 'mat-brida' })
    Presupuestos.create.mockResolvedValue({ id: 'pres-3' })
    Materiales.getPrecioReferencia.mockResolvedValue(null)

    await ArmadoService.confirmar({
      destino: 'PRESUPUESTO', obraId: 'obra-1',
      lineas: [{
        textoOriginal: '2 bridas', cantidad: 2, unidad: 'unidad',
        materialNuevo: { nombre: 'Brida 2 pulgadas', marca: 'Famiq', unidad: 'unidad' },
      }],
    })

    expect(Materiales.create).toHaveBeenCalledWith({
      nombre: 'Brida 2 pulgadas', marca: 'Famiq', unidad: 'unidad',
    })
    expect(Presupuestos.addInsumo).toHaveBeenCalledWith('pres-3',
      expect.objectContaining({ materialId: 'mat-brida' }))
  })

  // Aprendizaje de vocabulario — ver _plans/planos/architecture.html.
  describe('aprendizaje de vocabulario', () => {
    beforeEach(() => {
      Presupuestos.create.mockResolvedValue({ id: 'pres-voc' })
      Materiales.getPrecioReferencia.mockResolvedValue(null)
    })

    it('registra la corrección cuando el material final difiere del propuesto', async () => {
      await ArmadoService.confirmar({
        destino: 'PRESUPUESTO', obraId: 'obra-1',
        lineas: [{
          textoOriginal: 'caño inox', cantidad: 1,
          materialId: 'mat-valv', materialIdPropuesto: 'mat-cano', // la IA propuso otro, el usuario corrigió
        }],
      })
      expect(ArmadoVocabulario.registrarCorreccion).toHaveBeenCalledWith({
        textoOriginal: 'caño inox', materialId: 'mat-valv',
      })
    })

    it('NO registra nada cuando el usuario acepta la propuesta tal cual', async () => {
      await ArmadoService.confirmar({
        destino: 'PRESUPUESTO', obraId: 'obra-1',
        lineas: [{
          textoOriginal: 'caño inox', cantidad: 1,
          materialId: 'mat-cano', materialIdPropuesto: 'mat-cano', // sin cambios
        }],
      })
      expect(ArmadoVocabulario.registrarCorreccion).not.toHaveBeenCalled()
    })

    it('NO registra nada cuando la línea no trae materialIdPropuesto (ej. Panel IA)', async () => {
      await ArmadoService.confirmar({
        destino: 'PRESUPUESTO', obraId: 'obra-1',
        lineas: [{ textoOriginal: 'caño inox', cantidad: 1, materialId: 'mat-cano' }],
      })
      expect(ArmadoVocabulario.registrarCorreccion).not.toHaveBeenCalled()
    })

    it('registra cuando la IA no había encontrado match (propuesto null) y el usuario resolvió uno', async () => {
      Materiales.create.mockResolvedValue({ id: 'mat-nuevo' })
      await ArmadoService.confirmar({
        destino: 'PRESUPUESTO', obraId: 'obra-1',
        lineas: [{
          textoOriginal: 'brida rara', cantidad: 1, materialIdPropuesto: null,
          materialNuevo: { nombre: 'Brida rara', unidad: 'unidad' },
        }],
      })
      expect(ArmadoVocabulario.registrarCorreccion).toHaveBeenCalledWith({
        textoOriginal: 'brida rara', materialId: 'mat-nuevo',
      })
    })

    it('un fallo al registrar no tira abajo la confirmación', async () => {
      ArmadoVocabulario.registrarCorreccion.mockRejectedValue(new Error('supabase caído'))
      const out = await ArmadoService.confirmar({
        destino: 'PRESUPUESTO', obraId: 'obra-1',
        lineas: [{ textoOriginal: 'caño inox', cantidad: 1, materialId: 'mat-valv', materialIdPropuesto: 'mat-cano' }],
      })
      expect(out.presupuestoId).toBe('pres-voc')
    })
  })

  // Foto de plano/croquis ligada a la obra — Historial de Obra. La foto
  // se reenvía en confirmar() porque interpretar() es de solo lectura y
  // no la persiste (ver _plans/historial-obra/architecture.html).
  describe('foto ligada a la obra (Historial de Obra)', () => {
    beforeEach(() => {
      Presupuestos.create.mockResolvedValue({ id: 'pres-foto' })
      Materiales.getPrecioReferencia.mockResolvedValue(null)
    })

    it('con foto: llama a ObraHistorial.agregarPlano con la obra resuelta', async () => {
      const foto = { buffer: Buffer.from('imagen-fake'), mimeType: 'image/png' }
      await ArmadoService.confirmar({
        destino: 'PRESUPUESTO', obraId: 'obra-1', foto,
        lineas: [{ materialId: 'mat-cano', cantidad: 1 }],
      })
      expect(ObraHistorial.agregarPlano).toHaveBeenCalledWith('obra-1', foto)
    })

    it('sin foto: no llama a agregarPlano', async () => {
      await ArmadoService.confirmar({
        destino: 'PRESUPUESTO', obraId: 'obra-1',
        lineas: [{ materialId: 'mat-cano', cantidad: 1 }],
      })
      expect(ObraHistorial.agregarPlano).not.toHaveBeenCalled()
    })

    it('un fallo al subir la foto no impide que se confirme el presupuesto', async () => {
      ObraHistorial.agregarPlano.mockRejectedValue(new Error('bucket caído'))
      const out = await ArmadoService.confirmar({
        destino: 'PRESUPUESTO', obraId: 'obra-1',
        foto: { buffer: Buffer.from('x'), mimeType: 'image/png' },
        lineas: [{ materialId: 'mat-cano', cantidad: 1 }],
      })
      expect(out.presupuestoId).toBe('pres-foto')
    })
  })
})
