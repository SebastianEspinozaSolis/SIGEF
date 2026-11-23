import {useRef,useState} from 'react';
import {Link,useNavigate,useSearchParams} from 'react-router-dom';
import {api} from '../../api/cliente';
import useRegistro from '../../hooks/useRegistro';
import SelectorPaginado from '../../components/SelectorPaginado';
import ResumenFacturaCliente from '../../components/ResumenFacturaCliente';
import '../alpha/alpha.css';

export default function EditorFacturaCliente(){
    const [parametros]=useSearchParams();const navigate=useNavigate();
    const [obra,setObra]=useState(parametros.get('obra') || '');
    const [form,setForm]=useState(()=>({folio:'',fecha_emision:new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' }),fecha_vencimiento:'',descuento_general:'0',observaciones:''}));
    const [operacion]=useState(()=>crypto.randomUUID());
    const {datos,error,cargando,recargar}=useRegistro(obra?`/api/facturas-cliente/previsualizar/${obra}?descuento=${encodeURIComponent(form.descuento_general || '0')}`:null);
    const [fallo,setFallo]=useState('');const [ocupado,setOcupado]=useState(false);const envio=useRef(false);
    const cambiar=(campo,valor)=>setForm({...form,[campo]:valor});
    async function guardar(e){
        e.preventDefault();if(envio.current || !datos || cargando || error)return;
        if(!window.confirm('¿Confirmar la factura? El cobro y sus datos de origen quedarán bloqueados.'))return;
        envio.current=true;setOcupado(true);setFallo('');
        try{const d=await api('/api/facturas-cliente',{method:'POST',body:{...form,descuento_general:form.descuento_general || '0',id_obra:Number(obra),id_operacion:operacion}});navigate(`/beta/facturas-clientes/${d.id_documento}`);}
        catch(err){setFallo(err.message);}finally{envio.current=false;setOcupado(false);}
    }
    return <section className="alpha"><h1>Nueva factura de cliente</h1><p><Link to="/beta/facturas-clientes">Volver al listado</Link></p>
        <form onSubmit={guardar}><fieldset disabled={ocupado}><SelectorPaginado ruta="/api/facturas-cliente/obras" etiqueta="Obra finalizada" campoId="id_obra" valor={obra} nombre={o=>`${o.nombre_obra} — ${o.razon_social}`} alCambiar={valor=>setObra(valor)} />
            <div className="alpha-campos"><label>Folio *<input required maxLength={30} value={form.folio} onChange={e=>cambiar('folio',e.target.value)} /></label>
                <label>Fecha de emisión *<input required type="date" value={form.fecha_emision} onChange={e=>cambiar('fecha_emision',e.target.value)} /></label>
                <label>Vencimiento *<input required type="date" min={form.fecha_emision} value={form.fecha_vencimiento} onChange={e=>cambiar('fecha_vencimiento',e.target.value)} /></label>
                <label>Descuento general (%)<input required type="number" min="0" max="100" step="0.01" value={form.descuento_general} onChange={e=>cambiar('descuento_general',e.target.value)} /></label></div>
            <label>Observaciones<input maxLength={2000} value={form.observaciones} onChange={e=>cambiar('observaciones',e.target.value)} /></label>
            {cargando && <p role="status">Calculando…</p>}{error && <p role="alert">{error.message} <button type="button" onClick={recargar}>Reintentar</button></p>}
            {datos && !error && <ResumenFacturaCliente datos={datos} />}
            {fallo && <p role="alert">{fallo}</p>}
            <button disabled={!datos || cargando || !!error || ocupado}>{ocupado?'Confirmando…':'Confirmar factura'}</button> <Link to="/beta/facturas-clientes">Cancelar</Link>
        </fieldset></form>
    </section>;
}
