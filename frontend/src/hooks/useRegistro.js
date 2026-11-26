/*
 * Consulta reutilizable para cargar datos de una dirección del backend.
 * Entrega datos, estado de carga, error y reintento; evita mostrar respuestas antiguas si cambia la consulta.
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/cliente';

// Una ruta nula desactiva la consulta, por ejemplo al abrir un formulario nuevo.
export default function useRegistro(ruta, espera = 0) {
    const [resultado, setResultado] = useState(null);
    const [version, setVersion] = useState(0);
    const recargar = useCallback(() => setVersion((v) => v + 1), []);

    useEffect(() => {
        if (!ruta) return;
        let vigente = true;
        const cargar = () => api(ruta)
            .then((datos) => { if (vigente) setResultado({ ruta, version, datos }); })
            .catch((error) => { if (vigente) setResultado({ ruta, version, error }); });
        const temporizador = espera > 0 ? setTimeout(cargar, espera) : null;
        if (espera === 0) cargar();
        return () => { vigente = false; clearTimeout(temporizador); };
    }, [ruta, version, espera]);

    const vigente = Boolean(ruta) && resultado?.ruta === ruta && resultado?.version === version;
    return {
        datos: vigente ? resultado.datos ?? null : null,
        error: vigente ? resultado.error ?? null : null,
        cargando: Boolean(ruta) && !vigente,
        recargar,
    };
}
