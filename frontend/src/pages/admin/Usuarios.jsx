/*
 * Listado de usuarios para administración: muestra sus cuentas y permite activarlas o inactivarlas.
 * La creación tiene un formulario separado; este listado consulta la API y permite reintentar si falla la carga.
 */

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../../api/cliente';
import { useAuth } from '../../context/AuthContext';

// Listado de usuarios y acciones de estado existentes.

export default function Usuarios() {
    const { usuario } = useAuth();
    const location = useLocation();
    const [cambiandoEstado, setCambiandoEstado] = useState(null);
    const [usuarios, setUsuarios] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [errorListado, setErrorListado] = useState('');
    const [version, setVersion] = useState(0);
    const [error, setError] = useState('');
    const [ok, setOk] = useState(location.state?.mensaje || '');

    // Se cargan los usuarios desde la API al montar el componente
    useEffect(() => {
        let vigente = true;
        api('/api/usuarios')
            .then((datos) => { if (vigente) { setUsuarios(datos); setErrorListado(''); } })
            .catch((e) => { if (vigente) setErrorListado(e.message); })
            .finally(() => { if (vigente) setCargando(false); });
        return () => { vigente = false; };
    }, [version]);

    // Permite cambiar el estado de un usuario (Activo/Inactivo) mediante un PATCH a la API
    async function cambiarEstado(u) {
        setError('');
        setOk('');
        setCambiandoEstado(u.id_usuario);
        try {
            const actualizado = await api(`/api/usuarios/${u.id_usuario}/estado`, {
                method: 'PATCH', body: { estado: u.estado === 'Activo' ? 'Inactivo' : 'Activo' },
            });
            setUsuarios((lista) => lista.map((item) => item.id_usuario === u.id_usuario
                ? { ...item, estado: actualizado.estado } : item));
            setOk('Estado actualizado');
        } catch (err) {
            setError(err.message);
        } finally {
            setCambiandoEstado(null);
        }
    }

    return (
        <div>
            <h2>Usuarios</h2>

            <Link to="/admin/usuarios/nuevo">Nuevo usuario</Link>

            {error && <p role="alert">{error}</p>}
            {ok && <p role="status">{ok}</p>}
            {errorListado && <p role="alert">No se pudo cargar el listado: {errorListado}
                <button type="button" onClick={() => { setCargando(true); setErrorListado(''); setVersion((v) => v + 1); }}>Reintentar</button>
            </p>}
            {cargando && <p role="status">Cargando usuarios…</p>}

            {!cargando && !errorListado && <>
            <table>
                <thead>
                    <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                    {usuarios.map((u) => (
                        <tr key={u.id_usuario}>
                            <td>{u.nombres} {u.apellidos}</td>
                            <td>{u.email}</td>
                            <td>{u.rol}</td>
                            <td>{u.estado}</td>
                            <td><button type="button" disabled={cambiandoEstado !== null || u.id_usuario === usuario.id_usuario} // boton que permite cambiar el estado del usuario
                                onClick={() => cambiarEstado(u)}>
                                {u.estado === 'Activo' ? 'Desactivar' : 'Activar'}
                            </button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {!usuarios.length && <p>No hay usuarios para mostrar.</p>}
            </>}
        </div>
    );
}
