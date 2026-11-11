import { Suspense } from 'react';
import { Link, Outlet } from 'react-router-dom'; // Componente que permite renderizar rutas hijas dentro de un layout
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo-fyag.png';

// Componente plantilla que se muestra en las rutas para usuarios logeados
// Muestra el header con el nombre del usuario y un boton de logout
export default function Layout() {
    const { usuario, logout } = useAuth();

    return (
        <div>
            <header className="erp-encabezado">
                {/* El inicio muestra las opciones correspondientes al rol del usuario */}
                <Link to="/" aria-label="Ir al menú principal">
                    <img src={logo} alt="Frío y Agroindustria" style={{ height: 56, maxWidth: '100%', objectFit: 'contain', verticalAlign: 'middle' }} />
                </Link> — {usuario.nombres} {usuario.apellidos} ({usuario.rol})
                {/* Para cambiar contraseña */}
                <Link to="/mi-cuenta/password">Cambiar mi contraseña</Link>
                <button onClick={logout}>Cerrar sesión</button>
            </header>
            <main>
                {/* Conserva la cabecera mientras se descarga la pantalla solicitada. */}
                <Suspense fallback={<p role="status">Cargando pantalla…</p>}>
                    <Outlet />
                </Suspense>
            </main>
        </div>
    );
}
