import { Outlet } from 'react-router-dom'; // Componente que permite renderizar rutas hijas dentro de un layout
import { useAuth } from '../context/AuthContext';

// Componente plantilla que se muestra en las rutas para usuarios logeados
// Muestra el header con el nombre del usuario y un boton de logout
export default function Layout() {
    const { usuario, logout } = useAuth();

    return (
        <div>
            <header>
                <strong>SIGEF</strong> — {usuario.nombres} {usuario.apellidos} ({usuario.rol})
                <button onClick={logout}>Cerrar sesión</button>
            </header>
            <main>
                <Outlet />
            </main>
        </div>
    );
}