const { validar: validarPresupuesto } = require('../presupuestos/service');
const { comprobarCierre } = require('../obras/service');
const pool = require('../../db');
const ErrorHttp = require('../../utils/ErrorHttp');
const { idPositivo } = require('../../utils/catalogos');
const { uuidValido, fechaValida } = require('../../utils/validaciones');
const { escalar, decimal } = require('../../utils/decimales');
const { registrarAuditoria } = require('../auditoria/service');
const { analizar, restante, calcular } = require('../movimientos/service');
const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { validarFirma: firma } = require('../../utils/firmas');

function invalido(mensaje = 'Hay datos inválidos en la operación') { throw new ErrorHttp(400, mensaje); }
function objeto(valor) { return valor !== null && typeof valor === 'object' && !Array.isArray(valor); }
function campos(datos, permitidos) {
    if (!objeto(datos) || Object.keys(datos).some(k => !permitidos.includes(k))) invalido();
}
function numero(valor, enteros, decimales, positivo = false) {
    if (!['string', 'number'].includes(typeof valor) || !new RegExp(`^\\d{1,${enteros}}(?:\\.\\d{1,${decimales}})?$`).test(String(valor))) invalido();
    const n = escalar(valor, decimales);
    if (positivo && n === 0n) invalido('La cantidad debe ser mayor que cero');
    return decimal(n, decimales);
}
function validar(op) {
    campos(op, ['id_operacion_offline', 'tipo', 'datos']);
    if (!uuidValido(op.id_operacion_offline) || !['HOJA', 'CIERRE', 'FIRMA_RECEPCION', 'PRESUPUESTO'].includes(op.tipo)) invalido();
    const d = op.datos;
    let datos;
    if (op.tipo === 'HOJA' && objeto(d) && Object.hasOwn(d, 'id_detalle_presupuesto')) {
        campos(d,['id_obra','id_detalle_presupuesto','operacion_base','estado','fecha_servicio','horas_trabajadas','respuestas','materiales']);
        if (!['Borrador','Completada'].includes(d.estado) || !fechaValida(d.fecha_servicio) || d.fecha_servicio.startsWith('0000')) invalido();
        if (d.operacion_base != null && !uuidValido(d.operacion_base)) invalido();
        if (!Array.isArray(d.respuestas) || d.respuestas.length>200 || !Array.isArray(d.materiales) || d.materiales.length>100) invalido();
        datos={id_obra:idPositivo(d.id_obra),id_detalle_presupuesto:idPositivo(d.id_detalle_presupuesto),operacion_base:d.operacion_base?.toLowerCase() || null,
            estado:d.estado,fecha_servicio:d.fecha_servicio,horas_trabajadas:numero(d.horas_trabajadas,3,2),
            respuestas:d.respuestas.map(r=>{
                campos(r,['id_item','pregunta','estado','observacion']);
                if(typeof r.pregunta!=='string' || !r.pregunta.trim() || r.pregunta.length>255 || !['Pendiente','Completado','No aplica'].includes(r.estado)) invalido('Revisa las comprobaciones de la hoja');
                const observacion=r.observacion ?? '';
                if(typeof observacion!=='string' || observacion.length>255 || (r.estado==='No aplica' && !observacion.trim())) invalido('Indica el motivo de las comprobaciones que no aplican');
                return {id_item:r.id_item==null?null:idPositivo(r.id_item),pregunta:r.pregunta.trim(),estado:r.estado,observacion:observacion.trim()};
            }),materiales:d.materiales.map(m=>{campos(m,['id_movimiento_asignacion','cantidad']);return {id_movimiento_asignacion:idPositivo(m.id_movimiento_asignacion),cantidad:numero(m.cantidad,9,3,true)};})};
        const ids=datos.respuestas.filter(r=>r.id_item!=null).map(r=>r.id_item);
        if(datos.estado==='Completada' && escalar(datos.horas_trabajadas,2)===0n) invalido('Indica horas trabajadas mayores que cero antes de completar la hoja');
        if(new Set(ids).size!==ids.length || new Set(datos.respuestas.map(r=>r.pregunta)).size!==datos.respuestas.length || new Set(datos.materiales.map(m=>m.id_movimiento_asignacion)).size!==datos.materiales.length) invalido('No repitas comprobaciones ni asignaciones');
        if(datos.estado==='Completada' && datos.respuestas.some(r=>r.estado==='Pendiente')) invalido('Resuelve todas las comprobaciones antes de completar la hoja');
    } else if (op.tipo === 'CIERRE' && objeto(d) && Object.hasOwn(d, 'firma_conformidad')) {
        campos(d, ['id_obra', 'firma_conformidad']);
        datos = {id_obra:idPositivo(d.id_obra), firma_conformidad:firma(d.firma_conformidad)};
    } else if (op.tipo === 'HOJA' || op.tipo === 'CIERRE') {
        // Conserva la normalización de operaciones antiguas para reconocer sus UUID.
        campos(d, ['id_obra', 'fecha_servicio', 'horas_trabajadas', 'firma_cliente_base64', 'respuestas', 'materiales']);
        if (!fechaValida(d.fecha_servicio) || d.fecha_servicio.startsWith('0000')) invalido('Selecciona una fecha válida');
        if (!Array.isArray(d.respuestas) || d.respuestas.length > 200 || !Array.isArray(d.materiales) || d.materiales.length > 100) invalido();
        datos = {id_obra: idPositivo(d.id_obra), fecha_servicio: d.fecha_servicio, horas_trabajadas: numero(d.horas_trabajadas, 3, 2), firma_cliente_base64: firma(d.firma_cliente_base64, op.tipo !== 'CIERRE'),
            respuestas: d.respuestas.map(r => { campos(r,['id_item','valor_respuesta']); if (typeof r.valor_respuesta !== 'string' || r.valor_respuesta.length > 255) invalido(); return {id_item: idPositivo(r.id_item), valor_respuesta: r.valor_respuesta}; }),
            materiales: d.materiales.map(m => { campos(m,['id_movimiento_asignacion','cantidad']); return {id_movimiento_asignacion: idPositivo(m.id_movimiento_asignacion), cantidad: numero(m.cantidad,9,3,true)}; })};
        if (new Set(datos.respuestas.map(r => r.id_item)).size !== datos.respuestas.length || new Set(datos.materiales.map(m => m.id_movimiento_asignacion)).size !== datos.materiales.length) invalido('No repitas preguntas ni asignaciones en una hoja');
        if (op.tipo === 'HOJA' && d.firma_cliente_base64) invalido('La firma del cliente corresponde al cierre de la obra');
    } else if (op.tipo === 'PRESUPUESTO') {
        campos(d,['id_obra','monto_total','id_categoria_servicio','detalles']);
        if (d.detalles === undefined && d.id_categoria_servicio === undefined
            && !/^\d{1,12}(\.0{1,2})?$/.test(String(d.monto_total))) invalido('Ingresa un monto no negativo, en pesos enteros');
        datos = d.detalles !== undefined || d.id_categoria_servicio !== undefined
            ? {id_obra:idPositivo(d.id_obra), ...validarPresupuesto({...d,id_cliente:1})}
            : {id_obra: idPositivo(d.id_obra), monto_total: numero(d.monto_total,12,2)};
        delete datos.id_cliente;
    } else {
        campos(d,['id_recepcion','firma']);
        datos = {id_recepcion: idPositivo(d.id_recepcion), firma: firma(d.firma)};
    }
    return {id_operacion_offline: op.id_operacion_offline.toLowerCase(), tipo: op.tipo, datos};
}
// Ordena claves sin cambiar el orden de las líneas; la huella permite comparar sin auditar firmas.
function canonical(valor) {
    if (Array.isArray(valor)) return valor.map(canonical);
    if (objeto(valor)) return Object.fromEntries(Object.keys(valor).sort().map(k => [k,canonical(valor[k])]));
    return valor;
}
async function obraPropia(client, id, usuario) {
    const obra = (await client.query(`SELECT o.*, p.id_cliente FROM obra o JOIN presupuesto p USING(id_presupuesto)
        WHERE o.id_obra=$1 AND o.id_tecnico=$2 FOR UPDATE OF o`,[id,usuario])).rows[0];
    if (!obra) throw new ErrorHttp(403,'La obra no está asignada a tu usuario');
    if (obra.estado !== 'En proceso') throw new ErrorHttp(409,'La obra debe estar En proceso para registrar esta operación');
    if (obra.firma_conformidad) throw new ErrorHttp(409,'El trabajo ya fue enviado para revisión y finalización en el ERP');
    return obra;
}
async function guardarHoja(client, entrada, usuario, uuid) {
    const obra = await obraPropia(client,entrada.id_obra,usuario);
    let d=entrada;
    const detalles=(await client.query(entrada.id_detalle_presupuesto
        ? 'SELECT * FROM detalle_presupuesto WHERE id_detalle_presupuesto=$1 FOR SHARE'
        : 'SELECT * FROM detalle_presupuesto WHERE id_presupuesto=$1 ORDER BY id_detalle_presupuesto FOR SHARE',
        [entrada.id_detalle_presupuesto || obra.id_presupuesto])).rows;
    if(detalles.length!==1) throw new ErrorHttp(409,'Selecciona la tarea contratada para guardar su hoja');
    const detalle=detalles[0];
    if(detalle.id_presupuesto!==obra.id_presupuesto) throw new ErrorHttp(403,'La tarea no pertenece al presupuesto de esta obra');
    const anterior=(await client.query('SELECT * FROM hoja_de_servicio WHERE id_detalle_presupuesto=$1 FOR UPDATE',[detalle.id_detalle_presupuesto])).rows[0];
    const items=(await client.query('SELECT id_item,pregunta FROM item_checklist WHERE id_tarea=$1 ORDER BY id_item FOR SHARE',[detalle.id_tarea])).rows;
    // Una operacion antigua solo se asocia automaticamente si la obra tiene una tarea.
    if(!entrada.id_detalle_presupuesto) {
        d={...entrada,id_detalle_presupuesto:detalle.id_detalle_presupuesto,operacion_base:null,estado:'Completada',
            respuestas:entrada.respuestas.map(r=>{
                const item=items.find(i=>i.id_item===r.id_item);
                if(!item) invalido('Descarga los datos y revisa el checklist de esta tarea');
                return {id_item:r.id_item,pregunta:item.pregunta,estado:r.valor_respuesta.trim()?'Completado':'Pendiente',observacion:r.valor_respuesta};
            })};
    }
    if(anterior && (anterior.estado==='Completada' || anterior.id_usuario!==usuario || anterior.id_operacion_offline!==d.operacion_base)) throw new ErrorHttp(409,'La hoja fue completada o modificada. Descarga los datos antes de continuar');
    if(!anterior && d.operacion_base) throw new ErrorHttp(409,'Falta sincronizar la version anterior de esta hoja');
    const copiadas=anterior ? (await client.query('SELECT id_item,pregunta FROM respuesta_checklist WHERE id_hoja_servicio=$1 ORDER BY id_respuesta',[anterior.id_hoja_servicio])).rows : items;
    if(copiadas.some(i=>!d.respuestas.some(r=>r.id_item===i.id_item && r.pregunta===i.pregunta))) invalido('Conserva las comprobaciones originales; si alguna no corresponde, indica No aplica');
    if(d.respuestas.some(r=>r.id_item!=null && !copiadas.some(i=>i.id_item===r.id_item) && !items.some(i=>i.id_item===r.id_item))) invalido('La comprobacion no pertenece a esta tarea');
    if(d.estado==='Completada' && d.respuestas.some(r=>r.estado==='Pendiente')) invalido('Resuelve todas las comprobaciones antes de completar');
    const consumidos=anterior ? (await client.query(`SELECT m.id_movimiento_origen, SUM(m.cantidad-COALESCE((SELECT SUM(ABS(v.cantidad)) FROM movimiento_cardex v
        WHERE v.id_movimiento_revertido=m.id_movimiento AND v.tipo_movimiento='REVERSA'),0)) AS cantidad
        FROM material_utilizado mu JOIN movimiento_cardex m ON m.id_movimiento=mu.id_movimiento_egreso
        WHERE mu.id_hoja_servicio=$1 GROUP BY m.id_movimiento_origen`,[anterior.id_hoja_servicio])).rows : [];
    if(consumidos.some(c=>escalar(d.materiales.find(m=>m.id_movimiento_asignacion===c.id_movimiento_origen)?.cantidad || '0',3)<escalar(c.cantidad,3))) throw new ErrorHttp(409,'No puedes reducir un consumo confirmado; corrige su movimiento mediante reversa');
    // El formulario envia totales de la hoja; solo la diferencia genera nuevos egresos.
    const materiales=d.materiales.map(m=>({...m,cantidad:decimal(escalar(m.cantidad,3)-escalar(consumidos.find(c=>c.id_movimiento_origen===m.id_movimiento_asignacion)?.cantidad || '0',3),3)})).filter(m=>escalar(m.cantidad,3)>0n);
    d={...d,materiales};
    const origenes = d.materiales.length ? (await client.query(`SELECT m.* FROM movimiento_cardex m JOIN recepcion_material r USING(id_recepcion)
        WHERE m.id_movimiento=ANY($1::int[]) AND m.tipo_movimiento='USO_INTERNO' AND r.id_usuario_receptor=$2`,[d.materiales.map(m => m.id_movimiento_asignacion),usuario])).rows : [];
    if (origenes.length !== d.materiales.length) throw new ErrorHttp(403,'Solo puedes consumir tus propias asignaciones');
    const articulos = new Map();
    // Todos los consumos bloquean artículos en el mismo orden que otros consumos Gamma.
    for (const id of [...new Set(origenes.map(m => m.id_articulo))].sort((a,b) => a-b)) {
        const articulo = (await client.query('SELECT * FROM articulo WHERE id_articulo=$1 FOR UPDATE',[id])).rows[0];
        if (!articulo || !articulo.activo) throw new ErrorHttp(409,'El artículo ya no está disponible');
        articulos.set(id,articulo);
    }
    for (const id of [...new Set(origenes.map(m => m.id_recepcion))].sort((a,b) => a-b)) {
        const r = (await client.query('SELECT * FROM recepcion_material WHERE id_recepcion=$1 AND id_usuario_receptor=$2 FOR SHARE',[id,usuario])).rows[0];
        if (!r || !r.firma) throw new ErrorHttp(409,'Firma la recepción antes de utilizar sus materiales');
    }
    const hoja = anterior || (await client.query(`INSERT INTO hoja_de_servicio (id_detalle_presupuesto,id_usuario,fecha_servicio,horas_trabajadas,estado,id_operacion_offline)
        VALUES ($1,$2,($3::date::timestamp AT TIME ZONE 'America/Santiago'),$4,$5,$6) RETURNING id_hoja_servicio`,[d.id_detalle_presupuesto,usuario,d.fecha_servicio,d.horas_trabajadas,d.estado,uuid])).rows[0];
    if(anterior) await client.query("UPDATE hoja_de_servicio SET fecha_servicio=($2::date::timestamp AT TIME ZONE 'America/Santiago'),horas_trabajadas=$3,estado=$4,id_operacion_offline=$5 WHERE id_hoja_servicio=$1",[hoja.id_hoja_servicio,d.fecha_servicio,d.horas_trabajadas,d.estado,uuid]);
    await client.query('DELETE FROM respuesta_checklist WHERE id_hoja_servicio=$1',[hoja.id_hoja_servicio]);
    for (const r of d.respuestas) await client.query('INSERT INTO respuesta_checklist (id_hoja_servicio,id_item,pregunta,estado,observacion) VALUES ($1,$2,$3,$4,$5)',[hoja.id_hoja_servicio,r.id_item,r.pregunta,r.estado,r.observacion || null]);
    for (const [indice,m] of d.materiales.entries()) {
        const original = origenes.find(o => o.id_movimiento === m.id_movimiento_asignacion);
        const historia = (await client.query('SELECT * FROM movimiento_cardex WHERE id_articulo=$1',[original.id_articulo])).rows;
        if (escalar(m.cantidad,3) > restante(original,analizar(historia))) throw new ErrorHttp(409,'La cantidad supera el saldo de la asignación');
        const articulo = articulos.get(original.id_articulo);
        const saldo = calcular(articulo,{tipo_movimiento:'EGRESO',cantidad:m.cantidad},{original});
        await client.query('UPDATE articulo SET stock_actual=$2,precio_pmp=$3,stock_comprometido=$4 WHERE id_articulo=$1',[articulo.id_articulo,saldo.stock_actual,saldo.precio_pmp,saldo.stock_comprometido]);
        Object.assign(articulo,saldo);
        const egreso = (await client.query(`INSERT INTO movimiento_cardex (id_articulo,id_usuario,tipo_movimiento,cantidad,costo_unitario,id_obra,precio_lista_vigente,id_movimiento_origen,justificacion)
            VALUES ($1,$2,'EGRESO',$3,$4,$5,$6,$7,$8) RETURNING id_movimiento`,[articulo.id_articulo,usuario,m.cantidad,saldo.costo_unitario,d.id_obra,articulo.precio_lista,original.id_movimiento,`Hoja de servicio ${hoja.id_hoja_servicio}`])).rows[0];
        await client.query('INSERT INTO material_utilizado (id_hoja_servicio,id_movimiento_egreso,id_operacion_offline) VALUES ($1,$2,$3)',[hoja.id_hoja_servicio,egreso.id_movimiento,`${uuid}:${indice}`]);
    }
    return hoja.id_hoja_servicio;
}
async function sincronizar(entrada, idUsuario) {
    const op = validar(entrada), usuario = idPositivo(idUsuario);
    const digest = createHash('sha256').update(JSON.stringify(canonical({tipo:op.tipo,datos:op.datos}))).digest('hex');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[op.id_operacion_offline]);
        const previa = (await client.query(`SELECT id_usuario,valores_nuevos FROM registro_auditoria WHERE accion='GAMMA_SINCRONIZAR'
            AND valores_nuevos->>'id_operacion_offline'=$1 ORDER BY id_auditoria LIMIT 1`,[op.id_operacion_offline])).rows[0];
        if (previa) {
            if (previa.id_usuario !== usuario || !isDeepStrictEqual(previa.valores_nuevos.solicitud_digest,digest)) throw new ErrorHttp(409,'El identificador ya corresponde a otra operación');
            await client.query('COMMIT');
            return {...previa.valores_nuevos.respuesta,repetida:true};
        }
        const d = op.datos;
        let id, tabla;
        if (op.tipo === 'HOJA') {
            id = await guardarHoja(client,d,usuario,op.id_operacion_offline); tabla='hoja_de_servicio';
        } else if (op.tipo === 'CIERRE') {
                const obra = await obraPropia(client,d.id_obra,usuario);
                const previas = await client.query("SELECT id_hoja_servicio FROM hoja_de_servicio h JOIN detalle_presupuesto d USING(id_detalle_presupuesto) JOIN obra o USING(id_presupuesto) WHERE o.id_obra=$1 AND h.estado='Completada' LIMIT 1",[d.id_obra]);
                if (!previas.rows.length) throw new ErrorHttp(409,'Completa una hoja de servicio antes de finalizar la obra');
                // Los cierres antiguos podían incluir trabajo adicional: no se descarta.
                if (d.materiales?.length || d.respuestas?.length || escalar(d.horas_trabajadas || '0',2)>0n) {
                    await guardarHoja(client,d,usuario,op.id_operacion_offline);
                }
                await comprobarCierre(client,obra);
                // Terreno entrega el trabajo; el cierre definitivo corresponde al ERP.
                await client.query("UPDATE obra SET firma_conformidad=$2 WHERE id_obra=$1",[d.id_obra,d.firma_conformidad || d.firma_cliente_base64]);
                id=d.id_obra; tabla='obra';
                await registrarAuditoria(client,{id_usuario:usuario,tabla_afectada:'obra',id_registro_afectado:d.id_obra,
                    accion:'ENVIAR_REVISION',valores_anteriores:{estado:obra.estado},valores_nuevos:{estado:obra.estado,revision_pendiente:true}});
        } else if (op.tipo === 'PRESUPUESTO') {
            const obra = await obraPropia(client,d.id_obra,usuario);
            if (d.detalles) {
                const categoria = await client.query('SELECT id_categoria_servicio FROM categoria_servicio WHERE id_categoria_servicio=$1 FOR KEY SHARE',[d.id_categoria_servicio]);
                if (!categoria.rows.length) invalido('La categoria ya no existe');
                const tareas = (await client.query('SELECT * FROM tarea_servicio WHERE id_tarea=ANY($1::int[]) ORDER BY id_tarea FOR SHARE',[d.detalles.map(l=>l.id_tarea).sort((a,b)=>a-b)])).rows;
                for (const linea of d.detalles) {
                    const tarea = tareas.find(t=>t.id_tarea===linea.id_tarea);
                    if (!tarea || !tarea.activo || tarea.id_categoria_servicio!==d.id_categoria_servicio) invalido('Revisa las tareas disponibles de la categoria');
                    linea.descripcion = linea.descripcion ?? tarea.nombre_tarea;
                }
                id = (await client.query(`INSERT INTO presupuesto (id_cliente,monto_total,estado,origen,id_operacion_offline,id_categoria_servicio)
                    VALUES ($1,$2,'Pendiente','Terreno',$3,$4) RETURNING id_presupuesto`,[obra.id_cliente,d.monto_total,op.id_operacion_offline,d.id_categoria_servicio])).rows[0].id_presupuesto;
                for (const l of d.detalles) await client.query(`INSERT INTO detalle_presupuesto (id_presupuesto,id_tarea,descripcion,cantidad,precio_neto_unitario)
                    VALUES ($1,$2,$3,$4,$5)`,[id,l.id_tarea,l.descripcion,l.cantidad,l.precio_neto_unitario]);
            } else {
                // Compatibilidad con operaciones manuales guardadas antes del catalogo offline.
                id = (await client.query(`INSERT INTO presupuesto (id_cliente,monto_total,estado,origen,id_operacion_offline)
                    VALUES ($1,$2,'Pendiente','Terreno',$3) RETURNING id_presupuesto`,[obra.id_cliente,d.monto_total,op.id_operacion_offline])).rows[0].id_presupuesto;
            }
            tabla='presupuesto';
        } else {
            const r = (await client.query('SELECT * FROM recepcion_material WHERE id_recepcion=$1 AND id_usuario_receptor=$2 FOR UPDATE',[d.id_recepcion,usuario])).rows[0];
            if (!r) throw new ErrorHttp(403,'La recepción no pertenece a tu usuario');
            if (r.firma) throw new ErrorHttp(409,'La recepción ya fue firmada');
            await client.query('UPDATE recepcion_material SET firma=$2,fecha_firma=now() WHERE id_recepcion=$1',[d.id_recepcion,d.firma]);
            id=d.id_recepcion; tabla='recepcion_material';
        }
        const respuesta = {tipo:op.tipo,id_registro:id,...(op.tipo === 'CIERRE' ? {id_obra:d.id_obra,estado:'En proceso',revision_pendiente:true} : {})};
        await registrarAuditoria(client,{id_usuario:usuario,tabla_afectada:tabla,id_registro_afectado:id,accion:'GAMMA_SINCRONIZAR',
            valores_nuevos:{id_operacion_offline:op.id_operacion_offline,solicitud_digest:digest,id_obra:d.id_obra || null,respuesta}});
        await client.query('COMMIT');
        return respuesta;
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
}

