import { lazy, Suspense } from 'react'; // Lazy loading de componentes para optimizar la carga inicial de la aplicación
import { Routes, Route } from 'react-router-dom'; // Rutas y rutas hijas
import Login from './pages/Login'; // Página de login
import Inicio from './pages/Inicio'; // Página de inicio
import RutaProtegida from './components/RutaProtegida'; // Componente que protege rutas según sesión y roles
import Layout from './components/Layout'; // Componente de layout que envuelve las páginas protegidas
import { ROLES } from './roles'; // Constantes de roles de usuario
import NoEncontrada from './pages/NoEncontrada';


// Se descargan al visitar una ruta permitida, sin cargar todos los módulos al iniciar.
const RecepcionesCompra = lazy(() => import('./pages/alpha/RecepcionesCompra'));
const DocumentosProveedor = lazy(() => import('./pages/alpha/DocumentosProveedor'));
const PagosDocumento = lazy(() => import('./pages/alpha/PagosDocumento'));
const EditorDocumentoProveedor = lazy(() => import('./pages/alpha/EditorDocumentoProveedor'));
const ComprobanteDocumentoProveedor = lazy(() => import('./pages/alpha/ComprobanteDocumentoProveedor'));
const CrearUsuario = lazy(() => import('./pages/admin/CrearUsuario'));
const Usuarios = lazy(() => import('./pages/admin/Usuarios'));
const Auditoria = lazy(() => import('./pages/admin/Auditoria'));
const CambiarPassword = lazy(() => import('./pages/CambiarPassword'));
const Fichas = lazy(() => import('./pages/alpha/Fichas'));
const ListadoFichas = lazy(() => import('./pages/alpha/ListadoFichas'));
const EditorFicha = lazy(() => import('./pages/alpha/EditorFicha'));
const Articulos = lazy(() => import('./pages/alpha/Articulos'));
const EditorArticulo = lazy(() => import('./pages/alpha/EditorArticulo'));
const InventarioFisico = lazy(() => import('./pages/alpha/InventarioFisico'));
const ConteoInventario = lazy(() => import('./pages/alpha/ConteoInventario'));
const Cardex = lazy(() => import('./pages/alpha/Cardex'));
const Presupuestos = lazy(() => import('./pages/beta/Presupuestos'));
const EditorPresupuesto = lazy(() => import('./pages/beta/EditorPresupuesto'));
const TareasServicio = lazy(() => import('./pages/beta/TareasServicio'));
const EditorTareaServicio = lazy(() => import('./pages/beta/EditorTareaServicio'));
const Obras = lazy(() => import('./pages/beta/Obras'));
const EditorObra = lazy(() => import('./pages/beta/EditorObra'));
const DetalleObra = lazy(() => import('./pages/beta/DetalleObra'));
const CategoriasServicio = lazy(() => import('./pages/beta/CategoriasServicio'));
const Resumen = lazy(() => import('./pages/beta/Resumen'));
const FacturasCliente = lazy(() => import('./pages/beta/FacturasCliente'));
const EditorFacturaCliente = lazy(() => import('./pages/beta/EditorFacturaCliente'));
const DetalleFacturaCliente = lazy(() => import('./pages/beta/DetalleFacturaCliente'));
const PortalGamma = lazy(() => import('./pages/gamma/PortalGamma'));

