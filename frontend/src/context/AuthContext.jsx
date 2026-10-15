import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/cliente';
// Globaliza el estado de autenticacion para el resto de la app

// informacion de la sesion del usuario logeado
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [usuario, setUsuario] = useState(null); // Guarda infromacion del usuario logeado
    const [cargando, setCargando] = useState(true); // inicia cargando para no pestañear la app mientras se valida el token

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
        setUsuario(data.usuario);
    }

    // Maneja el logout, borra token y usuario del estado global
    function logout() {
        localStorage.removeItem('token');
        setUsuario(null);
    }

    // Provee el estado de autenticacion y funciones de login/logout a los componentes hijos
    return (
        <AuthContext.Provider value={{ usuario, cargando, login, logout }}>
        {children}
        </AuthContext.Provider>
    );
}

// uso de componentes mas comodos para acceder al contexto de autenticacion
export function useAuth() {
    return useContext(AuthContext);
}