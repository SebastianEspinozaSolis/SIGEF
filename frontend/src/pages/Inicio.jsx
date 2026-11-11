import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../roles';
import AlertasInicio from '../components/AlertasInicio';
import './alpha/alpha.css';

// Página de inicio que se muestra después de iniciar sesión
export default function Inicio() {
    const { usuario } = useAuth();

    // Cada rol ve únicamente las entradas que puede utilizar.
    return (
        <section className="alpha">
            <h1>Hola, {usuario.nombres}</h1>
            {usuario.rol === ROLES.ADMIN && <Link to="/admin/usuarios">Gestionar usuarios</Link>}
            {usuario.rol === ROLES.ADMIN && <Link to="/admin/auditoria">Gestionar auditoria</Link>}
            <h2>Menú principal</h2>
            <nav className="alpha-menu" aria-label="Menú principal">
                {[ROLES.ADMIN, ROLES.BODEGA].includes(usuario.rol) &&
                    <Link to="/alpha/articulos"><strong>Artículos</strong><span>Catálogo, existencias y Cardex</span></Link>}
                {usuario.rol === ROLES.BODEGA && <Link to="/alpha/recepciones-compra"><strong>Recepción de compras</strong><span>Recibir materiales contra documentos de proveedores</span></Link>}
                {[ROLES.BODEGA, ROLES.ADMIN].includes(usuario.rol) &&
                    <Link to="/alpha/inventario-fisico"><strong>Inventario físico</strong><span>Crear conteos y consultar diferencias</span></Link>}
                {[ROLES.ADMIN, ROLES.ADMINISTRACION].includes(usuario.rol) && <>
                    <Link to="/alpha/clientes">Clientes</Link>
                    <Link to="/alpha/proveedores">Proveedores</Link>
                </>}
                {usuario.rol === ROLES.ADMINISTRACION && <>
                    <div className="alpha-menu-pendiente"><strong>Estadísticas</strong><span>Pendiente de implementación</span></div>
                    <div className="alpha-menu-pendiente"><strong>Presupuestos</strong><span>Pendiente de implementación</span></div>
                </>}
            </nav>
            <AlertasInicio rol={usuario.rol} />
        </section>
    );
}
