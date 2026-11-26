/*
 * Entrada a la creación o edición de un artículo: carga su ficha cuando hay un identificador.
 * Resuelve los errores de consulta y abre Articulos en modo formulario; los movimientos de stock tienen su propio flujo.
 */

import { useLocation, useParams } from 'react-router-dom';
import useRegistro from '../../hooks/useRegistro';
import ErrorCarga from '../../components/ErrorCarga';
import Articulos from './Articulos';

// La edición consulta por ID para funcionar también al recargar su URL.
export default function EditorArticulo() {
    const { id } = useParams();
    const location = useLocation();
    const { datos: registro, error, cargando, recargar } = useRegistro(id ? `/api/articulos/${id}` : null);
    if (id && cargando) return <p role="status">Cargando artículo…</p>;
    if (id && error) return <ErrorCarga error={error}
        noEncontrado="Artículo no encontrado." volver="/alpha/articulos" etiqueta="Volver al catálogo" estado={location.state?.retorno}
        reintentar={recargar} />;
    return <Articulos key={id || 'nuevo'} soloFormulario registroInicial={id ? registro : null} />;
}
