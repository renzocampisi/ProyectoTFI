import * as DispositivoTrackerService from './dispositivo-tracker.service.js'

describe('dispositivo-tracker.service.consultarEstado (stub)', () => {
  it('devuelve "sin señal" hasta que se active el chip real', async () => {
    const estado = await DispositivoTrackerService.consultarEstado('IMEI-123')
    expect(estado).toEqual({ lat: null, lng: null, bateria: null, conSeñal: false })
  })
})
