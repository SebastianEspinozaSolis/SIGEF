import { pesos } from '../../utils/importes';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/cliente';
import ErrorCarga from '../../components/ErrorCarga';
import './alpha.css';
import IngresoArticulo from './IngresoArticulo';
import FormularioMovimiento from './FormularioMovimiento';
import { cantidadVisible, tiposMovimiento } from '../../utils/movimientos';

export default function Cardex() {
    const { id } = useParams();
    // Cambiar de artículo descarta la página y las respuestas del artículo anterior.
    return <HistorialArticulo key={id} id={id} />;
}

function HistorialArticulo({ id }) {
    const [datos, setDatos] = useState(null);
    const [mostrarFormulario, setMostrarFormulario] = useState(false);
    const [tipo, setTipo] = useState('INGRESO');
    const [pagina, setPagina] = useState(1);
    const [version, setVersion] = useState(0);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        let vigente = true;
        api(`/api/articulos/${id}/cardex?${new URLSearchParams({ pagina })}`)
            .then((r) => { if (vigente) setDatos(r); })
            .catch((err) => { if (vigente) setError(err); })
            .finally(() => { if (vigente) setCargando(false); });
        return () => { vigente = false; };
    }, [id, pagina, version]);
    return <section className="alpha">
        {mostrarFormulario
            ? <button type="button" onClick={() => setMostrarFormulario(false)}>Volver al historial</button>
            : <Link to="/alpha/articulos">Volver a artículos</Link>}
        <h1>{mostrarFormulario ? 'Nuevo movimiento' : 'Movimientos del artículo'}</h1>
        {error && <ErrorCarga error={error} noEncontrado="Artículo no encontrado."
            volver="/alpha/articulos" etiqueta="Volver a artículos"
            reintentar={() => { setCargando(true); setError(null); setVersion((v) => v + 1); }} />}
        {cargando ? <p role="status">Cargando movimientos…</p> : !error && datos && <>
            <h2>{datos.articulo.codigo_interno} — {datos.articulo.nombre}</h2>
            {!mostrarFormulario && <>
                <p>{datos.total} movimientos registrados · Unidad: {datos.articulo.unidad_medida}</p>
                <button type="button" disabled={!datos.articulo.activo} onClick={() => setMostrarFormulario(true)}>Generar movimiento</button>
            </>}
            {!datos.articulo.activo && <p role="status">Artículo inactivo: no se pueden generar movimientos.</p>}
            {mostrarFormulario && datos.articulo.activo && <section aria-labelledby="titulo-movimiento">
                <h3 id="titulo-movimiento">Datos del movimiento</h3>
                <label>Tipo de movimiento
                    <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                        {tiposMovimiento.map(([valor, nombre]) => <option key={valor} value={valor}>{nombre}</option>)}
                    </select>
                </label>
                {/* Cambiar de tipo reinicia los campos específicos para evitar mezclar sus datos. */}
                <BorradorMovimiento key={tipo} tipo={tipo} unidad={datos.articulo.unidad_medida} idArticulo={id} onConfirmado={() => {
                    setMostrarFormulario(false); setCargando(true); setPagina(1); setError(null); setVersion(v => v + 1);
                }} />
            </section>}
            {!mostrarFormulario && <>
            <h3>Historial de movimientos</h3>
            <div className="alpha-tabla"><table>
                <thead><tr>{['Movimiento', 'Fecha', 'Tipo', 'Cantidad', 'Costo unitario (CLP)', 'Responsable', 'Receptor', 'Obra', 'Movimiento de origen', 'Justificación'].map((t) => <th key={t}>{t}</th>)}</tr></thead>
                <tbody>{datos.registros.map((m) => <tr key={m.id_movimiento}>
                    <td>#{m.id_movimiento}</td><td>{new Date(m.fecha_hora).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</td><td>{tiposMovimiento.find(([valor]) => valor === m.tipo_movimiento)?.[1] || m.tipo_movimiento}</td>
                    <td>{cantidadVisible(m.cantidad)}</td><td>{pesos(m.costo_unitario)}</td><td>{m.nombres} {m.apellidos}</td>
                    <td>{m.receptor_nombres ? `${m.receptor_nombres} ${m.receptor_apellidos}` : '—'}</td>
                    <td>{m.id_obra ?? '—'}</td><td>{(m.id_movimiento_revertido || m.id_movimiento_origen) ? `${tiposMovimiento.find(([valor]) => valor === m.tipo_movimiento_original)?.[1] || 'Movimiento'} #${m.id_movimiento_revertido || m.id_movimiento_origen} — ${m.cantidad_original == null ? '—' : cantidadVisible(m.cantidad_original)} ${datos.articulo.unidad_medida}` : '—'}</td><td>{m.justificacion || '—'}</td>
                </tr>)}</tbody>
            </table></div>
            {datos.registros.length === 0 && <p>Este artículo aún no tiene movimientos registrados.</p>}
            <nav aria-label="Paginación de movimientos">
                <button disabled={pagina <= 1} onClick={() => { setCargando(true); setPagina((p) => p - 1); }}>Anterior</button>
                <span>Página {pagina}</span><button disabled={pagina * datos.limite >= datos.total} onClick={() => { setCargando(true); setPagina((p) => p + 1); }}>Siguiente</button>
            </nav>
            </>}
        </>}
    </section>;
}

function BorradorMovimiento({ tipo, unidad, idArticulo, onConfirmado }) {
    return tipo === 'INGRESO'
        ? <IngresoArticulo idArticulo={idArticulo} unidad={unidad} onConfirmado={onConfirmado} />
        : <FormularioMovimiento tipo={tipo} unidad={unidad} idArticulo={idArticulo} onConfirmado={onConfirmado} />;
}
