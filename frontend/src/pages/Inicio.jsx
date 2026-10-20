import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../roles';

// Página de inicio que se muestra después de iniciar sesión
export default function Inicio() {
    const { usuario } = useAuth();

    // Renderiza un saludo al usuario y, si es administrador, un enlace para gestionar usuarios
    // Permite diferenciar entre roles de usuario y mostrar contenido específico según el rol
    return (
        <div>
            <h1>Hola, {usuario.nombres}</h1>
            {usuario.rol === ROLES.ADMIN && <Link to="/admin/usuarios">Gestionar usuarios</Link>}
            {usuario.rol === ROLES.ADMIN && <Link to="/admin/auditoria">Gestionar auditoria</Link>}
        </div>
    );
}