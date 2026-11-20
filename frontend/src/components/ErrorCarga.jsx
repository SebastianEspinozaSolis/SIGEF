import { Link } from 'react-router-dom';

// Un registro inexistente permite volver; un fallo temporal también permite reintentar.
export default function ErrorCarga({ error, noEncontrado, volver, etiqueta = 'Volver al listado', estado, reintentar }) {
    const inexistente = error.status === 404;
    return <section>
        <p role="alert">{inexistente ? noEncontrado : error.message}</p>
        {!inexistente && reintentar && <button type="button" onClick={reintentar}>Reintentar</button>}{' '}
        <Link to={volver} state={estado}>{etiqueta}</Link>
    </section>;
}
