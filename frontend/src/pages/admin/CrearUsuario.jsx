import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/cliente';

const vacio = { rut: '', nombres: '', apellidos: '', email: '', password: '', id_rol: '' };

// La creación conserva los campos y validaciones del formulario original.
export default function CrearUsuario() {
    const navigate = useNavigate();
    const [form, setForm] = useState(vacio);
    const [roles, setRoles] = useState([]);
    const [errorRoles, setErrorRoles] = useState('');
    const [version, setVersion] = useState(0);
    const [error, setError] = useState('');
    const [errores, setErrores] = useState({});
    const [guardando, setGuardando] = useState(false);
    useEffect(() => {
        let vigente = true;
        api('/api/roles')
            .then((lista) => { if (vigente) { setRoles(lista); setErrorRoles(''); } })
            .catch((err) => { if (vigente) setErrorRoles(err.message); });
        return () => { vigente = false; };
    }, [version]);
    function cambiar(e) {
        setForm((anterior) => ({ ...anterior, [e.target.name]: e.target.value }));
    }
    async function crear(e) {
        e.preventDefault();
        setError('');
        setErrores({});
        setGuardando(true);
        try {
            await api('/api/usuarios', {
                method: 'POST',
                body: { ...form, id_rol: Number(form.id_rol) },
            });
            navigate('/admin/usuarios', { state: { mensaje: 'Usuario creado' } });
        } catch (err) {
            setError(err.message);
            setErrores(err.errores || {});
        } finally {
            setGuardando(false);
        }
    }
    return <section>
        <h2>Crear usuario</h2>
        {errorRoles && <p role="alert">No se pudieron cargar los roles: {errorRoles}
            <button type="button" onClick={() => setVersion((v) => v + 1)}>Reintentar</button></p>}
            <form onSubmit={crear}>
                <fieldset disabled={guardando || !roles.length || Boolean(errorRoles)}>
                <input name="rut" maxLength={12} placeholder="RUT (ej: 12345678-5)" value={form.rut} onChange={cambiar} required />
                {errores.rut && <small>{errores.rut}</small>}

                <input name="nombres" maxLength={80} placeholder="Nombres" value={form.nombres} onChange={cambiar} required />
                {errores.nombres && <small>{errores.nombres}</small>}

                <input name="apellidos" maxLength={80} placeholder="Apellidos" value={form.apellidos} onChange={cambiar} required />
                {errores.apellidos && <small>{errores.apellidos}</small>}

                <input name="email" type="email" maxLength={120} placeholder="Correo" value={form.email} onChange={cambiar} required />
                {errores.email && <small>{errores.email}</small>}

                <input autoComplete="new-password" name="password" type="password" maxLength={72} placeholder="Contraseña (mín. 8, letra y número)" value={form.password} onChange={cambiar} required minLength={8} />
                {errores.password && <small>{errores.password}</small>}

                <select name="id_rol" value={form.id_rol} onChange={cambiar} required>
                    <option value="">Selecciona un rol</option>
                    {roles.map((r) => (
                        <option key={r.id_rol} value={r.id_rol}>{r.nombre_rol}</option>
                    ))}
                </select>
                {errores.id_rol && <small>{errores.id_rol}</small>}

                <button type="submit">{guardando ? 'Creando…' : 'Crear usuario'}</button>
                </fieldset>
            </form>


        {error && <p role="alert">{error}</p>}
        {!guardando && <Link to="/admin/usuarios">Volver al listado</Link>}
    </section>;
}
