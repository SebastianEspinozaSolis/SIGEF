/*
 * Inicio de sesión del ERP mediante las credenciales del usuario.
 * Muestra los errores de acceso y, al entrar, permite continuar hacia las pantallas autorizadas.
 */

import { useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Página de login que permite a los usuarios autenticarse en la aplicación
export default function Login({ terreno = false }) {
    const { usuario, login, mensajeSesion } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [ingresando, setIngresando] = useState(false);
    const envioEnCurso = useRef(false);

    // Si ya hay sesión, no tiene sentido ver el login
    if (usuario) return <Navigate to={terreno ? '/gamma/' : '/'} replace />;

    async function enviar(e) {
        e.preventDefault();
        if (envioEnCurso.current) return;
        envioEnCurso.current = true;
        setIngresando(true);
        setError('');
        try {
            await login(email, password);   // al guardar el usuario, la línea de arriba redirige sola
        } catch (err) {
            setError(err.message);
        } finally {
            envioEnCurso.current = false;
            setIngresando(false);
        }
    }

    // Renderiza el formulario de login con campos para correo y contraseña, y un botón para enviar
    return (
        <form onSubmit={enviar}>
            <h1>{terreno ? 'SIGEF · Terreno' : 'SIGEF'}</h1>
            {mensajeSesion && <p role="status">{mensajeSesion}</p>}
            <input type="email" maxLength={120} placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input type="password" maxLength={72} placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="submit" disabled={ingresando}>{ingresando ? 'Ingresando…' : 'Entrar'}</button>
            {error && <p>{error}</p>}
            <p><Link to={terreno ? '/login' : '/gamma/login'}>{terreno ? 'Acceso ERP' : 'Acceso técnicos'}</Link></p>
        </form>
    );
}
