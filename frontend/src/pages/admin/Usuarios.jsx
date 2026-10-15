import { useEffect, useState } from 'react';
import { api } from '../../api/cliente';

// Página de administración de usuarios que permite crear nuevos usuarios y listar los existentes

// Se utiliza un formulario para crear usuarios y una tabla para mostrar los usuarios existentes
const vacio = { rut: '', nombres: '', apellidos: '', email: '', password: '', id_rol: '' };

export default function Usuarios() {
    const [usuarios, setUsuarios] = useState([]);
    const [roles, setRoles] = useState([]);
    const [form, setForm] = useState(vacio);
    const [error, setError] = useState('');
    const [errores, setErrores] = useState({});
    const [ok, setOk] = useState('');

    // Se cargan los usuarios y roles desde la API al montar el componente
    useEffect(() => {
        api('/api/usuarios').then(setUsuarios).catch((e) => setError(e.message));
        api('/api/roles').then(setRoles).catch((e) => setError(e.message));
    }, []);

    // Función que actualiza el estado del formulario cuando el usuario escribe en los campos
    function cambiar(e) {
        setForm({ ...form, [e.target.name]: e.target.value });
    }

    async function crear(e) {
        e.preventDefault();
        setError('');
        setOk('');
        try {
            await api('/api/usuarios', {
                method: 'POST',
                body: { ...form, id_rol: Number(form.id_rol) },
            });
            setOk('Usuario creado');
            setForm(vacio);
            setUsuarios(await api('/api/usuarios'));   // refresca la tabla
        } catch (err) {
            setError(err.message);
            setErrores(err.errores || {});
        }
    }


    return (
        <div>
            <h2>Usuarios</h2>

            <form onSubmit={crear}>
                <input name="rut" placeholder="RUT (ej: 12345678-5)" value={form.rut} onChange={cambiar} required />
                {errores.rut && <small>{errores.rut}</small>}

                <input name="nombres" placeholder="Nombres" value={form.nombres} onChange={cambiar} required />
                {errores.nombres && <small>{errores.nombres}</small>}

                <input name="apellidos" placeholder="Apellidos" value={form.apellidos} onChange={cambiar} required />
                {errores.apellidos && <small>{errores.apellidos}</small>}

                <input name="email" type="email" placeholder="Correo" value={form.email} onChange={cambiar} required />
                {errores.email && <small>{errores.email}</small>}

                <input name="password" type="password" placeholder="Contraseña (mín. 8, letra y número)" value={form.password} onChange={cambiar} required minLength={8} />
                {errores.password && <small>{errores.password}</small>}

                <select name="id_rol" value={form.id_rol} onChange={cambiar} required>
                    <option value="">Selecciona un rol</option>
                    {roles.map((r) => (
                        <option key={r.id_rol} value={r.id_rol}>{r.nombre_rol}</option>
                    ))}
                </select>
                {errores.id_rol && <small>{errores.id_rol}</small>}

                <button type="submit">Crear usuario</button>
            </form>

            {error && <p>{error}</p>}
            {ok && <p>{ok}</p>}

            <table>
                <thead>
                    <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th></tr>
                </thead>
                <tbody>
                    {usuarios.map((u) => (
                        <tr key={u.id_usuario}>
                            <td>{u.nombres} {u.apellidos}</td>
                            <td>{u.email}</td>
                            <td>{u.rol}</td>
                            <td>{u.estado}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}