// Componente principal de la aplicación que define las rutas y la estructura de navegación
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/gamma/login" element={<Login terreno />} />
      <Route path="/gamma/*" element={<RutaProtegida roles={[ROLES.TECNICO]} login="/gamma/login"><Suspense fallback={<p>Cargando terreno…</p>}><PortalGamma /></Suspense></RutaProtegida>} />

      {/* Todo lo que está dentro exige sesión y comparte el Layout */}
      <Route element={<RutaProtegida><Layout /></RutaProtegida>}>
        <Route path="/" element={<Inicio />} />
        <Route path="/mi-cuenta/password" element={<CambiarPassword />} />
        <Route path="/beta/resumen" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.ADMINISTRACION]}><Resumen /></RutaProtegida>} />
        <Route path="/beta/facturas-clientes" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.ADMINISTRACION]}><FacturasCliente /></RutaProtegida>} />
        <Route path="/beta/facturas-clientes/nuevo" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.ADMINISTRACION]}><EditorFacturaCliente /></RutaProtegida>} />
        <Route path="/beta/facturas-clientes/:id" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.ADMINISTRACION]}><DetalleFacturaCliente /></RutaProtegida>} />
        <Route path="/beta/facturas-clientes/:id/pagos" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.ADMINISTRACION]}><PagosDocumento cliente /></RutaProtegida>} />
        <Route path="/beta/presupuestos" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}><Presupuestos /></RutaProtegida>} />
        <Route path="/beta/presupuestos/nuevo" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}><EditorPresupuesto key="nuevo" /></RutaProtegida>} />
        <Route path="/beta/presupuestos/:id" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}><EditorPresupuesto /></RutaProtegida>} />
        <Route path="/beta/tareas-servicio" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}><TareasServicio /></RutaProtegida>} />
        <Route path="/beta/tareas-servicio/nuevo" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}><EditorTareaServicio key="nuevo" /></RutaProtegida>} />
        <Route path="/beta/tareas-servicio/:id/editar" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}><EditorTareaServicio /></RutaProtegida>} />
        <Route path="/beta/obras" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}><Obras /></RutaProtegida>} />
        <Route path="/beta/obras/nuevo" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}><EditorObra key="nuevo" /></RutaProtegida>} />
        <Route path="/beta/obras/:id/editar" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}><EditorObra /></RutaProtegida>} />
        <Route path="/beta/obras/:id" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}><DetalleObra /></RutaProtegida>} />
        <Route path="/beta/categorias-servicio" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.SUPERVISOR]}><CategoriasServicio /></RutaProtegida>} />
        {/* Los permisos de navegación acompañan las autorizaciones del backend. */}
        <Route path="/alpha/clientes" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.ADMINISTRACION]}><ListadoFichas key="clientes" tipo="clientes" /></RutaProtegida>} />
        <Route path="/alpha/clientes/nuevo" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.ADMINISTRACION]}><EditorFicha key="clientes-nuevo" tipo="clientes" /></RutaProtegida>} />
        <Route path="/alpha/clientes/:id/editar" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.ADMINISTRACION]}><EditorFicha key="clientes-:id/editar" tipo="clientes" /></RutaProtegida>} />
        <Route path="/alpha/proveedores" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.ADMINISTRACION]}><ListadoFichas key="proveedores" tipo="proveedores" /></RutaProtegida>} />
        <Route path="/alpha/proveedores/:proveedor/documentos" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.ADMINISTRACION]}><DocumentosProveedor /></RutaProtegida>} />
        <Route path="/alpha/proveedores/:proveedor/documentos/:id/pagos" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.ADMINISTRACION]}><PagosDocumento /></RutaProtegida>} />
        <Route path="/alpha/proveedores/:proveedor/documentos/nuevo" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.ADMINISTRACION]}><EditorDocumentoProveedor /></RutaProtegida>} />
        <Route path="/alpha/proveedores/:proveedor/documentos/:id/editar" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.ADMINISTRACION]}><EditorDocumentoProveedor /></RutaProtegida>} />
        <Route path="/alpha/proveedores/:proveedor/documentos/:id/comprobante" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.ADMINISTRACION]}><ComprobanteDocumentoProveedor /></RutaProtegida>} />
        <Route path="/alpha/proveedores/nuevo" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.ADMINISTRACION]}><EditorFicha key="proveedores-nuevo" tipo="proveedores" /></RutaProtegida>} />
        <Route path="/alpha/proveedores/:id/editar" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.ADMINISTRACION]}><EditorFicha key="proveedores-:id/editar" tipo="proveedores" /></RutaProtegida>} />
        <Route path="/alpha/categorias" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.BODEGA]}><Fichas key="categorias" tipo="categorias" /></RutaProtegida>} />
        <Route path="/alpha/articulos" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.BODEGA]}><Articulos /></RutaProtegida>} />
        <Route path="/alpha/recepciones-compra" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.BODEGA]}><RecepcionesCompra /></RutaProtegida>} />
        <Route path="/alpha/recepciones-compra/:id" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.BODEGA]}><RecepcionesCompra /></RutaProtegida>} />
        <Route path="/alpha/articulos/nuevo" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.BODEGA]}><EditorArticulo key="nuevo" /></RutaProtegida>} />
        <Route path="/alpha/articulos/:id/editar" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.BODEGA]}><EditorArticulo key=":id/editar" /></RutaProtegida>} />
        <Route path="/alpha/articulos/:id/cardex" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.BODEGA]}><Cardex /></RutaProtegida>} />
        <Route path="/alpha/articulos/:id/movimientos" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.BODEGA]}><Cardex /></RutaProtegida>} />
        <Route path="/alpha/inventario-fisico" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.BODEGA]}><InventarioFisico /></RutaProtegida>} />
        <Route path="/alpha/inventario-fisico/:id" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.BODEGA]}><ConteoInventario /></RutaProtegida>} />
        <Route path="/admin/usuarios/nuevo" element={<RutaProtegida roles={[ROLES.ADMIN]}><CrearUsuario /></RutaProtegida>} />
        <Route
          path="/admin/usuarios"
          element={<RutaProtegida roles={[ROLES.ADMIN]}><Usuarios /></RutaProtegida>}
        />
        <Route
          path="/admin/auditoria"
          element={<RutaProtegida roles={[ROLES.ADMIN]}><Auditoria /></RutaProtegida>}
        />
      </Route>
      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  );
}