async function descargar(idUsuario) {
    const usuario = idPositivo(idUsuario);
    const obras = (await pool.query(`SELECT o.id_obra,o.nombre_obra,o.id_presupuesto,p.id_categoria_servicio,o.id_tecnico,
        o.estado,o.sin_materiales,o.fecha_creacion,o.fecha_cierre,p.id_cliente,c.razon_social,c.rut_cliente FROM obra o
        JOIN presupuesto p USING(id_presupuesto) JOIN cliente c USING(id_cliente) WHERE o.id_tecnico=$1 AND o.estado <> 'Finalizada' AND o.firma_conformidad IS NULL ORDER BY o.id_obra`,[usuario])).rows;
    const categorias = (await pool.query('SELECT id_categoria_servicio,nombre_servicio FROM categoria_servicio ORDER BY nombre_servicio')).rows;
    const tareas = (await pool.query('SELECT id_tarea,id_categoria_servicio,nombre_tarea,precio_neto FROM tarea_servicio WHERE activo=true ORDER BY nombre_tarea,id_tarea')).rows;
    const detalles = (await pool.query('SELECT d.* FROM detalle_presupuesto d WHERE d.id_presupuesto=ANY($1::int[]) ORDER BY d.id_detalle_presupuesto',[obras.map(o=>o.id_presupuesto)])).rows;
    for (const obra of obras) {
        obra.nombre_servicio = categorias.find(c=>c.id_categoria_servicio===obra.id_categoria_servicio)?.nombre_servicio;
        obra.tareas = detalles.filter(d=>d.id_presupuesto===obra.id_presupuesto);
    }
    const recepciones = (await pool.query('SELECT id_recepcion,fecha_firma,(firma IS NOT NULL) AS firmada FROM recepcion_material WHERE id_usuario_receptor=$1 ORDER BY id_recepcion',[usuario])).rows;
    const movimientos = (await pool.query(`SELECT m.*,a.nombre,a.unidad_medida FROM movimiento_cardex m JOIN articulo a USING(id_articulo)
        WHERE m.id_articulo IN (SELECT x.id_articulo FROM movimiento_cardex x JOIN recepcion_material r USING(id_recepcion) WHERE r.id_usuario_receptor=$1)`,[usuario])).rows;
    const resumen = analizar(movimientos), propias = new Set(recepciones.map(r => r.id_recepcion));
    const entregas = movimientos.filter(m => m.tipo_movimiento === 'USO_INTERNO' && propias.has(m.id_recepcion)).map(m => ({id_movimiento:m.id_movimiento,id_movimiento_asignacion:m.id_movimiento,id_recepcion:m.id_recepcion,id_articulo:m.id_articulo,nombre:m.nombre,unidad_medida:m.unidad_medida,cantidad:m.cantidad,cantidad_disponible:decimal(restante(m,resumen),3),firmada:recepciones.find(r => r.id_recepcion === m.id_recepcion).firmada}));
    const asignaciones = entregas.filter(m => escalar(m.cantidad_disponible,3) > 0n);
    for (const r of recepciones) r.movimientos = entregas.filter(m => m.id_recepcion === r.id_recepcion);
    const items = (await pool.query(`SELECT i.* FROM item_checklist i WHERE i.id_tarea=ANY($1::int[]) ORDER BY i.id_item`,[[...new Set(detalles.map(d=>d.id_tarea))]])).rows;
    const hojas = (await pool.query(`SELECT h.*,o.id_obra,
        COALESCE((SELECT json_agg(r ORDER BY r.id_respuesta) FROM respuesta_checklist r WHERE r.id_hoja_servicio=h.id_hoja_servicio),'[]'::json) AS respuestas,
        COALESCE((SELECT json_agg(c) FROM (SELECT m.id_movimiento_origen AS id_movimiento_asignacion,
            SUM(m.cantidad-COALESCE((SELECT SUM(ABS(v.cantidad)) FROM movimiento_cardex v WHERE v.id_movimiento_revertido=m.id_movimiento AND v.tipo_movimiento='REVERSA'),0)) AS cantidad
            FROM material_utilizado mu JOIN movimiento_cardex m ON m.id_movimiento=mu.id_movimiento_egreso
            WHERE mu.id_hoja_servicio=h.id_hoja_servicio GROUP BY m.id_movimiento_origen) c),'[]'::json) AS materiales
        FROM hoja_de_servicio h JOIN detalle_presupuesto d USING(id_detalle_presupuesto) JOIN obra o USING(id_presupuesto)
        WHERE o.id_tecnico=$1 AND o.estado <> 'Finalizada' AND o.firma_conformidad IS NULL ORDER BY h.id_hoja_servicio DESC`,[usuario])).rows;
    const presupuestos = (await pool.query(`SELECT p.*, (a.valores_nuevos->>'id_obra')::int AS id_obra FROM presupuesto p JOIN registro_auditoria a
        ON a.tabla_afectada='presupuesto' AND a.id_registro_afectado=p.id_presupuesto AND a.accion='GAMMA_SINCRONIZAR'
        WHERE a.id_usuario=$1 AND EXISTS (SELECT 1 FROM obra o WHERE o.id_obra=(a.valores_nuevos->>'id_obra')::int AND o.estado <> 'Finalizada' AND o.firma_conformidad IS NULL) ORDER BY p.id_presupuesto DESC`,[usuario])).rows;
    return {obras,recepciones,asignaciones,items,hojas,presupuestos,categorias,tareas,actualizado_en:new Date().toISOString()};
}
module.exports = { descargar, sincronizar };
