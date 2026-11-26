/*
 * Comunicación con el backend: envía consultas, formularios y solicitudes de descarga.
 * Añade la sesión correspondiente y convierte los errores en mensajes utilizables por las pantallas. Reutilízalo para nuevas llamadas.
 */

//Centraliza la API global para el frontend y el uso del token
//Permite ademas manejar los errores de manera centralizada y uniforme
import { API_URL } from '../config';
import { configuracionSesion } from '../utils/sesion';


export async function api(ruta, { method = 'GET', body, archivo = false, sesion } = {}) {
    const area = sesion || (ruta.startsWith('/api/gamma/') ? 'gamma' : configuracionSesion(window.location.pathname).area);
    const claveToken = area === 'gamma' ? 'gamma-token' : 'token';
    const token = localStorage.getItem(claveToken); //Comprueba si hay token

    //El token lo agrega a la cabecera de peticion 
    const res = await fetch(`${API_URL}${ruta}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            },
        body: body ? JSON.stringify(body) : undefined, // Solo agrega body JSON si hay contenido
    });

    if (archivo && res.ok) return res.blob();
    const data = await res.json().catch(() => ({})); // Evita errores si la respuesta no es JSON

    // Manejo de errores centralizado
    if (!res.ok) {
        if (res.status === 401 && token && ruta !== '/api/auth/login') { // Si el token es invalido o expiro, se elimina y se notifica al resto de la app
            localStorage.removeItem(claveToken); // Elimina token invalido
            window.dispatchEvent(new CustomEvent('sesion-invalida', { detail: { sesion: area } })); // Lleva al login
        }
        const error = new Error(data.mensaje || 'Error en la petición');
        error.status = res.status;
        error.errores = data.errores;
        throw error;
    }
    return data;
}

// Las descargas conservan el token y el mismo tratamiento de errores de la API.
export async function descargar(ruta, nombre) {
    const contenido = await api(ruta, { archivo: true });
    const url = URL.createObjectURL(contenido);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    try { enlace.click(); }
    finally { enlace.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
