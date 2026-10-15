import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Página de login que permite a los usuarios autenticarse en la aplicación
export default function Login() {
    const { usuario, login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    // Si ya hay sesión, no tiene sentido ver el login
    if (usuario) return <Navigate to="/" replace />;

    async function enviar(e) {
        e.preventDefault();
        setError('');
        try {
            await login(email, password);   // al guardar el usuario, la línea de arriba redirige sola
        } catch (err) {
            setError(err.message);
        }
    }

    // Renderiza el formulario de login con campos para correo y contraseña, y un botón para enviar
    return (
        <form onSubmit={enviar}>
            <h1>SIGEF</h1>
            <input type="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="submit">Entrar</button>
            {error && <p>{error}</p>}
        </form>
    );
}