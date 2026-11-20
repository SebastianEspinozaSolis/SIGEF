import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/cliente';
import ErrorCarga from '../../components/ErrorCarga';
import { tiposDocumento } from './configuracionFichas';
import './alpha.css';

export default function RecepcionesCompra() {
    const { id } = useParams();
    return id ? <Recepcion key={id} id={id} /> : <Listado />;
}
function Listado() {
    const [q,setQ]=useState('');
    const [pagina,setPagina]=useState(1);
    const [version,setVersion]=useState(0);
    const [resultado,setResultado]=useState(null);
    const clave=`${q}-${pagina}-${version}`;
    useEffect(()=>{
        let vigente=true;
        const timer=setTimeout(()=>api(`/api/recepciones-compra?${new URLSearchParams({q,pagina})}`)
            .then((datos)=>{if(vigente)setResultado({clave,datos});})
            .catch((e)=>{if(vigente)setResultado({clave,error:e.message});}),250);
        return ()=>{vigente=false;clearTimeout(timer);};
    },[q,pagina,version,clave]);
    return <section className="alpha"><Link to="/">Volver al menú</Link><h1>Recepción de compras</h1>
        <label>Buscar por documento, proveedor o RUT<input type="search" maxLength={150} value={q} onChange={(e)=>{setQ(e.target.value);setPagina(1);}} /></label>
        {resultado?.clave!==clave?<p role="status">Cargando documentos…</p>:resultado.error?<p role="alert">{resultado.error}<button onClick={()=>setVersion(v=>v+1)}>Reintentar</button></p>:<>
            <table><thead><tr><th>Proveedor</th><th>Documento</th><th>Recepción</th><th>Acciones</th></tr></thead>
                <tbody>{resultado.datos.registros.map(d=><tr key={d.id_documento}>
                    <td>{d.razon_social} — {d.rut_proveedor}</td><td>{tiposDocumento.find(([valor])=>valor===d.tipo_documento)?.[1]} {d.folio}</td>
                    <td>{d.tiene_pendientes?'Materiales pendientes':'Completa'}</td><td><Link to={`/alpha/recepciones-compra/${d.id_documento}`}>{d.tiene_pendientes?'Recepcionar':'Consultar'}</Link></td>
                </tr>)}</tbody></table>
            {!resultado.datos.registros.length&&<p>No hay documentos registrados para recibir.</p>}
            <button disabled={pagina<=1} onClick={()=>setPagina(p=>p-1)}>Anterior</button><span>Página {pagina}</span>
            <button disabled={pagina*resultado.datos.limite>=resultado.datos.total} onClick={()=>setPagina(p=>p+1)}>Siguiente</button>
        </>}
    </section>;
}
export function Recepcion({id, idArticulo, idLinea, onConfirmado}) {
    const [doc,setDoc]=useState(null);
    const [error,setError]=useState('');
    const [errorCarga,setErrorCarga]=useState(null);
    const [version,setVersion]=useState(0);
    const [entradas,setEntradas]=useState({});
    const [observaciones,setObservaciones]=useState('');
    const [guardando,setGuardando]=useState(false);
    const [ok,setOk]=useState('');
    useEffect(()=>{
        let vigente=true;
        api(`/api/recepciones-compra/${id}`).then(d=>{if(vigente){setDoc(d);setErrorCarga(null);}})
            .catch(e=>{if(vigente)setErrorCarga(e);});
        return ()=>{vigente=false;};
    },[id,version]);
    async function confirmar(e) {
        e.preventDefault();
        const solicitud={observaciones,
            lineas:Object.entries(entradas).filter(([,v])=>v.activo).map(([id,c])=>({id_detalle_documento:Number(id),cantidad:c.cantidad}))};
        if(!solicitud.lineas.length){setError('Selecciona los materiales recibidos');return;}
        setGuardando(true);setError('');setOk('');
        try {
            const r=await api(`/api/recepciones-compra/${id}`,{method:'POST',body:solicitud});
            setDoc(r.documento);setEntradas({});setObservaciones('');
            setOk('Recepción confirmada. Existencias y PMP actualizados.');
            onConfirmado?.();
        }catch(e){setError(e.message);setVersion(v=>v+1);}
        finally{setGuardando(false);}
    }
    return <section className="alpha">{!idArticulo && <><Link to="/alpha/recepciones-compra">Volver a compras</Link><h1>Recepcionar materiales</h1></>}
        {errorCarga?<ErrorCarga error={errorCarga} noEncontrado="Documento de compra no encontrado."
            volver="/alpha/recepciones-compra" etiqueta="Volver a compras" reintentar={()=>setVersion(v=>v+1)} />:!doc?<p role="status">Cargando…</p>:<>
            <h2>{doc.razon_social} — {doc.rut_proveedor}</h2><p>{tiposDocumento.find(([v])=>v===doc.tipo_documento)?.[1]} {doc.folio}</p>
            <p>Marca los materiales que llegaron e indica cuánto recibiste. Solo la confirmación aumenta existencias.</p>
            {ok&&<p role="status">{ok}</p>}{error&&<p role="alert">{error}</p>}
            <form onSubmit={confirmar}><fieldset disabled={guardando||doc.tipo_documento==='nota_credito'}>
                <div className="alpha-tabla"><table><thead><tr><th>Recibir</th><th>Material</th><th>Unidad</th><th>Comprado</th><th>Recibido</th><th>Pendiente</th><th>Recibir ahora</th></tr></thead>
                    <tbody>{doc.detalles.filter(l=>!idArticulo || (String(l.id_articulo)===String(idArticulo) && String(l.id_detalle_documento)===String(idLinea))).map(l=>{
                        const entrada=entradas[l.id_detalle_documento]||{activo:false,cantidad:''};
                        const disponible=Number(l.cantidad_pendiente)>0&&l.activo;
                        return <tr key={l.id_detalle_documento}><td><input type="checkbox" aria-label={`Recibir ${l.nombre}`} disabled={!disponible} checked={entrada.activo}
                            onChange={e=>setEntradas(a=>({...a,[l.id_detalle_documento]:{...entrada,activo:e.target.checked,cantidad:entrada.cantidad||String(Number(l.cantidad_pendiente))}}))} /></td>
                            <td>{l.codigo_interno} — {l.nombre}{!l.activo&&' (inactivo)'}</td><td>{l.unidad_medida}</td><td>{Number(l.cantidad)}</td><td>{Number(l.cantidad_recibida)}</td><td>{Number(l.cantidad_pendiente)}</td>
                            <td><input type="number" aria-label={`Cantidad recibida de ${l.nombre}`} disabled={!entrada.activo||!disponible} required={entrada.activo}
                                min={l.unidad_medida==='UN'?'1':'0.001'} max={l.cantidad_pendiente} step={l.unidad_medida==='UN'?'1':'0.001'} value={entrada.cantidad}
                                onChange={e=>setEntradas(a=>({...a,[l.id_detalle_documento]:{...entrada,cantidad:e.target.value}}))}
                                onBlur={e=>{
                                    // Quita ceros sobrantes en UN sin redondear cantidades fraccionarias inválidas.
                                    if(l.unidad_medida==='UN' && e.target.value!=='' && Number.isInteger(Number(e.target.value))) {
                                        const cantidad=String(Number(e.target.value));
                                        setEntradas(a=>({...a,[l.id_detalle_documento]:{...a[l.id_detalle_documento],cantidad}}));
                                    }
                                }} /></td>
                        </tr>;
                    })}</tbody></table></div>
                <label>Observaciones<textarea maxLength={2000} value={observaciones} onChange={e=>setObservaciones(e.target.value)} /></label>
            </fieldset>
                <button type="submit" disabled={guardando||!Object.values(entradas).some(c=>c.activo)}>{guardando?'Confirmando…':'Confirmar recepción'}</button>
            </form>
        </>}
    </section>;
}
