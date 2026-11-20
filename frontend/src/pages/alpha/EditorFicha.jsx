import { useLocation, useParams } from 'react-router-dom';
import useRegistro from '../../hooks/useRegistro';
import ErrorCarga from '../../components/ErrorCarga';
import Fichas from './Fichas';

// Consulta la ficha por ID para permitir recargar o abrir directamente su edición.
export default function EditorFicha({ tipo }) {
    const { id } = useParams();
    const location = useLocation();
    const { datos: registro, error, cargando, recargar } = useRegistro(id ? `/api/${tipo}/${id}` : null);
    if (id && cargando) return <p role="status">Cargando ficha…</p>;
    if (id && error) return <ErrorCarga error={error}
        noEncontrado={tipo === 'clientes' ? 'Cliente no encontrado.' : 'Proveedor no encontrado.'} volver={`/alpha/${tipo}${location.search}`} etiqueta="Volver al listado"
        reintentar={recargar} />;
    return <Fichas key={`${tipo}-${id || 'nuevo'}`} tipo={tipo} soloFormulario registroInicial={id ? registro : null} />;
}
