import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RutaProtegida({ roles, children }) {
    const { usuario, cargando } = useAuth();

    if (cargando) return <p>Cargando...</p>; // evita que la app se muestre mientras se valida el token
    if (!usuario) return <Navigate to="/login" replace />; // si no hay usuario logeado redirige a login
    if (roles && !roles.includes(usuario.rol)) return <Navigate to="/" replace />; // si el usuario no tiene el rol requerido redirige al inicio

    return children; // si el usuario esta logeado y tiene el rol requerido, renderiza el componente
}