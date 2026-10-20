import { Link, Outlet } from 'react-router-dom'; // Componente que permite renderizar rutas hijas dentro de un layout
import { useAuth } from '../context/AuthContext';

// Componente plantilla que se muestra en las rutas para usuarios logeados
// Muestra el header con el nombre del usuario y un boton de logout
export default function Layout() {
    const { usuario, logout } = useAuth();

    return (
        <div>
            <header>
                {/* El inicio muestra las opciones correspondientes al rol del usuario */}
                <Link to="/" aria-label="Ir al menú principal"><strong>SIGEF</strong></Link> — {usuario.nombres} {usuario.apellidos} ({usuario.rol})
                {/* Para cambiar contraseña */}
                <Link to="/mi-cuenta/password">Cambiar mi contraseña</Link>
                <button onClick={logout}>Cerrar sesión</button>
            </header>
            <main>
                <Outlet />
            </main>
        </div>
    );
}
