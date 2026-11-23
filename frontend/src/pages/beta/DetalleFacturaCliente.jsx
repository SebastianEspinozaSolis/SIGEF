import {useRef,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {api,descargar} from '../../api/cliente';
import useRegistro from '../../hooks/useRegistro';
import ErrorCarga from '../../components/ErrorCarga';
import ResumenFacturaCliente from '../../components/ResumenFacturaCliente';
import {pesos,evitarCambioConRueda} from '../../utils/importes';
import '../alpha/alpha.css';

function NuevaNota({documento}){
    const navigate=useNavigate();const envio=useRef(false);
    const [form,setForm]=useState(()=>({folio:'',fecha_emision:new Date().toLocaleDateString('sv-SE'),monto_neto_correccion:'',observaciones:'',id_operacion:crypto.randomUUID()}));
    const [fallo,setFallo]=useState('');const [ocupado,setOcupado]=useState(false);
    const cambiar=(campo,valor)=>setForm({...form,[campo]:valor});
    async function guardar(e){e.preventDefault();if(envio.current)return;
        envio.current=true;setOcupado(true);setFallo('');
        try{const d=await api(`/api/facturas-cliente/${documento.id_documento}/notas-credito`,{method:'POST',body:form});navigate(`/beta/facturas-clientes/${d.id_documento}`);}
        catch(err){setFallo(err.message);}finally{envio.current=false;setOcupado(false);}
    }
    const neto=Number(form.monto_neto_correccion || 0),iva=Math.round(neto*19/100);
    return <details><summary>Registrar nota de crédito de monto</summary><form onSubmit={guardar}><fieldset disabled={ocupado}>
        <p>Factura original: {documento.folio}. Saldo por cobrar: {pesos(documento.saldo_pendiente)} CLP.</p>
        <div className="alpha-campos"><label>Folio NC *<input required maxLength={30} value={form.folio} onChange={e=>cambiar('folio',e.target.value)} /></label>
            <label>Fecha de emisión *<input required type="date" value={form.fecha_emision} onChange={e=>cambiar('fecha_emision',e.target.value)} /></label>
            <label>Rebaja neta (CLP) *<input required type="number" min="1" max="999999999999" step="1" inputMode="numeric" onWheel={evitarCambioConRueda} value={form.monto_neto_correccion} onChange={e=>cambiar('monto_neto_correccion',e.target.value)} /></label></div>
        <label>Motivo *<input required maxLength={2000} value={form.observaciones} onChange={e=>cambiar('observaciones',e.target.value)} /></label>
        <p>IVA (19 %): {pesos(iva)} CLP · Total a rebajar: {pesos(neto+iva)} CLP</p>{fallo && <p role="alert">{fallo}</p>}<button>{ocupado?'Guardando…':'Registrar nota de crédito'}</button>
    </fieldset></form></details>;
}
export default function DetalleFacturaCliente(){
    const {id}=useParams();const {datos,error,cargando,recargar}=useRegistro(`/api/facturas-cliente/${id}`);
    const [fallo,setFallo]=useState('');const [ocupado,setOcupado]=useState(false);
    async function pdf(){setOcupado(true);setFallo('');try{await descargar(`/api/facturas-cliente/${id}/pdf`,`documento-cliente-${id}.pdf`);}catch(err){setFallo(err.message);}finally{setOcupado(false);}}
    if(cargando)return <p role="status">Cargando documento…</p>;
    if(error)return <ErrorCarga error={error} volver="/beta/facturas-clientes" noEncontrado="Documento no encontrado" reintentar={recargar} />;
    if(!datos)return null;
    const nota=datos.tipo_documento==='nota_credito';
    return <section className="alpha"><h1>{nota?'Nota de crédito':'Factura de cliente'} — {datos.folio}</h1><p><Link to="/beta/facturas-clientes">Volver al listado</Link> · <button disabled={ocupado} onClick={pdf}>Descargar PDF</button></p>
        <p>Emisión: {new Date(datos.fecha_emision).toLocaleDateString('es-CL')}{datos.fecha_vencimiento && ` · Vencimiento: ${new Date(datos.fecha_vencimiento).toLocaleDateString('es-CL')}`}</p>
        {nota && <p>Factura original: <Link to={`/beta/facturas-clientes/${datos.id_documento_referencia}`}>{datos.folio_referencia}</Link></p>}
        <ResumenFacturaCliente datos={datos} />{datos.observaciones && <p>Observaciones: {datos.observaciones}</p>}
        {!nota && <p><Link to={`/beta/facturas-clientes/${id}/pagos`}>Registrar pago o ver abonos</Link></p>}
        {!!datos.notas?.length && <><h2>Notas de crédito aplicadas</h2><ul>{datos.notas.map(n=><li key={n.id_documento}><Link to={`/beta/facturas-clientes/${n.id_documento}`}>Nota de crédito {n.folio}</Link></li>)}</ul></>}
        {!nota && Number(datos.saldo_pendiente)>0 && <NuevaNota key={id} documento={datos} />}
        {fallo && <p role="alert">{fallo}</p>}<p>Registro interno de SIGEF; no reemplaza la emisión tributaria ante el SII.</p>
    </section>;
}
