// Una operación pendiente contiene la versión más reciente guardada en este dispositivo.
export function hojaActual(snapshot, operaciones, idDetalle) {
    const servidor=(snapshot.hojas || []).find(h=>Number(h.id_detalle_presupuesto)===Number(idDetalle));
    const locales=operaciones.filter(o=>o.tipo==='HOJA' && Number(o.datos.id_detalle_presupuesto)===Number(idDetalle) && !['rechazada','sustituida'].includes(o.estado));
    const ultima=[...locales].reverse().find(o=>o.estado==='pendiente' || !servidor);
    return ultima ? {...ultima.datos,id_operacion_offline:ultima.id_operacion_offline} : servidor;
}

