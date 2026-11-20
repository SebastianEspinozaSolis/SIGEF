import { lazy } from 'react'; // Lazy loading de componentes para optimizar la carga inicial de la aplicación
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

// Componente principal de la aplicación que define las rutas y la estructura de navegación
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Todo lo que está dentro exige sesión y comparte el Layout */}
      <Route element={<RutaProtegida><Layout /></RutaProtegida>}>
        <Route path="/" element={<Inicio />} />
        <Route path="/mi-cuenta/password" element={<CambiarPassword />} />
        {/* Los permisos de navegación acompañan las autorizaciones del backend. */}
        <Route path="/alpha/clientes" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.ADMINISTRACION]}><ListadoFichas key="clientes" tipo="clientes" /></RutaProtegida>} />
        <Route path="/alpha/clientes/nuevo" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.ADMINISTRACION]}><EditorFicha key="clientes-nuevo" tipo="clientes" /></RutaProtegida>} />
        <Route path="/alpha/clientes/:id/editar" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.ADMINISTRACION]}><EditorFicha key="clientes-:id/editar" tipo="clientes" /></RutaProtegida>} />
        <Route path="/alpha/proveedores" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.ADMINISTRACION]}><ListadoFichas key="proveedores" tipo="proveedores" /></RutaProtegida>} />
        <Route path="/alpha/proveedores/:proveedor/documentos" element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.ADMINISTRACION]}><DocumentosProveedor /></RutaProtegida>} />
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
