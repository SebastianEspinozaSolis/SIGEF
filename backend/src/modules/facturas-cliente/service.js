const pool=require('../../db');
const ErrorHttp=require('../../utils/ErrorHttp');
const {idPositivo,texto,comprobarErrores,filtrosListado}=require('../../utils/catalogos');
const {fechaValida,uuidValido}=require('../../utils/validaciones');
const {escalar,decimal}=require('../../utils/decimales');
const {calcular,convertirCostoBruto}=require('../../utils/importesDocumento');
const {registrarAuditoria}=require('../auditoria/service');
const {isDeepStrictEqual}=require('node:util');

function porcentaje(valor='0') {
    if(!/^\d{1,3}(\.\d{1,2})?$/.test(String(valor)) || escalar(valor,2)>10000n) throw new ErrorHttp(400,'Descuento inválido: usa un porcentaje entre 0 y 100');
    return decimal(escalar(valor,2),2);
}
function validar(d,nota=false) {
    const permitidos=['folio','fecha_emision','observaciones','id_operacion',...(nota?['monto_neto_correccion']:['id_obra','fecha_vencimiento','descuento_general'])];
    if(Object.keys(d).some(k=>!permitidos.includes(k)))throw new ErrorHttp(400,'Hay campos no permitidos');
    const errores={};
    const folio=texto(d.folio,'folio',30,errores);
    const observaciones=texto(d.observaciones,'observaciones',2000,errores,nota);
    if(!fechaValida(d.fecha_emision)||d.fecha_emision.startsWith('0000'))errores.fecha_emision='Selecciona una fecha válida';
    if(!nota && (!fechaValida(d.fecha_vencimiento)||d.fecha_vencimiento<d.fecha_emision))errores.fecha_vencimiento='Selecciona un vencimiento igual o posterior a la emisión';
    if(!uuidValido(d.id_operacion))errores.id_operacion='Identificador de operación inválido';
    if(nota && (!/^\d{1,12}$/.test(String(d.monto_neto_correccion))||BigInt(d.monto_neto_correccion)===0n))errores.monto_neto_correccion='Ingresa una rebaja neta mayor que cero, en pesos enteros';
    comprobarErrores(errores);
    return {folio,observaciones,fecha_emision:d.fecha_emision,...(nota?{monto_neto_correccion:String(d.monto_neto_correccion)}:
        {id_obra:idPositivo(d.id_obra),fecha_vencimiento:d.fecha_vencimiento,descuento_general:porcentaje(d.descuento_general)})};
}
const desdeObra=`FROM obra o JOIN presupuesto p ON p.id_presupuesto=o.id_presupuesto JOIN cliente c ON c.id_cliente=p.id_cliente`;
const columnasObra=`o.id_obra,o.nombre_obra,o.estado,o.id_presupuesto,p.id_cliente,p.estado AS estado_presupuesto,c.razon_social,c.rut_cliente`;
async function fuentes(conexion,id,bloquear=false) {
    if(bloquear){
        const previa=(await conexion.query('SELECT id_presupuesto FROM obra WHERE id_obra=$1',[id])).rows[0];
        if(!previa)throw new ErrorHttp(404,'Obra no encontrada');
        await conexion.query('SELECT id_presupuesto FROM presupuesto WHERE id_presupuesto=$1 FOR UPDATE',[previa.id_presupuesto]);
    }
    const obra=(await conexion.query(`SELECT ${columnasObra} ${desdeObra} WHERE o.id_obra=$1${bloquear?' FOR UPDATE OF o':''}`,[id])).rows[0];
    if(!obra)throw new ErrorHttp(404,'Obra no encontrada');
    if(obra.estado!=='Finalizada'||obra.estado_presupuesto!=='Aprobado')throw new ErrorHttp(409,'La factura requiere una obra finalizada y su presupuesto aprobado');
    if(bloquear){
        await conexion.query('SELECT id_cliente FROM cliente WHERE id_cliente=$1 FOR SHARE',[obra.id_cliente]);
        await conexion.query(`SELECT a.id_articulo FROM articulo a WHERE a.id_articulo IN
            (SELECT id_articulo FROM movimiento_cardex WHERE id_obra=$1 AND tipo_movimiento='EGRESO') ORDER BY a.id_articulo FOR SHARE`,[id]);
        // Vuelve a leer la identidad una vez adquirido su bloqueo.
        const cliente=(await conexion.query('SELECT razon_social,rut_cliente FROM cliente WHERE id_cliente=$1',[obra.id_cliente])).rows[0];
        if(cliente)Object.assign(obra,cliente);
    }
    const servicios=(await conexion.query('SELECT id_detalle_presupuesto,descripcion,cantidad,precio_neto_unitario FROM detalle_presupuesto WHERE id_presupuesto=$1 ORDER BY id_detalle_presupuesto',[obra.id_presupuesto])).rows;
    if(!servicios.length)throw new ErrorHttp(409,'El presupuesto necesita un detalle de servicios para facturar');
    const egresos=(await conexion.query(`SELECT m.id_movimiento,m.id_articulo,a.nombre,a.unidad_medida,m.precio_lista_vigente,
        m.cantidad-COALESCE((SELECT SUM(ABS(v.cantidad)) FROM movimiento_cardex v
            WHERE v.id_movimiento_revertido=m.id_movimiento AND v.tipo_movimiento='REVERSA'),0) AS cantidad_neta
        FROM movimiento_cardex m JOIN articulo a ON a.id_articulo=m.id_articulo
        WHERE m.id_obra=$1 AND m.tipo_movimiento='EGRESO' ORDER BY m.id_movimiento`,[id])).rows;
    if(egresos.some(m=>Number(m.cantidad_neta)<0||m.precio_lista_vigente==null))throw new ErrorHttp(409,'Revisa cantidades y precios de los egresos antes de facturar');
    const detalles=[...servicios.map(s=>({...s,tipo:'Servicio',unidad_medida:'servicio'})),
        ...egresos.filter(m=>Number(m.cantidad_neta)>0).map(m=>({...m,tipo:'Material',descripcion:m.nombre,cantidad:m.cantidad_neta,precio_neto_unitario:convertirCostoBruto(m.precio_lista_vigente)}))];
    return {...obra,detalles:detalles.map(l=>({...l,subtotal:importes({detalles:[l]}).subtotal}))};
}
function importes(d) {
    return calcular({...d,tipo_documento:'factura',tasa_iva:'19',descuento_pronto_pago:'0',descuento_general:d.descuento_general || '0'},
        d.detalles.map(l=>({...l,costo_neto:l.precio_neto_unitario,descuento_1:'0',descuento_2:'0',descuento_3:'0'})));
}
async function obrasDisponibles(filtros={}) {
    const {pagina,limite,patron,offset}=filtrosListado(filtros);
    const where=`WHERE o.estado='Finalizada' AND p.estado='Aprobado' AND (o.nombre_obra ILIKE $1 OR c.razon_social ILIKE $1)
        AND NOT EXISTS(SELECT 1 FROM documento_tributario d WHERE d.id_obra=o.id_obra AND d.id_proveedor IS NULL AND d.tipo_documento='factura')`;
    const total=(await pool.query(`SELECT COUNT(*) AS total ${desdeObra} ${where}`,[patron])).rows[0].total;
    const r=await pool.query(`SELECT ${columnasObra} ${desdeObra} ${where} ORDER BY o.id_obra DESC LIMIT $2 OFFSET $3`,[patron,limite,offset]);
    return {registros:r.rows,total:Number(total),pagina,limite};
}
async function previsualizar(id,descuento) {
    const fuente=await fuentes(pool,idPositivo(id));
    const d={...fuente,descuento_general:porcentaje(descuento)};
    return {...d,...importes(d)};
}
async function listar(filtros={}) {
    const {pagina,limite,patron,offset}=filtrosListado(filtros);
    const desde=`FROM documento_tributario d JOIN obra o USING(id_obra) JOIN presupuesto p ON p.id_presupuesto=o.id_presupuesto JOIN cliente c ON c.id_cliente=p.id_cliente
        WHERE d.tipo_documento IN ('factura','nota_credito') AND (d.folio ILIKE $1 OR c.razon_social ILIKE $1 OR o.nombre_obra ILIKE $1)`;
    const total=(await pool.query(`SELECT COUNT(*) AS total ${desde}`,[patron])).rows[0].total;
    const r=await pool.query(`SELECT d.id_documento,d.tipo_documento,d.folio,d.fecha_emision,d.id_obra,c.razon_social,o.nombre_obra ${desde}
        ORDER BY d.id_documento DESC LIMIT $2 OFFSET $3`,[patron,limite,offset]);
    return {registros:r.rows,total:Number(total),pagina,limite};
}
async function obtenerCon(conexion,id) {
    const d=(await conexion.query(`SELECT d.*,p.id_cliente,c.razon_social,c.rut_cliente,o.nombre_obra,r.folio AS folio_referencia
        FROM documento_tributario d JOIN obra o ON o.id_obra=d.id_obra
        JOIN presupuesto p ON p.id_presupuesto=o.id_presupuesto JOIN cliente c ON c.id_cliente=p.id_cliente
        LEFT JOIN documento_tributario r ON r.id_documento=d.id_documento_referencia
        WHERE d.id_documento=$1 AND d.tipo_documento IN ('factura','nota_credito')`,[id])).rows[0];
    if(!d)throw new ErrorHttp(404,'Documento de cliente no encontrado');
    if(d.tipo_documento==='nota_credito')return {...d,...calcular(d,[]),detalles:[]};
    const fuente=await fuentes(conexion,d.id_obra);
    const totales=importes({...fuente,descuento_general:d.descuento_general});
    const notas=(await conexion.query("SELECT id_documento,folio,monto_neto_correccion FROM documento_tributario WHERE id_documento_referencia=$1 AND id_proveedor IS NULL AND tipo_documento='nota_credito' ORDER BY id_documento",[id])).rows;
    const credito=notas.reduce((s,n)=>s+escalar(calcular({...n,tipo_documento:'nota_credito'},[]).total,2),0n);
    const pagado=(await conexion.query('SELECT COALESCE(SUM(monto),0) AS total FROM pago_documento WHERE id_documento=$1',[id])).rows[0]?.total || '0';
    const saldo=escalar(totales.total,2)-credito-escalar(pagado,2);
    return {...d,...totales,detalles:fuente.detalles,notas,total_notas_credito:decimal(credito,2),total_pagado:pagado,saldo_pendiente:decimal(saldo,2)};
}
async function obtener(id) {return obtenerCon(pool,idPositivo(id));}
async function confirmar(entrada,usuario) {
    const d=validar(entrada);usuario=idPositivo(usuario);
    const client=await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`factura-cliente:${entrada.id_operacion.toLowerCase()}`]);
        const previa=(await client.query("SELECT id_usuario,valores_nuevos FROM registro_auditoria WHERE accion='FACTURAR_CLIENTE' AND valores_nuevos->>'id_operacion'=$1 ORDER BY id_auditoria LIMIT 1",[entrada.id_operacion.toLowerCase()])).rows[0];
        if(previa){
            if(previa.id_usuario!==usuario||!isDeepStrictEqual(previa.valores_nuevos.solicitud,d))throw new ErrorHttp(409,'Esta confirmación ya se utilizó con otros datos');
            await client.query('COMMIT');return {id_documento:previa.valores_nuevos.id_documento,repetida:true};
        }
        const fuente=await fuentes(client,d.id_obra,true);
        if((await client.query("SELECT id_documento FROM documento_tributario WHERE id_obra=$1 AND id_proveedor IS NULL AND tipo_documento='factura'",[d.id_obra])).rows.length)throw new ErrorHttp(409,'La obra ya tiene una factura registrada');
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`folio-factura-cliente:${d.folio}`]);
        if((await client.query("SELECT id_documento FROM documento_tributario WHERE id_proveedor IS NULL AND tipo_documento='factura' AND folio=$1",[d.folio])).rows.length)throw new ErrorHttp(409,'Ese folio de factura ya está registrado');
        const totales=importes({...fuente,...d});
        const documento=(await client.query(`INSERT INTO documento_tributario (tipo_documento,folio,fecha_emision,fecha_vencimiento,observaciones,descuento_general,descuento_pronto_pago,tasa_iva,id_obra)
            VALUES ('factura',$1,$2,$3,$4,$5,0,19,$6) RETURNING *`,[d.folio,d.fecha_emision,d.fecha_vencimiento,d.observaciones,d.descuento_general,d.id_obra])).rows[0];
        await registrarAuditoria(client,{id_usuario:usuario,tabla_afectada:'documento_tributario',id_registro_afectado:documento.id_documento,accion:'FACTURAR_CLIENTE',
            valores_nuevos:{id_operacion:entrada.id_operacion.toLowerCase(),solicitud:d,id_documento:documento.id_documento,total:totales.total}});
        await client.query('COMMIT');return {...documento,...totales,detalles:fuente.detalles};
    }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
