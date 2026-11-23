import { useState } from 'react';
import { prepararSesionTerreno } from '../utils/sesion';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../roles';
import AlertasInicio from '../components/AlertasInicio';
import './alpha/alpha.css';

// Página de inicio que se muestra después de iniciar sesión
export default function Inicio() {
    const { usuario } = useAuth();
    const [errorTerreno, setErrorTerreno] = useState('');
    function abrirTerreno(evento) {
        try {
            if (prepararSesionTerreno(usuario)) return;
            setErrorTerreno('Tu sesión no permite acceder a terreno. Vuelve a iniciar sesión.');
        } catch {
            setErrorTerreno('No se pudo preparar la sesión de terreno en este navegador.');
        }
        evento.preventDefault();
    }

    // Cada rol ve únicamente las entradas que puede utilizar.
    return (
        <section className="alpha">
            <h1>Hola, {usuario.nombres}</h1>
            {usuario.rol === ROLES.ADMIN && <Link to="/admin/usuarios">Gestionar usuarios</Link>}
            {usuario.rol === ROLES.ADMIN && <Link to="/admin/auditoria">Gestionar auditoria</Link>}
            <h2>Menú principal</h2>
            <nav className="alpha-menu" aria-label="Menú principal">
                {usuario.rol === ROLES.TECNICO && <Link to="/gamma/" onClick={abrirTerreno}>Portal de terreno</Link>}
                {[ROLES.ADMIN, ROLES.SUPERVISOR].includes(usuario.rol) && <>
                    <Link to="/beta/presupuestos">Presupuestos</Link>
                    <Link to="/beta/obras">Obras</Link>
                    <Link to="/beta/categorias-servicio">Categorías de servicio</Link>
                </>}
                {[ROLES.ADMIN, ROLES.BODEGA].includes(usuario.rol) &&
                    <Link to="/alpha/articulos"><strong>Artículos</strong><span>Catálogo, existencias y Cardex</span></Link>}
                {usuario.rol === ROLES.BODEGA && <Link to="/alpha/recepciones-compra"><strong>Recepción de compras</strong><span>Recibir materiales contra documentos de proveedores</span></Link>}
                {[ROLES.BODEGA, ROLES.ADMIN].includes(usuario.rol) &&
                    <Link to="/alpha/inventario-fisico"><strong>Inventario físico</strong><span>Crear conteos y consultar diferencias</span></Link>}
                {[ROLES.ADMIN, ROLES.ADMINISTRACION].includes(usuario.rol) && <>
                    <Link to="/beta/resumen"><strong>Resumen</strong><span>Indicadores, gráficos y alertas de gestión</span></Link>
                    <Link to="/alpha/clientes">Clientes</Link>
                    <Link to="/beta/facturas-clientes">Facturas de clientes</Link>
                    <Link to="/alpha/proveedores">Proveedores</Link>
                </>}
                {usuario.rol === ROLES.ADMINISTRACION && <>
                    <div className="alpha-menu-pendiente"><strong>Presupuestos</strong><span>Pendiente de implementación</span></div>
                </>}
            </nav>
            {errorTerreno && <p role="alert">{errorTerreno}</p>}
            <AlertasInicio rol={usuario.rol} />
        </section>
    );
}
