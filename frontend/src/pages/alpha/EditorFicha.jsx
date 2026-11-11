import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../../api/cliente';
import Fichas from './Fichas';

// Consulta la ficha por ID para permitir recargar o abrir directamente su edición.
export default function EditorFicha({ tipo }) {
    const { id } = useParams();
    const location = useLocation();
    const [resultado, setResultado] = useState(null);
    const [version, setVersion] = useState(0);
    useEffect(() => {
        if (!id) return;
        let vigente = true;
        api(`/api/${tipo}/${id}`)
            .then((registro) => { if (vigente) setResultado({ id, version, registro }); })
            .catch((err) => { if (vigente) setResultado({ id, version, error: err.message }); });
        return () => { vigente = false; };
    }, [tipo, id, version]);
    if (id && (resultado?.id !== id || resultado?.version !== version)) return <p role="status">Cargando ficha…</p>;
    if (id && resultado.error) return <section>
        <p role="alert">{resultado.error}</p>
        <button onClick={() => setVersion((v) => v + 1)}>Reintentar</button>
        <Link to={`/alpha/${tipo}${location.search}`}>Volver al listado</Link>
    </section>;
    return <Fichas key={`${tipo}-${id || 'nuevo'}`} tipo={tipo} soloFormulario registroInicial={id ? resultado.registro : null} />;
}
