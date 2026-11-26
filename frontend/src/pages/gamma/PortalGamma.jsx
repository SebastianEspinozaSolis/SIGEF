/*
 * Portal de terreno: organiza mis obras, recepciones, pendientes y navegación del técnico.
 * Descarga datos para trabajar sin conexión y permite sincronizar los registros pendientes. Conserva los avisos de guardado y los errores para evitar pérdida de trabajo.
 */

import useBorrador from '../../hooks/useBorradorGamma';
import HojaTarea from './HojaTarea';
import { hojaActual, unidadesObra } from '../../utils/hojasTerreno';
import { fechaSantiago } from '../../utils/fechas';
import { pesos, evitarCambioConRueda } from '../../utils/importes';
import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useParams, useLocation } from 'react-router-dom';
import logo from '../../assets/logo-fyag.png';
import { useAuth } from '../../context/AuthContext';
import { leerDescarga, descargarDatos, guardarOperacion, listarOperaciones, sincronizarPendientes } from '../../utils/gammaOffline';
import Firma from './Firma';
import ResumenTrabajo from '../../components/ResumenTrabajo';
import './gamma.css';

const fechaHoy = () => fechaSantiago();
const errorTexto = error => error?.message || error?.mensaje || 'No se pudo completar la operación.';
const obraNombre = obra => obra.nombre_obra || `Obra ${obra.id_obra}`;

