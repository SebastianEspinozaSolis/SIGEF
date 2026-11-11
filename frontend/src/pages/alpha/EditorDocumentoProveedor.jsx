import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/cliente';
import { tiposDocumento } from './configuracionFichas';
import './alpha.css';

function hoy() {
    const fecha = new Date();
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}
export default function EditorDocumentoProveedor() {
    const { proveedor, id } = useParams();
    const [resultado, setResultado] = useState(null);
    const [version, setVersion] = useState(0);
    const clave = `${proveedor}-${id || 'nuevo'}-${version}`;
    useEffect(() => {
        let vigente = true;
        Promise.all([api(`/api/proveedores/${proveedor}`), id ? api(`/api/documentos-proveedor/${proveedor}/${id}`) : Promise.resolve(null)])
            .then(([ficha, documento]) => { if (vigente) setResultado({ clave, ficha, documento }); })
            .catch((err) => { if (vigente) setResultado({ clave, error: err.message }); });
        return () => { vigente = false; };
    }, [proveedor, id, version, clave]);
    if (resultado?.clave !== clave) return <p role="status">Cargando documento…</p>;
    if (resultado.error) return <section><p role="alert">{resultado.error}</p><button onClick={() => setVersion((v) => v + 1)}>Reintentar</button>
        <Link to={`/alpha/proveedores/${proveedor}/documentos`}>Volver</Link></section>;

    return <FormularioDocumento key={clave} proveedor={resultado.ficha} documento={resultado.documento} />;
}
function FormularioDocumento({ proveedor, documento }) {
    const bloqueado = Boolean(documento?.tiene_recepciones);
    const navigate = useNavigate();
    const [form, setForm] = useState(() => ({ tipo_documento: documento?.tipo_documento || 'factura', folio: documento?.folio || '',
        fecha_emision: documento ? String(documento.fecha_emision).slice(0,10) : hoy(),
        fecha_vencimiento: documento?.fecha_vencimiento ? String(documento.fecha_vencimiento).slice(0,10) : '', observaciones: documento?.observaciones || '',
        id_documento_referencia: documento?.id_documento_referencia || '', descuento_general: documento?.descuento_general || '0',
        descuento_pronto_pago: documento?.descuento_pronto_pago || '0', tasa_iva: documento?.tasa_iva || '19' }));
    const [lineas, setLineas] = useState(() => (documento?.detalles || []).map((d, i) => ({ ...d, clave: `guardado-${i}` })));
    const siguiente = useRef(0);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [errores, setErrores] = useState({});
    const regreso = `/alpha/proveedores/${proveedor.id_proveedor}/documentos`;
    function cambiar(e) { setForm((f) => ({ ...f, [e.target.name]: e.target.value, ...(e.target.name === 'tipo_documento' && { id_documento_referencia: '' }) })); }
    function cambiarLinea(clave, campo, valor) { setLineas((lista) => lista.map((d) => d.clave === clave ? { ...d, [campo]: valor } : d)); }
    function agregar(a) {
        siguiente.current += 1;
        setLineas((lista) => [...lista, { clave: `nuevo-${siguiente.current}`, id_articulo: a.id_articulo, articulo: a.nombre,
            unidad_medida: a.unidad_medida, cantidad: '', costo_neto: '', precio_lista: a.precio_lista,
            descuento_1: '0', descuento_2: '0', descuento_3: '0', observaciones: '' }]);
    }
    async function guardar(e) {
        e.preventDefault(); setGuardando(true); setError(''); setErrores({});
        try {
            const guardado = await api(`/api/documentos-proveedor/${proveedor.id_proveedor}${documento ? `/${documento.id_documento}` : ''}`, {
                method: documento ? 'PUT' : 'POST', body: { ...form, detalles: lineas.map(({ clave, articulo, unidad_medida, fecha_ingreso, ...d }) => { void clave; void articulo; void unidad_medida; void fecha_ingreso; return d; }) },
            });
            navigate(`${regreso}/${guardado.id_documento}/comprobante`);
        } catch(err) { setError(err.message); setErrores(err.errores || {}); }
        finally { setGuardando(false); }
    }
    return <section className="alpha"><h1>{documento ? 'Editar documento de proveedor' : 'Crear documento de proveedor'}</h1>
        <p>{proveedor.rut_proveedor} — {proveedor.razon_social}</p>
        <p>Registrar el documento no modifica existencias. Bodega confirmará por separado los materiales recibidos.</p>
        <form onSubmit={guardar}><fieldset disabled={guardando}>
            <div className="alpha-campos">
                <label>Tipo de documento *<select name="tipo_documento" disabled={bloqueado} value={form.tipo_documento} onChange={cambiar}>{tiposDocumento.map(([valor, nombre]) => <option key={valor} value={valor}>{nombre}</option>)}</select></label>
                <label>Número de documento *<input name="folio" maxLength={30} value={form.folio} onChange={cambiar} required /></label>
                <label>Fecha de emisión *<input type="date" name="fecha_emision" value={form.fecha_emision} onChange={cambiar} required /></label>
                <label>Fecha de vencimiento {form.tipo_documento === 'factura' ? '*' : '(opcional)'}
                    <input type="date" name="fecha_vencimiento" min={form.fecha_emision || undefined} value={form.fecha_vencimiento} onChange={cambiar} required={form.tipo_documento === 'factura'} />
                    <small>Indica la fecha límite de pago. Para facturas al contado puede coincidir con la fecha de emisión.</small>
                </label>
                {documento && <p>Fecha de registro del documento: {new Date(documento.fecha_ingreso).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</p>}
                <label>Observaciones<textarea name="observaciones" maxLength={5000} value={form.observaciones} onChange={cambiar} /></label>
                {form.tipo_documento === 'nota_credito' && <><label>Identificador del documento original *<input name="id_documento_referencia" disabled={bloqueado} type="number" min="1" step="1" required value={form.id_documento_referencia} onChange={cambiar} /></label>
                    <p>Esta nota de crédito no se recibe como compra. Su aplicación a devoluciones o correcciones de costos está pendiente.</p></>}
            </div>
            <fieldset disabled={bloqueado}>
            <h2>Materiales</h2>{!bloqueado && <BuscadorArticulo agregar={agregar} />}
            {lineas.map((d, i) => <fieldset key={d.clave}><legend>{d.articulo} ({d.unidad_medida})</legend>
                <div className="alpha-campos">
                    {[['cantidad','Cantidad'],['costo_neto','Costo neto unitario (sin IVA)']].map(([campo, nombre]) => <label key={campo}>{nombre} *
                        <input type="number" min={campo === 'cantidad' ? (d.unidad_medida === 'UN' ? '1' : '0.001') : '0'}
                            step={campo === 'cantidad' ? (d.unidad_medida === 'UN' ? '1' : '0.001') : '0.0001'}
                            value={d[campo]} onChange={(e) => cambiarLinea(d.clave, campo, e.target.value)} required />
                        {errores[`detalles.${i}.${campo}`] && <small>{errores[`detalles.${i}.${campo}`]}</small>}
                    </label>)}
                    <label>Observaciones<textarea maxLength={2000} value={d.observaciones || ''} onChange={(e) => cambiarLinea(d.clave, 'observaciones', e.target.value)} /></label>
                </div>
                <Descuentos key={`descuentos-${d.clave}`} campos={['descuento_1', 'descuento_2', 'descuento_3']}
                    valores={d} cambiar={(valores) => setLineas((lista) => lista.map((l) => l.clave === d.clave ? { ...l, ...valores } : l))} />
                <p>Precio de lista unitario (IVA incluido): {Number(d.precio_lista).toLocaleString('es-CL')} CLP.</p>
                <Margen linea={d} tasa={form.tasa_iva} />
                <button type="button" onClick={() => setLineas((lista) => lista.filter((l) => l.clave !== d.clave))}>Quitar material</button>
            </fieldset>)}
            <h2>Descuentos y totales</h2><p>Los tres descuentos por producto se aplican sucesivamente. Después se aplica el descuento general y luego el de pronto pago.</p>
            <div className="alpha-campos">
                {[['descuento_general', 'Descuento general (%)'], ['descuento_pronto_pago', 'Descuento por pago anticipado (%)']].map(([campo, etiqueta]) => <label key={campo}>
                    {etiqueta}<input name={campo} type="number" min="0" max="100" step="0.01" value={form[campo]} onChange={cambiar} required />
                </label>)}
            </div>
            <p>Estos descuentos se aplican al conjunto del documento, después de los descuentos de cada material.</p>
            <label>IVA (%)<input name="tasa_iva" type="number" min="0" max="100" step="0.01" value={form.tasa_iva} onChange={cambiar} required /></label>
            <p>Los totales se calculan desde los materiales, descuentos y tasa de IVA.</p>
            {documento && <p>Totales del documento: subtotal {documento.subtotal}, neto {documento.total_neto}, IVA {documento.iva}, total {documento.total} CLP.</p>}
            </fieldset>
            {bloqueado && <p>Este documento tiene recepciones. Solo puedes editar número, fechas de emisión y vencimiento y observaciones generales.</p>}
            {Object.entries(errores).map(([campo, mensaje]) => <p role="alert" key={campo}>{campo}: {mensaje}</p>)}
            {error && <p role="alert">{error}</p>}
            <button type="submit" disabled={!lineas.length || lineas.length > 100}>{guardando ? 'Guardando…' : documento ? 'Guardar cambios' : 'Registrar documento'}</button>
        </fieldset></form>
        {!guardando && <Link to={regreso}>Cancelar</Link>}
    </section>;
}
function Margen({ linea, tasa }) {
    const costo = Number(linea.costo_neto) * ['descuento_1','descuento_2','descuento_3'].reduce((factor, campo) => factor * (1 - Number(linea[campo]) / 100), 1);
    const ventaNeta = Number(linea.precio_lista) / (1 + Number(tasa) / 100);
    return <p>Margen estimado sobre venta neta, tras descuentos de producto: {ventaNeta > 0 && Number.isFinite(costo) && linea.costo_neto !== '' ? `${((ventaNeta - costo) / ventaNeta * 100).toFixed(2)} %` : '—'}. No incluye descuentos generales.</p>;
}
function BuscadorArticulo({ agregar }) {
    const [q, setQ] = useState('');
    const [pagina, setPagina] = useState(1);
    const [version, setVersion] = useState(0);
    const [resultado, setResultado] = useState(null);
    const clave = `${q}-${pagina}-${version}`;
    useEffect(() => {
        let vigente = true;
        const timer = setTimeout(() => api(`/api/documentos-proveedor/articulos?${new URLSearchParams({ q, pagina })}`)
            .then((datos) => { if (vigente) setResultado({ clave, datos }); })
            .catch((err) => { if (vigente) setResultado({ clave, error: err.message }); }), 250);
        return () => { vigente = false; clearTimeout(timer); };
    }, [q, pagina, version, clave]);
    return <div><label>Buscar artículo<input type="search" maxLength={150} value={q} onChange={(e) => { setQ(e.target.value); setPagina(1); }} /></label>
        <small>Filtra por código o nombre. Sin búsqueda se muestran los artículos activos.</small>
        {resultado?.clave !== clave ? <p role="status">Cargando artículos…</p> : resultado.error ? <p role="alert">{resultado.error}<button type="button" onClick={() => setVersion((v) => v + 1)}>Reintentar</button></p> : <>
            <div className="alpha-tabla"><table>
                <caption>Artículos disponibles</caption>
                <thead><tr><th>Código</th><th>Artículo</th><th>Unidad</th><th>Acciones</th></tr></thead>
                <tbody>{resultado.datos.registros.map((a) => <tr key={a.id_articulo}>
                    <td>{a.codigo_interno}</td><td>{a.nombre}</td><td>{a.unidad_medida}</td>
                    <td><button type="button" onClick={() => agregar(a)} aria-label={`Agregar ${a.nombre}`}>Agregar</button></td>
                </tr>)}</tbody>
            </table></div>
            {!resultado.datos.registros.length && <p>No hay artículos activos para esta búsqueda.</p>}
            <button type="button" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
            <button type="button" disabled={pagina * resultado.datos.limite >= resultado.datos.total} onClick={() => setPagina((p) => p + 1)}>Siguiente</button>
        </>}
    </div>;
}

// Los descuentos no visibles se envían como cero, conservando el contrato de la API.
function Descuentos({ campos, valores, cambiar }) {
    const [visibles, setVisibles] = useState(() => campos.reduce((total, campo, i) => Number(valores[campo]) > 0 ? i + 1 : total, 0));
    function quitar(indice) {
        const anteriores = campos.slice(0, visibles).map((campo) => valores[campo]);
        anteriores.splice(indice, 1);
        cambiar(Object.fromEntries(campos.map((campo, i) => [campo, anteriores[i] ?? '0'])));
        setVisibles((cantidad) => cantidad - 1);
    }
    return <div>
        <h3>Descuentos del material</h3>
        {!visibles && <p>Sin descuentos.</p>}
        {campos.slice(0, visibles).map((campo, i) => <div key={campo}>
            <label>Descuento {i + 1} (%)
                <input type="number" min="0" max="100" step="0.01" required value={valores[campo]}
                    onChange={(e) => cambiar({ [campo]: e.target.value })} />
            </label>
            <button type="button" onClick={() => quitar(i)}>Quitar descuento {i + 1}</button>
        </div>)}
        <button type="button" disabled={visibles >= campos.length} onClick={() => {
            cambiar({ [campos[visibles]]: '0' });
            setVisibles((cantidad) => cantidad + 1);
        }}>Agregar descuento</button>
        <small>Hasta {campos.length} descuentos aplicados sucesivamente.</small>
    </div>;
}
