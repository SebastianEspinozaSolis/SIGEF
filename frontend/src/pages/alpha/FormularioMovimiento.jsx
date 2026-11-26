/*
 * Formulario reutilizable para registrar un movimiento de inventario de un artículo.
 * Los campos cambian según el tipo, como egreso, merma o uso interno. El backend valida y actualiza el stock al confirmar.
 */

import { pesos, evitarCambioConRueda } from '../../utils/importes';
import { useState } from 'react';
import SelectorPaginado from '../../components/SelectorPaginado';
import { api } from '../../api/cliente';
import { useAuth } from '../../context/AuthContext';
import { cantidadVisible, nombresMovimiento as nombres } from '../../utils/movimientos';
export default function FormularioMovimiento({tipo,unidad,idArticulo,onConfirmado}) {
    const {usuario}=useAuth();
    const almacenamiento=`movimiento-${usuario.id_usuario}-${idArticulo}-${tipo}`;
    const [pendiente,setPendiente]=useState(()=>{try{return JSON.parse(sessionStorage.getItem(almacenamiento))||null;}catch{return null;}});
    const [cantidad,setCantidad]=useState('');
    const [costo,setCosto]=useState('');
    const [justificacion,setJustificacion]=useState('');
    const [asociarObra,setAsociarObra]=useState(false);
    const [obra,setObra]=useState(null);
    const [receptor,setReceptor]=useState(null);
    const [original,setOriginal]=useState(null);
    const [guardando,setGuardando]=useState(false);
    const [error,setError]=useState('');
    const [errores,setErrores]=useState({});
    const [ok,setOk]=useState('');
    const necesitaOrigen=['REVERSA','DEVOLUCION_PROVEEDOR'].includes(tipo);
    const necesitaReceptor=tipo==='USO_INTERNO';
    const maximo=original?.cantidad_disponible||(unidad==='UN'?'999999999':'999999999.999');
    async function guardar(e) {
        e.preventDefault();
        const solicitud=pendiente||{
            id_operacion:crypto.randomUUID(),tipo_movimiento:tipo,cantidad,justificacion,
            ...(tipo==='INGRESO'&&{costo_unitario:costo}),
            ...((tipo==='EGRESO'||(tipo==='MERMA'&&asociarObra))&&{id_obra:obra?.id_obra}),
            ...(necesitaReceptor&&{id_usuario_receptor:receptor?.id_usuario}),
            ...(necesitaOrigen&&tipo!=='REVERSA'&&{id_movimiento_origen:original?.id_movimiento}),
            ...(tipo==='REVERSA'&&{id_movimiento_revertido:original?.id_movimiento}),
        };
        try{sessionStorage.setItem(almacenamiento,JSON.stringify(solicitud));}catch{setError('No se pudo conservar la confirmación en este navegador. Revisa el almacenamiento antes de continuar.');return;}
        setPendiente(solicitud);setGuardando(true);setError('');setErrores({});setOk('');
        try {
            const r=await api(`/api/movimientos/${idArticulo}`,{method:'POST',body:solicitud});
            setPendiente(null);sessionStorage.removeItem(almacenamiento);
            setCantidad('');setCosto('');setJustificacion('');setOriginal(null);
            setOk(r.repetida?'El movimiento ya estaba registrado; no se duplicó.':`${nombres[tipo]} registrado correctamente.`);
            onConfirmado?.();
        }catch(e){setError(e.message);setErrores(e.errores||{});if(e.status>=400&&e.status<500){setPendiente(null);sessionStorage.removeItem(almacenamiento);}}
        finally{setGuardando(false);}
    }
    return <form onSubmit={guardar}>
        {ok&&<p role="status">{ok}</p>}{error&&<p role="alert">{error}</p>}
        {pendiente&&<p role="status">Hay una confirmación pendiente de respuesta. Reinténtala antes de registrar otra.</p>}
        <fieldset disabled={guardando||Boolean(pendiente)} className="alpha-campos">
            {tipo==='MERMA'&&<label><span><input type="checkbox" checked={asociarObra} onChange={e=>{setAsociarObra(e.target.checked);setObra(null);}} /> Asociar a una obra (opcional)</span></label>}
            {(tipo==='EGRESO'||(tipo==='MERMA'&&asociarObra))&&<SelectorPaginado ruta="/api/articulos/obras" campoId="id_obra" etiqueta="Obra asociada" valor={obra?.id_obra ?? ''} opcionActual={obra} alCambiar={(_id, registro) => setObra(registro)}
                nombre={o=>`${o.nombre_obra} — ${o.cliente}`} />}
            {necesitaReceptor&&<SelectorPaginado ruta="/api/movimientos/receptores?tecnico=true" campoId="id_usuario" etiqueta="Técnico responsable"
                valor={receptor?.id_usuario ?? ''} opcionActual={receptor} alCambiar={(_id, registro) => setReceptor(registro)} nombre={u=>`${u.nombres} ${u.apellidos}`} />}
            {necesitaOrigen&&<SelectorPaginado key={tipo} ruta={`/api/movimientos/${idArticulo}/referencias?tipo=${tipo}`} campoId="id_movimiento"
                etiqueta={tipo==='REVERSA'?'Movimiento a corregir':'Ingreso original del proveedor'} valor={original?.id_movimiento ?? ''} opcionActual={original}
                alCambiar={(_id,m)=>{setOriginal(m);setCantidad(tipo==='REVERSA'&&m?cantidadVisible(m.cantidad_disponible):'');}}
                nombre={m=>`${nombres[m.tipo_movimiento]} #${m.id_movimiento} — ${cantidadVisible(m.cantidad_disponible)} ${unidad} disponibles${m.receptor_nombres?` — ${m.receptor_nombres} ${m.receptor_apellidos}`:''}${m.proveedor?` — ${m.proveedor} · ${m.documento_folio}`:''}`} />}
            {original&&<p>Original: {cantidadVisible(original.cantidad)} {unidad}. Costo unitario: {pesos(original.costo_unitario)} CLP. Disponible para esta operación: {cantidadVisible(original.cantidad_disponible)} {unidad}.</p>}
            <label>{tipo==='REVERSA'?'Cantidad a revertir':tipo==='AJUSTE'?'Diferencia (positiva o negativa)':'Cantidad'} ({unidad}) *
                <input type="number" min={tipo==='AJUSTE'?(unidad==='UN'?'-999999999':'-999999999.999'):(unidad==='UN'?'1':'0.001')}
                    max={maximo} step={unidad==='UN'?'1':'0.001'} required value={cantidad} onChange={e=>setCantidad(e.target.value)} />
                {errores.cantidad&&<small>{errores.cantidad}</small>}
            </label>
            {tipo==='INGRESO'&&<label>Costo neto unitario (sin IVA) *<input type="number" min="0" max="9999999999" step="1" inputMode="numeric" onWheel={evitarCambioConRueda} required value={costo} onChange={e=>setCosto(e.target.value)} /></label>}
            {tipo==='REVERSA'&&<p>Indica una cantidad positiva. El sistema aplica el efecto contrario al movimiento original; no edita ni elimina ese registro.</p>}
            {tipo==='USO_INTERNO'&&<p>Se asigna material al técnico: aumenta el stock comprometido sin disminuir el total.</p>}
            <label>Justificación *<textarea maxLength={2000} required value={justificacion} onChange={e=>setJustificacion(e.target.value)} /></label>
            {Object.entries(errores).filter(([campo])=>campo!=='cantidad').map(([campo,mensaje])=><small key={campo}>{mensaje}</small>)}
        </fieldset>
        <button type="submit" disabled={guardando||(!pendiente&&((necesitaOrigen&&!original)||(necesitaReceptor&&!receptor)||((tipo==='EGRESO'||(tipo==='MERMA'&&asociarObra))&&!obra)))}>
            {guardando?'Registrando…':pendiente?'Reintentar confirmación':'Registrar movimiento'}
        </button>
    </form>;
}