function FormularioTerreno({ usuarioId, snapshot, tipo, operaciones, alGuardar, idObra = '' }) {
    const esHoja = tipo === 'HOJA' || tipo === 'CIERRE';
    const inicial = esHoja
        ? { id_obra: idObra, fecha_servicio: fechaHoy(), horas_trabajadas: tipo === 'CIERRE' ? '0' : '', respuestas: {}, materiales: {}, firma_conformidad: '' }
        : { id_recepcion: '', firma: '' };
    const { datos, cambiar, listo, error, limpiar } = useBorrador(usuarioId, `${tipo}${idObra ? `:${idObra}` : ''}`, inicial);
    const [mensaje, setMensaje] = useState('');
    const [fallo, setFallo] = useState('');
    const [ocupado, setOcupado] = useState(false);
    const [guardado, setGuardado] = useState(false);
    const [estadoFirma, setEstadoFirma] = useState({ procesando: false, error: '' });
    const obra = snapshot.obras.find(item => String(item.id_obra) === String(datos.id_obra));
    const resumenHojas=tipo==='CIERRE' ? unidadesObra(obra).map(t=>{
        const hoja=hojaActual(snapshot,operaciones,t.id_detalle_presupuesto,t.numero_unidad);
        return {id_detalle_presupuesto:t.id_detalle_presupuesto,numero_unidad:t.numero_unidad,cantidad_contratada:t.cantidad,descripcion:t.descripcion,
            estado:hoja?.estado || 'Sin iniciar',horas_trabajadas:hoja?.horas_trabajadas || '0',
            materiales:(hoja?.materiales || []).map(m=>{
                const asignacion=(snapshot.asignaciones || []).find(a=>a.id_movimiento_asignacion===m.id_movimiento_asignacion);
                return {...m,nombre:asignacion?.nombre || `Asignación #${m.id_movimiento_asignacion}`,unidad_medida:asignacion?.unidad_medida || ''};
            }).filter(m=>Number(m.cantidad)>0)};
    }) : [];
    const recepciones = snapshot.recepciones || [];
    const disponibles = snapshot.obras.filter(item => item.estado === 'En proceso');
    const editar = (campo, valor) => cambiar({ ...datos, [campo]: valor });
    const recepcionesEnCola = new Set(operaciones.filter(item => item.tipo === 'FIRMA_RECEPCION' && item.estado !== 'rechazada').map(item => String(item.datos.id_recepcion)));
    const recepcion = recepciones.find(item => String(item.id_recepcion) === String(datos.id_recepcion));

    async function guardar(evento) {
        evento.preventDefault();
        setOcupado(true);
        setFallo('');
        try {
            if (estadoFirma.procesando || estadoFirma.error) throw new Error(estadoFirma.error || 'Espera a que termine de guardarse la firma.');
            if (tipo !== 'FIRMA_RECEPCION' && obra?.estado !== 'En proceso') throw new Error('Selecciona una obra en proceso.');
            if (tipo === 'FIRMA_RECEPCION' && (!datos.firma || !recepcion || recepcion.firmada || recepcionesEnCola.has(String(datos.id_recepcion)))) throw new Error('Selecciona una recepción pendiente y captura su firma.');
            if (tipo === 'CIERRE' && operaciones.some(item => item.tipo === 'CIERRE' && item.estado !== 'enviada' && String(item.datos.id_obra) === String(datos.id_obra))) throw new Error('Ya hay un cierre pendiente para esta obra. Revisa Pendientes antes de crear otro.');
            const firmaConformidad = datos.firma_conformidad || datos.firma_cliente_base64 || '';
            if (tipo === 'CIERRE' && !firmaConformidad) throw new Error('Captura la firma de conformidad del cliente para finalizar.');
            // Conserva trabajo adicional de borradores de cierre anteriores.
            const trabajoAnterior = tipo === 'CIERRE' && (Number(datos.horas_trabajadas)>0 || Object.keys(datos.materiales || {}).length || Object.keys(datos.respuestas || {}).length);
            const payload = tipo === 'CIERRE' && !trabajoAnterior ? { id_obra:Number(datos.id_obra), firma_conformidad:firmaConformidad } : esHoja ? {
                id_obra: Number(datos.id_obra), fecha_servicio: datos.fecha_servicio, horas_trabajadas: Number(datos.horas_trabajadas),
                ...(tipo === 'CIERRE' ? {firma_cliente_base64:firmaConformidad} : {}),
                respuestas: tipo === 'CIERRE' ? Object.entries(datos.respuestas || {}).map(([id,valor])=>({id_item:Number(id),valor_respuesta:valor})) : [],
                materiales: Object.entries(datos.materiales).filter(([, cantidad]) => Number(cantidad) > 0).map(([id, cantidad]) => ({ id_movimiento_asignacion: Number(id), cantidad: Number(cantidad) })),
            } : { id_recepcion: Number(datos.id_recepcion), firma: datos.firma };
            await guardarOperacion(usuarioId, tipo, payload);
            setGuardado(true);
            setMensaje('Operación guardada en este dispositivo. Revisa Pendientes para enviarla.');
            await limpiar();
            await alGuardar();
        } catch (err) { setFallo(errorTexto(err)); }
        finally { setOcupado(false); }
    }

    return <form className="gamma-panel" onSubmit={guardar}>
        <h2>{tipo === 'CIERRE' ? 'Enviar trabajo a revisión' : tipo === 'HOJA' ? 'Hoja de servicio' : 'Recepción de materiales'}</h2>
        <p>El borrador se conserva en este dispositivo. Guardar prepara el envío; sincroniza cuando tengas conexión.</p>
        {error ? <p role="alert">{error}</p> : null}
        {fallo ? <p role="alert">{fallo}</p> : null}
        {mensaje ? <p role="status">{mensaje}</p> : null}
        <fieldset disabled={!listo || ocupado || guardado}>
            {tipo === 'FIRMA_RECEPCION' ? <>
                <label>Entrega pendiente<select required value={datos.id_recepcion} onChange={evento => cambiar({ ...datos, id_recepcion: evento.target.value, firma: '' })}>
                    <option value="">Selecciona una entrega</option>
                    {recepciones.filter(item => !item.firmada && !recepcionesEnCola.has(String(item.id_recepcion))).map(item => <option key={item.id_recepcion} value={item.id_recepcion}>Recepción #{item.id_recepcion}{item.movimientos?.[0]?.tipo_movimiento==='EGRESO'?` · ${item.movimientos[0].nombre_obra || `Obra #${item.movimientos[0].id_obra}`}`:' · Uso interno'}</option>)}
                </select></label>
                {recepcion ? <ul>{(recepcion.movimientos || []).map((item, indice) => <li key={item.id_movimiento || indice}>{item.nombre}: {item.cantidad ?? item.cantidad_disponible} {item.unidad_medida}</li>)}</ul> : null}
                {recepcion?.movimientos?.some(item=>item.tipo_movimiento==='EGRESO') && <p>Confirma que recibiste estos materiales para la obra. No debes volver a registrarlos como utilizados.</p>}
                <Firma label="Firma de recepción del técnico" value={datos.firma} onChange={valor => editar('firma', valor)} onEstadoChange={setEstadoFirma} disabled={!listo || ocupado || guardado} />
            </> : <>
                {!idObra && <label>Obra en proceso<select required value={datos.id_obra} onChange={evento => cambiar({ ...datos, id_obra: evento.target.value, ...(esHoja ? { respuestas: {}, materiales: {} } : {}) })}>
                    <option value="">Selecciona una obra</option>
                    {disponibles.map(item => <option key={item.id_obra} value={item.id_obra}>{obraNombre(item)}</option>)}
                </select></label>}
                {datos.id_obra && !obra ? <p role="alert">La obra del borrador ya no está en la descarga. Selecciona una obra disponible.</p> : null}
                {obra ? <p>Cliente: {obra.razon_social || obra.nombre_cliente || 'Según obra asignada'}</p> : null}
                    {tipo === 'CIERRE' && obra && <ResumenTrabajo hojas={resumenHojas} />}
                    {tipo === 'CIERRE' && <p>Confirma las tareas, horas y materiales registrados. La firma expresa la conformidad del cliente; el supervisor o Administrador General revisará y finalizará la obra en el ERP.</p>}
                    {tipo === 'CIERRE' && <Firma label="Firma de conformidad del cliente" value={datos.firma_conformidad || datos.firma_cliente_base64 || ''} onChange={valor => cambiar({ ...datos, firma_conformidad:valor, firma_cliente_base64:'' })} onEstadoChange={setEstadoFirma} disabled={!listo || ocupado || guardado} />}
            </>}
            <button type="submit" className="gamma-principal" disabled={estadoFirma.procesando || Boolean(estadoFirma.error)}>{ocupado ? 'Guardando…' : 'Guardar para sincronizar'}</button>
        </fieldset>
        {guardado ? <button type="button" onClick={() => { setGuardado(false); setMensaje(''); }}>Crear otro registro</button> : null}
    </form>;
}

function Actividad({ snapshot, operaciones }) {
    const nombreTarea=id=>(snapshot?.obras || []).flatMap(o=>o.tareas || []).find(t=>Number(t.id_detalle_presupuesto)===Number(id))?.descripcion;
    const claveHoja=(id,unidad,alternativa)=>id!=null?`hoja:${id}:${unidad ?? 'anterior'}`:alternativa;
    const registros = [
        ...operaciones.filter(o=>o.estado!=='sustituida').map(o=>({clave:o.tipo==='HOJA'?claveHoja(o.datos.id_detalle_presupuesto,o.datos.numero_unidad,o.id_operacion_offline):o.id_operacion_offline,fecha:o.creado_en,
            texto:o.tipo==='HOJA'
                ? `Hoja de servicio${nombreTarea(o.datos.id_detalle_presupuesto)?`: ${nombreTarea(o.datos.id_detalle_presupuesto)}`:''} · Unidad ${o.datos.numero_unidad ?? 'sin indicar'} - ${o.datos.estado || 'Borrador'} - ${o.estado==='enviada'?'sincronizada':o.estado}`
                : `${o.tipo === 'CIERRE' ? 'Entrega del trabajo' : o.tipo === 'PRESUPUESTO' ? 'Presupuesto' : 'Recepción'} - ${o.estado}`})),
        ...(snapshot?.hojas || []).filter(h=>!operaciones.some(o=>o.id_operacion_offline===h.id_operacion_offline || (o.tipo==='HOJA' && Number(o.datos.id_detalle_presupuesto)===Number(h.id_detalle_presupuesto) && Number(o.datos.numero_unidad ?? 1)===Number(h.numero_unidad))))
            .map(h=>({clave:claveHoja(h.id_detalle_presupuesto,h.numero_unidad,`servidor:${h.id_hoja_servicio}`),fecha:h.fecha_servicio,
                texto:`Hoja de servicio${nombreTarea(h.id_detalle_presupuesto)?`: ${nombreTarea(h.id_detalle_presupuesto)}`:''} · Unidad ${h.numero_unidad} - ${h.estado || 'Borrador'} - sincronizada`}))
    ].sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)));
    // Muestra la última versión por tarea, sin eliminar operaciones de la cola.
    const vistas=new Set();
    const recientes=registros.filter(r=>{
        if(vistas.has(r.clave))return false;
        vistas.add(r.clave);return true;
    }).slice(0,5);
    return <section className="gamma-panel"><h2>Actividad reciente</h2>{recientes.length ? <ul>{recientes.map(r=><li key={r.clave}>{r.texto}</li>)}</ul> : <p>Todavía no hay actividad descargada o local.</p>}</section>;
}