async function notaCredito(idFactura,entrada,usuario) {
    const id=idPositivo(idFactura),d=validar(entrada,true);usuario=idPositivo(usuario);
    const client=await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`nc-cliente:${entrada.id_operacion.toLowerCase()}`]);
        const solicitud={id_factura:id,...d};
        const previa=(await client.query("SELECT id_usuario,valores_nuevos FROM registro_auditoria WHERE accion='NC_CLIENTE' AND valores_nuevos->>'id_operacion'=$1 ORDER BY id_auditoria LIMIT 1",[entrada.id_operacion.toLowerCase()])).rows[0];
        if(previa){
            if(previa.id_usuario!==usuario||!isDeepStrictEqual(previa.valores_nuevos.solicitud,solicitud))throw new ErrorHttp(409,'Esta confirmación ya se utilizó con otros datos');
            await client.query('COMMIT');return {id_documento:previa.valores_nuevos.id_documento,repetida:true};
        }
        await client.query("SELECT id_documento FROM documento_tributario WHERE id_documento=$1 AND id_proveedor IS NULL AND tipo_documento='factura' FOR UPDATE",[id]);
        const factura=await obtenerCon(client,id);
        if(factura.tipo_documento!=='factura')throw new ErrorHttp(400,'La referencia debe ser una factura de cliente');
        const totales=calcular({...d,tipo_documento:'nota_credito'},[]);
        const netoPrevio=factura.notas.reduce((s,n)=>s+escalar(n.monto_neto_correccion,2),0n);
        if(escalar(d.monto_neto_correccion,2)+netoPrevio>escalar(factura.total_neto,2)||escalar(totales.total,2)>escalar(factura.saldo_pendiente,2))throw new ErrorHttp(409,'La rebaja supera el saldo disponible de la factura');
        const fechaFactura=factura.fecha_emision instanceof Date?factura.fecha_emision.toLocaleDateString('sv-SE'):String(factura.fecha_emision).slice(0,10);
        if(d.fecha_emision<fechaFactura)throw new ErrorHttp(400,'La nota no puede ser anterior a la factura');
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`folio-nc-cliente:${d.folio}`]);
        if((await client.query("SELECT id_documento FROM documento_tributario WHERE id_proveedor IS NULL AND tipo_documento='nota_credito' AND folio=$1",[d.folio])).rows.length)throw new ErrorHttp(409,'Ese folio de nota de crédito ya existe');
        const nota=(await client.query(`INSERT INTO documento_tributario (tipo_documento,folio,fecha_emision,observaciones,id_obra,id_documento_referencia,monto_neto_correccion,tasa_iva)
            VALUES ('nota_credito',$1,$2,$3,$4,$5,$6,19) RETURNING id_documento`,[d.folio,d.fecha_emision,d.observaciones,factura.id_obra,id,d.monto_neto_correccion])).rows[0];
        await registrarAuditoria(client,{id_usuario:usuario,tabla_afectada:'documento_tributario',id_registro_afectado:nota.id_documento,accion:'NC_CLIENTE',valores_nuevos:{id_operacion:entrada.id_operacion.toLowerCase(),solicitud,id_documento:nota.id_documento,total:totales.total}});
        await client.query('COMMIT');return nota;
    }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
module.exports={listar,obrasDisponibles,previsualizar,confirmar,obtener,obtenerCon,notaCredito};
