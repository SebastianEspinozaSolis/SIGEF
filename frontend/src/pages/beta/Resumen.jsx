/*
 * Resumen de gestión: presenta indicadores, tablas y gráficos del período seleccionado.
 * Consulta resúmenes guardados en la base de datos. El botón de actualización solicita refrescarlos y respeta la espera impuesta por el backend.
 */

import { pesos } from '../../utils/importes';
import Paginacion from '../../components/Paginacion';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useRegistro from '../../hooks/useRegistro';
import GraficoBarras from '../../components/GraficoBarras';
import { nombresMovimiento } from '../../utils/movimientos';
import { api, descargar } from '../../api/cliente';
import '../alpha/alpha.css';
import './resumen.css';

function clp(valor) { return `${pesos(valor)} CLP`; }

function BotonActualizar({ datos, cargando, actualizando, actualizar }) {
    const [hasta] = useState(() => Date.now() + (datos?.espera_segundos ?? 0) * 1000);
    const [reloj, setReloj] = useState(() => Date.now());
    useEffect(() => {
        if (hasta <= Date.now()) return;
        const temporizador = setInterval(() => {
            const ahora = Date.now();
            setReloj(ahora);
            if (ahora >= hasta) clearInterval(temporizador);
        }, 1000);
        return () => clearInterval(temporizador);
    }, [hasta]);
    const espera = Math.max(0, Math.ceil((hasta - reloj) / 1000));
    return <button type="button" disabled={!datos || cargando || actualizando || espera > 0} onClick={actualizar}>
        {actualizando ? 'Actualizando...' : espera > 0 ? `Actualizar (${Math.floor(espera / 60)}:${String(espera % 60).padStart(2, '0')})` : 'Actualizar'}
    </button>;
}

function Indicador({ titulo, valor, detalle, alerta = false }) {
    return <article className={`resumen-indicador${alerta ? ' resumen-aviso' : ''}`}>
        <h3>{titulo}</h3><p className="resumen-valor">{valor}</p><p>{detalle}</p>
    </article>;
}

