import { evitarCambioConRueda, pesos } from '../../utils/importes';
import '../alpha/alpha.css';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/cliente';
import useRegistro from '../../hooks/useRegistro';
import ErrorCarga from '../../components/ErrorCarga';
import SelectorPaginado from '../../components/SelectorPaginado';
import useListado from '../../hooks/useListado';
import Paginacion from '../../components/Paginacion';

// Redondea cada línea a pesos sin introducir decimales de coma flotante.
function subtotalLinea(detalle) {
    const cantidad = String(detalle.cantidad || '0');
    const precio = String(detalle.precio_neto_unitario || '0');
    if (!/^\d+(?:\.\d{1,3})?$/.test(cantidad) || !/^\d+(?:\.0+)?$/.test(precio)) return 0n;
    const [entero, fraccion = ''] = cantidad.split('.');
    return (BigInt(entero + fraccion.padEnd(3, '0')) * BigInt(precio.split('.')[0]) + 500n) / 1000n;
}

function TareasDisponibles({ categoria, detalles, agregar, alCreando }) {
    const [nueva, setNueva] = useState(false);
    const [nombre, setNombre] = useState('');
    const [precio, setPrecio] = useState('');
    const [errorNueva, setErrorNueva] = useState('');
    const [creando, setCreando] = useState(false);
    const envioEnCurso = useRef(false);
    const { datos, error, cargando, recargar, q, buscar, pagina, setPagina } = useListado(`/api/tareas-servicio?id_categoria_servicio=${categoria}&activo=true`);
    function cerrarNueva() {
        setNueva(false); setNombre(''); setPrecio(''); setErrorNueva('');
    }
    async function crearTarea() {
        if (envioEnCurso.current) return;
        if (!nombre.trim()) { setErrorNueva('Ingresa el nombre de la tarea.'); return; }
        if (!/^\d{1,14}$/.test(precio)) { setErrorNueva('Ingresa un precio neto entero, igual o mayor que cero.'); return; }
        envioEnCurso.current = true;
        setCreando(true); alCreando(true); setErrorNueva('');
        try {
            const tarea = await api('/api/tareas-servicio', {method:'POST', body:{
                id_categoria_servicio:categoria, nombre_tarea:nombre.trim(), precio_neto:precio, activo:true,
            }});
            agregar(tarea); recargar(); cerrarNueva();
        } catch (err) { setErrorNueva(err.message); }
        finally { envioEnCurso.current = false; setCreando(false); alCreando(false); }
    }
    return <fieldset className="alpha-ejecutivos"><legend>Agregar tareas</legend>
        <label>Buscar tarea <input type="search" maxLength={150} value={q} onChange={e => buscar(e.target.value)} /></label>
        <button type="button" aria-expanded={nueva} aria-controls="nueva-tarea-presupuesto" disabled={nueva} onClick={() => setNueva(true)}>Nueva tarea</button>
        {nueva && <fieldset id="nueva-tarea-presupuesto" className="alpha-ejecutivos" disabled={creando}
            onKeyDown={evento => { if (evento.key === 'Enter' && evento.target.tagName === 'INPUT') { evento.preventDefault(); crearTarea(); } }}>
            <legend>Nueva tarea</legend>
            <p>Se guardará en el catálogo de esta categoría y se agregará al presupuesto.</p>
            <div className="alpha-campos">
                <label>Nombre de la tarea * <input id="nombre-nueva-tarea" aria-required="true" maxLength={150} value={nombre} onChange={e => setNombre(e.target.value)} /></label>
                <label>Precio neto (CLP) * <input id="precio-nueva-tarea" aria-required="true" type="number" min="0" max="99999999999999" step="1" inputMode="numeric" onWheel={evitarCambioConRueda} value={precio} onChange={e => setPrecio(e.target.value)} /></label>
            </div>
            {errorNueva && <p role="alert">{errorNueva}</p>}
            <button type="button" onClick={crearTarea}>{creando ? 'Guardando...' : 'Guardar y agregar'}</button>
            <button type="button" onClick={cerrarNueva}>Cancelar</button>
        </fieldset>}
        {cargando && <p role="status">Cargando tareas…</p>}
        {error && <p role="alert">{error.message} <button type="button" onClick={recargar}>Reintentar</button></p>}
        {datos && <><div className="alpha-tabla"><table><thead><tr><th>Tarea</th><th>Precio neto (CLP)</th><th>Acción</th></tr></thead>
            <tbody>{datos.registros.map(t => { const usada = detalles.some(d => String(d.id_tarea) === String(t.id_tarea)); return <tr key={t.id_tarea}><td>{t.nombre_tarea}</td><td>{pesos(t.precio_neto)}</td><td><button type="button" disabled={usada} onClick={() => agregar(t)}>{usada ? 'Agregada' : 'Agregar'}</button></td></tr>; })}</tbody></table></div>
            {!datos.total && <p>No hay tareas activas en esta categoría.</p>}
            <Paginacion pagina={pagina} limite={datos.limite} total={datos.total} setPagina={setPagina} />
        </>}
    </fieldset>;
}

