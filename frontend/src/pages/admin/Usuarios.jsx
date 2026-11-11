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
    const [error, setError] = useState('');
    const [ok, setOk] = useState(location.state?.mensaje || '');

    // Se cargan los usuarios desde la API al montar el componente
    useEffect(() => {
        api('/api/usuarios').then(setUsuarios).catch((e) => setError(e.message));
    }, []);

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

            {error && <p>{error}</p>}
            {ok && <p>{ok}</p>}

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
        </div>
    );
}
