/*
 * Consulta y registro de pagos de un documento, con su saldo y movimientos de pago.
 * Permite abonar montos y muestra lo pendiente; el backend comprueba que el pago sea válido antes de guardarlo.
 */

import { pesos, evitarCambioConRueda } from '../../utils/importes';
import Paginacion from '../../components/Paginacion';
import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/cliente';
import useListado from '../../hooks/useListado';
import ErrorCarga from '../../components/ErrorCarga';
import './alpha.css';

export default function PagosDocumento({ cliente = false }) {
    const { proveedor, id } = useParams();
    const { datos, error, cargando, recargar, pagina, setPagina } = useListado(`/api/pagos-documento/${id}`);
    const [monto, setMonto] = useState('');
    const [fecha, setFecha] = useState(() => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Santiago' }).format(new Date()));
    const [observaciones, setObservaciones] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [fallo, setFallo] = useState(null);
    const [mensaje, setMensaje] = useState('');
    const confirmacion = useRef(null);
    const volver = cliente ? `/beta/facturas-clientes/${id}` : `/alpha/proveedores/${proveedor}/documentos`;
    async function guardar(e) {
        e.preventDefault();
        if (!window.confirm(`¿Registrar un pago de ${pesos(monto)} CLP? Comprueba el monto antes de confirmar.`)) return;
        setGuardando(true); setFallo(null); setMensaje('');
        try {
            const solicitud = JSON.stringify({ id, monto, fecha, observaciones });
            if (confirmacion.current?.solicitud !== solicitud) confirmacion.current = { solicitud, id_operacion: crypto.randomUUID() };
            await api(`/api/pagos-documento/${id}`, { method: 'POST', body: { monto, fecha_pago: fecha, observaciones, id_operacion: confirmacion.current.id_operacion } });
            confirmacion.current = null;
            setMonto(''); setObservaciones(''); recargar(); setMensaje('Pago registrado');
        } catch (err) { setFallo(err); }
        finally { setGuardando(false); }
    }
    if (error) return <section className="alpha"><ErrorCarga error={error} noEncontrado="Documento no encontrado" volver={volver} reintentar={recargar} /></section>;
    return <section className="alpha"><Link to={volver}>Volver al documento</Link><h1>{cliente?'Pagos recibidos del cliente':'Pagos del documento'}</h1>
        {cargando ? <p role="status">Cargando…</p> : datos && <>
            <h2>{datos.documento.folio}</h2>
            <p>Total: {pesos(datos.documento.total)} CLP · Pagado: {pesos(datos.documento.total_pagado)} CLP · Saldo pendiente: {datos.documento.saldo_pendiente == null ? 'No aplica' : pesos(datos.documento.saldo_pendiente)} CLP</p>
            {Number(datos.documento.total_notas_credito) > 0 && <p>Notas de crédito aplicadas: {pesos(datos.documento.total_notas_credito)} CLP.</p>}
            <p>Estado: {datos.documento.estado_pago}</p>
            {(cliente ? !datos.documento.id_cliente : String(datos.documento.id_proveedor) !== proveedor) ? <p role="alert">El documento no corresponde a esta pantalla.</p> : <>
            {Number(datos.documento.saldo_pendiente) > 0 && <form onSubmit={guardar}><fieldset className="alpha-campos" disabled={guardando}>
                <legend>Registrar abono</legend>
                <label>{cliente?'Monto recibido (CLP) *':'Monto pagado (CLP) *'}<input required type="number" min="1" max={datos.documento.saldo_pendiente} step="1" inputMode="numeric" onWheel={evitarCambioConRueda} value={monto} onChange={e => setMonto(e.target.value)} /></label>
                <label>Fecha del pago *<input required type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></label>
                <label>Observaciones (opcional)<input maxLength={2000} value={observaciones} onChange={e => setObservaciones(e.target.value)} /></label>
                <div><button type="submit">{guardando ? 'Registrando…' : 'Registrar pago'}</button></div>
            </fieldset></form>}
            <h2>Historial de pagos</h2>
            <div className="alpha-tabla"><table><thead><tr><th>Fecha de pago</th><th>Monto (CLP)</th><th>Registrado por</th><th>Observaciones</th></tr></thead>
                <tbody>{datos.registros.map(p => <tr key={p.id_pago}><td>{String(p.fecha_pago).slice(0, 10)}</td><td>{pesos(p.monto)}</td><td>{p.nombres} {p.apellidos}</td><td>{p.observaciones || '—'}</td></tr>)}</tbody></table></div>
            {!datos.total && <p>No hay pagos registrados.</p>}
            <Paginacion pagina={pagina} limite={datos.limite} total={datos.total} setPagina={setPagina} etiqueta="Paginación de pagos" />
            </>}
        </>}
        {mensaje && <p role="status">{mensaje}</p>}
        {fallo && <div role="alert"><p>{fallo.message}</p>{Object.entries(fallo.errores || {}).map(([campo, texto]) => <p key={campo}>{texto}</p>)}</div>}
    </section>;
}
