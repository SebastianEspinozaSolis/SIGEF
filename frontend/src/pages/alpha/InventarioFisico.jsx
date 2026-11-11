import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/cliente';
import './alpha.css';

export default function InventarioFisico() {
    const navigate = useNavigate();
    const [datos, setDatos] = useState({ registros: [], total: 0 });
    const [pagina, setPagina] = useState(1);
    const [estado, setEstado] = useState('');
    const [version, setVersion] = useState(0);
    const [cargando, setCargando] = useState(true);
    const [creando, setCreando] = useState(false);
    const [error, setError] = useState('');
    const [errorCrear, setErrorCrear] = useState('');

    useEffect(() => {
        let vigente = true;
        api(`/api/inventario-fisico?${new URLSearchParams({ pagina, estado })}`)
            .then((r) => { if (vigente) setDatos(r); })
            .catch((err) => { if (vigente) setError(err.message); })
            .finally(() => { if (vigente) setCargando(false); });
        return () => { vigente = false; };
    }, [pagina, estado, version]);

    async function crear() {
        setCreando(true); setErrorCrear('');
        try {
            const inventario = await api('/api/inventario-fisico', { method: 'POST' });
            navigate(`/alpha/inventario-fisico/${inventario.id_inventario}`);
        } catch (err) { setErrorCrear(err.message); }
        finally { setCreando(false); }
    }

    return <section className="alpha">
        <Link to="/">Volver al inicio</Link>
        <h1>Inventario físico</h1>
        <p>Cuenta los materiales de bodega, excluyendo lo asignado a técnicos. Finalizar el conteo no cambia las existencias.</p>
        <button disabled={creando} onClick={crear}>{creando ? 'Creando…' : 'Crear conteo'}</button>
        {errorCrear && <p role="alert">{errorCrear}</p>}
        <div className="alpha-filtros"><label>Estado
            <select value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(1); setCargando(true); setError(''); }}>
                <option value="">Todos</option><option>En proceso</option><option>Finalizado</option>
            </select>
        </label></div>
        {error && <p role="alert">{error} <button onClick={() => { setCargando(true); setError(''); setVersion((v) => v + 1); }}>Reintentar</button></p>}
        {cargando ? <p role="status">Cargando conteos…</p> : !error && <>
            <div className="alpha-tabla"><table>
                <thead><tr><th>Conteo</th><th>Fecha</th><th>Estado</th><th>Artículos contados</th><th>Con diferencia</th><th>Acciones</th></tr></thead>
                <tbody>{datos.registros.map((i) => <tr key={i.id_inventario}>
                    <td>#{i.id_inventario}</td><td>{new Date(i.fecha_conteo).toLocaleString('es-CL')}</td><td>{i.estado}</td>
                    <td>{i.total_contados ?? 0}</td><td>{i.total_con_diferencia ?? 0}</td>
                    <td><Link to={`/alpha/inventario-fisico/${i.id_inventario}`}>{i.estado === 'En proceso' ? 'Continuar conteo' : 'Ver detalle'}</Link></td>
                </tr>)}</tbody>
            </table></div>
            {datos.registros.length === 0 && <p>No hay conteos para este filtro.</p>}
            <nav aria-label="Paginación de inventarios">
                <button disabled={pagina <= 1} onClick={() => { setCargando(true); setPagina((p) => p - 1); }}>Anterior</button>
                <span>Página {pagina}</span><button disabled={pagina * 20 >= datos.total} onClick={() => { setCargando(true); setPagina((p) => p + 1); }}>Siguiente</button>
            </nav>
        </>}
    </section>;
}
