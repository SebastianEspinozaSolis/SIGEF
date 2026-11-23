import { pesos } from '../../utils/importes';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, descargar } from '../../api/cliente';
import ErrorCarga from '../../components/ErrorCarga';
import { tiposDocumento } from './configuracionFichas';
import './alpha.css';
import './comprobante.css';

const cantidad = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 3 });
// Las fechas DATE no se convierten a zona horaria para evitar cambiar su día.
function fecha(valor) {
    if (!valor) return '—';
    return String(valor).slice(0, 10).split('-').reverse().join('-');
}

export default function ComprobanteDocumentoProveedor() {
    const { proveedor, id } = useParams();
    const [resultado, setResultado] = useState(null);
    const [version, setVersion] = useState(0);
    const [descargando, setDescargando] = useState(false);
    const [errorDescarga, setErrorDescarga] = useState('');
    const clave = `${proveedor}-${id}-${version}`;
    const regreso = `/alpha/proveedores/${proveedor}/documentos`;
    useEffect(() => {
        let vigente = true;
        api(`/api/documentos-proveedor/${proveedor}/${id}`)
            .then(documento => { if (vigente) setResultado({ clave, documento }); })
            .catch(error => { if (vigente) setResultado({ clave, error }); });
        return () => { vigente = false; };
    }, [proveedor, id, version, clave]);

    async function descargarPdf() {
        setDescargando(true); setErrorDescarga('');
        try { await descargar(`/api/documentos-proveedor/${proveedor}/${id}/pdf`, `comprobante-proveedor-${id}.pdf`); }
        catch (err) { setErrorDescarga(err.message); }
        finally { setDescargando(false); }
    }

    if (resultado?.clave !== clave) return <p role="status">Cargando comprobante…</p>;
    if (resultado.error) return <ErrorCarga error={resultado.error} noEncontrado="Documento no encontrado."
        volver={resultado.error.status === 404 ? '/alpha/proveedores' : regreso}
        etiqueta={resultado.error.status === 404 ? 'Volver a proveedores' : 'Volver al listado'}
        reintentar={() => setVersion(v => v + 1)} />;

    const d = resultado.documento;
    const esNota = d.tipo_documento === 'nota_credito';
    const esBoleta = d.tipo_documento === 'boleta';
    const tipo = tiposDocumento.find(([valor]) => valor === d.tipo_documento)?.[1] || d.tipo_documento;
    const totales = esNota ? [['Neto de la correcci\u00f3n', d.total_neto], ['IVA (19 %)', d.iva], ['Total a rebajar', d.total]] : [
        [esBoleta ? 'Subtotal bruto (IVA incluido)' : 'Subtotal', d.subtotal],
        ['Descuentos por producto', d.descuento_productos],
        [esBoleta ? 'Bruto tras descuentos por producto' : 'Subtotal tras descuentos por producto', d.neto_productos],
        [d.es_factura_guias ? 'Descuentos generales incluidos en las guías' : `Descuento general (${cantidad.format(d.descuento_general)} %)`, d.importe_descuento_general],
        [d.es_factura_guias ? 'Descuentos por pronto pago incluidos en las guías' : `Descuento por pronto pago (${cantidad.format(d.descuento_pronto_pago)} %)`, d.importe_descuento_pronto_pago],
        ['Total neto', d.total_neto],
        [`IVA ${esBoleta ? 'incluido ' : ''}(${cantidad.format(d.tasa_iva)} %)`, d.iva],
        ['Total final', d.total],
    ];
    return <section className="alpha comprobante-documento">
        <nav className="comprobante-acciones" aria-label="Acciones del comprobante">
            <button type="button" disabled={descargando} onClick={descargarPdf}>{descargando ? 'Generando PDF…' : 'Descargar PDF'}</button>
            {!esNota && Number(d.total_pagado || 0) === 0 && <Link to={`${regreso}/${id}/editar`}>Editar documento</Link>}
            <Link to={regreso}>Volver al listado</Link>
        </nav>
        {errorDescarga && <p role="alert">No se pudo descargar el comprobante: {errorDescarga}</p>}
        <h1>SIGEF — Comprobante de registro</h1>
        <h2>{tipo} · Folio {d.folio}</h2>
        <dl className="comprobante-datos">
            <div><dt>Proveedor</dt><dd>{d.razon_social}</dd></div>
            <div><dt>RUT</dt><dd>{d.rut_proveedor}</dd></div>
            <div><dt>Fecha de emisión</dt><dd>{fecha(d.fecha_emision)}</dd></div>
            {d.tipo_documento === 'factura' && <div><dt>Fecha de vencimiento</dt><dd>{fecha(d.fecha_vencimiento)}</dd></div>}
            <div><dt>Fecha de registro</dt><dd>{new Date(d.fecha_ingreso).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</dd></div>
            {d.id_documento_referencia && <div><dt>Factura de referencia</dt><dd><Link to={`${regreso}/${d.id_documento_referencia}/comprobante`}>Folio {d.folio_documento_referencia || d.id_documento_referencia}</Link></dd></div>}
        </dl>
        {esBoleta && <p>Pagada: pago incluido al registrar la boleta.</p>}
        {d.tipo_documento === 'guia_despacho' && <p>Importes referenciales. Esta guía no genera deuda.</p>}
        {d.es_factura_guias && <p>Factura de guías: la recepción de materiales se realiza desde las guías asociadas. Los importes incluyen los descuentos aplicados en cada guía; consulta sus comprobantes para ver el desglose.</p>}
        {d.guias?.map(g => <p key={g.id_documento}><Link to={`${regreso}/${g.id_documento}/comprobante`}>Guía {g.folio}</Link></p>)}
        {d.facturas_relacionadas?.map(f => <p key={f.id_documento}>Facturada en <Link to={`${regreso}/${f.id_documento}/comprobante`}>factura {f.folio}</Link>.</p>)}
        {!esNota && <div className="alpha-tabla"><table>
            <caption>Detalle de materiales — importes en CLP {esBoleta ? 'con IVA incluido' : 'sin IVA'}</caption>
            <thead><tr><th>Artículo</th><th>Cantidad</th><th>Unidad</th><th>{esBoleta ? 'Costo bruto unitario' : 'Costo neto unitario'}</th><th>Detalle del importe</th></tr></thead>
            <tbody>{d.detalles.map(l => <tr key={l.id_detalle_documento}>
                <td>{l.articulo}{l.observaciones && <p className="comprobante-observacion">{l.observaciones}</p>}</td>
                <td>{cantidad.format(l.cantidad)}</td><td>{l.unidad_medida}</td><td>{pesos(esBoleta ? l.costo_bruto : l.costo_neto)}</td>
                <td><dl className="comprobante-desglose">
                    <div><dt>Subtotal producto</dt><dd>{pesos(l.desglose.subtotal)} CLP</dd></div>
                    {l.desglose.descuentos.map(x => <div key={x.orden}>
                        <dt>Descuento {x.orden} ({cantidad.format(x.porcentaje)} %)</dt><dd>−{pesos(x.importe)} CLP</dd>
                    </div>)}
                    {l.desglose.descuentos.length > 0 && <div><dt>{esBoleta ? 'Bruto producto' : 'Neto producto'}</dt><dd>{pesos(l.desglose.total_neto)} CLP</dd></div>}
                </dl></td>
            </tr>)}</tbody>
        </table></div>}
        <dl className="comprobante-totales">{totales.map(([nombre, valor]) => <div key={nombre}>
            <dt>{nombre}</dt><dd>{pesos(valor)} CLP</dd>
        </div>)}</dl>
        {d.saldo_pendiente != null && <dl className="comprobante-totales"><div><dt>Pagado</dt><dd>{pesos(d.total_pagado)} CLP</dd></div>
            {Number(d.total_notas_credito) > 0 && <div><dt>Notas de crédito aplicadas</dt><dd>{pesos(d.total_notas_credito)} CLP</dd></div>}
            <div><dt>Saldo pendiente</dt><dd>{pesos(d.saldo_pendiente)} CLP</dd></div></dl>}
        {d.observaciones && <section><h2>Observaciones</h2><p className="comprobante-observacion">{d.observaciones}</p></section>}
        <p>Comprobante interno de SIGEF. No reemplaza el documento del proveedor.</p>
    </section>;
}
