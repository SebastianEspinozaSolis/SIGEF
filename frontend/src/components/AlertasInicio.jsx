/*
 * Alertas del menú principal: muestra situaciones que requieren atención según el perfil.
 * Consulta el backend y ofrece accesos al apartado correspondiente; conserva los estados de carga y error al rediseñar las tarjetas.
 */

import { pesos } from '../utils/importes';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/cliente';
import { ROLES } from '../roles';

const alertas = [
    { tipo: 'stock', titulo: 'Stock en mínimo o bajo', descripcion: 'Disponible en bodega igual o inferior al mínimo.' },
    { tipo: 'por-vencer', titulo: 'Proveedores: facturas próximas a vencer', descripcion: 'Pendientes de pago: vencen hoy o en los próximos 7 días.' },
    { tipo: 'vencidas', titulo: 'Proveedores: facturas vencidas', descripcion: 'El vencimiento pasó y siguen pendientes de pago.' },
    { tipo: 'clientes-por-vencer', titulo: 'Clientes: facturas próximas a vencer', descripcion: 'Pendientes de cobro: vencen hoy o en los próximos 7 días.' },
    { tipo: 'clientes-vencidas', titulo: 'Clientes: facturas vencidas', descripcion: 'El vencimiento pasó y mantienen saldo por cobrar.' },
    { tipo: 'obras-por-cerrar', titulo: 'Obras pendientes de cierre', descripcion: 'Todas las hojas de las tareas contratadas están completadas. Revisar y finalizar.' },
    { tipo: 'presupuestos-pendientes', titulo: 'Presupuestos pendientes de aprobación', descripcion: 'Presupuestos pendientes de revisión y decisión.' },
];

export default function AlertasInicio({ rol }) {
    if (![ROLES.ADMIN, ROLES.ADMINISTRACION, ROLES.BODEGA, ROLES.SUPERVISOR].includes(rol)) return null;
    const visibles = alertas.filter(a => ['obras-por-cerrar', 'presupuestos-pendientes'].includes(a.tipo)
        ? [ROLES.ADMIN, ROLES.SUPERVISOR].includes(rol)
        : rol === ROLES.ADMIN || rol === ROLES.ADMINISTRACION || (rol === ROLES.BODEGA && a.tipo === 'stock'));
    return <section aria-labelledby="titulo-alertas"><h2 id="titulo-alertas">Alertas</h2>
        <div className="alpha-alertas">{visibles
            .map(a => <TarjetaAlerta key={`${rol}-${a.tipo}`} {...a} rol={rol} />)}</div>
    </section>;
}

function TarjetaAlerta({ tipo, titulo, descripcion, rol }) {
    const [pagina, setPagina] = useState(1);
    const [version, setVersion] = useState(0);
    const [resultado, setResultado] = useState(null);
    const clave = `${tipo}-${pagina}-${version}`;
    useEffect(() => {
        let vigente = true;
        api(`/api/alertas/${tipo}?${new URLSearchParams({ pagina })}`)
            .then(datos => { if (vigente) setResultado({ clave, datos }); })
            .catch(error => { if (vigente) setResultado({ clave, error: error.message }); });
        return () => { vigente = false; };
    }, [tipo, pagina, version, clave]);
    const vigente = resultado?.clave === clave;
    return <article className="alpha-alerta">
        <h3>{titulo}</h3><p>{descripcion}</p>
        {!vigente ? <p role="status">Cargando alertas…</p> : resultado.error
            ? <p role="alert">{resultado.error}<button onClick={() => setVersion(v => v + 1)}>Reintentar</button></p>
            : <>
                <p className={resultado.datos.total ? 'alpha-critico' : undefined}><strong>{resultado.datos.total}</strong> {tipo === 'stock' ? 'artículos' : tipo === 'obras-por-cerrar' ? 'obras' : tipo === 'presupuestos-pendientes' ? 'presupuestos' : 'facturas'}</p>
                {!resultado.datos.total && <p>No hay alertas de este tipo.</p>}
                <ul>{resultado.datos.registros.map(r => <li key={tipo === 'stock' ? r.id_articulo : tipo === 'obras-por-cerrar' ? r.id_obra : tipo === 'presupuestos-pendientes' ? r.id_presupuesto : r.id_documento}>
                    {tipo === 'obras-por-cerrar' ? <>
                        <Link to={`/beta/obras/${r.id_obra}`}>{r.nombre_obra} — {r.razon_social}</Link>
                        <p>Tareas completadas. Pendiente de revisión y cierre.</p>
                    </> : tipo === 'presupuestos-pendientes' ? <>
                        <Link to={`/beta/presupuestos/${r.id_presupuesto}`}>Presupuesto #{r.id_presupuesto} — {r.razon_social}</Link>
                        <p>Total: {pesos(r.monto_total)} CLP · Origen: {r.origen}</p>
                    </> : tipo === 'stock' ? <>
                        {[ROLES.ADMIN, ROLES.BODEGA].includes(rol)
                            ? <Link to={`/alpha/articulos/${r.id_articulo}/movimientos`}>{r.codigo_interno} — {r.nombre}</Link>
                            : <span>{r.codigo_interno} — {r.nombre}</span>}
                        <p>Disponible: {Number(r.stock_disponible)} {r.unidad_medida} · Mínimo: {Number(r.stock_minimo)} {r.unidad_medida}</p>
                    </> : <>
                        <Link to={tipo.startsWith('clientes-')?`/beta/facturas-clientes/${r.id_documento}`:`/alpha/proveedores/${r.id_proveedor}/documentos/${r.id_documento}/comprobante`}>Factura {r.folio} — {r.razon_social}</Link>
                        <p>Vencimiento: {String(r.fecha_vencimiento).slice(0, 10).split('-').reverse().join('-')}</p>
                        <p>Saldo pendiente: {pesos(r.saldo_pendiente)} CLP</p>
                        {r.dias_restantes!=null && <p>{r.dias_restantes<0?`Vencida hace ${Math.abs(r.dias_restantes)} días`:r.dias_restantes===0?'Vence hoy':`Vence en ${r.dias_restantes} días`}</p>}
                    </>}
                </li>)}</ul>
                {resultado.datos.total > resultado.datos.limite && <nav aria-label={`Páginas de ${titulo.toLowerCase()}`}>
                    <button disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>Anterior</button>
                    <span>Página {pagina}</span>
                    <button disabled={pagina * resultado.datos.limite >= resultado.datos.total} onClick={() => setPagina(p => p + 1)}>Siguiente</button>
                </nav>}
                <button type="button" onClick={() => { setPagina(1); setVersion(v => v + 1); }}>Actualizar</button>
            </>}
    </article>;
}
