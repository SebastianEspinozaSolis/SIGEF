import { useState } from 'react';
import useListado from '../../hooks/useListado';
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
    const { q, buscar, pagina, setPagina, datos, error, cargando, recargar } = useListado(`/api/recepciones-compra/articulos/${idArticulo}/pendientes`);
    const [seleccion,setSeleccion]=useState(null);
    const lista=datos?.registros || [];
    const opciones=seleccion&&!lista.some(l=>l.id_detalle_documento===seleccion.id_detalle_documento)?[seleccion,...lista]:lista;
    return <div>
        <label>Buscar compra por documento o proveedor<input type="search" maxLength={150} value={q} onChange={e=>{buscar(e.target.value);}} /></label>
        <label>Compra y material pendiente *<select value={seleccion?.id_detalle_documento||''} disabled={cargando||Boolean(error)}
            onChange={e=>setSeleccion(opciones.find(l=>String(l.id_detalle_documento)===e.target.value)||null)}>
            <option value="">Selecciona una compra</option>
            {opciones.map(l=><option key={l.id_detalle_documento} value={l.id_detalle_documento}>
                {tiposDocumento.find(([t])=>t===l.tipo_documento)?.[1]} {l.folio} — {l.razon_social} — Pendiente: {Number(l.cantidad_pendiente)} {unidad} — línea {l.id_detalle_documento}
            </option>)}
        </select></label>
        {cargando?<p role="status">Cargando compras pendientes…</p>:error?<p role="alert">{error.message}<button type="button" onClick={recargar}>Reintentar</button></p>:<>
            {!lista.length&&<p>No hay compras pendientes de este artículo para esta búsqueda.</p>}
            <nav aria-label="Compras pendientes"><button type="button" disabled={pagina<=1} onClick={()=>setPagina(p=>p-1)}>Anterior</button>
                <span>Página {pagina}</span><button type="button" disabled={pagina*datos.limite>=datos.total} onClick={()=>setPagina(p=>p+1)}>Siguiente</button></nav>
        </>}
        {seleccion&&<>
            <p>Costo neto unitario aplicado: {seleccion.costo_unitario_aplicado} CLP, incluidos los descuentos del documento.</p>
            <Recepcion key={seleccion.id_detalle_documento} id={seleccion.id_documento} idArticulo={idArticulo} idLinea={seleccion.id_detalle_documento}
                onConfirmado={()=>{recargar();onConfirmado?.();}} />
        </>}
    </div>;
}