function Formulario({ registro }) {
    const navigate = useNavigate();
    const [cliente, setCliente] = useState(String(registro?.id_cliente || ''));
    const [monto, setMonto] = useState(registro?.monto_total || '');
    const [categoria, setCategoria] = useState(String(registro?.id_categoria_servicio || ''));
    const [detalles, setDetalles] = useState(registro?.detalles || []);
    const manual = Boolean(registro && !registro.id_categoria_servicio && !registro.detalles?.length);
    const [error, setError] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const [creandoTarea, setCreandoTarea] = useState(false);
    const editable = !registro || registro.estado === 'Pendiente';
    const modificado = Boolean(registro && (cliente !== String(registro.id_cliente) || (manual
        ? String(monto) !== String(registro.monto_total)
        : categoria !== String(registro.id_categoria_servicio) || JSON.stringify(detalles) !== JSON.stringify(registro.detalles))));
    const subtotal = detalles.reduce((total, d) => total + subtotalLinea(d), 0n);
    const iva = (subtotal * 19n + 50n) / 100n;

    function cambiarCategoria(valor) {
        if (valor === categoria) return;
        if (detalles.length && !window.confirm('Cambiar la categoría quitará las tareas seleccionadas. ¿Continuar?')) return;
        setCategoria(valor); setDetalles([]);
    }

    function cambiarDetalle(indice, campo, valor) {
        setDetalles(actuales => actuales.map((d, i) => i === indice ? { ...d, [campo]: valor } : d));
    }

    async function guardar(e) {
        e.preventDefault();
        if (creandoTarea) return;
        setGuardando(true); setError(null);
        try {
            const r = await api(`/api/presupuestos${registro ? `/${registro.id_presupuesto}` : ''}`, {
                method: registro ? 'PUT' : 'POST', body: manual ? { id_cliente: cliente, monto_total: monto }
                    : { id_cliente: cliente, id_categoria_servicio: categoria, detalles: detalles.map(({ id_tarea, descripcion, cantidad, precio_neto_unitario }) => ({ id_tarea, descripcion, cantidad, precio_neto_unitario })) },
            });
            navigate(registro ? '/beta/presupuestos' : `/beta/presupuestos/${r.id_presupuesto}`, { replace: true });
        } catch (err) { setError(err); }
        finally { setGuardando(false); }
    }

    async function decidir(estado) {
        if (!window.confirm(`¿Marcar este presupuesto como ${estado}? Después no podrá editarse.`)) return;
        setGuardando(true); setError(null);
        try {
            await api(`/api/presupuestos/${registro.id_presupuesto}/estado`, { method: 'PATCH', body: { estado } });
            navigate('/beta/presupuestos');
        } catch (err) { setError(err); }
        finally { setGuardando(false); }
    }

    return <>
        {registro && <p>Estado: {registro.estado} · Origen: {registro.origen} · Fecha de emisión: {new Date(registro.fecha_emision).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</p>}
        <form onSubmit={guardar}><fieldset className="alpha-campos" disabled={guardando || creandoTarea || !editable}>
            <SelectorPaginado etiqueta="Cliente" ruta="/api/presupuestos/clientes" valor={cliente} seleccionado={registro?.razon_social}
                alCambiar={setCliente} campoId="id_cliente" nombre={c => `${c.razon_social} — ${c.rut_cliente}`} />
            {manual ? <><p>Presupuesto de monto manual.</p><label>Monto total acordado (CLP) * <input required type="number" min="0" max="999999999999" step="1" inputMode="numeric" onWheel={evitarCambioConRueda} value={monto} onChange={e => setMonto(e.target.value)} /></label></> : <>
                <SelectorPaginado etiqueta="Categoría de servicio" ruta="/api/categorias-servicio" valor={categoria} seleccionado={registro?.nombre_servicio}
                    alCambiar={cambiarCategoria} campoId="id_categoria_servicio" nombre={c => c.nombre_servicio} />
                {editable && categoria && <TareasDisponibles key={categoria} categoria={categoria} detalles={detalles} alCreando={setCreandoTarea} agregar={t => setDetalles(actuales => actuales.some(d => String(d.id_tarea) === String(t.id_tarea)) ? actuales : [...actuales, { id_tarea: t.id_tarea, descripcion: t.nombre_tarea, cantidad: '1', precio_neto_unitario: String(Number(t.precio_neto)) }])} />}
                <h2>Tareas del presupuesto</h2>
                {!detalles.length && <p>Agrega al menos una tarea.</p>}
                {detalles.map((d, i) => <fieldset className="alpha-ejecutivos" key={d.id_tarea}><legend>Tarea {i + 1}</legend><div className="alpha-campos">
                    <label>Descripción * <input required maxLength={255} value={d.descripcion} onChange={e => cambiarDetalle(i, 'descripcion', e.target.value)} /></label>
                    <label>Cantidad * <input required type="number" min="1" max="999999999" step="1" inputMode="numeric" value={Number.isInteger(Number(d.cantidad)) ? String(Number(d.cantidad)) : d.cantidad} onChange={e => cambiarDetalle(i, 'cantidad', e.target.value)} /></label>
                    <label>Precio neto unitario (CLP) * <input required type="number" min="0" max="999999999999" step="1" inputMode="numeric" onWheel={evitarCambioConRueda} value={d.precio_neto_unitario} onChange={e => cambiarDetalle(i, 'precio_neto_unitario', e.target.value)} /></label>
                    <p>Subtotal neto: ${pesos(subtotalLinea(d))}</p>
                    {editable && <button type="button" onClick={() => setDetalles(actuales => actuales.filter((_, indice) => indice !== i))}>Quitar tarea</button>}
                </div></fieldset>)}
                <dl><dt>Subtotal neto</dt><dd>${pesos(subtotal)}</dd><dt>IVA (19 %)</dt><dd>${pesos(iva)}</dd><dt>Total</dt><dd>${pesos(subtotal + iva)}</dd></dl>
            </>}
            {editable && <button type="submit" disabled={!manual && !detalles.length}>{guardando ? 'Guardando…' : 'Guardar presupuesto'}</button>}
        </fieldset></form>
        {modificado && <p>Guarda los cambios antes de aprobar o rechazar.</p>}
        {registro?.estado === 'Pendiente' && <p>Decidir sobre el presupuesto guardado: <button disabled={guardando || creandoTarea || modificado} onClick={() => decidir('Aprobado')}>Aprobar</button> <button disabled={guardando || creandoTarea || modificado} onClick={() => decidir('Rechazado')}>Rechazar</button></p>}
        {registro?.estado === 'Aprobado' && <p>{registro.id_obra
            ? <Link to={`/beta/obras/${registro.id_obra}`}>Ver obra</Link>
            : <Link to={`/beta/obras/nuevo?presupuesto=${registro.id_presupuesto}`}>Crear obra con este presupuesto</Link>}</p>}
        {error && <div role="alert"><p>{error.message}</p>{Object.entries(error.errores || {}).map(([campo, mensaje]) => <p key={campo}>{mensaje}</p>)}</div>}
    </>;
}

export default function EditorPresupuesto() {
    const { id } = useParams();
    const { datos, error, cargando, recargar } = useRegistro(id ? `/api/presupuestos/${id}` : null);
    if (cargando) return <p role="status">Cargando presupuesto…</p>;
    if (error) return <ErrorCarga error={error} noEncontrado="Presupuesto no encontrado" volver="/beta/presupuestos" reintentar={recargar} />;
    return <section className="alpha"><h1>{id ? `Presupuesto #${id}` : 'Nuevo presupuesto'}</h1>
        <p><Link to="/beta/presupuestos">Volver a presupuestos</Link></p>
        {(!id || datos) && <Formulario key={id || 'nuevo'} registro={datos} />}
    </section>;
}