function Obras({ snapshot, operaciones }) {
    const obras = [...snapshot.obras].sort((a,b)=>Number(b.nombre_servicio === 'Emergencia')-Number(a.nombre_servicio === 'Emergencia') || a.id_obra-b.id_obra);
    return <section><h2>Mis obras</h2>
        {!obras.length && <p>No hay obras asignadas en la descarga.</p>}
        <div className="gamma-obras">{obras.map(obra=><Link className="gamma-panel gamma-tarjeta" key={obra.id_obra} to={`/gamma/obras/${obra.id_obra}`}>
            <strong>{obra.razon_social}</strong><span>{obraNombre(obra)}</span><span>{obra.nombre_servicio} · {obra.estado}</span>
        </Link>)}</div>
        <Actividad snapshot={snapshot} operaciones={operaciones} />
    </section>;
}

function PresupuestoTerreno({ usuarioId, snapshot, obra, alGuardar }) {
    const {datos,cambiar,listo,error,limpiar}=useBorrador(usuarioId,`PRESUPUESTO:${obra.id_obra}`,{id_obra:obra.id_obra,id_categoria_servicio:'',detalles:[]});
    const [fallo,setFallo]=useState('');
    const [mensaje,setMensaje]=useState('');
    const [ocupado,setOcupado]=useState(false);
    const detalles=datos.detalles || [];
    const tareas=(snapshot.tareas || []).filter(t=>String(t.id_categoria_servicio)===String(datos.id_categoria_servicio));
    const subtotal=detalles.reduce((n,l)=>n+(/^\d+$/.test(String(l.cantidad)) && /^\d+$/.test(String(l.precio_neto_unitario)) ? BigInt(l.cantidad)*BigInt(l.precio_neto_unitario) : 0n),0n);
    const iva=(subtotal*19n+50n)/100n;
    function modificar(indice,campo,valor) {cambiar({...datos,detalles:detalles.map((l,i)=>i===indice?{...l,[campo]:valor}:l)});}
    async function guardar(e) {
        e.preventDefault();setFallo('');setOcupado(true);
        try {
            if(!detalles.length) throw new Error('Agrega al menos una tarea.');
            if(detalles.some(l=>!/^\d{1,3}$/.test(String(l.cantidad)) || Number(l.cantidad)<1 || Number(l.cantidad)>100 || !/^\d{1,14}$/.test(String(l.precio_neto_unitario)) || !l.descripcion.trim())) throw new Error('Revisa cantidades entre 1 y 100, descripciones y precios.');
            if(subtotal+iva>999999999999n) throw new Error('El total supera el importe permitido.');
            await guardarOperacion(usuarioId,'PRESUPUESTO',{id_obra:obra.id_obra,id_categoria_servicio:Number(datos.id_categoria_servicio),detalles});
            await limpiar();await alGuardar();setMensaje('Presupuesto guardado. Envía desde Pendientes para su revisión en oficina.');
        } catch(err) {setFallo(errorTexto(err));} finally {setOcupado(false);}
    }
    return <form className="gamma-panel" onSubmit={guardar}><h2>Crear presupuesto</h2><p>Cliente: <strong>{obra.razon_social}</strong></p>
        {!snapshot.categorias && <p role="status">Vuelve al inicio y descarga los datos para disponer de las categorías y tareas.</p>}
        {error && <p role="alert">{error}</p>}{fallo && <p role="alert">{fallo}</p>}{mensaje && <p role="status">{mensaje}</p>}
        <fieldset disabled={!listo || ocupado}>
            <label>Categoría de servicio<select required value={datos.id_categoria_servicio} onChange={e=>{if(!detalles.length || window.confirm('Cambiar categoría quitará las tareas seleccionadas.')) cambiar({...datos,id_categoria_servicio:e.target.value,detalles:[]});}}><option value="">Selecciona una categoría</option>{(snapshot.categorias || []).map(c=><option key={c.id_categoria_servicio} value={c.id_categoria_servicio}>{c.nombre_servicio}</option>)}</select></label>
            {datos.id_categoria_servicio && <label>Agregar tarea<select value="" onChange={e=>{const t=tareas.find(t=>String(t.id_tarea)===e.target.value);if(t && !detalles.some(l=>l.id_tarea===t.id_tarea)) cambiar({...datos,detalles:[...detalles,{id_tarea:t.id_tarea,descripcion:t.nombre_tarea,cantidad:'1',precio_neto_unitario:String(t.precio_neto).split('.')[0]}]});}}><option value="">Selecciona una tarea</option>{tareas.map(t=><option key={t.id_tarea} value={t.id_tarea} disabled={detalles.some(l=>l.id_tarea===t.id_tarea)}>{t.nombre_tarea} - ${pesos(t.precio_neto)}</option>)}</select></label>}
            {detalles.map((l,i)=><fieldset className="gamma-panel" key={l.id_tarea}><legend>{l.descripcion}</legend>
                <label>Descripción<input required maxLength="255" value={l.descripcion} onChange={e=>modificar(i,'descripcion',e.target.value)} /></label>
                <div className="gamma-campos"><label>Cantidad<input required type="number" min="1" max="100" step="1" inputMode="numeric" value={l.cantidad} onChange={e=>modificar(i,'cantidad',e.target.value)} /></label>
                <label>Precio neto unitario (CLP)<input required type="number" min="0" max="99999999999999" step="1" inputMode="numeric" onWheel={evitarCambioConRueda} value={l.precio_neto_unitario} onChange={e=>modificar(i,'precio_neto_unitario',e.target.value)} /></label></div>
                <button type="button" onClick={()=>cambiar({...datos,detalles:detalles.filter((_,j)=>j!==i)})}>Quitar tarea</button>
            </fieldset>)}
            <p>Neto: ${pesos(subtotal.toString())} · IVA (19 %): ${pesos(iva.toString())}</p><p><strong>Total: ${pesos((subtotal+iva).toString())}</strong></p>
            <button className="gamma-principal" disabled={!detalles.length}>{ocupado?'Guardando...':'Guardar para sincronizar'}</button>
        </fieldset>
    </form>;
}

