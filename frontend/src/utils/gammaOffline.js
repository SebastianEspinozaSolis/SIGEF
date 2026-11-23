import { api } from '../api/cliente';
import { identidadToken } from './sesion';

let apertura;
let sincronizacion;
function base() {
    if (!apertura) apertura = new Promise((resolve, reject) => {
        const solicitud = indexedDB.open('sigef-gamma', 1);
        solicitud.onupgradeneeded = () => solicitud.result.createObjectStore('registros', { keyPath: 'clave' });
        solicitud.onsuccess = () => resolve(solicitud.result);
        solicitud.onerror = () => { apertura = null; reject(solicitud.error); };
        solicitud.onblocked = () => { apertura = null; reject(new Error('Cierra las otras pestañas de terreno para actualizar el almacenamiento.')); };
    });
    return apertura;
}

async function consultar(modo, operacion) {
    const db = await base();
    return new Promise((resolve, reject) => {
        const transaccion = db.transaction('registros', modo);
        const solicitud = operacion(transaccion.objectStore('registros'));
        transaccion.oncomplete = () => resolve(solicitud.result);
        transaccion.onerror = () => reject(transaccion.error);
        transaccion.onabort = () => reject(transaccion.error || new Error('No se pudo guardar en este dispositivo.'));
    });
}
function prefijo(usuarioId) {
    if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) throw new Error('Usuario inválido.');
    return `usuario:${usuarioId}:`;
}
function comprobarSesion(usuarioId) {
    const identidad = identidadToken(localStorage.getItem('gamma-token'));
    if (!identidad || identidad.id_usuario !== usuarioId) throw new Error('Vuelve a iniciar sesión con el mismo técnico para sincronizar sus registros.');
}
const leer = clave => consultar('readonly', almacen => almacen.get(clave));
const escribir = registro => consultar('readwrite', almacen => almacen.put(registro));

export async function leerDescarga(usuarioId) {
    return (await leer(`${prefijo(usuarioId)}descarga`))?.datos || null;
}
export async function descargarDatos(usuarioId) {
    comprobarSesion(usuarioId);
    const datos = await api('/api/gamma/descarga', { sesion: 'gamma' });
    comprobarSesion(usuarioId);
    await escribir({ clave: `${prefijo(usuarioId)}descarga`, datos });
    return datos;
}
export async function guardarOperacion(usuarioId, tipo, datos) {
    const id = crypto.randomUUID();
    const operacion = { clave: `${prefijo(usuarioId)}operacion:${id}`, id_operacion_offline: id, tipo,
        datos: structuredClone(datos), estado: 'pendiente', creado_en: new Date().toISOString() };
    await escribir(operacion);
    return operacion;
}
export async function listarOperaciones(usuarioId) {
    const inicio = `${prefijo(usuarioId)}operacion:`;
    const registros = await consultar('readonly', almacen => almacen.getAll(IDBKeyRange.bound(inicio, `${inicio}\uffff`)));
    return registros.sort((a, b) => a.creado_en.localeCompare(b.creado_en));
}

// Un rechazo confirmado se corrige con otra operación; nunca se modifica su UUID.
export async function corregirHojaRechazada(usuarioId, idDetalle) {
    const ejecutar=async()=>{
        const descarga=await descargarDatos(usuarioId);
        const versiones=(await listarOperaciones(usuarioId)).filter(o=>o.tipo==='HOJA' && Number(o.datos.id_detalle_presupuesto)===Number(idDetalle) && o.estado!=='sustituida');
        if(versiones.some(o=>o.estado==='pendiente')) throw new Error('Sincroniza los envíos de esta hoja antes de corregirla.');
        const rechazada=[...versiones].reverse().find(o=>o.estado==='rechazada');
        if(!rechazada) throw new Error('Esta hoja no tiene un envío rechazado para corregir.');
        const servidor=(descarga.hojas || []).find(h=>Number(h.id_detalle_presupuesto)===Number(idDetalle));
        if(servidor?.estado==='Completada') throw new Error('La hoja ya está completada en el servidor y no puede editarse.');
        const obra=(descarga.obras || []).find(o=>Number(o.id_obra)===Number(rechazada.datos.id_obra));
        if(!obra || obra.estado!=='En proceso') throw new Error('La obra ya no admite cambios.');
        const datos={...rechazada.datos,estado:'Borrador',operacion_base:servidor?.id_operacion_offline || null};
        const db=await base();
        await new Promise((resolve,reject)=>{
            const tx=db.transaction('registros','readwrite');
            const almacen=tx.objectStore('registros');
            for(const op of versiones.filter(o=>o.estado==='rechazada')) almacen.put({...op,estado:'sustituida'});
            almacen.put({clave:`${prefijo(usuarioId)}borrador:HOJA:${datos.id_obra}:${idDetalle}`,datos});
            tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
        });
        return datos;
    };
    if(sincronizacion) throw new Error('Espera a que termine la sincronización.');
    return navigator.locks ? navigator.locks.request('sigef-gamma-sincronizacion',ejecutar) : ejecutar();
}

