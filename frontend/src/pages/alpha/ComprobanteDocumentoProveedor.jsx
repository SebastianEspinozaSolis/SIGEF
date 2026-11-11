import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/cliente';
import { tiposDocumento } from './configuracionFichas';
import './alpha.css';
import './comprobante.css';

const importe = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
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
    const clave = `${proveedor}-${id}-${version}`;
    const regreso = `/alpha/proveedores/${proveedor}/documentos`;
    useEffect(() => {
        let vigente = true;
        api(`/api/documentos-proveedor/${proveedor}/${id}`)
            .then(documento => { if (vigente) setResultado({ clave, documento }); })
            .catch(error => { if (vigente) setResultado({ clave, error: error.message }); });
        return () => { vigente = false; };
    }, [proveedor, id, version, clave]);

    if (resultado?.clave !== clave) return <p role="status">Cargando comprobante…</p>;
    if (resultado.error) return <section className="alpha"><p role="alert">{resultado.error}</p>
        <button onClick={() => setVersion(v => v + 1)}>Reintentar</button> <Link to={regreso}>Volver al listado</Link></section>;

    const d = resultado.documento;
    const tipo = tiposDocumento.find(([valor]) => valor === d.tipo_documento)?.[1] || d.tipo_documento;
    const totales = [
        ['Subtotal', d.subtotal],
        ['Descuentos por producto', d.descuento_productos],
        ['Subtotal tras descuentos por producto', d.neto_productos],
        [`Descuento general (${cantidad.format(d.descuento_general)} %)`, d.importe_descuento_general],
        [`Descuento por pronto pago (${cantidad.format(d.descuento_pronto_pago)} %)`, d.importe_descuento_pronto_pago],
        ['Total neto', d.total_neto],
        [`IVA (${cantidad.format(d.tasa_iva)} %)`, d.iva],
        ['Total final', d.total],
    ];
    return <section className="alpha comprobante-documento">
        <nav className="comprobante-acciones" aria-label="Acciones del comprobante">
            <button type="button" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
            <Link to={`${regreso}/${id}/editar`}>Editar documento</Link>
            <Link to={regreso}>Volver al listado</Link>
        </nav>
        <h1>SIGEF — Comprobante de registro</h1>
        <h2>{tipo} · Folio {d.folio}</h2>
        <dl className="comprobante-datos">
            <div><dt>Proveedor</dt><dd>{d.razon_social}</dd></div>
            <div><dt>RUT</dt><dd>{d.rut_proveedor}</dd></div>
            <div><dt>Fecha de emisión</dt><dd>{fecha(d.fecha_emision)}</dd></div>
            <div><dt>Fecha de vencimiento</dt><dd>{fecha(d.fecha_vencimiento)}</dd></div>
            <div><dt>Fecha de registro</dt><dd>{new Date(d.fecha_ingreso).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</dd></div>
            {d.id_documento_referencia && <div><dt>Documento de referencia</dt><dd>#{d.id_documento_referencia}</dd></div>}
        </dl>
        <div className="alpha-tabla"><table>
            <caption>Detalle de materiales — importes en CLP</caption>
            <thead><tr><th>Artículo</th><th>Cantidad</th><th>Unidad</th><th>Costo neto unitario</th><th>Descuento 1</th><th>Descuento 2</th><th>Descuento 3</th></tr></thead>
            <tbody>{d.detalles.map(l => <tr key={l.id_detalle_documento}>
                <td>{l.articulo}{l.observaciones && <p className="comprobante-observacion">{l.observaciones}</p>}</td>
                <td>{cantidad.format(l.cantidad)}</td><td>{l.unidad_medida}</td><td>{importe.format(l.costo_neto)}</td>
                {[l.descuento_1, l.descuento_2, l.descuento_3].map((valor, i) => <td key={i}>{cantidad.format(valor)} %</td>)}
            </tr>)}</tbody>
        </table></div>
        <dl className="comprobante-totales">{totales.map(([nombre, valor]) => <div key={nombre}>
            <dt>{nombre}</dt><dd>{importe.format(valor)} CLP</dd>
        </div>)}</dl>
        {d.observaciones && <section><h2>Observaciones</h2><p className="comprobante-observacion">{d.observaciones}</p></section>}
        <p>Comprobante interno de SIGEF. No reemplaza el documento del proveedor.</p>
    </section>;
}