export default function Resumen() {
    const [mes, setMes] = useState(() => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Santiago' }).format(new Date()).slice(0, 7));
    const [entrada, setEntrada] = useState(mes);
    const [pagina, setPagina] = useState(1);
    const [exportando, setExportando] = useState('');
    const [errorExportacion, setErrorExportacion] = useState('');
    const [actualizando, setActualizando] = useState(false);
    const [mensajeActualizacion, setMensajeActualizacion] = useState('');
    const { datos, error, cargando, recargar } = useRegistro(`/api/resumen?${new URLSearchParams({ mes, pagina })}`);
    const i = datos?.indicadores;
    async function actualizar() {
        setActualizando(true); setMensajeActualizacion('');
        try {
            const resultado = await api('/api/resumen/actualizar', { method: 'POST' });
            setMensajeActualizacion(resultado.actualizado ? 'Resumen actualizado' : 'El resumen se actualizó hace menos de cinco minutos. Se muestran los datos guardados.');
            recargar();
        } catch (err) { setMensajeActualizacion(err.message); }
        finally { setActualizando(false); }
    }
    async function exportar(formato) {
        setExportando(formato); setErrorExportacion('');
        try { await descargar(`/api/resumen/exportar/${formato}?${new URLSearchParams({ mes })}`, `resumen-${mes}.${formato}`); }
        catch (err) { setErrorExportacion(err.message); }
        finally { setExportando(''); }
    }
    return <section className="alpha resumen">
        <Link to="/">Volver al inicio</Link><h1>Resumen de gestión</h1>
        <form className="alpha-filtros" onSubmit={e => { e.preventDefault(); setMes(entrada); setPagina(1); if (entrada === mes) recargar(); }}>
            <label>Mes del informe<input type="month" required value={entrada} onChange={e => setEntrada(e.target.value)} /></label>
            <button type="submit">Consultar</button>
            <BotonActualizar key={`${datos?.actualizado_en}-${datos?.espera_segundos}`} datos={datos}
                cargando={cargando} actualizando={actualizando} actualizar={actualizar} />
        </form>
        {mensajeActualizacion && <p role="status">{mensajeActualizacion}</p>}
        <nav aria-label="Exportar resumen">
            <button type="button" disabled={!datos || Boolean(exportando)} onClick={() => exportar('pdf')}>{exportando === 'pdf' ? 'Generando PDF…' : 'Descargar PDF'}</button>
            <button type="button" disabled={!datos || Boolean(exportando)} onClick={() => exportar('xlsx')}>{exportando === 'xlsx' ? 'Generando Excel…' : 'Descargar Excel'}</button>
        </nav>
        {errorExportacion && <p role="alert">No se pudo exportar el resumen: {errorExportacion}</p>}
        {error && <p role="alert">No se pudo cargar el resumen: {error.message} <button onClick={recargar}>Reintentar</button></p>}
        {cargando && <p role="status">Cargando resumen…</p>}
        {datos && <>
            <p>Mes consultado: <strong>{datos.mes}</strong> · Actualizado: {new Date(datos.actualizado_en).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</p>
            <h2>Actividad del mes</h2>
            <div className="resumen-tarjetas">
                <Indicador titulo="Compras recibidas" valor={clp(i.compras_mes)} detalle="Costo neto de ingresos con documento de proveedor, corregido por reversas. Sin IVA." />
                <Indicador titulo="Presupuestos aprobados" valor={i.presupuestos_aprobados} detalle="Presupuestos emitidos en el mes que actualmente están aprobados." />
                <Indicador titulo="Presupuestos pendientes" valor={i.presupuestos_pendientes} detalle="Presupuestos emitidos en el mes que actualmente siguen pendientes." />
                <Indicador titulo="Servicios realizados" valor={i.servicios_realizados} detalle="Obras finalizadas con fecha de cierre en el mes." />
                <Indicador titulo="Ventas del mes" valor="Pendiente" detalle="Requiere implementar documentos de clientes." />
            </div>
            <h2>Situación actual</h2>
            <p>Estos saldos y alertas corresponden a la última actualización del resumen, independientemente del mes seleccionado.</p>
            <div className="resumen-tarjetas">
                <Indicador titulo="Cuentas por pagar" valor={clp(i.cuentas_por_pagar)} detalle="Saldo de facturas y boletas de proveedores, descontando abonos. Notas de crédito pendientes de aplicación." />
                <Indicador titulo="Cuentas por cobrar" valor="Pendiente" detalle="Requiere documentos y cobros de clientes." />
                <Indicador titulo="Facturas próximas a vencer" valor={i.facturas_por_vencer} alerta={i.facturas_por_vencer > 0} detalle="Con saldo pendiente; vencen hoy o en los próximos 7 días." />
                <Indicador titulo="Facturas vencidas" valor={i.facturas_vencidas} alerta={i.facturas_vencidas > 0} detalle="Con saldo pendiente y fecha de vencimiento anterior a hoy." />
                <Indicador titulo="Stock crítico" valor={i.stock_critico} alerta={i.stock_critico > 0} detalle="Artículos activos con disponible igual o inferior al mínimo." />
                <Indicador titulo="Obras en proceso" valor={i.obras_en_proceso} detalle="Obras que actualmente están En proceso." />
            </div>
            <h2>Gráficos</h2>
            <div className="resumen-graficos">
                <GraficoBarras titulo="Compras recibidas: últimos seis meses del período" datos={datos.compras_por_mes} etiqueta={d => d.mes} valor={d => d.total} formato={clp} formatoEje={pesos} />
                <GraficoBarras titulo="Presupuestos emitidos en el mes, por estado actual" datos={datos.presupuestos} etiqueta={d => d.estado} valor={d => d.cantidad} />
                <GraficoBarras titulo="Movimientos registrados en el mes" datos={datos.movimientos} etiqueta={d => nombresMovimiento[d.tipo] || d.tipo} valor={d => d.cantidad} />
                <GraficoBarras titulo="Obras por estado actual" datos={datos.obras} etiqueta={d => d.estado} valor={d => d.cantidad} />
            </div>
            <h2>Artículos en stock crítico</h2>
            <p>Hasta 10 artículos con mayor diferencia bajo el mínimo.</p>
            <div className="alpha-tabla"><table><thead><tr><th>Código</th><th>Artículo</th><th>Disponible</th><th>Mínimo</th><th>Unidad</th></tr></thead>
                <tbody>{datos.stock_critico.map(a => <tr key={a.id_articulo}><td>{a.codigo_interno}</td><td>{a.nombre}</td><td>{a.disponible}</td><td>{a.minimo}</td><td>{a.unidad_medida}</td></tr>)}</tbody></table></div>
            {!datos.stock_critico.length && <p>No hay artículos en stock crítico.</p>}
            <h2>Próximos vencimientos</h2>
            <p>Hasta 10 facturas pendientes que vencen dentro de los próximos 7 días.</p>
            <div className="alpha-tabla"><table><thead><tr><th>Proveedor</th><th>Folio</th><th>Vencimiento</th><th>Saldo</th><th>Acciones</th></tr></thead>
                <tbody>{datos.vencimientos.map(d => <tr key={d.id_documento}><td>{d.razon_social}</td><td>{d.folio}</td><td>{String(d.fecha_vencimiento).slice(0, 10)}</td><td>{clp(d.saldo)}</td>
                    <td><Link to={`/alpha/proveedores/${d.id_proveedor}/documentos/${d.id_documento}/pagos`}>Ver pagos</Link></td></tr>)}</tbody></table></div>
            {!datos.vencimientos.length && <p>No hay facturas próximas a vencer con saldo pendiente.</p>}
            <h2>Movimientos de materiales del mes</h2>
            <p>Las cantidades se separan por artículo y tipo. Las reversas corrigen el tipo original; pueden producir un neto negativo si revierten movimientos de otro mes. Uso interno representa asignación, no consumo definitivo.</p>
            <div className="alpha-tabla"><table><thead><tr><th>Artículo</th><th>Tipo</th><th>Cantidad neta</th><th>Unidad</th><th>Registros incluidos</th></tr></thead>
                <tbody>{datos.materiales.registros.map(m => <tr key={`${m.id_articulo}-${m.tipo}`}><td>{m.codigo_interno} — {m.nombre}</td><td>{nombresMovimiento[m.tipo] || m.tipo}</td><td>{Number(m.cantidad).toLocaleString('es-CL', { maximumFractionDigits: 3 })}</td><td>{m.unidad_medida}</td><td>{m.registros}</td></tr>)}</tbody></table></div>
            {!datos.materiales.total && <p>No hay movimientos en el mes consultado.</p>}
            <Paginacion pagina={pagina} limite={datos.materiales.limite} total={datos.materiales.total} setPagina={setPagina} etiqueta="Paginación de materiales" />
        </>}
    </section>;
}
