/*
 * Borrador de terreno: recupera y guarda el formulario en el dispositivo mientras se trabaja.
 * Conserva los cambios y comunica los fallos de guardado. Un borrador local todavía no significa que el servidor lo recibió.
 */

import { useEffect, useRef, useState } from 'react';
import { leerBorrador, guardarBorrador, borrarBorrador } from '../utils/gammaOffline';
const errorTexto = error => error?.message || 'No se pudo guardar el borrador.';

// Cada cambio se escribe en orden; cambiar de vista no elimina el borrador.
export default function useBorrador(usuarioId, clave, inicial) {
    const inicialRef = useRef(inicial);
    const [datos, setDatos] = useState(inicial);
    const [listo, setListo] = useState(false);
    const [error, setError] = useState('');
    const escrituras = useRef(Promise.resolve());
    useEffect(() => {
        let activo = true;
        leerBorrador(usuarioId, clave).then(valor => {
            if (activo) { setDatos(valor || inicialRef.current); setListo(true); }
        }).catch(err => { if (activo) setError(errorTexto(err)); });
        return () => { activo = false; };
    }, [usuarioId, clave]);
    function cambiar(nuevos) {
        setDatos(nuevos);
        escrituras.current = escrituras.current.catch(() => {}).then(() => guardarBorrador(usuarioId, clave, nuevos));
        escrituras.current.then(() => setError(''), err => setError(`No se guardó el borrador: ${errorTexto(err)}`));
    }
    async function limpiar() {
        await escrituras.current.catch(() => {});
        await borrarBorrador(usuarioId, clave);
        setDatos(inicialRef.current);
    }
    return { datos, cambiar, listo, error, limpiar };
}

