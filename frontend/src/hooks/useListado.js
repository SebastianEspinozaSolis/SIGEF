/*
 * Consulta reutilizable para listados con búsqueda y páginas.
 * Al buscar vuelve a la primera página; cada pantalla decide cómo dibujar los registros recibidos.
 */

import { useState } from 'react';
import useRegistro from './useRegistro';

// Comparte la consulta paginada; cada pantalla conserva su selector o tabla.
export default function useListado(ruta) {
    const [q, setBusqueda] = useState('');
    const [pagina, setPagina] = useState(1);
    const parametros = new URLSearchParams({ q, pagina });
    const consulta = useRegistro(`${ruta}${ruta.includes('?') ? '&' : '?'}${parametros}`, 250);

    function buscar(valor) {
        setBusqueda(valor);
        setPagina(1);
    }

    return { ...consulta, q, buscar, pagina, setPagina };
}
