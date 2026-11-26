/*
 * Hoja de terreno de una unidad de una tarea contratada: reúne checklist, tiempo y materiales utilizados.
 * Permite guardar avances o completar la hoja. Guarda localmente para sincronizar después, manteniendo separadas las unidades de una misma tarea.
 */

import { hojaActual } from '../../utils/hojasTerreno';
import { fechaSantiago } from '../../utils/fechas';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import useBorrador from '../../hooks/useBorradorGamma';
import { guardarOperacion, corregirHojaRechazada } from '../../utils/gammaOffline';

export default function HojaTarea({ usuarioId, snapshot, operaciones, obra, tarea, numeroUnidad, alGuardar }) {
    const [fechaInicial]=useState(()=>fechaSantiago());
    const fuente=hojaActual(snapshot,operaciones,tarea.id_detalle_presupuesto,numeroUnidad);
    const inicial={id_obra:obra.id_obra,id_detalle_presupuesto:tarea.id_detalle_presupuesto,numero_unidad:numeroUnidad,
        operacion_base:fuente?.id_operacion_offline || null,estado:fuente?.estado || 'Borrador',
        fecha_servicio:fuente?.fecha_servicio ? fechaSantiago(fuente.fecha_servicio) : fechaInicial,
        horas_trabajadas:fuente?.horas_trabajadas || '0',
        respuestas:fuente?.respuestas || (snapshot.items || []).filter(i=>i.id_tarea===tarea.id_tarea).map(i=>({id_item:i.id_item,pregunta:i.pregunta,estado:'Pendiente',observacion:''})),
        materiales:fuente?.materiales || []};
    const clave=`HOJA:${obra.id_obra}:${tarea.id_detalle_presupuesto}${Number(tarea.cantidad)===1?'':`:${numeroUnidad}`}`;
    const {datos,cambiar,listo,error}=useBorrador(usuarioId,clave,inicial);
    const [mensaje,setMensaje]=useState('');
    const [fallo,setFallo]=useState('');
    const [ocupado,setOcupado]=useState(false);
    const envio=useRef(false);
    // Los borradores anteriores y el servidor guardan horas decimales.
    const minutosGuardados=Math.round(Number(datos.horas_trabajadas || 0)*60);
    const horas=datos.horas ?? String(Math.floor(minutosGuardados/60));
    const minutos=datos.minutos ?? String(minutosGuardados%60);
    const completada=datos.estado==='Completada' || fuente?.estado==='Completada';
    const rechazadas=operaciones.filter(o=>o.tipo==='HOJA' && Number(o.datos.id_detalle_presupuesto)===tarea.id_detalle_presupuesto && Number(o.datos.numero_unidad ?? 1)===numeroUnidad && o.estado==='rechazada');
    function respuesta(indice,campo,valor) {cambiar({...datos,respuestas:datos.respuestas.map((r,i)=>i===indice?{...r,[campo]:valor}:r)});}
    async function corregir() {
        setFallo('');setOcupado(true);
        try {
            const recuperada=await corregirHojaRechazada(usuarioId,tarea.id_detalle_presupuesto,numeroUnidad);
            cambiar(recuperada);await alGuardar();setMensaje('Hoja recuperada como borrador. Corrige el tiempo y vuelve a completarla.');
        } catch(err) {setFallo(err.message);} finally {setOcupado(false);}
    }
    const asignaciones=(snapshot.asignaciones || []).filter(a=>(snapshot.recepciones || []).some(r=>r.id_recepcion===a.id_recepcion && r.firmada));
    const visibles=[...asignaciones,...(datos.materiales || []).filter(m=>!asignaciones.some(a=>a.id_movimiento_asignacion===m.id_movimiento_asignacion)).map(m=>({...m,nombre:`Asignación #${m.id_movimiento_asignacion}`,cantidad_disponible:0}))];
    function material(id,valor) {
        const otros=datos.materiales.filter(m=>m.id_movimiento_asignacion!==id);
        cambiar({...datos,materiales:[...otros,{id_movimiento_asignacion:id,cantidad:valor}]});
    }
    function seleccionarMaterial(id,seleccionado) {
        // Solo los materiales marcados se incluyen en el consumo de la hoja.
        cambiar({...datos,materiales:seleccionado
            ? [...datos.materiales,{id_movimiento_asignacion:id,cantidad:''}]
            : datos.materiales.filter(m=>m.id_movimiento_asignacion!==id)});
    }
    async function guardar(e) {
        e.preventDefault();if(envio.current)return;
        const estado=e.nativeEvent.submitter?.value==='Completada'?'Completada':'Borrador';
        setFallo('');setMensaje('');
        const tiempo=Number(horas)*60+Number(minutos);
        if(!/^\d{1,3}$/.test(horas) || !/^\d{1,2}$/.test(minutos) || Number(minutos)>59 || (estado==='Completada' && tiempo===0)) {
            setFallo('Revisa el tiempo trabajado: ingresa horas enteras y minutos entre 0 y 59. Para completar la hoja debe ser mayor que cero.');return;
        }
        if(estado==='Completada' && datos.respuestas.some(r=>r.estado==='Pendiente')) {setFallo('Resuelve las comprobaciones antes de completar.');return;}
        envio.current=true;setOcupado(true);
        try {
            // Solo se envía el formato decimal que ya utiliza el backend.
            const payload={...datos,numero_unidad:numeroUnidad,horas_trabajadas:(tiempo/60).toFixed(2),estado,respuestas:datos.respuestas.map(({id_item,pregunta,estado,observacion})=>({id_item:id_item ?? null,pregunta,estado,observacion:observacion || ''}))};
            delete payload.horas;delete payload.minutos;
            const op=await guardarOperacion(usuarioId,'HOJA',payload);
            cambiar({...datos,horas,minutos,horas_trabajadas:payload.horas_trabajadas,estado,operacion_base:op.id_operacion_offline});
            await alGuardar();setMensaje(estado==='Completada'?'Hoja completada en este dispositivo. Sincroniza desde Pendientes.':'Avance guardado en este dispositivo. Puedes continuar esta misma hoja.');
        } catch(err) {setFallo(err.message);} finally {envio.current=false;setOcupado(false);}
    }
    return <form className="gamma-panel" onSubmit={guardar}>
        <Link className="gamma-volver" to={`/gamma/obras/${obra.id_obra}`}>Volver a la obra</Link>
        <h3>{tarea.descripcion} · Unidad {numeroUnidad} de {Number(tarea.cantidad)}</h3><p>Hoja de servicio · {completada?'Completada':'Borrador'}</p>
        {!Array.isArray(snapshot.items) && <p role="alert">Vuelve al inicio y descarga los datos para disponer del checklist por tarea.</p>}
        {error && <p role="alert">{error}</p>}{fallo && <p role="alert">{fallo}</p>}{mensaje && <p role="status">{mensaje}</p>}
        {!!rechazadas.length && <div><p role="alert">Hay un envío rechazado de esta tarea. Puedes recuperar la hoja para corregirla con conexión.</p><button type="button" disabled={!listo || ocupado} onClick={corregir}>Corregir hoja</button></div>}
        <fieldset disabled={!listo || ocupado || completada || !Array.isArray(snapshot.items)}>
            <div className="gamma-campos"><label>Fecha del servicio<input required type="date" value={datos.fecha_servicio} onChange={e=>cambiar({...datos,fecha_servicio:e.target.value})} /></label>
                <label>Horas trabajadas<input required type="number" min="0" max="999" step="1" inputMode="numeric" value={horas} onChange={e=>cambiar({...datos,horas:e.target.value,minutos})} /></label>
                <label>Minutos<input required type="number" min="0" max="59" step="1" inputMode="numeric" value={minutos} onChange={e=>cambiar({...datos,horas,minutos:e.target.value})} /></label></div>
            <h3>Comprobaciones</h3>
            {datos.respuestas.map((r,i)=><fieldset className="gamma-panel" key={i}>
                {r.id_item!=null || fuente?.respuestas?.some(a=>a.pregunta===r.pregunta)
                    ? <legend>{r.pregunta}</legend>
                    : <label>Nueva comprobación<input required maxLength={255} value={r.pregunta} onChange={e=>respuesta(i,'pregunta',e.target.value)} /></label>}
                <label>Resultado<select value={r.estado} onChange={e=>respuesta(i,'estado',e.target.value)}><option>Pendiente</option><option>Completado</option><option>No aplica</option></select></label>
                <label>{r.estado==='No aplica'?'Motivo (obligatorio)':'Observaciones (opcional)'}<input required={r.estado==='No aplica'} maxLength={255} value={r.observacion || ''} onChange={e=>respuesta(i,'observacion',e.target.value)} /></label>
                {r.id_item==null && !fuente?.respuestas?.some(a=>a.pregunta===r.pregunta) && <button type="button" onClick={()=>cambiar({...datos,respuestas:datos.respuestas.filter((_,j)=>i!==j)})}>Quitar nueva comprobación</button>}
            </fieldset>)}
            {!datos.respuestas.length && <p>Esta tarea no tiene comprobaciones predeterminadas. Puedes agregar las que correspondan.</p>}
            <button type="button" disabled={datos.respuestas.length>=200} onClick={()=>cambiar({...datos,respuestas:[...datos.respuestas,{id_item:null,pregunta:'',estado:'Pendiente',observacion:''}]})}>Agregar comprobación</button>
            <h3>Materiales utilizados</h3><p>Indica el total utilizado en esta tarea. Al continuar la hoja solo se descuenta el consumo adicional.</p>
            {visibles.map(a=>{
                const usado=Number(fuente?.materiales?.find(m=>m.id_movimiento_asignacion===a.id_movimiento_asignacion)?.cantidad || 0);
                const seleccionado=datos.materiales.find(m=>m.id_movimiento_asignacion===a.id_movimiento_asignacion);
                const paso=a.unidad_medida==='UN'?'1':'0.001';
                return <div className="gamma-panel" key={a.id_movimiento_asignacion}>
                    <label className="gamma-material-seleccion"><input type="checkbox" checked={!!seleccionado} disabled={usado>0}
                        onChange={e=>seleccionarMaterial(a.id_movimiento_asignacion,e.target.checked)} />Utilicé {a.nombre} · {a.unidad_medida || ''}</label>
                    <label>Cantidad utilizada<input aria-label={`Cantidad utilizada de ${a.nombre}`} type="number" required={!!seleccionado} disabled={!seleccionado}
                        min={usado || paso} max={usado+Number(a.cantidad_disponible)} step={paso} value={seleccionado?.cantidad ?? ''}
                        onChange={e=>material(a.id_movimiento_asignacion,e.target.value)} /></label>
                </div>;
            })}
            <div className="gamma-acciones"><button type="submit" value="Borrador">Guardar avance</button><button type="submit" value="Completada" className="gamma-principal" disabled={datos.respuestas.some(r=>r.estado==='Pendiente')}>Completar hoja</button></div>
        </fieldset>
    </form>;
}
