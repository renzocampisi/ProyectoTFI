// src/services/dispositivo-tracker.service.js
/**
 * Único punto de contacto con el proveedor de rastreo (TKSTAR / mytkstar.net)
 * — mismo criterio que mercadopago.service.js y email.service.js. Nadie más
 * en el backend le habla al proveedor directo.
 *
 * STUB por ahora: los dispositivos comprados todavía no tienen el chip con
 * datos activado (ver architecture.html — spike pendiente), así que no hay
 * nada real que consultar. `consultarEstado` devuelve siempre "sin señal"
 * en vez de pegarle a una API que no existe todavía. El día que se active
 * el chip, esta es la ÚNICA función que hay que reescribir — el resto del
 * dominio de dispositivos (dispositivos.service.js, el emparejado, el
 * panel de control) no la conoce por dentro, solo por esta forma de dato.
 */
export async function consultarEstado(imeiProveedor) {
  void imeiProveedor
  return { lat: null, lng: null, bateria: null, conSeñal: false }
}