function HojaDeObra({usuarioId,snapshot,operaciones,obra,alGuardar}) {
    const {idDetalle,unidad}=useParams();
    const tarea=(obra.tareas || []).find(t=>String(t.id_detalle_presupuesto)===idDetalle);
    if(!tarea) return <p role="alert">La tarea no pertenece a esta obra o no esta descargada.</p>;
    const numeroUnidad=Number(unidad || 1);
    if(!Number.isInteger(numeroUnidad)||numeroUnidad<1||numeroUnidad>Number(tarea.cantidad))return <p role="alert">La unidad no pertenece a esta tarea contratada.</p>;
    return <HojaTarea key={`${idDetalle}:${numeroUnidad}`} usuarioId={usuarioId} snapshot={snapshot} operaciones={operaciones} obra={obra} tarea={tarea} numeroUnidad={numeroUnidad} alGuardar={alGuardar} />;
}

function ApartadoObra({ snapshot, usuarioId, operaciones, alGuardar }) {
    const {idObra}=useParams();
    const obra=snapshot.obras.find(o=>String(o.id_obra)===idObra);
    if(!obra) return <section className="gamma-panel"><h2>Obra no disponible</h2><p>La obra no está en los datos descargados o ya finalizó.</p><Link className="gamma-volver" to="/gamma/obras">Volver a mis obras</Link></section>;
    const hojas=(snapshot.hojas || []).filter(h=>String(h.id_obra)===idObra);
    const locales=operaciones.filter(o=>o.tipo==='HOJA' && String(o.datos.id_obra)===idObra && !['rechazada','sustituida'].includes(o.estado));
    const cierre=operaciones.some(o=>o.tipo==='CIERRE' && String(o.datos.id_obra)===idObra && o.estado!=='rechazada');
    const puedeTrabajar=obra.estado==='En proceso' && !cierre;
    const unidades=unidadesObra(obra);
    const puedeCerrar=puedeTrabajar && !!unidades.length && unidades.every(t=>hojaActual(snapshot,operaciones,t.id_detalle_presupuesto,t.numero_unidad)?.estado==='Completada');
    return <section><Link className="gamma-volver" to="/gamma/obras">Volver a mis obras</Link><h2>{obra.razon_social}</h2><p>{obraNombre(obra)} · {obra.nombre_servicio} · {obra.estado}</p>
        <Routes>
            <Route path="tareas/:idDetalle" element={obra.estado==='En proceso' ? <HojaDeObra usuarioId={usuarioId} snapshot={snapshot} operaciones={operaciones} obra={obra} alGuardar={alGuardar} /> : <p>La obra no admite nuevos registros.</p>} />
            <Route path="tareas/:idDetalle/unidades/:unidad" element={obra.estado==='En proceso' ? <HojaDeObra usuarioId={usuarioId} snapshot={snapshot} operaciones={operaciones} obra={obra} alGuardar={alGuardar} /> : <p>La obra no admite nuevos registros.</p>} />
            <Route path="presupuesto" element={puedeTrabajar ? <PresupuestoTerreno key={idObra} usuarioId={usuarioId} snapshot={snapshot} obra={obra} alGuardar={alGuardar} /> : <p>La obra no admite nuevos registros.</p>} />
            <Route path="cierre" element={puedeCerrar ? <FormularioTerreno key={`CIERRE:${idObra}`} usuarioId={usuarioId} snapshot={snapshot} tipo="CIERRE" operaciones={operaciones} alGuardar={alGuardar} idObra={idObra} /> : cierre ? <p role="status">Trabajo guardado. Sincroniza desde Pendientes para enviarlo a revisión.</p> : <p>Completa las hojas de todas las tareas antes de enviar el trabajo.</p>} />
            <Route path="*" element={<>
                <section className="gamma-panel"><h3>Tareas contratadas</h3>
                    {unidades.length ? <div className="gamma-obras">{unidades.map(t=>{
                        const hoja=hojaActual(snapshot,operaciones,t.id_detalle_presupuesto,t.numero_unidad);
                        return <Link className="gamma-tarjeta" key={`${t.id_detalle_presupuesto}:${t.numero_unidad}`} to={`tareas/${t.id_detalle_presupuesto}/unidades/${t.numero_unidad}`}><strong>{t.descripcion}</strong><span>Unidad {t.numero_unidad} de {Number(t.cantidad)} · {hoja?.estado || 'Sin iniciar'}</span><span>{!hoja?'Iniciar tarea':hoja.estado==='Completada'?'Ver hoja':'Continuar hoja'}</span></Link>;
                    })}</div> : <p>El presupuesto no contiene tareas detalladas. Revisa su definicion en el ERP.</p>}
                    <p>Hojas sincronizadas: {hojas.length}. Actualizaciones locales: {locales.filter(o=>o.estado!=='enviada').length}.</p>
                </section>
                {puedeTrabajar && <section className="gamma-panel"><h3>Otra necesidad de esta empresa</h3><Link className="gamma-tarjeta" to="presupuesto">Crear presupuesto</Link></section>}
                <section className="gamma-panel"><h3>Entregar trabajo</h3>{puedeCerrar ? <Link className="gamma-tarjeta" to="cierre">Enviar trabajo y firmar conformidad</Link> : <p>{cierre?'Trabajo guardado para revisión. Revisa Pendientes.':'Completa las hojas de todas las tareas antes de enviar el trabajo.'}</p>}</section>
            </>} />
        </Routes>
    </section>;
}

