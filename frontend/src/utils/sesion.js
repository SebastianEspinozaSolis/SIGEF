/*
 * Reglas compartidas de sesión entre ERP y terreno, incluido el acceso del técnico desde el ERP.
 * El cierre voluntario elimina las credenciales de ambas áreas y conserva los datos locales de trabajo; el backend verifica la validez del token.
 */

import { ROLES } from '../roles.js';

// El cierre voluntario elimina credenciales de ambas áreas, conservando los datos de trabajo.
export function cerrarSesiones(almacenamiento = globalThis.localStorage) {
    for (const clave of ['token', 'token-usuario', 'gamma-token', 'gamma-token-usuario']) {
        almacenamiento.removeItem(clave);
    }
}

export function configuracionSesion(pathname) {
    const terreno = pathname === '/gamma' || pathname.startsWith('/gamma/');
    return { area: terreno ? 'gamma' : 'erp', inactividad: !terreno, claveToken: terreno ? 'gamma-token' : 'token' };
}

// Solo comprueba identidad y vencimiento locales; el servidor verifica la firma del JWT.
export function identidadToken(token, ahora = Date.now()) {
    try {
        const parte = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const bytes = Uint8Array.from(atob(parte), caracter => caracter.charCodeAt(0));
        const identidad = JSON.parse(new TextDecoder().decode(bytes));
        if (!Number.isSafeInteger(identidad.id_usuario) || identidad.id_usuario <= 0
            || !Number.isFinite(identidad.exp) || identidad.exp * 1000 <= ahora) return null;
        return identidad;
    } catch { return null; }
}


// Solo prepara el acceso solicitado desde el ERP; Gamma vuelve a validar el token con la API.
export function prepararSesionTerreno(usuario, almacenamiento = globalThis.localStorage, ahora = Date.now()) {
    const token = almacenamiento.getItem('token');
    const identidad = identidadToken(token, ahora);
    if (usuario?.rol !== ROLES.TECNICO || !identidad || identidad.rol !== ROLES.TECNICO
        || identidad.id_usuario !== usuario.id_usuario) return false;
    const actual = identidadToken(almacenamiento.getItem('gamma-token'), ahora);
    const conservar = actual?.id_usuario === usuario.id_usuario && actual.rol === ROLES.TECNICO;
    almacenamiento.setItem('gamma-token-usuario', JSON.stringify(usuario));
    if (!conservar) almacenamiento.setItem('gamma-token', token);
    return true;
}
