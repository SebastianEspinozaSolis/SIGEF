//Centraliza la API global para el frontend y el uso del token
//Permite ademas manejar los errores de manera centralizada y uniforme
import { API_URL } from '../config';


export async function api(ruta, { method = 'GET', body } = {}) {
    const token = localStorage.getItem('token'); //Comprueba si hay token

    //El token lo agrega a la cabecera de peticion 
    const res = await fetch(`${API_URL}${ruta}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            },
        body: body ? JSON.stringify(body) : undefined, // Solo agrega body JSON si hay contenido
    });

    const data = await res.json().catch(() => ({})); // Evita errores si la respuesta no es JSON

    // Manejo de errores centralizado
    if (!res.ok) {
        const error = new Error(data.mensaje || 'Error en la petición');
        error.status = res.status;
        error.errores = data.errores;
        throw error;
    }
    return data;
}