// Retira la copia y la firma tras confirmar el servidor la entrega del trabajo.
async function retirarObraLocal(usuarioId, idObra) {
    const db = await base();
    const inicio = prefijo(usuarioId);
    await new Promise((resolve, reject) => {
        const tx = db.transaction('registros', 'readwrite');
        const almacen = tx.objectStore('registros');
        const cursor = almacen.openCursor(IDBKeyRange.bound(inicio, `${inicio}\uffff`));
        cursor.onsuccess = () => {
            const fila = cursor.result;
            if (!fila) return;
            const registro = fila.value;
            if (registro.clave === `${inicio}descarga`) {
                const datos = { ...registro.datos };
                for (const campo of ['obras', 'hojas', 'presupuestos']) datos[campo] = (datos[campo] || []).filter(x => Number(x.id_obra) !== Number(idObra));
                fila.update({ ...registro, datos });
            } else if (Number(registro.datos?.id_obra) === Number(idObra) &&
                (registro.clave.includes(':borrador:') || ['enviada','sustituida'].includes(registro.estado))) fila.delete();
            fila.continue();
        };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

// La misma operación conserva su UUID incluso si se corta la respuesta del servidor.
async function enviarPendientes(usuarioId) {
    comprobarSesion(usuarioId);
    let enviadas = 0;
    let rechazadas = 0;
    for (const operacion of (await listarOperaciones(usuarioId)).sort((a,b) => Number(a.tipo === 'CIERRE') - Number(b.tipo === 'CIERRE'))) {
        if (operacion.estado !== 'pendiente') continue;
        comprobarSesion(usuarioId);
        try {
            const { id_operacion_offline, tipo, datos } = operacion;
            if (tipo === 'CIERRE' && (await listarOperaciones(usuarioId)).some(x => x.id_operacion_offline !== id_operacion_offline && Number(x.datos?.id_obra) === Number(datos.id_obra) && !['enviada','sustituida'].includes(x.estado))) {
                await escribir({ ...operacion, error: 'Resuelve los registros pendientes o rechazados de esta obra antes de finalizar.' });
                continue;
            }
            const respuesta = await api('/api/gamma/sincronizar', { method: 'POST', sesion: 'gamma', body: { id_operacion_offline, tipo, datos } });
            await escribir({ ...operacion, estado: 'enviada', respuesta, error: null });
            if (tipo === 'CIERRE' && (respuesta.revision_pendiente === true || respuesta.estado === 'Finalizada') && Number(respuesta.id_obra) === Number(datos.id_obra)) await retirarObraLocal(usuarioId, datos.id_obra);
            enviadas++;
        } catch (error) {
            if (!error.status || error.status === 401 || error.status >= 500) {
                await escribir({ ...operacion, error: error.message });
                break;
            }
            await escribir({ ...operacion, estado: 'rechazada', error: error.message, errores: error.errores });
            rechazadas++;
        }
    }
    const pendientes = (await listarOperaciones(usuarioId)).filter(item => item.estado === 'pendiente').length;
    return { enviadas, rechazadas, pendientes };
}
export async function sincronizarPendientes(usuarioId) {
    if (sincronizacion) throw new Error('Ya hay una sincronización en curso en esta pestaña.');
    const ejecutar = () => enviarPendientes(usuarioId);
    sincronizacion = navigator.locks
        ? navigator.locks.request('sigef-gamma-sincronizacion', ejecutar)
        : ejecutar();
    try { return await sincronizacion; }
    finally { sincronizacion = null; }
}
export async function guardarBorrador(usuarioId, clave, datos) {
    await escribir({ clave: `${prefijo(usuarioId)}borrador:${clave}`, datos: structuredClone(datos) });
}
export async function leerBorrador(usuarioId, clave) {
    return (await leer(`${prefijo(usuarioId)}borrador:${clave}`))?.datos || null;
}
export async function borrarBorrador(usuarioId, clave) {
    await consultar('readwrite', almacen => almacen.delete(`${prefijo(usuarioId)}borrador:${clave}`));
}
