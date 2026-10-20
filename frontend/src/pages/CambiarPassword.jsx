import { useState } from 'react';
import { api } from '../api/cliente';

// Página para cambiar la contraseña propia del usuario logueado
export default function CambiarPassword() {
    const [form, setForm] = useState({ passwordActual: '', passwordNueva: '', confirmacion: '' });
    const [mensaje, setMensaje] = useState('');
    const [guardando, setGuardando] = useState(false);

    // Envía la nueva contraseña al backend y muestra el mensaje de resultado
    async function enviar(e) {
        e.preventDefault();
        setMensaje('');
        if (form.passwordNueva !== form.confirmacion) {
            setMensaje('La confirmación no coincide');
            return;
        }
        if (new TextEncoder().encode(form.passwordNueva).length > 72) {
            setMensaje('La nueva contraseña supera los caracteres permitidos. Las tildes y emojis pueden ocupar más espacios.');
            return;
        }
        setGuardando(true);
        try {
            const data = await api('/api/auth/password', { method: 'PATCH', body: form });
            setForm({ passwordActual: '', passwordNueva: '', confirmacion: '' });
            setMensaje(data.mensaje);
        } catch (err) {
            setMensaje(err.message);
        } finally {
            setGuardando(false);
        }
    }

    return (
        <section>
            <h2>Cambiar mi contraseña</h2>
            <p>La nueva contraseña debe tener al menos 8 caracteres, una letra y un número, y no superar 72 bytes.</p>
            <form onSubmit={enviar}>
                <label>Contraseña actual
                    <input type="password" autoComplete="current-password" required maxLength={72}
                        value={form.passwordActual} onChange={(e) => setForm({ ...form, passwordActual: e.target.value })} />
                </label>
                <label>Nueva contraseña
                    <input type="password" autoComplete="new-password" required minLength={8} maxLength={72}
                        value={form.passwordNueva} onChange={(e) => setForm({ ...form, passwordNueva: e.target.value })} />
                </label>
                <label>Confirmar nueva contraseña
                    <input type="password" autoComplete="new-password" required minLength={8} maxLength={72}
                        value={form.confirmacion} onChange={(e) => setForm({ ...form, confirmacion: e.target.value })} />
                </label>
                <button disabled={guardando}>{guardando ? 'Guardando...' : 'Cambiar contraseña'}</button>
            </form>
            <p role="status">{mensaje}</p>
        </section>
    );
}
