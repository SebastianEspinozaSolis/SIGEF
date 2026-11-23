import { pesos } from '../../utils/importes';
import { useState } from 'react';
import useListado from '../../hooks/useListado';
import { SelectorListado } from '../../components/SelectorPaginado';
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
    const listado = useListado(`/api/recepciones-compra/articulos/${idArticulo}/pendientes`);
    const [seleccion,setSeleccion]=useState(null);
    return <div>
        <SelectorListado listado={listado} etiqueta="Compra y material pendiente" obligatorio={false}
            busqueda="Buscar compra por documento o proveedor" placeholder="Selecciona una compra"
            vacio="No hay compras pendientes de este artículo para esta búsqueda."
            valor={seleccion?.id_detalle_documento ?? ''} opcionActual={seleccion} campoId="id_detalle_documento"
            alCambiar={(_id, registro) => setSeleccion(registro)}
            nombre={l => `${tiposDocumento.find(([t]) => t === l.tipo_documento)?.[1]} ${l.folio} — ${l.razon_social} — Pendiente: ${Number(l.cantidad_pendiente)} ${unidad} — línea ${l.id_detalle_documento}`} />
        {seleccion&&<>
            <p>Costo neto unitario aplicado: {pesos(seleccion.costo_unitario_aplicado)} CLP, incluidos los descuentos del documento.</p>
            <Recepcion key={seleccion.id_detalle_documento} id={seleccion.id_documento} idArticulo={idArticulo} idLinea={seleccion.id_detalle_documento}
                onConfirmado={()=>{listado.recargar();onConfirmado?.();}} />
        </>}
    </div>;
}
