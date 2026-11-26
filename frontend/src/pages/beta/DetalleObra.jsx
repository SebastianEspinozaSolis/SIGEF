/*
 * Seguimiento de una obra en el ERP: reúne sus datos, hojas de servicio, avance y acciones disponibles.
 * Permite revisar el trabajo antes del cierre autorizado. Las hojas se distinguen por tarea y unidad; el backend controla los cambios de estado.
 */

import { pesos } from '../../utils/importes';
import '../alpha/alpha.css';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/cliente';
import useRegistro from '../../hooks/useRegistro';
import ErrorCarga from '../../components/ErrorCarga';
import ResumenTrabajo from '../../components/ResumenTrabajo';
import ConformidadObra from '../../components/ConformidadObra';
import {useAuth} from '../../context/AuthContext';
import {ROLES} from '../../roles';

export default function DetalleObra() {
    const { id } = useParams();
    const {usuario}=useAuth();
    const { datos, error, cargando, recargar } = useRegistro(`/api/obras/${id}`);
    const [fallo, setFallo] = useState(null);
    const [guardando, setGuardando] = useState(false);
    async function cambiarEstado(estado) {
        if (estado === 'Cancelada' && !window.confirm('¿Cancelar esta obra? Esta acción no revierte los materiales ya entregados y no permite reabrirla.')) return;
        if (estado === 'Finalizada' && !window.confirm('¿Finalizar esta obra? El servidor comprobará las horas y los materiales registrados. No podrá reabrirse.')) return;
        setGuardando(true); setFallo(null);
        try {
            await api(`/api/obras/${id}/estado`, { method: 'PATCH', body: { estado } });
            recargar();
        } catch (err) { setFallo(err); }
        finally { setGuardando(false); }
    }
    if (cargando) return <p role="status">Cargando obra…</p>;
    if (error) return <ErrorCarga error={error} noEncontrado="Obra no encontrada" volver="/beta/obras" reintentar={recargar} />;
    if (!datos) return null;
    return <section className="alpha"><h1>{datos.nombre_obra}</h1><p><Link to="/beta/obras">Volver a obras</Link></p>
        <dl><dt>Cliente</dt><dd>{datos.razon_social} — {datos.rut_cliente}</dd>
            <dt>Presupuesto</dt><dd><Link to={`/beta/presupuestos/${datos.id_presupuesto}`}>#{datos.id_presupuesto}</Link> — {pesos(datos.monto_total)} CLP</dd>
            <dt>Servicio</dt><dd>{datos.nombre_servicio}</dd><dt>Técnico responsable</dt><dd>{datos.tecnico}</dd>
            <dt>Estado</dt><dd>{datos.estado}</dd><dt>Creación</dt><dd>{new Date(datos.fecha_creacion).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</dd>
            <dt>Sin materiales</dt><dd>{datos.sin_materiales ? 'Sí' : 'No'}</dd>
            {datos.fecha_cierre && <><dt>Fecha de cierre</dt><dd>{new Date(datos.fecha_cierre).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</dd></>}
        </dl>
        {datos.estado==='Finalizada' && [ROLES.ADMIN,ROLES.ADMINISTRACION].includes(usuario.rol) && <p><Link to={datos.id_factura_cliente?`/beta/facturas-clientes/${datos.id_factura_cliente}`:`/beta/facturas-clientes/nuevo?obra=${id}`}>{datos.id_factura_cliente?'Ver factura de cliente':'Crear factura de cliente'}</Link></p>}
        {datos.estado==='En proceso' && datos.tareas_completadas && <p role="status"><strong>Tareas completadas: revisar y finalizar la obra.</strong> {datos.conformidad_recibida?'Conformidad del cliente recibida.':'La conformidad del cliente todavía no se ha recibido.'}</p>}
        {['En proceso', 'Suspendida'].includes(datos.estado) && <p><Link to={`/beta/obras/${id}/editar`}>Editar obra</Link>{' '}
            <button disabled={guardando} onClick={() => cambiarEstado(datos.estado === 'En proceso' ? 'Suspendida' : 'En proceso')}>{datos.estado === 'En proceso' ? 'Suspender' : 'Reanudar'}</button>{' '}
            <button disabled={guardando} onClick={() => cambiarEstado('Cancelada')}>Cancelar obra</button>{' '}
            {datos.estado === 'En proceso' && <button disabled={guardando} onClick={() => cambiarEstado('Finalizada')}>Finalizar obra</button>}</p>}
        {datos.estado === 'En proceso' && <p>Para finalizar deben estar registradas las horas y los materiales utilizados, o confirmarse que no se usaron materiales.</p>}
        {fallo && <p role="alert">{fallo.message}</p>}
        <ResumenTrabajo hojas={datos.hojas} fechaCierre={datos.fecha_cierre} />
        {datos.estado === 'Finalizada' && <ConformidadObra key={id} id={id} />}
        <h2>Materiales entregados</h2>
        <div className="alpha-tabla"><table><caption>Egresos asociados a la obra, descontando sus reversas</caption><thead><tr><th>Movimiento</th><th>Artículo</th><th>Unidad</th><th>Cantidad neta</th><th>Costo unitario neto (CLP)</th><th>Costo neto (CLP)</th></tr></thead>
            <tbody>{datos.materiales.map(m => <tr key={m.id_movimiento}><td>#{m.id_movimiento}</td><td>{m.nombre}</td><td>{m.unidad_medida}</td><td>{Number(m.cantidad_neta).toLocaleString('es-CL', { maximumFractionDigits: 3 })}</td><td>{pesos(m.costo_unitario)}</td><td>{pesos(m.costo_neto)}</td></tr>)}</tbody></table></div>
        {!datos.materiales.length && <p>No hay egresos registrados para esta obra.</p>}
        <p>Costo neto de materiales entregados: {pesos(datos.costo_materiales)} CLP</p>
    </section>;
}
