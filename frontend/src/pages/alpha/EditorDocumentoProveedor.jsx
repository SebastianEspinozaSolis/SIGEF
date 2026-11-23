import { pesos, evitarCambioConRueda } from '../../utils/importes';
import { fechaSantiago } from '../../utils/fechas';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/cliente';
import ErrorCarga from '../../components/ErrorCarga';
import SelectorPaginado from '../../components/SelectorPaginado';
import useListado from '../../hooks/useListado';
import { tiposDocumento } from './configuracionFichas';
import './alpha.css';

function hoy() {
    return fechaSantiago();
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
            .catch((err) => { if (vigente) setResultado({ clave, error: err }); });
        return () => { vigente = false; };
    }, [proveedor, id, version, clave]);
    if (resultado?.clave !== clave) return <p role="status">Cargando documento…</p>;
    if (resultado.error) return <ErrorCarga error={resultado.error}
        noEncontrado="Proveedor o documento no encontrado."
        volver={resultado.error.status === 404 ? '/alpha/proveedores' : `/alpha/proveedores/${proveedor}/documentos`}
        etiqueta={resultado.error.status === 404 ? 'Volver a proveedores' : 'Volver al listado'}
        reintentar={() => setVersion((v) => v + 1)} />;

    return <FormularioDocumento key={clave} proveedor={resultado.ficha} documento={resultado.documento} />;
}
function FormularioDocumento({ proveedor, documento }) {
    const bloqueado = Boolean(Number(documento?.total_notas_credito || 0) > 0 || documento?.tiene_recepciones || documento?.es_factura_guias || documento?.facturas_relacionadas?.length);
    const esNotaRegistrada = documento?.tipo_documento === 'nota_credito';
    const tienePagos = Number(documento?.total_pagado || 0) > 0;
    const navigate = useNavigate();
    const [form, setForm] = useState(() => ({ tipo_documento: documento?.tipo_documento || 'factura', folio: documento?.folio || '',
        fecha_emision: documento ? String(documento.fecha_emision).slice(0,10) : hoy(),
        fecha_vencimiento: documento?.fecha_vencimiento ? String(documento.fecha_vencimiento).slice(0,10) : '', observaciones: documento?.observaciones || '',
        id_documento_referencia: documento?.id_documento_referencia || '', descuento_general: documento?.descuento_general || '0',
        descuento_pronto_pago: documento?.descuento_pronto_pago || '0', tasa_iva: documento?.tasa_iva || '19', monto_neto_correccion: documento?.monto_neto_correccion || '' }));
    const [lineas, setLineas] = useState(() => (documento?.detalles || []).map((d, i) => ({ ...d, clave: `guardado-${i}` })));
    const [facturarGuias, setFacturarGuias] = useState(Boolean(documento?.es_factura_guias));
    const [guias, setGuias] = useState([]);
    const esBoleta = form.tipo_documento === 'boleta';
    const esNota = form.tipo_documento === 'nota_credito';
    const [facturaOriginal, setFacturaOriginal] = useState(null);
    const tasaRebaja = esNotaRegistrada ? form.tasa_iva : facturaOriginal?.tasa_iva ?? '19';
    const rebaja = calcularRebaja(form.monto_neto_correccion, tasaRebaja);
    const excedeSaldo = Boolean(rebaja && facturaOriginal && rebaja.totalCentavos > centavos(facturaOriginal.saldo_pendiente));
    const siguiente = useRef(0);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [errores, setErrores] = useState({});
    const regreso = `/alpha/proveedores/${proveedor.id_proveedor}/documentos`;
    function cambiar(e) { if (e.target.name === 'tipo_documento') { setFacturarGuias(false); setGuias([]); setFacturaOriginal(null); } setForm((f) => ({ ...f, [e.target.name]: e.target.value, ...(e.target.name === 'tipo_documento' && { id_documento_referencia: '' }) })); }
    function cambiarLinea(clave, campo, valor) { setLineas((lista) => lista.map((d) => d.clave === clave ? { ...d, [campo]: valor } : d)); }
    function agregar(a) {
        siguiente.current += 1;
        setLineas((lista) => lista.some(d => String(d.id_articulo) === String(a.id_articulo)) ? lista : [...lista, { clave: `nuevo-${siguiente.current}`, id_articulo: a.id_articulo, articulo: a.nombre,
            unidad_medida: a.unidad_medida, cantidad: '', costo_neto: '', costo_bruto: '', precio_lista: a.precio_lista,
            descuento_1: '0', descuento_2: '0', descuento_3: '0', observaciones: '' }]);
    }
    async function guardar(e) {
        e.preventDefault(); setGuardando(true); setError(''); setErrores({});
        try {
            if (esNota && (!rebaja || excedeSaldo)) throw new Error('Revisa el monto neto: debe ser mayor que cero y su total con IVA no puede superar el saldo pendiente de la factura.');
            const guardado = await api(`/api/documentos-proveedor/${proveedor.id_proveedor}${documento ? `/${documento.id_documento}` : ''}`, {
                method: documento ? 'PUT' : 'POST', body: { ...form, tasa_iva: '19', fecha_vencimiento: form.tipo_documento === 'factura' ? form.fecha_vencimiento : null,
                    ...(facturarGuias && !documento ? { guias: guias.map(g => g.id_documento), descuento_general: '0', descuento_pronto_pago: '0' } : {}),
                    ...(esNota ? { monto_neto_correccion: form.monto_neto_correccion, descuento_general: '0', descuento_pronto_pago: '0' } : { monto_neto_correccion: null }),
                    detalles: facturarGuias || esNota ? [] : lineas.map(({ clave, articulo, unidad_medida, costo_neto, costo_bruto, ...d }) => {
                        void clave; void articulo; void unidad_medida;
                        return { ...d, ...(esBoleta ? { costo_bruto } : { costo_neto }) };
                    }) },
            });
            navigate(`${regreso}/${guardado.id_documento}/comprobante`);
        } catch(err) { setError(err.message); setErrores(err.errores || {}); }
        finally { setGuardando(false); }
    }
    return <section className="alpha"><h1>{documento ? 'Editar documento de proveedor' : 'Crear documento de proveedor'}</h1>
        <p>{proveedor.rut_proveedor} — {proveedor.razon_social}</p>
        {!esNota && <p>Registrar el documento no modifica existencias. Bodega confirmará por separado los materiales recibidos.</p>}
        {esNotaRegistrada && <p role="status">La nota de crédito registrada no admite edición.</p>}
        {tienePagos && <p role="status">El documento tiene pagos registrados y no admite edición.</p>}
        <form onSubmit={guardar}><fieldset disabled={guardando || tienePagos || esNotaRegistrada}>
            <div className="alpha-campos">
                <label>Tipo de documento *<select name="tipo_documento" disabled={bloqueado} value={form.tipo_documento} onChange={cambiar}>{tiposDocumento.map(([valor, nombre]) => <option key={valor} value={valor}>{nombre}</option>)}</select></label>
                <label>Número de documento *<input name="folio" maxLength={30} value={form.folio} onChange={cambiar} required /></label>
                <label>Fecha de emisión *<input type="date" name="fecha_emision" value={form.fecha_emision} onChange={cambiar} required /></label>
                {form.tipo_documento === 'factura' && <label>Fecha de vencimiento *
                    <input type="date" name="fecha_vencimiento" min={form.fecha_emision || undefined} value={form.fecha_vencimiento} onChange={cambiar} required={form.tipo_documento === 'factura'} />
                    <small>Indica la fecha límite de pago. Para facturas al contado puede coincidir con la fecha de emisión.</small>
                </label>}
                {documento && <p>Fecha de registro del documento: {new Date(documento.fecha_ingreso).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</p>}
                <label>{esNota ? 'Observaciones / Motivo *' : 'Observaciones'}<textarea name="observaciones" maxLength={5000} value={form.observaciones} onChange={cambiar} required={esNota} /></label>
                {esNota && <SelectorDocumentoOriginal proveedor={proveedor.id_proveedor} valor={form.id_documento_referencia} disabled={esNotaRegistrada}
                    alCambiar={valor => setForm(f => ({ ...f, id_documento_referencia: valor }))} alCargar={setFacturaOriginal} />}
            </div>
            {form.tipo_documento === 'factura' && !documento && <label><input type="checkbox" checked={facturarGuias} onChange={e => { setFacturarGuias(e.target.checked); setGuias([]); }} /> Facturar guías de despacho</label>}
            {facturarGuias && <><p>Los materiales se reciben desde las guías. Esta factura no genera una segunda recepción.</p>
                {!documento && <SelectorGuias proveedor={proveedor.id_proveedor} seleccionadas={guias} cambiar={setGuias} />}
                {documento && <p>Subtotal: {pesos(documento.subtotal)} CLP. Neto: {pesos(documento.total_neto)} CLP. IVA: {pesos(documento.iva)} CLP. Total: {pesos(documento.total)} CLP.</p>}
                {documento?.guias?.map(g => <p key={g.id_documento}><Link to={`${regreso}/${g.id_documento}/comprobante`}>Guía {g.folio}</Link></p>)}
            </>}
            {esNota && <section><h2>Rebaja de la factura</h2>
                <label>Monto neto de descuento o corrección (CLP) *<input name="monto_neto_correccion" type="number" min="1" step="1" inputMode="numeric" onWheel={evitarCambioConRueda} required value={form.monto_neto_correccion} onChange={cambiar} /></label>
                {rebaja && <dl><dt>Neto a rebajar</dt><dd>{pesos(form.monto_neto_correccion)} CLP</dd><dt>IVA ({Number(tasaRebaja)} %)</dt><dd>{pesos(rebaja.iva)} CLP</dd><dt>Total a rebajar</dt><dd>{pesos(rebaja.total)} CLP</dd></dl>}
                {facturaOriginal && <p>Saldo pendiente de la factura: {pesos(facturaOriginal.saldo_pendiente)} CLP.</p>}
                {excedeSaldo && <p role="alert">El total a rebajar supera el saldo pendiente de la factura.</p>}
            </section>}
            {esBoleta && <p>Ingresa precios brutos en pesos enteros, con IVA incluido. La boleta queda pagada al registrarse.</p>}
            {!esNota && <fieldset disabled={bloqueado || facturarGuias} hidden={facturarGuias}>
            <h2>Materiales</h2>{!bloqueado && <BuscadorArticulo agregar={agregar} seleccionados={lineas.map(d => String(d.id_articulo))} />}
            {lineas.map((d, i) => <fieldset key={d.clave}><legend>{d.articulo} ({d.unidad_medida})</legend>
                <div className="alpha-campos">
                    {[['cantidad','Cantidad'],[esBoleta ? 'costo_bruto' : 'costo_neto', esBoleta ? 'Costo bruto unitario (IVA incluido)' : 'Costo neto unitario (sin IVA)']].map(([campo, nombre]) => <label key={campo}>{nombre} *
                        <input type="number" min={campo === 'cantidad' ? (d.unidad_medida === 'UN' ? '1' : '0.001') : '0'}
                            step={campo === 'cantidad' ? (d.unidad_medida === 'UN' ? '1' : '0.001') : '1'}
                            inputMode={campo === 'cantidad' ? 'decimal' : 'numeric'} onWheel={campo === 'cantidad' ? undefined : evitarCambioConRueda}
                            value={d[campo] ?? ''} onChange={(e) => cambiarLinea(d.clave, campo, e.target.value)} required />
                        {errores[`detalles.${i}.${campo}`] && <small>{errores[`detalles.${i}.${campo}`]}</small>}
                    </label>)}
                    <label>Observaciones<textarea maxLength={2000} value={d.observaciones || ''} onChange={(e) => cambiarLinea(d.clave, 'observaciones', e.target.value)} /></label>
                </div>
                <Descuentos key={`descuentos-${d.clave}`} campos={['descuento_1', 'descuento_2', 'descuento_3']}
                    valores={d} cambiar={(valores) => setLineas((lista) => lista.map((l) => l.clave === d.clave ? { ...l, ...valores } : l))} />
                <p>Precio de lista unitario (IVA incluido): {pesos(d.precio_lista)} CLP.</p>
                <Margen linea={d} esBoleta={esBoleta} />
                <button type="button" onClick={() => setLineas((lista) => lista.filter((l) => l.clave !== d.clave))}>Quitar material</button>
            </fieldset>)}
            <h2>Descuentos y totales</h2><p>Los tres descuentos por producto se aplican sucesivamente. Después se aplica el descuento general y luego el de pronto pago.</p>
            <div className="alpha-campos">
                {[['descuento_general', 'Descuento general (%)'], ['descuento_pronto_pago', 'Descuento por pago anticipado (%)']].map(([campo, etiqueta]) => <label key={campo}>
                    {etiqueta}<input name={campo} type="number" min="0" max="100" step="0.01" value={form[campo]} onChange={cambiar} required />
                </label>)}
            </div>
            <p>Estos descuentos se aplican al conjunto del documento, después de los descuentos de cada material.</p>
            <p>IVA: {esNota ? Number(tasaRebaja) : '19'} % {esBoleta ? "incluido en los precios" : form.tipo_documento === "guia_despacho" ? "referencial; la guía no genera deuda" : "sobre el neto"}.</p>
            <p>Los totales se calculan desde los materiales, descuentos y tasa de IVA.</p>
            {documento && <p>Totales del documento: subtotal {pesos(documento.subtotal)}, neto {pesos(documento.total_neto)}, IVA {pesos(documento.iva)}, total {pesos(documento.total)} CLP.</p>}
            </fieldset>}
            {bloqueado && <p>Este documento tiene recepciones, notas de crédito o está vinculado a una factura. Solo puedes editar número, fechas de emisión y vencimiento y observaciones generales.</p>}
            {Object.entries(errores).map(([campo, mensaje]) => <p role="alert" key={campo}>{campo}: {mensaje}</p>)}
            {error && <p role="alert">{error}</p>}
            <button type="submit" disabled={esNota ? !rebaja || !form.id_documento_referencia || !facturaOriginal || excedeSaldo : facturarGuias ? !documento && !guias.length : !lineas.length || lineas.length > 100}>{guardando ? 'Guardando…' : documento ? 'Guardar cambios' : 'Registrar documento'}</button>
        </fieldset></form>
        {!guardando && <Link to={regreso}>Cancelar</Link>}
    </section>;
}
function Margen({ linea, esBoleta }) {
    const costo = (esBoleta ? Number(linea.costo_bruto) / 1.19 : Number(linea.costo_neto)) * ['descuento_1','descuento_2','descuento_3'].reduce((factor, campo) => factor * (1 - Number(linea[campo]) / 100), 1);
    const ventaNeta = Number(linea.precio_lista) / 1.19;
    return <p>Margen estimado sobre venta neta, tras descuentos de producto: {ventaNeta > 0 && Number.isFinite(costo) && (esBoleta ? linea.costo_bruto : linea.costo_neto) !== '' ? `${((ventaNeta - costo) / ventaNeta * 100).toFixed(2)} %` : '—'}. No incluye descuentos generales.</p>;
}
function BuscadorArticulo({ agregar, seleccionados }) {
    const { q, buscar, pagina, setPagina, datos, error, cargando, recargar } = useListado('/api/documentos-proveedor/articulos');
    return <div><label>Buscar artículo<input type="search" maxLength={150} value={q} onChange={(e) => { buscar(e.target.value); }} /></label>
        <small>Filtra por código o nombre. Sin búsqueda se muestran los artículos activos.</small>
        {cargando ? <p role="status">Cargando artículos…</p> : error ? <p role="alert">{error.message}<button type="button" onClick={recargar}>Reintentar</button></p> : <>
            <div className="alpha-tabla"><table>
                <caption>Artículos disponibles</caption>
                <thead><tr><th>Código</th><th>Artículo</th><th>Unidad</th><th>Acciones</th></tr></thead>
                <tbody>{datos.registros.map((a) => <tr key={a.id_articulo}>
                    <td>{a.codigo_interno}</td><td>{a.nombre}</td><td>{a.unidad_medida}</td>
                    <td><button type="button" disabled={seleccionados.includes(String(a.id_articulo))} onClick={() => agregar(a)} aria-label={`Agregar ${a.nombre}`}>{seleccionados.includes(String(a.id_articulo)) ? 'Agregado' : 'Agregar'}</button></td>
                </tr>)}</tbody>
            </table></div>
            {!datos.registros.length && <p>No hay artículos activos para esta búsqueda.</p>}
            <button type="button" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
            <button type="button" disabled={pagina * datos.limite >= datos.total} onClick={() => setPagina((p) => p + 1)}>Siguiente</button>
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

// Cada guía conserva su detalle y recepción; la selección solo crea el vínculo de facturación.
function SelectorGuias({ proveedor, seleccionadas, cambiar }) {
    const { q, buscar, pagina, setPagina, datos, error, cargando, recargar } = useListado(`/api/documentos-proveedor/${proveedor}/guias-disponibles`);
    const [cargandoDetalle, setCargandoDetalle] = useState(false);
    const [errorDetalle, setErrorDetalle] = useState('');
    async function seleccionar(guia) {
        setCargandoDetalle(true); setErrorDetalle('');
        try {
            const detalle = await api(`/api/documentos-proveedor/${proveedor}/${guia.id_documento}`);
            cambiar(lista => lista.some(g => g.id_documento === detalle.id_documento) ? lista : [...lista, detalle]);
        } catch (err) { setErrorDetalle(err.message); }
        finally { setCargandoDetalle(false); }
    }
    // Suma los importes ya calculados por el servidor, sin recalcular descuentos ni IVA.
    const totales = Object.fromEntries(['subtotal', 'total_neto', 'iva', 'total'].map(campo => [campo, seleccionadas.reduce((suma, guia) => suma + Number(guia[campo]), 0)]));
    return <div><label>Buscar guía por folio<input type="search" value={q} onChange={e => buscar(e.target.value)} /></label>
        {cargando ? <p role="status">Cargando guías…</p> : error ? <p role="alert">{error.message}<button type="button" onClick={recargar}>Reintentar</button></p> : <>
            <div className="alpha-tabla"><table><caption>Guías disponibles de este proveedor</caption><thead><tr><th>Folio</th><th>Acción</th></tr></thead>
                <tbody>{datos.registros.map(g => <tr key={g.id_documento}><td>{g.folio}</td><td><button type="button" disabled={cargandoDetalle || seleccionadas.some(x => x.id_documento === g.id_documento)} onClick={() => seleccionar(g)}>Seleccionar guía {g.folio}</button></td></tr>)}</tbody>
            </table></div>
            {!datos.registros.length && <p>No hay guías disponibles para esta búsqueda.</p>}
            <button type="button" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>Anterior</button><span>Página {pagina}</span>
            <button type="button" disabled={pagina * datos.limite >= datos.total} onClick={() => setPagina(p => p + 1)}>Siguiente</button>
        </>}
        {cargandoDetalle && <p role="status">Cargando materiales de la guía…</p>}{errorDetalle && <p role="alert">{errorDetalle}</p>}
        {seleccionadas.map(g => <section key={g.id_documento}><h3>Guía {g.folio}</h3><Link to={`/alpha/proveedores/${proveedor}/documentos/${g.id_documento}/comprobante`}>Ver comprobante de la guía</Link>
            <div className="alpha-tabla"><table><thead><tr><th>Material</th><th>Cantidad</th><th>Costo neto unitario</th><th>Total neto del material</th></tr></thead><tbody>
                {g.detalles.map(d => <tr key={d.id_detalle_documento}><td>{d.articulo}</td><td>{d.cantidad} {d.unidad_medida}</td><td>{pesos(d.costo_neto)}</td><td>{pesos(d.desglose.total_neto)}</td></tr>)}
            </tbody></table></div><p>Subtotal: {pesos(g.subtotal)} · Neto: {pesos(g.total_neto)} · IVA: {pesos(g.iva)} · Total: {pesos(g.total)} CLP.</p>
            <button type="button" onClick={() => cambiar(lista => lista.filter(x => x.id_documento !== g.id_documento))}>Quitar guía {g.folio}</button>
        </section>)}
        {seleccionadas.length > 0 && <p role="status">Totales de las guías seleccionadas: subtotal {pesos(totales.subtotal)}, neto {pesos(totales.total_neto)}, IVA {pesos(totales.iva)}, total {pesos(totales.total)} CLP.</p>}
        <p>Se facturan guías completas, con sus descuentos por producto. No se agregan descuentos generales ni por pronto pago.</p>
    </div>;
}


function SelectorDocumentoOriginal({ proveedor, valor, disabled, alCambiar, alCargar }) {
    const [actual, setActual] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => {
        if (!valor) { alCargar(null); return; }
        alCargar(null);
        let vigente = true;
        api(`/api/documentos-proveedor/${proveedor}/${valor}`)
            .then(d => { if (vigente) { setActual(d); setError(''); alCargar(d); } })
            .catch(err => { if (vigente) setError(err.message); });
        return () => { vigente = false; };
    }, [proveedor, valor, alCargar]);
    function nombre(d) {
        const fecha = String(d.fecha_emision).slice(0,10).split('-').reverse().join('/');
        return `Factura \u00b7 Folio ${d.folio} \u00b7 ${fecha} \u00b7 Saldo ${pesos(d.saldo_pendiente)} CLP`;
    }
    return <div>
        <SelectorPaginado ruta={`/api/documentos-proveedor/${proveedor}/referencias`}
            etiqueta="Factura original" busqueda="Buscar por folio" valor={valor}
            campoId="id_documento" nombre={nombre} disabled={disabled}
            opcionActual={String(actual?.id_documento) === String(valor) ? actual : null}
            seleccionado="Cargando documento seleccionado..." alCambiar={alCambiar}
            placeholder="Selecciona la factura que corrige la nota"
            vacio="No hay facturas con saldo pendiente de este proveedor." />
        {valor && error && <p role="alert">No se pudo consultar el documento seleccionado: {error}</p>}
    </div>;
}

// La vista previa usa céntimos enteros; el servidor valida y calcula el importe definitivo.
function centavos(valor) {
    if (!/^\d+(?:\.\d{1,2})?$/.test(String(valor))) return 0n;
    const [entero, fraccion = ''] = String(valor).split('.');
    return BigInt(entero) * 100n + BigInt(fraccion.padEnd(2, '0'));
}
function calcularRebaja(valor, tasa) {
    const neto = ((centavos(valor)+50n)/100n)*100n;
    if (neto <= 0n) return null;
    const iva = ((neto * centavos(tasa) + 500000n) / 1000000n)*100n;
    return { iva: Number(iva) / 100, total: Number(neto + iva) / 100, totalCentavos: neto + iva };
}
