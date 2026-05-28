// src/modules/m5-remito/pages/RemitoPrint.jsx
import { QRCodeSVG } from 'qrcode.react'

function formatFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

export function getNombreArchivo(remito) {
  const fecha  = remito?.fecha_egreso
    ? remito.fecha_egreso.split('T')[0].split('-').reverse().join('.')
    : new Date().toLocaleDateString('es-AR').replace(/\//g, '.')
  const numero = remito?.numero?.replace(/-/g, '_') || 'sin_numero'
  return `remito_${numero}_${fecha}`
}

export default function RemitoPrint({ remito }) {
  if (!remito) return null

  // QR apunta a la página de confirmación mobile
  const qrValue   = `${window.location.origin}/remitos/${remito.id}/qr`
  const esIngreso = remito.tipo === 'INGRESO'

  return (
    <div id="remito-print" style={{
      display: 'none',
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      color: '#1a1a1a',
      background: '#fff',
      padding: '24px 28px',
      maxWidth: '794px',
      margin: '0 auto',
    }}>

      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1a1a1a', paddingBottom: '12px', marginBottom: '16px' }}>
        <div style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.5px' }}>FieldStock AI</div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '13px', fontWeight: '600' }}>{remito.numero}</div>
          <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>Fecha: {formatFecha(remito.fecha_egreso)}</div>
        </div>
      </div>

      {/* Datos */}
      {/*
        Bloques del destino y del envío:
        - "Destino" usa la EMPRESA (cliente) como header principal — en este
          flujo no nos importa el nombre interno de la obra/sector, sino a qué
          empresa va dirigido el remito. Mostramos la dirección y el contacto
          del responsable (este último queda '—' hasta que tengamos login,
          momento en el que vendrá del perfil del usuario responsable).
        - "Datos del envío" agrega el teléfono del transporte para que el
          chofer/responsable de planta tengan contacto directo.
      */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px', background: '#f8f8f8', padding: '12px', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', borderBottom: '1px solid #ccc', paddingBottom: '4px', marginBottom: '8px' }}>Destino</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {[
                ['Empresa:',    remito.cliente_nombre],
                ['Dirección:',  [remito.cliente_direccion, remito.cliente_localidad, remito.cliente_provincia].filter(Boolean).join(', ')],
                ['Responsable:', remito.responsable],
                // TODO: cuando esté el login, este campo viene del perfil
                // del usuario responsable. Por ahora se imprime vacío y se
                // completa a mano.
                ['Tel. responsable:', remito.responsable_telefono],
              ].map(([label, val]) => (
                <tr key={label}>
                  <td style={{ color: '#555', paddingBottom: '4px', whiteSpace: 'nowrap', paddingRight: '6px', verticalAlign: 'top', width: '110px' }}>{label}</td>
                  <td style={{ fontWeight: '500', paddingBottom: '4px', verticalAlign: 'top' }}>{val || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', borderBottom: '1px solid #ccc', paddingBottom: '4px', marginBottom: '8px' }}>Datos del envío</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {[
                ['Transporte:',      remito.empresa_transporte],
                ['Tel. transporte:', remito.transporte_telefono],
                // El conductor / persona que físicamente traslada se carga
                // al escanear el QR de SALIDA desde el celular (es campo
                // obligatorio en esa pantalla). En BORRADOR / CONFIRMADO
                // todavía está vacío y sale como '—'.
                ['Persona a cargo:', remito.conductor],
                ['Fecha egreso:',    formatFecha(remito.fecha_egreso)],
                ...(esIngreso ? [['Fecha retorno:', formatFecha(remito.fecha_retorno)]] : []),
              ].map(([label, val]) => (
                <tr key={label}>
                  <td style={{ color: '#555', paddingBottom: '4px', whiteSpace: 'nowrap', paddingRight: '6px', verticalAlign: 'top', width: '110px' }}>{label}</td>
                  <td style={{ fontWeight: '500', paddingBottom: '4px', verticalAlign: 'top' }}>{val || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Observaciones */}
      {remito.observacion && (
        <div style={{ marginBottom: '16px', padding: '8px 12px', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: '4px' }}>
          <span style={{ fontWeight: '600' }}>Observaciones: </span>{remito.observacion}
        </div>
      )}

      {/* Herramientas */}
      {remito.items?.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', background: '#1a1a1a', color: '#fff', padding: '5px 10px' }}>
            Herramientas — {remito.items.length} ítem{remito.items.length !== 1 ? 's' : ''}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ background: '#f0f0f0' }}>
                <th style={{ border: '1px solid #ccc', padding: '5px 8px', textAlign: 'left', width: '30px' }}>N°</th>
                <th style={{ border: '1px solid #ccc', padding: '5px 8px', textAlign: 'left', width: '110px' }}>Código QR</th>
                <th style={{ border: '1px solid #ccc', padding: '5px 8px', textAlign: 'left' }}>Herramienta</th>
                <th style={{ border: '1px solid #ccc', padding: '5px 8px', textAlign: 'center', width: '80px' }}>Est. salida</th>
                {esIngreso && <th style={{ border: '1px solid #ccc', padding: '5px 8px', textAlign: 'center', width: '80px' }}>Est. retorno</th>}
                <th style={{ border: '1px solid #ccc', padding: '5px 8px', textAlign: 'center', width: '70px' }}>Conforme</th>
              </tr>
            </thead>
            <tbody>
              {remito.items.map((item, idx) => (
                <tr key={item.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ border: '1px solid #ccc', padding: '5px 8px', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #ccc', padding: '4px 8px', fontFamily: 'monospace', fontSize: '10px' }}>{item.herramienta_qr}</td>
                  <td style={{ border: '1px solid #ccc', padding: '5px 8px', fontWeight: '500' }}>{item.herramienta_nombre}</td>
                  <td style={{ border: '1px solid #ccc', padding: '5px 8px', textAlign: 'center' }}>{item.estado_salida || '—'}</td>
                  {esIngreso && <td style={{ border: '1px solid #ccc', padding: '5px 8px', textAlign: 'center' }}>{item.estado_retorno?.replace(/_/g, ' ') || '—'}</td>}
                  <td style={{ border: '1px solid #ccc', padding: '5px 8px' }}></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Materiales */}
      {remito.materiales?.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', background: '#1a1a1a', color: '#fff', padding: '5px 10px' }}>
            Materiales e insumos — {remito.materiales.length} ítem{remito.materiales.length !== 1 ? 's' : ''}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ background: '#f0f0f0' }}>
                <th style={{ border: '1px solid #ccc', padding: '5px 8px', textAlign: 'left', width: '30px' }}>N°</th>
                <th style={{ border: '1px solid #ccc', padding: '5px 8px', textAlign: 'left' }}>Descripción</th>
                <th style={{ border: '1px solid #ccc', padding: '5px 8px', textAlign: 'center', width: '80px' }}>Cant. envío</th>
                <th style={{ border: '1px solid #ccc', padding: '5px 8px', textAlign: 'center', width: '60px' }}>Unidad</th>
                {esIngreso && <th style={{ border: '1px solid #ccc', padding: '5px 8px', textAlign: 'center', width: '80px' }}>Cant. retorno</th>}
                <th style={{ border: '1px solid #ccc', padding: '5px 8px', textAlign: 'center', width: '70px' }}>Conforme</th>
              </tr>
            </thead>
            <tbody>
              {remito.materiales.map((m, idx) => (
                <tr key={m.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ border: '1px solid #ccc', padding: '5px 8px', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #ccc', padding: '5px 8px', fontWeight: '500' }}>
                    {m.material_nombre || m.descripcion_libre}
                    {!m.material_id && <span style={{ fontSize: '9px', color: '#888', marginLeft: '4px' }}>(libre)</span>}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '5px 8px', textAlign: 'center' }}>{m.cantidad_egreso}</td>
                  <td style={{ border: '1px solid #ccc', padding: '5px 8px', textAlign: 'center' }}>{m.unidad}</td>
                  {esIngreso && <td style={{ border: '1px solid #ccc', padding: '5px 8px', textAlign: 'center' }}>{m.cantidad_retorno ?? '—'}</td>}
                  <td style={{ border: '1px solid #ccc', padding: '5px 8px' }}></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* QR del remito */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px', paddingTop: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '12px 20px', border: '1px solid #ddd', borderRadius: '6px', background: '#fafafa' }}>
          <QRCodeSVG value={qrValue} size={90} bgColor="#ffffff" fgColor="#000000" level="M" />
          <div style={{ fontSize: '10px', color: '#555', fontFamily: 'monospace' }}>{remito.numero}</div>
          <div style={{ fontSize: '9px', color: '#888' }}>Escanear para confirmar egreso / llegada</div>
        </div>
      </div>

      {/* Firmas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', borderTop: '1px solid #ccc', paddingTop: '20px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderBottom: '1px solid #1a1a1a', marginBottom: '8px', height: '48px' }}></div>
          <div style={{ fontSize: '10px', fontWeight: '600' }}>Firma persona a cargo</div>
          <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>{remito.responsable}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderBottom: '1px solid #1a1a1a', marginBottom: '8px', height: '48px' }}></div>
          <div style={{ fontSize: '10px', fontWeight: '600' }}>Firma transportista</div>
          <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>{remito.empresa_transporte || '—'}</div>
        </div>
      </div>

    </div>
  )
}