export default function PortalGamma() {
    const { usuario, logout } = useAuth();
    const ubicacion = useLocation();
    const inicio = ['/gamma','/gamma/'].includes(ubicacion.pathname);
    const usuarioId = usuario.id_usuario;
    const [snapshot, setSnapshot] = useState(null);
    const [operaciones, setOperaciones] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [ocupado, setOcupado] = useState(false);
    const [error, setError] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [online, setOnline] = useState(navigator.onLine);
    const [rutaMensaje, setRutaMensaje] = useState('');
    useEffect(() => {
        let activo = true;
        Promise.all([leerDescarga(usuarioId), listarOperaciones(usuarioId)]).then(([datos, cola]) => {
            if (activo) { setSnapshot(datos); setOperaciones(cola); }
        }).catch(err => { if (activo) setError(errorTexto(err)); }).finally(() => { if (activo) setCargando(false); });
        const conectado = () => setOnline(navigator.onLine);
        window.addEventListener('online', conectado);
        window.addEventListener('offline', conectado);
        return () => { activo = false; window.removeEventListener('online', conectado); window.removeEventListener('offline', conectado); };
    }, [usuarioId]);
    const actualizarCola = async () => setOperaciones(await listarOperaciones(usuarioId));
    async function ejecutar(accion) {
        setOcupado(true); setError(''); setMensaje('');
        setRutaMensaje(ubicacion.pathname);
        try {
            if (accion === 'descargar') {
                setSnapshot(await descargarDatos(usuarioId));
                setMensaje('Datos descargados. Ya puedes preparar registros sin conexión.');
            } else {
                const resultado = await sincronizarPendientes(usuarioId);
                setSnapshot(await leerDescarga(usuarioId));
                try { setSnapshot(await descargarDatos(usuarioId)); } catch { setError('Los envíos fueron procesados, pero no se pudo actualizar la descarga. Inténtalo desde el inicio.'); }
                setMensaje(`Sincronización: ${resultado.enviadas} enviadas, ${resultado.rechazadas} rechazadas, ${resultado.pendientes} pendientes. Descarga nuevamente para actualizar saldos e historial.`);
            }
        } catch (err) { setError(errorTexto(err)); }
        finally { try { await actualizarCola(); } catch (err) { setError(errorTexto(err)); } setOcupado(false); }
    }
    // Agrupa solo la presentación; la sincronización conserva todas las versiones.
    const gruposEnvio=new Map();
    for(const item of [...operaciones].sort((a,b)=>String(b.creado_en).localeCompare(String(a.creado_en)))) {
        if(item.estado==='sustituida')continue;
        const clave=item.tipo==='HOJA' && item.datos.id_detalle_presupuesto!=null
            ? `hoja:${item.datos.id_detalle_presupuesto}:${item.datos.numero_unidad ?? 'anterior'}` : item.id_operacion_offline;
        if(!gruposEnvio.has(clave))gruposEnvio.set(clave,{...item,versiones:[]});
        gruposEnvio.get(clave).versiones.push(item);
    }
    const envios=[...gruposEnvio.values()];
    const pendientes = envios.filter(item => item.versiones.some(v=>v.estado==='pendiente')).length;
    return <main className="gamma">
        <header><Link to="/gamma" aria-label="Ir al inicio de terreno"><img className="gamma-logo" src={logo} alt="Frio y Agroindustria" /></Link><div><h1>Portal de terreno</h1><p>{usuario.nombres} {usuario.apellidos} · {online ? 'Con conexión' : 'Sin conexión'}</p></div><button onClick={() => logout()}>Cerrar sesión</button></header>
        {!inicio && <Link className="gamma-volver" to="/gamma">Volver al inicio</Link>}
        {error && <p role="alert">{error}</p>}{mensaje && rutaMensaje === ubicacion.pathname && <p role="status">{mensaje}</p>}
        {cargando ? <p role="status">Cargando datos del dispositivo...</p> : <Routes>
            <Route index element={<>
                <section className="gamma-panel" aria-label="Datos del dispositivo"><p>Última descarga: {snapshot?.actualizado_en ? new Date(snapshot.actualizado_en).toLocaleString('es-CL', { timeZone: 'America/Santiago' }) : 'Sin datos descargados'}</p>
                    <button disabled={ocupado || !online} onClick={()=>ejecutar('descargar')}>{ocupado?'Procesando...':'Descargar datos'}</button>
                </section>
                <nav className="gamma-menu" aria-label="Portal de terreno"><NavLink to="/gamma/obras">Mis obras</NavLink><NavLink to="/gamma/recepciones">Recepciones</NavLink><NavLink to="/gamma/pendientes">Pendientes ({pendientes})</NavLink></nav>
                <Actividad snapshot={snapshot} operaciones={operaciones} />
            </>} />
            <Route path="pendientes" element={<section><h2>Pendientes y envíos</h2>
                <button className="gamma-principal" disabled={ocupado || !online || !pendientes} onClick={()=>ejecutar('sincronizar')}>{ocupado?'Sincronizando...':'Sincronizar pendientes'}</button>
                <p>Los registros sin confirmar se conservan. Revisa los motivos de rechazo antes de registrar una corrección.</p>
                {!operaciones.length && <p>No hay operaciones guardadas.</p>}
                {envios.map(item=>{
                    const tarea=(snapshot?.obras || []).flatMap(o=>o.tareas || []).find(t=>Number(t.id_detalle_presupuesto)===Number(item.datos.id_detalle_presupuesto));
                    return <article className="gamma-panel" key={item.id_operacion_offline}>
                        <h3>{item.tipo==='CIERRE'?'Entrega del trabajo':item.tipo==='HOJA'?`Hoja de servicio${tarea?`: ${tarea.descripcion}`:''}`:item.tipo==='PRESUPUESTO'?'Presupuesto':'Firma de recepción'}</h3>
                        {item.tipo==='HOJA' && <p>Unidad {item.datos.numero_unidad ?? 'sin indicar'} · Hoja: <strong>{item.datos.estado || 'Borrador'}</strong></p>}
                        <p>Último envío: <strong>{item.estado}</strong> · {item.datos.id_obra ? obraNombre(snapshot?.obras.find(o=>o.id_obra===Number(item.datos.id_obra)) || {id_obra:item.datos.id_obra}) : `Recepción #${item.datos.id_recepcion}`}</p>
                        {item.versiones.filter(v=>v.error).map(v=><p role="alert" key={v.id_operacion_offline}>{typeof v.error==='string'?v.error:v.error.mensaje || 'No se pudo enviar el registro.'}</p>)}
                        {item.tipo==='HOJA' && item.versiones.some(v=>v.estado==='rechazada') && <Link className="gamma-volver" to={`/gamma/obras/${item.datos.id_obra}/tareas/${item.datos.id_detalle_presupuesto}/unidades/${item.datos.numero_unidad ?? 1}`}>Revisar y corregir hoja</Link>}
                    </article>;
                })}
            </section>} />
            <Route path="obras" element={snapshot ? <Obras snapshot={snapshot} operaciones={operaciones} /> : <p>Descarga los datos desde el inicio antes de trabajar sin conexión.</p>} />
            <Route path="obras/:idObra/*" element={snapshot ? <ApartadoObra snapshot={snapshot} usuarioId={usuarioId} operaciones={operaciones} alGuardar={actualizarCola} /> : <p>Descarga los datos desde el inicio.</p>} />
            <Route path="recepciones" element={snapshot ? <FormularioTerreno key="FIRMA_RECEPCION" usuarioId={usuarioId} snapshot={snapshot} tipo="FIRMA_RECEPCION" operaciones={operaciones} alGuardar={actualizarCola} /> : <p>Descarga los datos desde el inicio.</p>} />
            <Route path="*" element={<p>Selecciona una opción desde el <Link to="/gamma">inicio de terreno</Link>.</p>} />
        </Routes>}
    </main>;
}
