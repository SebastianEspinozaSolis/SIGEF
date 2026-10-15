import { Routes, Route } from 'react-router-dom'; // Rutas y rutas hijas
import Login from './pages/Login'; // Página de login
import Inicio from './pages/Inicio'; // Página de inicio
import Usuarios from './pages/admin/Usuarios'; // Página de administración de usuarios
import RutaProtegida from './components/RutaProtegida'; // Componente que protege rutas según sesión y roles
import Layout from './components/Layout'; // Componente de layout que envuelve las páginas protegidas
import { ROLES } from './roles'; // Constantes de roles de usuario

// Componente principal de la aplicación que define las rutas y la estructura de navegación
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Todo lo que está dentro exige sesión y comparte el Layout */}
      <Route element={<RutaProtegida><Layout /></RutaProtegida>}>
        <Route path="/" element={<Inicio />} />
        <Route
          path="/admin/usuarios"
          element={<RutaProtegida roles={[ROLES.ADMIN]}><Usuarios /></RutaProtegida>}
        />
      </Route>
    </Routes>
  );
}