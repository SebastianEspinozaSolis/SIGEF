const pool = require('../../db');
const ErrorHttp = require('../../utils/ErrorHttp');
const { idPositivo, filtrosListado, texto, comprobarErrores } = require('../../utils/catalogos');
const { registrarAuditoria } = require('../auditoria/service');

const recibidos = `COALESCE((SELECT SUM(m.cantidad-COALESCE((SELECT SUM(abs(r.cantidad)) FROM movimiento_cardex r WHERE r.tipo_movimiento='REVERSA' AND r.id_movimiento_revertido=m.id_movimiento),0)) FROM movimiento_cardex m
    WHERE m.id_detalle_documento=l.id_detalle_documento AND m.tipo_movimiento='INGRESO'),0)`;
async function listar(filtros = {}) {
    const { pagina, limite, offset, patron } = filtrosListado(filtros);
    const where = `d.id_proveedor IS NOT NULL
        AND d.tipo_documento IN ('factura','boleta','guia_despacho')
        AND (d.folio ILIKE $1 OR p.razon_social ILIKE $1 OR p.rut_proveedor ILIKE $1)`;
    const total = await pool.query(`SELECT COUNT(*) AS total FROM documento_tributario d JOIN proveedor p USING(id_proveedor) WHERE ${where}`, [patron]);
    const r = await pool.query(`SELECT d.id_documento,d.tipo_documento,d.folio,d.fecha_ingreso,p.rut_proveedor,p.razon_social,
        EXISTS (SELECT 1 FROM detalle_documento l WHERE l.id_documento=d.id_documento AND l.cantidad>${recibidos}) AS tiene_pendientes
        FROM documento_tributario d JOIN proveedor p USING(id_proveedor) WHERE ${where}
        ORDER BY d.fecha_ingreso DESC,d.id_documento DESC LIMIT $2 OFFSET $3`, [patron,limite,offset]);
    return { registros: r.rows, total: Number(total.rows[0].total), pagina, limite };
}
// Líneas pendientes del artículo, sin cargar las compras de otros materiales.
async function pendientesArticulo(idArticulo, filtros = {}) {
    const id = idPositivo(idArticulo);
    const { pagina, limite, offset, patron } = filtrosListado(filtros);
    const where = `l.id_articulo=$1 AND a.activo=true
        AND d.tipo_documento IN ('factura','boleta','guia_despacho') AND l.cantidad>${recibidos}
        AND (d.folio ILIKE $2 OR p.razon_social ILIKE $2 OR p.rut_proveedor ILIKE $2)`;
    const from = `FROM detalle_documento l JOIN documento_tributario d USING(id_documento)
        JOIN proveedor p USING(id_proveedor) JOIN articulo a ON a.id_articulo=l.id_articulo`;
    const total = await pool.query(`SELECT COUNT(*) AS total ${from} WHERE ${where}`, [id, patron]);
    const r = await pool.query(`SELECT l.*, d.tipo_documento,d.folio,d.id_proveedor,d.descuento_general,d.descuento_pronto_pago,
        p.razon_social,p.rut_proveedor, l.cantidad-${recibidos} AS cantidad_pendiente
        ${from} WHERE ${where} ORDER BY d.fecha_ingreso DESC,d.id_documento DESC,l.id_detalle_documento
        LIMIT $3 OFFSET $4`, [id,patron,limite,offset]);
    return { registros:r.rows.map((l)=>({...l,costo_unitario_aplicado:costoRecepcion(l,l)})),total:Number(total.rows[0].total),pagina,limite };
}

