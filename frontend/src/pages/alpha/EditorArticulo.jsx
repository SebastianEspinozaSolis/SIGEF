import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../../api/cliente';
import Articulos from './Articulos';

// La edición consulta por ID para funcionar también al recargar su URL.
export default function EditorArticulo() {
    const { id } = useParams();
    const location = useLocation();
    const [resultado, setResultado] = useState(null);
    const [version, setVersion] = useState(0);
    useEffect(() => {
        if (!id) return;
        let vigente = true;
        api(`/api/articulos/${id}`)
            .then((registro) => { if (vigente) setResultado({ id, version, registro }); })
            .catch((err) => { if (vigente) setResultado({ id, version, error: err.message }); });
        return () => { vigente = false; };
    }, [id, version]);
    if (id && (resultado?.id !== id || resultado?.version !== version)) return <p role="status">Cargando artículo…</p>;
    if (id && resultado.error) return <section>
        <p role="alert">{resultado.error}</p>
        <button onClick={() => setVersion((v) => v + 1)}>Reintentar</button>
        <Link to="/alpha/articulos" state={location.state?.retorno}>Volver al catálogo</Link>
    </section>;
    return <Articulos key={id || 'nuevo'} soloFormulario registroInicial={id ? resultado.registro : null} />;
}
