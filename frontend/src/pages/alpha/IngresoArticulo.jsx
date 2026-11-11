import { useEffect, useState } from 'react';
import { api } from '../../api/cliente';
import { tiposDocumento } from './configuracionFichas';
import { Recepcion } from './RecepcionesCompra';
import FormularioMovimiento from './FormularioMovimiento';

// La entrada desde el artículo reutiliza la misma confirmación y API de recepción.
export default function IngresoArticulo({ idArticulo, unidad, onConfirmado }) {
    const [asociar, setAsociar] = useState(false);
    return <div>
        <label><span><input type="checkbox" checked={asociar} onChange={(e)=>setAsociar(e.target.checked)} /> Asociar a una compra pendiente</span></label>
        {asociar ? <ComprasPendientes idArticulo={idArticulo} unidad={unidad} onConfirmado={onConfirmado} />
            : <FormularioMovimiento tipo="INGRESO" idArticulo={idArticulo} unidad={unidad} onConfirmado={onConfirmado} />}
    </div>;
}
function ComprasPendientes({ idArticulo, unidad, onConfirmado }) {
    const [q,setQ]=useState('');
    const [pagina,setPagina]=useState(1);
    const [version,setVersion]=useState(0);
    const [resultado,setResultado]=useState(null);
    const [seleccion,setSeleccion]=useState(null);
    const clave=`${idArticulo}-${q}-${pagina}-${version}`;
    useEffect(()=>{
        let vigente=true;
        const timer=setTimeout(()=>api(`/api/recepciones-compra/articulos/${idArticulo}/pendientes?${new URLSearchParams({q,pagina})}`)
            .then(datos=>{if(vigente)setResultado({clave,datos});})
            .catch(e=>{if(vigente)setResultado({clave,error:e.message});}),250);
        return ()=>{vigente=false;clearTimeout(timer);};
    },[idArticulo,q,pagina,version,clave]);
    const vigente=resultado?.clave===clave;
    const lista=vigente&&resultado.datos?resultado.datos.registros:[];
    const opciones=seleccion&&!lista.some(l=>l.id_detalle_documento===seleccion.id_detalle_documento)?[seleccion,...lista]:lista;
    return <div>
        <label>Buscar compra por documento o proveedor<input type="search" maxLength={150} value={q} onChange={e=>{setQ(e.target.value);setPagina(1);}} /></label>
        <label>Compra y material pendiente *<select value={seleccion?.id_detalle_documento||''} disabled={!vigente||Boolean(resultado?.error)}
            onChange={e=>setSeleccion(opciones.find(l=>String(l.id_detalle_documento)===e.target.value)||null)}>
            <option value="">Selecciona una compra</option>
            {opciones.map(l=><option key={l.id_detalle_documento} value={l.id_detalle_documento}>
                {tiposDocumento.find(([t])=>t===l.tipo_documento)?.[1]} {l.folio} — {l.razon_social} — Pendiente: {Number(l.cantidad_pendiente)} {unidad} — línea {l.id_detalle_documento}
            </option>)}
        </select></label>
        {!vigente?<p role="status">Cargando compras pendientes…</p>:resultado.error?<p role="alert">{resultado.error}<button type="button" onClick={()=>setVersion(v=>v+1)}>Reintentar</button></p>:<>
            {!lista.length&&<p>No hay compras pendientes de este artículo para esta búsqueda.</p>}
            <nav aria-label="Compras pendientes"><button type="button" disabled={pagina<=1} onClick={()=>setPagina(p=>p-1)}>Anterior</button>
                <span>Página {pagina}</span><button type="button" disabled={pagina*resultado.datos.limite>=resultado.datos.total} onClick={()=>setPagina(p=>p+1)}>Siguiente</button></nav>
        </>}
        {seleccion&&<>
            <p>Costo neto unitario aplicado: {seleccion.costo_unitario_aplicado} CLP, incluidos los descuentos del documento.</p>
            <Recepcion key={seleccion.id_detalle_documento} id={seleccion.id_documento} idArticulo={idArticulo} idLinea={seleccion.id_detalle_documento}
                onConfirmado={()=>{setVersion(v=>v+1);onConfirmado?.();}} />
        </>}
    </div>;
}