async function detalle(conexion, id) {
    const doc = await conexion.query(`SELECT d.*,p.rut_proveedor,p.razon_social FROM documento_tributario d
        JOIN proveedor p USING(id_proveedor) WHERE d.id_documento=$1`, [id]);
    if (!doc.rows[0]) throw new ErrorHttp(404, 'Documento de proveedor no encontrado');
    const lineas = await conexion.query(`SELECT l.*,a.codigo_interno,a.nombre,a.unidad_medida,a.activo,
        ${recibidos} AS cantidad_recibida, l.cantidad-${recibidos} AS cantidad_pendiente
        FROM detalle_documento l JOIN articulo a USING(id_articulo) WHERE l.id_documento=$1 ORDER BY l.id_detalle_documento`, [id]);
    return { ...doc.rows[0], detalles: lineas.rows };
}
async function obtener(id) { return detalle(pool, idPositivo(id)); }
function escalar(valor, precision) {
    const [entero, fraccion = ''] = String(valor).split('.');
    return BigInt(entero) * 10n ** BigInt(precision) + BigInt(fraccion.padEnd(precision,'0'));
}
function textoDecimal(n, precision) {
    const factor = 10n ** BigInt(precision);
    return `${n / factor}.${String(n % factor).padStart(precision,'0')}`;
}
// Costo sin IVA y con los descuentos ya concedidos en el documento; precisión de cuatro decimales.
function costoRecepcion(linea, doc) {
    const factores = [linea.descuento_1,linea.descuento_2,linea.descuento_3,doc.descuento_general,doc.descuento_pronto_pago];
    const numerador = factores.reduce((n,p) => n * (10000n-escalar(p,2)), escalar(linea.costo_neto,4));
    const divisor = 10000n ** 5n;
    return textoDecimal((numerador+divisor/2n)/divisor,4);
}
function validar(datos) {
    const errores = {};
    const observaciones = texto(datos.observaciones, 'observaciones', 2000, errores, false);
    if (!Array.isArray(datos.lineas) || !datos.lineas.length || datos.lineas.length>100) errores.lineas = 'Selecciona entre 1 y 100 materiales';
    const vistos = new Set();
    const lineas = (Array.isArray(datos.lineas) ? datos.lineas.slice(0,100) : []).map((dato,i) => {
        const d = dato && typeof dato === 'object' ? dato : {};
        let id;
        try { id = idPositivo(d.id_detalle_documento); } catch { errores[`lineas.${i}`]='Línea inválida'; }
        if (vistos.has(id)) errores[`lineas.${i}`]='Línea repetida';
        vistos.add(id);
        if (!['number','string'].includes(typeof d.cantidad) || !/^\d{1,9}(\.\d{1,3})?$/.test(String(d.cantidad)) || Number(d.cantidad)<=0) errores[`lineas.${i}`]='Cantidad positiva, con hasta tres decimales';
        return { id_detalle_documento:id, cantidad:String(d.cantidad) };
    });
    comprobarErrores(errores);
    return { observaciones, lineas };
}
async function recibir(idDocumento, datos, responsable) {
    const id = idPositivo(idDocumento);
    const solicitud = validar(datos);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const bloqueo = await client.query('SELECT id_documento FROM documento_tributario WHERE id_documento=$1 FOR UPDATE', [id]);
        if (!bloqueo.rows.length) throw new ErrorHttp(404,'Documento no encontrado');
        const doc=await detalle(client,id);
        if (!['factura','boleta','guia_despacho'].includes(doc.tipo_documento)) throw new ErrorHttp(400,'Una nota de crédito no se recibe como compra');
        const seleccionadas=solicitud.lineas.map((entrada) => {
            const linea=doc.detalles.find((l) => l.id_detalle_documento===entrada.id_detalle_documento);
            if (!linea) throw new ErrorHttp(400,'El material no pertenece al documento');
            if (escalar(entrada.cantidad,3)>escalar(linea.cantidad_pendiente,3)) throw new ErrorHttp(409,'La cantidad supera lo pendiente de recepción');
            return { ...linea, cantidad_ahora:entrada.cantidad };
        });
        // Orden estable de bloqueo para compras simultáneas con artículos compartidos.
        const articulos=await client.query('SELECT id_articulo,unidad_medida,activo,stock_actual,precio_pmp FROM articulo WHERE id_articulo=ANY($1::int[]) ORDER BY id_articulo FOR UPDATE', [seleccionadas.map((l) => l.id_articulo)]);
        const movimientos=[];
        for (const linea of seleccionadas) {
            const articulo=articulos.rows.find((a) => a.id_articulo===linea.id_articulo);
            if (!articulo || !articulo.activo) throw new ErrorHttp(409,'No se pueden recibir materiales de un artículo inactivo');
            if (articulo.unidad_medida==='UN' && !Number.isInteger(Number(linea.cantidad_ahora))) throw new ErrorHttp(400,'Este artículo se registra en unidades enteras');
            if (Number(articulo.stock_actual)<0) throw new ErrorHttp(409,'El saldo del artículo requiere revisión antes de recibir');
            const costo=costoRecepcion(linea,doc);
            if (escalar(costo,4)>99999999999999n) throw new ErrorHttp(400,'Costo fuera de rango');
            const saldo=await client.query(`UPDATE articulo SET
                precio_pmp=round((stock_actual*precio_pmp+$2::numeric*$3::numeric)/(stock_actual+$2::numeric),4),
                stock_actual=stock_actual+$2::numeric WHERE id_articulo=$1 RETURNING stock_actual,precio_pmp`,[linea.id_articulo,linea.cantidad_ahora,costo]);
            const movimiento=await client.query(`INSERT INTO movimiento_cardex
                (id_articulo,id_usuario,id_detalle_documento,tipo_movimiento,cantidad,costo_unitario,justificacion)
                VALUES ($1,$2,$3,'INGRESO',$4,$5,$6) RETURNING *`,[linea.id_articulo,responsable,linea.id_detalle_documento,linea.cantidad_ahora,costo,solicitud.observaciones]);
            await registrarAuditoria(client,{ id_usuario:responsable,tabla_afectada:'movimiento_cardex',id_registro_afectado:movimiento.rows[0].id_movimiento,
                accion:'RECIBIR_COMPRA',valores_anteriores:{ stock_actual:articulo.stock_actual,precio_pmp:articulo.precio_pmp },
                valores_nuevos:{ movimiento:movimiento.rows[0],saldo:saldo.rows[0] } });
            Object.assign(articulo,saldo.rows[0]);
            movimientos.push(movimiento.rows[0]);
        }
        const documento=await detalle(client,id);
        await client.query('COMMIT');
        return { documento,movimientos };
    } catch(e) {
        await client.query('ROLLBACK');
        if (e.code==='22003') throw new ErrorHttp(400,'La recepción supera los límites de cantidad o costo');
        throw e;
    } finally { client.release(); }
}
module.exports={listar,obtener,recibir,costoRecepcion,validar,pendientesArticulo};
