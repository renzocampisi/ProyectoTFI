// src/routes/AppRouter.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '@layouts/AppLayout'

import InventarioListPage   from '@modules/m2-inventario/pages/InventarioListPage'
import InventarioDetailPage from '@modules/m2-inventario/pages/InventarioDetailPage'
import InventarioNewPage    from '@modules/m2-inventario/pages/InventarioNewPage'
import InventarioEditPage   from '@modules/m2-inventario/pages/InventarioEditPage'

import QRScannerPage from '@modules/m3-qr/pages/QRScannerPage'
import RemitoQRPage  from '@modules/m3-qr/pages/RemitoQRPage'

import ObrasListPage   from '@modules/m4-obra/pages/ObrasListPage'
import ObrasNewPage    from '@modules/m4-obra/pages/ObrasNewPage'
import ObrasDetailPage from '@modules/m4-obra/pages/ObrasDetailPage'
import ObrasEditPage   from '@modules/m4-obra/pages/ObrasEditPage'

import RemitosListPage   from '@modules/m5-remito/pages/RemitosListPage'
import RemitosNewPage    from '@modules/m5-remito/pages/RemitosNewPage'
import RemitosDetailPage from '@modules/m5-remito/pages/RemitosDetailPage'

import MateriasListPage from '@modules/m6-materiales/pages/MateriasListPage'
import MateriasNewPage  from '@modules/m6-materiales/pages/MateriasNewPage'
import MateriasEditPage from '@modules/m6-materiales/pages/MateriasEditPage'

import TransportesPage from '@modules/m7-directorio/pages/TransportesPage'
import ClientesPage    from '@modules/m7-directorio/pages/ClientesPage'

import EstanteriasPage from '@modules/m8-estanterias/pages/EstanteriasPage'

import ComingSoon from '@shared/components/ComingSoon'

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Ruta pública mobile — QR de remito, sin sidebar */}
        <Route path="/remitos/:id/qr" element={<RemitoQRPage />} />

        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/herramientas" replace />} />

          <Route path="herramientas">
            <Route index             element={<InventarioListPage />} />
            <Route path="nuevo"      element={<InventarioNewPage />} />
            <Route path=":id"        element={<InventarioDetailPage />} />
            <Route path=":id/editar" element={<InventarioEditPage />} />
          </Route>
          <Route path="inventario/*" element={<Navigate to="/herramientas" replace />} />

          <Route path="qr" element={<QRScannerPage />} />

          <Route path="obras">
            <Route index             element={<ObrasListPage />} />
            <Route path="nueva"      element={<ObrasNewPage />} />
            <Route path=":id"        element={<ObrasDetailPage />} />
            <Route path=":id/editar" element={<ObrasEditPage />} />
          </Route>

          <Route path="remitos">
            <Route index        element={<RemitosListPage />} />
            <Route path="nuevo" element={<RemitosNewPage />} />
            <Route path=":id"   element={<RemitosDetailPage />} />
          </Route>

          <Route path="materiales">
            <Route index             element={<MateriasListPage />} />
            <Route path="nuevo"      element={<MateriasNewPage />} />
            <Route path=":id/editar" element={<MateriasEditPage />} />
          </Route>

          <Route path="directorio">
            <Route index              element={<Navigate to="/directorio/transportes" replace />} />
            <Route path="transportes" element={<TransportesPage />} />
            <Route path="clientes"    element={<ClientesPage />} />
            <Route path="proveedores" element={<ComingSoon modulo="Proveedores" />} />
          </Route>

          <Route path="estanterias" element={<EstanteriasPage />} />

          <Route path="compras/*"     element={<ComingSoon modulo="Compras" />} />
          <Route path="facturacion/*" element={<ComingSoon modulo="Facturación" />} />
          <Route path="panel/*"       element={<ComingSoon modulo="Panel IA" />} />

          <Route path="*" element={<Navigate to="/herramientas" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
