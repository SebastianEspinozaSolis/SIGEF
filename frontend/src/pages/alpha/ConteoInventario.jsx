import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/cliente';
import './alpha.css';

export default function ConteoInventario() {
    const { id } = useParams();
    // Cada inventario conserva su propio formulario y descarta solicitudes anteriores al salir.
    return <DetalleConteo key={id} id={id} />;
}

function DetalleConteo({ id }) {
    const [inventario, setInventario] = useState(null);
    const [errorCarga, setErrorCarga] = useState('');
    const [cargando, setCargando] = useState(true);
    const [version, setVersion] = useState(0);
    const [busqueda, setBusqueda] = useState('');
    const [pagina, setPagina] = useState(1);
    const [articulos, setArticulos] = useState({ registros: [], total: 0 });
    const [buscando, setBuscando] = useState(true);
    const [errorBusqueda, setErrorBusqueda] = useState('');
    const [seleccionado, setSeleccionado] = useState(null);
    const [cantidad, setCantidad] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [ok, setOk] = useState('');
    const [confirmar, setConfirmar] = useState(false);

    useEffect(() => {
        let vigente = true;
        api(`/api/inventario-fisico/${id}`)
            .then((r) => { if (vigente) setInventario(r); })
            .catch((err) => { if (vigente) setErrorCarga(err.message); })
            .finally(() => { if (vigente) setCargando(false); });
        return () => { vigente = false; };
    }, [id, version]);

    const enProceso = inventario?.estado === 'En proceso';
    useEffect(() => {
        if (!enProceso) return;
        let vigente = true;
        const temporizador = setTimeout(() => {
            setBuscando(true); setErrorBusqueda('');
            api(`/api/inventario-fisico/articulos?${new URLSearchParams({ q: busqueda, pagina })}`)
                .then((r) => { if (vigente) setArticulos(r); })
                .catch((err) => { if (vigente) setErrorBusqueda(err.message); })
                .finally(() => { if (vigente) setBuscando(false); });
        }, 250);
        return () => { vigente = false; clearTimeout(temporizador); };
    }, [enProceso, busqueda, pagina, id, version]);

    function seleccionar(articulo) {
        setSeleccionado(articulo);
        const anterior = inventario.detalles.find((d) => d.id_articulo === articulo.id_articulo);
        setCantidad(anterior ? String(Number(anterior.stock_fisico)) : '');
        setError(''); setOk(''); setConfirmar(false);
    }

    async function guardar(e) {
        e.preventDefault();
        setGuardando(true); setError(''); setOk('');
        try {
            const detalle = await api(`/api/inventario-fisico/${id}/articulos/${seleccionado.id_articulo}`, {
                method: 'PUT', body: { stock_fisico: cantidad },
            });
            // Actualiza la evidencia devuelta por la API sin repetir un guardado si falla una recarga.
            setInventario((actual) => {
                const detalles = [...actual.detalles.filter((d) => d.id_articulo !== detalle.id_articulo),
                    { ...seleccionado, ...detalle }].sort((a, b) => a.id_articulo - b.id_articulo);
                return { ...actual, detalles, total_contados: detalles.length,
                    total_con_diferencia: detalles.filter((d) => Number(d.diferencia) !== 0).length };
            });
            setOk(`Conteo guardado. Diferencia: ${Number(detalle.diferencia)} ${seleccionado.unidad_medida}. No se modificó el stock.`);
            setSeleccionado(null); setCantidad('');
        } catch (err) { setError(err.errores?.stock_fisico || err.message); }
        finally { setGuardando(false); }
    }

    async function finalizar() {
        setGuardando(true); setError(''); setOk('');
        try {
            const cabecera = await api(`/api/inventario-fisico/${id}/finalizar`, { method: 'PATCH' });
            setInventario((actual) => ({ ...actual, ...cabecera }));
            setConfirmar(false); setSeleccionado(null);
            setOk('Conteo finalizado. Las diferencias no se aplicaron al stock.');
        } catch (err) { setError(err.message); }
        finally { setGuardando(false); }
    }

    return <section className="alpha">
        <Link to="/alpha/inventario-fisico">Volver a inventario físico</Link>
        <h1>Conteo #{id}</h1>
        {cargando && <p role="status">Cargando conteo…</p>}
        {errorCarga && <p role="alert">{errorCarga} <button onClick={() => { setCargando(true); setErrorCarga(''); setVersion((v) => v + 1); }}>Reintentar</button></p>}
        {inventario && <>
            <p>Estado: <strong>{inventario.estado}</strong> · Contados: {inventario.total_contados ?? 0} · Con diferencia: {inventario.total_con_diferencia ?? 0}</p>
            <p>Cuenta solo lo que hay en bodega, sin incluir lo asignado a técnicos. Diferencia = contado en bodega − esperado en bodega.</p>
            {enProceso && <>
                <h2>Seleccionar artículo</h2>
                <label>Buscar por nombre o código<input type="search" maxLength={150} value={busqueda}
                    onChange={(e) => { setBusqueda(e.target.value); setPagina(1); setBuscando(true); }} /></label>
                {errorBusqueda && <p role="alert">{errorBusqueda} <button onClick={() => setVersion((v) => v + 1)}>Reintentar</button></p>}
                {buscando ? <p role="status">Buscando artículos…</p> : !errorBusqueda && <>
                    <div className="alpha-tabla"><table>
                        <thead><tr><th>Código</th><th>Artículo</th><th>Unidad</th><th>Acción</th></tr></thead>
                        <tbody>{articulos.registros.map((a) => <tr key={a.id_articulo}>
                            <td>{a.codigo_interno}</td><td>{a.nombre}</td><td>{a.unidad_medida}</td>
                            <td><button disabled={guardando} onClick={() => seleccionar(a)}>Contar</button></td>
                        </tr>)}</tbody>
                    </table></div>
                    {articulos.registros.length === 0 && <p>No hay artículos para esta búsqueda.</p>}
                    <nav aria-label="Paginación de artículos para contar">
                        <button disabled={pagina <= 1} onClick={() => { setBuscando(true); setPagina((p) => p - 1); }}>Anterior</button>
                        <span>Página {pagina}</span><button disabled={pagina * 20 >= articulos.total} onClick={() => { setBuscando(true); setPagina((p) => p + 1); }}>Siguiente</button>
                    </nav>
                </>}
                {seleccionado && <form onSubmit={guardar}>
                    <h2>Contar: {seleccionado.nombre}</h2>
                    <fieldset disabled={guardando} className="alpha-campos">
                        <label>Cantidad contada en bodega ({seleccionado.unidad_medida})
                            <input type="number" min="0" max={seleccionado.unidad_medida === 'UN' ? '999999999' : '999999999.999'} step={seleccionado.unidad_medida === 'UN' ? '1' : '0.001'} required
                                value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
                        </label>
                        <div><button type="submit">{guardando ? 'Guardando…' : 'Guardar conteo'}</button>
                            <button type="button" onClick={() => setSeleccionado(null)}>Cancelar</button></div>
                    </fieldset>
                </form>}
            </>}
            {error && <p role="alert">{error}</p>}{ok && <p role="status">{ok}</p>}
            <h2>Artículos contados y diferencias</h2>
            <p>El esperado en bodega es el stock total menos lo comprometido al guardar el primer conteo de cada artículo. Esa referencia se conserva al corregirlo.</p>
            <div className="alpha-tabla"><table>
                <thead><tr><th>Código</th><th>Artículo</th><th>Unidad</th><th>Esperado en bodega</th><th>Contado en bodega</th><th>Diferencia</th>{enProceso && <th>Acción</th>}</tr></thead>
                <tbody>{inventario.detalles.map((d) => <tr key={d.id_articulo}>
                    <td>{d.codigo_interno}</td><td>{d.nombre}</td><td>{d.unidad_medida}</td><td>{Number(d.stock_sistema)}</td><td>{Number(d.stock_fisico)}</td>
                    <td className={Number(d.diferencia) !== 0 ? 'alpha-critico' : undefined}>{Number(d.diferencia)}</td>
                    {enProceso && <td><button disabled={guardando} onClick={() => seleccionar(d)}>Corregir conteo</button></td>}
                </tr>)}</tbody>
            </table></div>
            {inventario.detalles.length === 0 && <p>Aún no hay artículos contados.</p>}
            {enProceso && (confirmar ? <div>
                <p>Al finalizar no podrás corregir este conteo. Las diferencias quedarán registradas sin aplicar ajustes.</p>
                <button disabled={guardando} onClick={finalizar}>Confirmar finalización</button>
                <button disabled={guardando} onClick={() => setConfirmar(false)}>Seguir contando</button>
            </div> : <button disabled={guardando || seleccionado !== null} onClick={() => setConfirmar(true)}>Finalizar conteo</button>)}
        </>}
    </section>;
}
