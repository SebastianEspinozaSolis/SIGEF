/*
 * Organización del avance de las hojas de terreno a partir de datos descargados y operaciones locales.
 * Distingue tarea y número de unidad para que el estado, las horas y el checklist de una unidad no se mezclen con otra.
 */

// Una operación pendiente contiene la versión más reciente guardada en este dispositivo.
export function hojaActual(snapshot, operaciones, idDetalle, numeroUnidad=1) {
    const tarea=(snapshot.obras || []).flatMap(o=>o.tareas || []).find(t=>Number(t.id_detalle_presupuesto)===Number(idDetalle));
    const coincide=h=>Number(h.id_detalle_presupuesto)===Number(idDetalle)
        && (h.numero_unidad!=null || Number(tarea?.cantidad)===1)
        && Number(h.numero_unidad ?? 1)===Number(numeroUnidad);
    const servidor=(snapshot.hojas || []).find(coincide);
    const locales=operaciones.filter(o=>o.tipo==='HOJA' && coincide(o.datos) && !['rechazada','sustituida'].includes(o.estado));
    const ultima=[...locales].reverse().find(o=>o.estado==='pendiente' || !servidor);
    return ultima ? {...ultima.datos,id_operacion_offline:ultima.id_operacion_offline} : servidor;
}

// Cada unidad contratada tiene su formulario, sin duplicar tareas del catálogo.
export function unidadesObra(obra) {
    return (obra?.tareas || []).flatMap(t=>Array.from({length:Math.min(100,Math.max(0,Number(t.cantidad) || 0))},(_,i)=>({...t,numero_unidad:i+1})));
}

