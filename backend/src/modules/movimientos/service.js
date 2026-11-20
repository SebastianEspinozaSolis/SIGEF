const { isDeepStrictEqual } = require('node:util');
const pool = require('../../db');
const ErrorHttp = require('../../utils/ErrorHttp');
const config = require('../../config');
const { idPositivo, texto, comprobarErrores, filtrosListado } = require('../../utils/catalogos');
const { registrarAuditoria } = require('../auditoria/service');

const tiposImplementados = ['INGRESO', 'EGRESO', 'MERMA', 'AJUSTE', 'USO_INTERNO', 'DEVOLUCION_PROVEEDOR', 'REVERSA'];
function numero(valor, precision, enteros, permiteNegativo = false) {
    if (!['number','string'].includes(typeof valor)) return null;
    const patron = new RegExp(`^${permiteNegativo ? '-?' : ''}\\d{1,${enteros}}(?:\\.\\d{1,${precision}})?$`);
    if (!patron.test(String(valor))) return null;
    const negativo = String(valor).startsWith('-');
    const [entero, fraccion=''] = String(valor).replace(/^-/, '').split('.');
    const n = BigInt(entero) * 10n ** BigInt(precision) + BigInt(fraccion.padEnd(precision,'0'));
    return negativo ? -n : n;
}
function decimal(n, precision) {
    const factor = 10n ** BigInt(precision);
    const absoluto = n < 0n ? -n : n;
    return `${n < 0n ? '-' : ''}${absoluto / factor}.${String(absoluto % factor).padStart(precision,'0')}`;
}
function validar(datos) {
    const errores = {};
    const tipo = datos.tipo_movimiento;
    if (!tiposImplementados.includes(tipo)) errores.tipo_movimiento = 'Tipo pendiente de definir o no permitido';
    const cantidad = numero(datos.cantidad,3,9,tipo==='AJUSTE');
    if (cantidad === null || cantidad===0n) errores.cantidad = 'Ingresa una cantidad válida, distinta de cero y con hasta tres decimales';
    const costo = tipo==='INGRESO' ? numero(datos.costo_unitario,4,10) : null;
    if (tipo==='INGRESO' && costo===null) errores.costo_unitario = 'Ingresa un costo neto no negativo con hasta cuatro decimales';
    const justificacion = texto(datos.justificacion,'justificacion',2000,errores);
    let obra = null, receptor = null;
    if (tipo==='EGRESO' || (tipo==='MERMA' && datos.id_obra != null && datos.id_obra!=='')) {
        try { obra=idPositivo(datos.id_obra); } catch { errores.id_obra='Selecciona una obra válida'; }
    }
    if (tipo==='USO_INTERNO') {
        try { receptor=idPositivo(datos.id_usuario_receptor); } catch { errores.id_usuario_receptor='Selecciona el responsable de recepción'; }
    }
    let origen=null, revertido=null;
    if (datos.id_movimiento_origen != null && datos.id_movimiento_origen !== '') {
        if (tipo!=='DEVOLUCION_PROVEEDOR') errores.id_movimiento_origen='Referencia no permitida para este tipo';
        try { origen=idPositivo(datos.id_movimiento_origen); } catch { errores.id_movimiento_origen='Selecciona un movimiento de origen'; }
    }
    if (tipo==='DEVOLUCION_PROVEEDOR' && origen===null) errores.id_movimiento_origen='Selecciona el ingreso original';
    if (tipo==='REVERSA') {
        try { revertido=idPositivo(datos.id_movimiento_revertido); } catch { errores.id_movimiento_revertido='Selecciona el movimiento original'; }
    } else if (Object.hasOwn(datos,'id_movimiento_revertido')) errores.id_movimiento_revertido='Solo se utiliza para una reversa';
    if (typeof datos.id_operacion!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(datos.id_operacion)) errores.id_operacion='Identificador de operación inválido';
    for (const campo of ['stock_actual','stock_comprometido','precio_pmp','precio_lista_vigente','id_documento','id_recepcion','id_detalle_documento']) {
        if (Object.hasOwn(datos,campo)) errores[campo]='Este dato lo determina el servidor o corresponde a otro flujo';
    }
    comprobarErrores(errores);
    return { tipo_movimiento:tipo, cantidad:decimal(cantidad,3), costo_unitario:costo===null?null:decimal(costo,4),
        justificacion,id_obra:obra,id_usuario_receptor:receptor,id_movimiento_origen:origen,id_movimiento_revertido:revertido,id_operacion:datos.id_operacion.toLowerCase() };
}
function absoluto(n) { return n<0n?-n:n; }
// Calcula lo reversible, devuelto y consumido sin modificar el historial original.
function analizar(historial) {
    const reversas=new Map(), consumos=new Map(), devoluciones=new Map();
    for (const m of historial) if (m.tipo_movimiento==='REVERSA') reversas.set(m.id_movimiento_revertido,(reversas.get(m.id_movimiento_revertido)||0n)+absoluto(numero(m.cantidad,3,9,true)));
    for (const m of historial) {
        const neto=absoluto(numero(m.cantidad,3,9,true))-(reversas.get(m.id_movimiento)||0n);
        if (m.tipo_movimiento==='EGRESO' && m.id_movimiento_origen) consumos.set(m.id_movimiento_origen,(consumos.get(m.id_movimiento_origen)||0n)+neto);
        if (m.tipo_movimiento==='DEVOLUCION_PROVEEDOR' && m.id_movimiento_origen) devoluciones.set(m.id_movimiento_origen,(devoluciones.get(m.id_movimiento_origen)||0n)+neto);
    }
    return { reversas,consumos,devoluciones };
}
function restante(original, resumen) {
    let saldo=absoluto(numero(original.cantidad,3,9,true))-(resumen.reversas.get(original.id_movimiento)||0n);
    if (original.tipo_movimiento==='INGRESO') saldo-=resumen.devoluciones.get(original.id_movimiento)||0n;
    if (original.tipo_movimiento==='USO_INTERNO') saldo-=resumen.consumos.get(original.id_movimiento)||0n;
    return saldo;
}
// Cantidades y costos se calculan con enteros para evitar errores de coma flotante.
function calcular(articulo, solicitud, contexto={}) {
    const stock=numero(articulo.stock_actual,3,9);
    const comprometido=numero(articulo.stock_comprometido,3,9);
    const promedio=numero(articulo.precio_pmp,4,10);
    const cantidad=numero(solicitud.cantidad,3,9,true);
    if (stock===null || comprometido===null || promedio===null || comprometido>stock) throw new ErrorHttp(409,'El saldo del artículo requiere revisión');
    if (articulo.unidad_medida==='UN' && cantidad%1000n!==0n) throw new ErrorHttp(400,'Hay datos inválidos',{cantidad:'Este artículo se registra en unidades enteras'});
    const tipo=solicitud.tipo_movimiento, original=contexto.original;
    let delta=cantidad, reserva=0n, costo=promedio, ponderar=false;
    if (tipo==='INGRESO') { costo=numero(solicitud.costo_unitario,4,10); ponderar=true; }
    if (['EGRESO','MERMA','DEVOLUCION_PROVEEDOR'].includes(tipo)) delta=-cantidad;
    if (tipo==='USO_INTERNO') { delta=0n; reserva=cantidad; }
    if (tipo==='EGRESO' && original) reserva=-cantidad;
    if (tipo==='DEVOLUCION_PROVEEDOR') { costo=numero(original.costo_unitario,4,10); ponderar=true; }
    if (tipo==='REVERSA') {
        costo=numero(original.costo_unitario,4,10);
        if (original.tipo_movimiento==='USO_INTERNO') { delta=0n; reserva=-cantidad; }
        else {
            const salida=['EGRESO','MERMA','DEVOLUCION_PROVEEDOR'].includes(original.tipo_movimiento)
                || (original.tipo_movimiento==='AJUSTE' && numero(original.cantidad,3,9,true)<0n);
            delta=salida?cantidad:-cantidad;
            if (original.tipo_movimiento==='EGRESO' && original.id_movimiento_origen) reserva=cantidad;
            ponderar=original.tipo_movimiento!=='AJUSTE';
        }
    }
    const nuevo=stock+delta, nuevaReserva=comprometido+reserva;
    if (nuevo<0n || nuevaReserva<0n || nuevo<nuevaReserva) throw new ErrorHttp(409,'La cantidad supera las existencias o asignaciones disponibles');
    if (nuevo>999999999999n || nuevaReserva>999999999999n) throw new ErrorHttp(400,'La cantidad supera el máximo de existencias');
    let nuevoPromedio=promedio;
    if (ponderar) {
        const valor=stock*promedio+delta*costo;
        if (valor<0n && nuevo>0n) throw new ErrorHttp(409,'La corrección dejaría una valoración negativa; revisa los costos y movimientos posteriores');
        nuevoPromedio=nuevo===0n?0n:(valor+nuevo/2n)/nuevo;
        if (nuevoPromedio>99999999999999n) throw new ErrorHttp(400,'El costo promedio supera el máximo admitido');
    }
    const cantidadMovimiento=tipo==='REVERSA'?(delta===0n?reserva:delta):cantidad;
    return { stock_actual:decimal(nuevo,3),stock_comprometido:decimal(nuevaReserva,3),precio_pmp:decimal(nuevoPromedio,4),costo_unitario:decimal(costo,4),cantidad_movimiento:decimal(cantidadMovimiento,3) };
}
// Recorre las referencias hasta el detalle de compra, también para reversas de devoluciones.
async function documentoOrigen(conexion,idMovimiento,idArticulo) {
    const r=await conexion.query(`WITH RECURSIVE cadena AS (
        SELECT m.id_movimiento,m.id_articulo,m.id_detalle_documento,m.id_movimiento_origen,m.id_movimiento_revertido,
            ARRAY[m.id_movimiento] AS visitados FROM movimiento_cardex m WHERE m.id_movimiento=$1 AND m.id_articulo=$2
        UNION ALL
        SELECT m.id_movimiento,m.id_articulo,m.id_detalle_documento,m.id_movimiento_origen,m.id_movimiento_revertido,
            c.visitados||m.id_movimiento FROM cadena c JOIN movimiento_cardex m
            ON m.id_movimiento=COALESCE(c.id_movimiento_revertido,c.id_movimiento_origen) AND m.id_articulo=c.id_articulo
        WHERE c.id_detalle_documento IS NULL AND NOT m.id_movimiento=ANY(c.visitados)
    ) SELECT l.id_documento FROM cadena c JOIN detalle_documento l ON l.id_detalle_documento=c.id_detalle_documento LIMIT 1`,[idMovimiento,idArticulo]);
    return r.rows[0]?.id_documento||null;
}
async function historialCon(conexion,id) {
    const filas=(await conexion.query(`SELECT m.*,r.id_usuario_receptor,u.nombres AS receptor_nombres,u.apellidos AS receptor_apellidos,
        l.id_documento AS id_documento_respaldo,d.id_proveedor,d.folio AS documento_folio,p.razon_social AS proveedor
        FROM movimiento_cardex m LEFT JOIN recepcion_material r ON r.id_recepcion=m.id_recepcion
        LEFT JOIN usuario u ON u.id_usuario=r.id_usuario_receptor
        LEFT JOIN detalle_documento l ON l.id_detalle_documento=m.id_detalle_documento
        LEFT JOIN documento_tributario d ON d.id_documento=l.id_documento
        LEFT JOIN proveedor p ON p.id_proveedor=d.id_proveedor
        WHERE m.id_articulo=$1 ORDER BY m.fecha_hora DESC,m.id_movimiento DESC`,[id])).rows;
    const indice=new Map(filas.map(m=>[m.id_movimiento,m]));
    return filas.map(m=>{
        let origen=m;
        const visitados=new Set();
        while(origen&&!origen.id_documento_respaldo&&!visitados.has(origen.id_movimiento)) {
            visitados.add(origen.id_movimiento);
            origen=indice.get(origen.id_movimiento_revertido||origen.id_movimiento_origen);
        }
        return origen?.id_documento_respaldo?{...m,id_documento_respaldo:origen.id_documento_respaldo,
            id_proveedor:origen.id_proveedor,documento_folio:origen.documento_folio,proveedor:origen.proveedor}:m;
    });
}
async function referencias(idArticulo,filtros={}) {
    const id=idPositivo(idArticulo);
    if (!['REVERSA','DEVOLUCION_PROVEEDOR'].includes(filtros.tipo)) throw new ErrorHttp(400,'Tipo de referencia inválido');
    const {pagina,limite,offset}=filtrosListado(filtros);
    const historia=await historialCon(pool,id), resumen=analizar(historia);
    const elegibles=historia.filter(m=>filtros.tipo==='REVERSA'?m.tipo_movimiento!=='REVERSA':m.tipo_movimiento==='INGRESO'&&m.id_proveedor)
        .map(m=>({...m,cantidad_disponible:decimal(restante(m,resumen),3)})).filter(m=>Number(m.cantidad_disponible)>0)
        .filter(m=>!filtros.q || [m.id_movimiento,m.tipo_movimiento,m.receptor_nombres,m.receptor_apellidos,m.proveedor,m.documento_folio].join(' ').toLocaleLowerCase().includes(filtros.q.trim().toLocaleLowerCase()));
    return {registros:elegibles.slice(offset,offset+limite),total:elegibles.length,pagina,limite};
}
async function receptores(filtros={}) {
    const {pagina,limite,offset,patron}=filtrosListado(filtros);
    const tecnico=filtros.tecnico==='true';
    const valores=[patron];
    const where=`u.estado='Activo' AND (u.nombres ILIKE $1 OR u.apellidos ILIKE $1)${tecnico?' AND r.nombre_rol=$2':''}`;
    if(tecnico)valores.push(config.roles.TECNICO);
    const total=await pool.query(`SELECT COUNT(*) AS total FROM usuario u JOIN rol r USING(id_rol) WHERE ${where}`,valores);
    const filas=await pool.query(`SELECT u.id_usuario,u.nombres,u.apellidos,r.nombre_rol FROM usuario u JOIN rol r USING(id_rol)
        WHERE ${where} ORDER BY u.nombres,u.apellidos,u.id_usuario LIMIT $${valores.length+1} OFFSET $${valores.length+2}`,[...valores,limite,offset]);
    return {registros:filas.rows,total:Number(total.rows[0].total),pagina,limite};
}
async function registrar(idArticulo, datos, responsable) {
    const id=idPositivo(idArticulo);
    responsable=idPositivo(responsable);
    const solicitud=validar(datos);
    const client=await pool.connect();
    try {
        await client.query('BEGIN');
        // La auditoría conserva la clave de reintento sin añadir columnas al modelo.
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[solicitud.id_operacion]);
        const previa=await client.query(`SELECT valores_nuevos FROM registro_auditoria
            WHERE accion='REGISTRAR_MOVIMIENTO' AND valores_nuevos->>'id_operacion'=$1 ORDER BY id_auditoria LIMIT 1`,[solicitud.id_operacion]);
        if (previa.rows.length) {
            const anterior=previa.rows[0].valores_nuevos;
            if (anterior.id_articulo!==id || anterior.id_usuario!==responsable || !isDeepStrictEqual(anterior.solicitud,solicitud)) throw new ErrorHttp(409,'Esta confirmación ya se utilizó con otros datos');
            await client.query('COMMIT');
            return { movimiento:anterior.movimiento,saldo:anterior.saldo,repetida:true };
        }
        let origenPrevio=null;
        const idOrigen=solicitud.id_movimiento_origen||solicitud.id_movimiento_revertido;
        if(idOrigen) {
            const origen=await client.query('SELECT * FROM movimiento_cardex WHERE id_movimiento=$1 AND id_articulo=$2',[idOrigen,id]);
            origenPrevio=origen.rows[0];
            if(!origenPrevio)throw new ErrorHttp(400,'El movimiento original no pertenece a este artículo');
            const documento=await documentoOrigen(client,idOrigen,id);
            if(documento)await client.query('SELECT id_documento FROM documento_tributario WHERE id_documento=$1 FOR UPDATE',[documento]);
        }
        const r=await client.query('SELECT * FROM articulo WHERE id_articulo=$1 FOR UPDATE',[id]);
        const articulo=r.rows[0];
        if (!articulo) throw new ErrorHttp(404,'Artículo no encontrado');
        if (!articulo.activo) throw new ErrorHttp(409,'No se pueden registrar movimientos de un artículo inactivo');
        if (solicitud.id_obra!==null) {
            const obra=await client.query('SELECT id_obra FROM obra WHERE id_obra=$1',[solicitud.id_obra]);
            if (!obra.rows.length) throw new ErrorHttp(400,'La obra indicada no existe');
        }
        let original=null, historia=[];
        if(idOrigen) {
            historia=await historialCon(client,id);
            original=historia.find(m=>m.id_movimiento===idOrigen);
            if(!original)throw new ErrorHttp(400,'Movimiento de referencia no encontrado');
            const resumen=analizar(historia);
            if(solicitud.tipo_movimiento==='REVERSA' && original.tipo_movimiento==='REVERSA')throw new ErrorHttp(400,'No se puede revertir una reversa');
            if(solicitud.tipo_movimiento==='DEVOLUCION_PROVEEDOR' && (original.tipo_movimiento!=='INGRESO'||!original.id_proveedor))throw new ErrorHttp(400,'La devolución exige un ingreso con documento de proveedor');
            if(numero(solicitud.cantidad,3,9)>restante(original,resumen))throw new ErrorHttp(409,'La cantidad supera lo que queda disponible en el movimiento original');
        }
        // La recepción identifica al técnico de una entrega USO_INTERNO.
        let idRecepcion=null;
        if(solicitud.tipo_movimiento==='USO_INTERNO') {
            const usuario=await client.query(`SELECT u.id_usuario,r.nombre_rol FROM usuario u JOIN rol r USING(id_rol)
                WHERE u.id_usuario=$1 AND u.estado='Activo' FOR SHARE OF u`,[solicitud.id_usuario_receptor]);
            if(!usuario.rows.length)throw new ErrorHttp(400,'El receptor debe ser un usuario activo');
            if(usuario.rows[0].nombre_rol!==config.roles.TECNICO)throw new ErrorHttp(400,'Selecciona un técnico activo para la asignación');
            const recepcion=await client.query('INSERT INTO recepcion_material (id_usuario_receptor) VALUES ($1) RETURNING id_recepcion',[solicitud.id_usuario_receptor]);
            idRecepcion=recepcion.rows[0].id_recepcion;
        }
        const saldo=calcular(articulo,solicitud,{original});
        await client.query('UPDATE articulo SET stock_actual=$2,precio_pmp=$3,stock_comprometido=$4 WHERE id_articulo=$1',[id,saldo.stock_actual,saldo.precio_pmp,saldo.stock_comprometido]);
        const obra=solicitud.tipo_movimiento==='REVERSA'?(original.id_obra||null):solicitud.id_obra;
        const movimiento=await client.query(`INSERT INTO movimiento_cardex
            (id_articulo,id_usuario,tipo_movimiento,cantidad,costo_unitario,justificacion,id_obra,id_recepcion,precio_lista_vigente,id_movimiento_origen,id_movimiento_revertido)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[id,responsable,solicitud.tipo_movimiento,saldo.cantidad_movimiento,saldo.costo_unitario,solicitud.justificacion,obra,idRecepcion,solicitud.tipo_movimiento==='EGRESO'?articulo.precio_lista:null,solicitud.id_movimiento_origen,solicitud.id_movimiento_revertido]);
        const nuevos={id_operacion:solicitud.id_operacion,id_articulo:id,id_usuario:responsable,solicitud,movimiento:movimiento.rows[0],saldo};
        await registrarAuditoria(client,{id_usuario:responsable,tabla_afectada:'movimiento_cardex',id_registro_afectado:movimiento.rows[0].id_movimiento,
            accion:'REGISTRAR_MOVIMIENTO',valores_anteriores:{stock_actual:articulo.stock_actual,stock_comprometido:articulo.stock_comprometido,precio_pmp:articulo.precio_pmp},valores_nuevos:nuevos});
        await client.query('COMMIT');
        return {movimiento:movimiento.rows[0],saldo,repetida:false};
    } catch(e) {
        await client.query('ROLLBACK');
        if (e.code==='22003') throw new ErrorHttp(400,'La operación supera el límite de cantidad o costo');
        if (e.code==='23503') throw new ErrorHttp(400,'Una referencia de la operación ya no existe');
        throw e;
    } finally {client.release();}
}
module.exports={registrar,calcular,validar,referencias,receptores,analizar,restante,documentoOrigen};
