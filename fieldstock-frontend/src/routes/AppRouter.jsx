// src/routes/AppRouter.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '@layouts/AppLayout'
import RequireAuth from '@shared/components/RequireAuth'
import RequireRole from '@shared/components/RequireRole'
import { ROLES } from '@shared/constants/roles'

import LoginPage  from '@modules/m0-auth/pages/LoginPage'
import PerfilPage from '@modules/m0-auth/pages/PerfilPage'

import DashboardPage        from '@modules/m1-dashboard/pages/DashboardPage'

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
import ProveedoresPage from '@modules/m7-directorio/pages/ProveedoresPage'

import EstanteriasPage from '@modules/m8-estanterias/pages/EstanteriasPage'

import UsuariosListPage from '@modules/m9-usuarios/pages/UsuariosListPage'

import ComingSoon from '@shared/components/ComingSoon'

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>

        {/* /login es la única ruta pública (sin RequireAuth). */}
        <Route path="/login" element={<LoginPage />} />

        {/* QR mobile del remito: privada también — quien escanea es siempre
            un empleado (operario/encargado/dueño). El responsable del cliente
            recibe el PDF impreso pero no opera la app. */}
        <Route path="/remitos/:id/qr" element={
          <RequireAuth><RemitoQRPage /></RequireAuth>
        } />

        {/* Todo el resto vive detrás de auth + AppLayout. */}
        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          {/* Word #16 — dashboard de inicio reemplaza el redirect a /herramientas */}
          <Route index element={<DashboardPage />} />

          {/* Mi perfil — accesible para los 3 roles */}
          <Route path="perfil" element={<PerfilPage />} />

          {/* Gestión de usuarios — solo DUEÑO */}
          <Route path="usuarios" element={
            <RequireRole roles={[ROLES.DUEÑO]}>
              <UsuariosListPage />
            </RequireRole>
          } />

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
            <Route path="proveedores" element={<ProveedoresPage />} />
          </Route>

          <Route path="estanterias" element={<EstanteriasPage />} />

          <Route path="compras/*"     element={<ComingSoon modulo="Compras" />} />
          <Route path="facturacion/*" element={<ComingSoon modulo="Facturación" />} />
          <Route path="panel/*"       element={<ComingSoon modulo="Panel IA" />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
