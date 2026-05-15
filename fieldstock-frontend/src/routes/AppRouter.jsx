// src/routes/AppRouter.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '@layouts/AppLayout'

// M2 — Herramientas
import InventarioListPage   from '@modules/m2-inventario/pages/InventarioListPage'
import InventarioDetailPage from '@modules/m2-inventario/pages/InventarioDetailPage'
import InventarioNewPage    from '@modules/m2-inventario/pages/InventarioNewPage'
import InventarioEditPage   from '@modules/m2-inventario/pages/InventarioEditPage'

// M4 — Obras
import ObrasListPage   from '@modules/m4-obra/pages/ObrasListPage'
import ObrasNewPage    from '@modules/m4-obra/pages/ObrasNewPage'
import ObrasDetailPage from '@modules/m4-obra/pages/ObrasDetailPage'
import ObrasEditPage   from '@modules/m4-obra/pages/ObrasEditPage'

// M5 — Remitos
import RemitosListPage   from '@modules/m5-remito/pages/RemitosListPage'
import RemitosNewPage    from '@modules/m5-remito/pages/RemitosNewPage'
import RemitosDetailPage from '@modules/m5-remito/pages/RemitosDetailPage'

// M6 — Materiales
import MateriasListPage from '@modules/m6-materiales/pages/MateriasListPage'
import MateriasNewPage  from '@modules/m6-materiales/pages/MateriasNewPage'
import MateriasEditPage from '@modules/m6-materiales/pages/MateriasEditPage'

import ComingSoon from '@shared/components/ComingSoon'

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/herramientas" replace />} />

          {/* M2 — Herramientas */}
          <Route path="herramientas">
            <Route index             element={<InventarioListPage />} />
            <Route path="nuevo"      element={<InventarioNewPage />} />
            <Route path=":id"        element={<InventarioDetailPage />} />
            <Route path=":id/editar" element={<InventarioEditPage />} />
          </Route>
          <Route path="inventario/*" element={<Navigate to="/herramientas" replace />} />

          {/* M4 — Obras */}
          <Route path="obras">
            <Route index             element={<ObrasListPage />} />
            <Route path="nueva"      element={<ObrasNewPage />} />
            <Route path=":id"        element={<ObrasDetailPage />} />
            <Route path=":id/editar" element={<ObrasEditPage />} />
          </Route>

          {/* M5 — Remitos */}
          <Route path="remitos">
            <Route index        element={<RemitosListPage />} />
            <Route path="nuevo" element={<RemitosNewPage />} />
            <Route path=":id"   element={<RemitosDetailPage />} />
          </Route>

          {/* M6 — Materiales */}
          <Route path="materiales">
            <Route index             element={<MateriasListPage />} />
            <Route path="nuevo"      element={<MateriasNewPage />} />
            <Route path=":id/editar" element={<MateriasEditPage />} />
          </Route>

          {/* Futuros */}
          <Route path="qr/*"          element={<ComingSoon modulo="M3 — Códigos QR" />} />
          <Route path="proveedores/*" element={<ComingSoon modulo="M6 — Proveedores" />} />
          <Route path="compras/*"     element={<ComingSoon modulo="M7 — Compras" />} />
          <Route path="facturacion/*" element={<ComingSoon modulo="M8 — Facturación" />} />
          <Route path="panel/*"       element={<ComingSoon modulo="M1 — Panel IA" />} />

          <Route path="*" element={<Navigate to="/herramientas" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
