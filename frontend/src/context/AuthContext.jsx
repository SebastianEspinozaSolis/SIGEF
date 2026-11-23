import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useIdleTimer } from 'react-idle-timer';
import { useLocation } from 'react-router-dom';
import { api } from '../api/cliente';
import { cerrarSesiones, configuracionSesion, identidadToken } from '../utils/sesion';
import { ROLES } from '../roles';
import { prepararPwaGamma } from '../utils/gammaPwa';
// Globaliza el estado de autenticacion para el resto de la app

// informacion de la sesion del usuario logeado
const AuthContext = createContext(null);

// Tiempo sin actividad permitido en el ERP web: 40 minutos en milisegundos
const TIEMPO_INACTIVIDAD = 40 * 60 * 1000;
const AVISO_INACTIVIDAD = 'Tu sesión se cerró por inactividad. Vuelve a iniciar sesión.';

export function AuthProvider({ children }) {
    const { pathname } = useLocation();
    const configuracion = configuracionSesion(pathname);
    return <ProveedorSesion key={configuracion.area} configuracion={configuracion}>{children}</ProveedorSesion>;
}

function ProveedorSesion({ children, configuracion }) {
    const { area, claveToken, inactividad } = configuracion;
    const claveUsuario = `${claveToken}-usuario`;
    useEffect(() => { if (area === 'gamma') return prepararPwaGamma(); }, [area]);
    const [usuario, setUsuario] = useState(null); // Guarda infromacion del usuario logeado
    const [cargando, setCargando] = useState(true); // inicia cargando para no pestañear la app mientras se valida el token
    const [mensajeSesion, setMensajeSesion] = useState('');

    // Borra la sesion local. useCallback mantiene estable la funcion entre renders
    const cerrarSesionActual = useCallback((mensaje = '') => {
        localStorage.removeItem(claveToken);
        localStorage.removeItem(claveUsuario);
        // Solo acepta mensajes de texto: un boton tambien puede pasar un evento al llamar logout
        setMensajeSesion(typeof mensaje === 'string' ? mensaje : '');
        setUsuario(null);
    }, [claveToken, claveUsuario]);

    // Solo el cierre voluntario afecta al ERP y a Gamma; los vencimientos siguen separados.
    const logout = useCallback(() => {
        cerrarSesiones();
        cerrarSesionActual();
    }, [cerrarSesionActual]);

    // La libreria detecta actividad humana; las consultas automaticas no reinician el tiempo
    const { getRemainingTime } = useIdleTimer({
        timeout: TIEMPO_INACTIVIDAD,
        onIdle: () => cerrarSesionActual(AVISO_INACTIVIDAD),
        disabled: !inactividad || cargando || !usuario, // Gamma conserva la vigencia del JWT.
        crossTab: true, // Comparte la actividad entre pestañas del mismo sitio y navegador
        syncTimers: 200,
        name: 'sigef-erp-inactividad',
        stopOnIdle: true,
        // Volver a una pestaña no cuenta por si solo como una nueva interaccion
        events: ['mousemove', 'keydown', 'wheel', 'mousedown', 'touchstart', 'touchmove'],
    });

    // Comprueba el vencimiento al volver: el navegador puede retrasar timers en segundo plano
    useEffect(() => {
        if (!inactividad || !usuario || cargando) return;
        const comprobar = () => {
            if (document.visibilityState === 'visible' && getRemainingTime() <= 0) {
                cerrarSesionActual(AVISO_INACTIVIDAD);
            }
        };
        window.addEventListener('focus', comprobar);
        document.addEventListener('visibilitychange', comprobar);
        return () => {
            window.removeEventListener('focus', comprobar);
            document.removeEventListener('visibilitychange', comprobar);
        };
    }, [usuario, cargando, getRemainingTime, cerrarSesionActual, inactividad]);

    useEffect(() => {
        if (area !== 'gamma' || !usuario) return;
        const comprobar = () => {
            const actual = identidadToken(localStorage.getItem(claveToken));
            if (!actual) cerrarSesionActual('Tu sesión venció. Vuelve a iniciar sesión para sincronizar.');
            else if (actual.id_usuario !== usuario.id_usuario) {
                setUsuario(null);
                setMensajeSesion('La sesión cambió en otra pestaña. Vuelve a iniciar sesión.');
            }
        };
        const identidad = identidadToken(localStorage.getItem(claveToken));
        if (!identidad) { comprobar(); return; }
        const temporizador = setTimeout(comprobar, Math.min(identidad.exp * 1000 - Date.now() + 100, 2147483647));
        window.addEventListener('focus', comprobar);
        document.addEventListener('visibilitychange', comprobar);
        return () => {
            clearTimeout(temporizador);
            window.removeEventListener('focus', comprobar);
            document.removeEventListener('visibilitychange', comprobar);
        };
    }, [area, usuario, claveToken, cerrarSesionActual]);

    // Si otra pestaña borra el token, esta tambien deja de mostrar la sesion abierta
    useEffect(() => {
        const sincronizar = (e) => {
            if (area === 'gamma' && e.key === claveToken && e.oldValue !== e.newValue) {
                setUsuario(null);
                setMensajeSesion('La sesión cambió en otra pestaña. Vuelve a iniciar sesión.');
                return;
            }
            if ((e.key === claveToken || e.key === null) && !localStorage.getItem(claveToken)) {
                setUsuario(null);
                setMensajeSesion('La sesión se cerró en otra pestaña. Vuelve a iniciar sesión.');
            }
        };
        window.addEventListener('storage', sincronizar);
        return () => window.removeEventListener('storage', sincronizar);
    }, [claveToken, area]);

    // Escucha evento de sesion invalida para cerrar sesion desde cualquier parte de la app
    // y lleva a Login
    useEffect(() => {
        const cerrar = (evento) => {
            if ((evento.detail?.sesion || 'erp') === area) {
                localStorage.removeItem(claveUsuario);
                setUsuario(null);
            }
        };
        window.addEventListener('sesion-invalida', cerrar);
        return () => window.removeEventListener('sesion-invalida', cerrar);
    }, [area, claveUsuario]);

    // Al abrir la app valida token, comprueba identidad y validez
    // cambia a cargando false cuando termina, para que la app se muestre
    useEffect(() => {
        let vigente = true;
        const token = localStorage.getItem(claveToken);
        if (!token) {
            setCargando(false);
            return;
        }
        api('/api/auth/me', { sesion: area })
        .then((datos) => {
            if (!vigente || localStorage.getItem(claveToken) !== token) return;
            if (area === 'gamma' && datos.rol !== ROLES.TECNICO) { cerrarSesionActual(); return; }
            localStorage.setItem(claveUsuario, JSON.stringify(datos));
            setUsuario(datos);
        })
        .catch((err) => {
            if (!vigente || localStorage.getItem(claveToken) !== token) return;
            if (err.status === 401) cerrarSesionActual();
            // Sin conexión, permite continuar únicamente la sesión de terreno ya verificada.
            if (area === 'gamma' && !err.status) {
                try {
                    const identidad = identidadToken(token);
                    const guardado = JSON.parse(localStorage.getItem(claveUsuario));
                    if (identidad && guardado?.id_usuario === identidad.id_usuario && guardado.rol === ROLES.TECNICO) setUsuario(guardado);
                } catch { /* Sin identidad local válida se conserva el login. */ }
            }
        })
        .finally(() => { if (vigente) setCargando(false); });
        return () => { vigente = false; };
    }, [area, claveToken, claveUsuario, cerrarSesionActual]);

    // Maneja el login, guarda token y usuario en estado global
    async function login(email, password) {
        const data = await api('/api/auth/login', { method: 'POST', body: { email, password }, sesion: area });
        if (area === 'gamma' && data.usuario.rol !== ROLES.TECNICO) throw new Error('Este acceso está reservado a técnicos.');
        localStorage.setItem(claveToken, data.token);
        localStorage.setItem(claveUsuario, JSON.stringify(data.usuario));
        setMensajeSesion('');
        setUsuario(data.usuario);
    }

    // Provee el estado de autenticacion y funciones de login/logout a los componentes hijos
    return (
        <AuthContext.Provider value={{ usuario, cargando, login, logout, mensajeSesion }}>
        {children}
        </AuthContext.Provider>
    );
}

// uso de componentes mas comodos para acceder al contexto de autenticacion
export function useAuth() {
    return useContext(AuthContext);
}
