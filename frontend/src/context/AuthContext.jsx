import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useIdleTimer } from 'react-idle-timer';
import { api } from '../api/cliente';
// Globaliza el estado de autenticacion para el resto de la app

// informacion de la sesion del usuario logeado
const AuthContext = createContext(null);

// Tiempo sin actividad permitido en el ERP web: 20 minutos en milisegundos
const TIEMPO_INACTIVIDAD = 20 * 60 * 1000;
const AVISO_INACTIVIDAD = 'Tu sesión se cerró por inactividad. Vuelve a iniciar sesión.';

export function AuthProvider({ children }) {
    const [usuario, setUsuario] = useState(null); // Guarda infromacion del usuario logeado
    const [cargando, setCargando] = useState(true); // inicia cargando para no pestañear la app mientras se valida el token
    const [mensajeSesion, setMensajeSesion] = useState('');

    // Borra la sesion local. useCallback mantiene estable la funcion entre renders
    const logout = useCallback((mensaje = '') => {
        localStorage.removeItem('token');
        // Solo acepta mensajes de texto: un boton tambien puede pasar un evento al llamar logout
        setMensajeSesion(typeof mensaje === 'string' ? mensaje : '');
        setUsuario(null);
    }, []);

    // La libreria detecta actividad humana; las consultas automaticas no reinician el tiempo
    const { getRemainingTime } = useIdleTimer({
        timeout: TIEMPO_INACTIVIDAD,
        onIdle: () => logout(AVISO_INACTIVIDAD),
        disabled: cargando || !usuario, // No cuenta tiempo en la pantalla de login
        crossTab: true, // Comparte la actividad entre pestañas del mismo sitio y navegador
        syncTimers: 200,
        name: 'sigef-erp-inactividad',
        stopOnIdle: true,
        // Volver a una pestaña no cuenta por si solo como una nueva interaccion
        events: ['mousemove', 'keydown', 'wheel', 'mousedown', 'touchstart', 'touchmove'],
    });

    // Comprueba el vencimiento al volver: el navegador puede retrasar timers en segundo plano
    useEffect(() => {
        if (!usuario || cargando) return;
        const comprobar = () => {
            if (document.visibilityState === 'visible' && getRemainingTime() <= 0) {
                logout(AVISO_INACTIVIDAD);
            }
        };
        window.addEventListener('focus', comprobar);
        document.addEventListener('visibilitychange', comprobar);
        return () => {
            window.removeEventListener('focus', comprobar);
            document.removeEventListener('visibilitychange', comprobar);
        };
    }, [usuario, cargando, getRemainingTime, logout]);

    // Si otra pestaña borra el token, esta tambien deja de mostrar la sesion abierta
    useEffect(() => {
        const sincronizar = (e) => {
            if ((e.key === 'token' || e.key === null) && !localStorage.getItem('token')) {
                setUsuario(null);
                setMensajeSesion('La sesión se cerró en otra pestaña. Vuelve a iniciar sesión.');
            }
        };
        window.addEventListener('storage', sincronizar);
        return () => window.removeEventListener('storage', sincronizar);
    }, []);

    // Escucha evento de sesion invalida para cerrar sesion desde cualquier parte de la app
    // y lleva a Login
    useEffect(() => {
        const cerrar = () => setUsuario(null);
        window.addEventListener('sesion-invalida', cerrar);
        return () => window.removeEventListener('sesion-invalida', cerrar);
    }, []);

    // Al abrir la app valida token, comprueba identidad y validez
    // cambia a cargando false cuando termina, para que la app se muestre
    useEffect(() => {
        if (!localStorage.getItem('token')) {
            setCargando(false);
            return;
        }
        api('/api/auth/me')
        .then(setUsuario)
        .catch((err) => {
            if (err.status === 401) localStorage.removeItem('token');
        })
        .finally(() => setCargando(false));
    }, []);

    // Maneja el login, guarda token y usuario en estado global
    async function login(email, password) {
        const data = await api('/api/auth/login', { method: 'POST', body: { email, password } });
        localStorage.setItem('token', data.token);
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
