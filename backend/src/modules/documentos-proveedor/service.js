const pool = require('../../db');
const ErrorHttp = require('../../utils/ErrorHttp');
const { texto, idPositivo, filtrosListado, comprobarErrores } = require('../../utils/catalogos');
const { calcular, calcularDetalle, convertirCostoBruto, costoBruto } = require('../../utils/importesDocumento');
const { escalar } = require('../../utils/decimales');
const { fechaValida } = require('../../utils/validaciones');
const { resumirPago, documentosGuiasSql, totalNotasCreditoSql, totalDocumentoSql, saldoDocumentoSql } = require('../../utils/pagos');
const { registrarAuditoria } = require('../auditoria/service');

const { costoRecepcion } = require('../recepciones-compra/service');

// Los vínculos se conservan: una guía solo puede pertenecer a una factura.
const relaciones = `${totalNotasCreditoSql} AS total_notas_credito,
        (SELECT ref.folio FROM documento_tributario ref WHERE ref.id_documento=d.id_documento_referencia) AS folio_documento_referencia,
        ${documentosGuiasSql} AS documentos_guias,
        EXISTS (SELECT 1 FROM factura_guia fg WHERE fg.id_factura=d.id_documento) AS es_factura_guias,
        COALESCE((SELECT json_agg(json_build_object('id_documento',g.id_documento,'folio',g.folio) ORDER BY g.id_documento) FROM factura_guia fg JOIN documento_tributario g ON g.id_documento=fg.id_guia WHERE fg.id_factura=d.id_documento),'[]'::json) AS guias,
        COALESCE((SELECT json_agg(json_build_object('id_documento',f.id_documento,'folio',f.folio)) FROM factura_guia fg JOIN documento_tributario f ON f.id_documento=fg.id_factura WHERE fg.id_guia=d.id_documento),'[]'::json) AS facturas_relacionadas`;

const tipos = ['factura', 'boleta', 'guia_despacho', 'nota_credito'];

// Valida números no negativos según su precisión y máximo permitido.
function decimal(valor, campo, enteros, decimales, errores, maximo) {
    if (!['string', 'number'].includes(typeof valor) || !new RegExp(`^\\d{1,${enteros}}(\\.\\d{1,${decimales}})?$`).test(String(valor))
        || (maximo !== undefined && Number(valor) > maximo)) errores[campo] = 'Ingresa un valor no negativo válido';
    return String(valor);
}
// Comprueba el formato AAAA-MM-DD y que la fecha exista en el calendario.
function fecha(valor, campo, errores) {
    if (!fechaValida(valor)) errores[campo] = 'Fecha inválida';
    return valor;
}
// Valida la cabecera y los materiales; devuelve solo los campos admitidos.
function validar(datos, permitirSinDetalles = false) {
    const errores = {};
    const cabecera = {
        tipo_documento: datos.tipo_documento,
        folio: texto(datos.folio, 'folio', 30, errores),
        fecha_emision: fecha(datos.fecha_emision, 'fecha_emision', errores),
        fecha_vencimiento: ['boleta','nota_credito'].includes(datos.tipo_documento) || datos.fecha_vencimiento == null || datos.fecha_vencimiento === ''
            ? null : fecha(datos.fecha_vencimiento, 'fecha_vencimiento', errores),
        observaciones: texto(datos.observaciones, 'observaciones', 5000, errores, false),
    };
    // si es factura, la fecha de vencimiento es obligatorio
    if (cabecera.tipo_documento === 'factura' && !cabecera.fecha_vencimiento) errores.fecha_vencimiento = 'La fecha de vencimiento es obligatoria para facturas';
    // asegurarse que fecha de vencimiento no sea anterior a fecha de emisión, si ambas son válidas
    if (!errores.fecha_emision && !errores.fecha_vencimiento && cabecera.fecha_vencimiento
        && cabecera.fecha_vencimiento < cabecera.fecha_emision) errores.fecha_vencimiento = 'No puede ser anterior a la fecha de emisión';
    // 
    if (!tipos.includes(cabecera.tipo_documento)) errores.tipo_documento = 'Selecciona un tipo de documento';
    for (const campo of ['descuento_general', 'descuento_pronto_pago', 'tasa_iva']) {
        cabecera[campo] = decimal(datos[campo] ?? (campo === 'tasa_iva' ? 19 : 0), campo, 3, 2, errores, 100);
    }
    // Una nota de crédito debe identificar el documento que corrige.
    if (['factura','boleta','guia_despacho'].includes(cabecera.tipo_documento) && Number(cabecera.tasa_iva) !== 19) errores.tasa_iva = 'El IVA debe ser 19%';
    if (cabecera.tipo_documento === 'boleta') cabecera.fecha_vencimiento = null;
    cabecera.monto_neto_correccion = null;
    if (cabecera.tipo_documento === 'nota_credito') {
        cabecera.monto_neto_correccion = decimal(datos.monto_neto_correccion, 'monto_neto_correccion', 12, 2, errores);
        if (Number(datos.monto_neto_correccion) <= 0 || !/^\d+(?:\.0{1,2})?$/.test(String(datos.monto_neto_correccion))) errores.monto_neto_correccion = 'La rebaja neta debe ser mayor que cero, en pesos enteros';
        if (!cabecera.observaciones) errores.observaciones = 'Indica el motivo de la correccion';
        if (Number(cabecera.tasa_iva) !== 19) errores.tasa_iva = 'El IVA debe ser 19%';
        if (Number(cabecera.descuento_general) || Number(cabecera.descuento_pronto_pago)) errores.descuento_general = 'La nota de credito utiliza una rebaja global';
        if (datos.detalles !== undefined && (!Array.isArray(datos.detalles) || datos.detalles.length)) errores.detalles = 'La nota de credito no admite materiales';
    }
    let guias = [];
    if (datos.guias !== undefined) {
        if (!Array.isArray(datos.guias) || !datos.guias.length || datos.guias.length > 100 || cabecera.tipo_documento !== 'factura') errores.guias = 'Selecciona entre 1 y 100 guias para una factura';
        else {
            try { guias = datos.guias.map(idPositivo).sort((a,b) => a-b); } catch { errores.guias = 'Guias invalidas'; }
            if (new Set(guias).size !== guias.length) errores.guias = 'No repitas guias';
        }
        if (datos.detalles?.length) errores.detalles = 'La factura utiliza los materiales de las guias';
        if (Number(cabecera.descuento_general) || Number(cabecera.descuento_pronto_pago)) errores.guias = 'Los descuentos ya estan incluidos en las guias';
    }
    if (datos.id_documento_referencia) {
        try { cabecera.id_documento_referencia = idPositivo(datos.id_documento_referencia); }
        catch { errores.id_documento_referencia = 'Referencia inválida'; }
    } else cabecera.id_documento_referencia = null;
    if (cabecera.tipo_documento === 'nota_credito' && !cabecera.id_documento_referencia) errores.id_documento_referencia = 'Selecciona el documento original';
    if (cabecera.tipo_documento !== 'nota_credito' && cabecera.id_documento_referencia) errores.id_documento_referencia = 'La referencia se utiliza para notas de crédito';
    if (cabecera.tipo_documento !== 'nota_credito' && !permitirSinDetalles && !guias.length && (!Array.isArray(datos.detalles) || !datos.detalles.length || datos.detalles.length > 100)) errores.detalles = 'Agrega entre 1 y 100 materiales';
    const detalles = (Array.isArray(datos.detalles) ? datos.detalles.slice(0, 100) : []).map((entrada, i) => {
        const d = entrada && typeof entrada === 'object' ? entrada : {};
        const prefijo = `detalles.${i}`;
        const linea = { observaciones: texto(d.observaciones, `${prefijo}.observaciones`, 2000, errores, false) };
        try { linea.id_articulo = idPositivo(d.id_articulo); } catch { errores[`${prefijo}.id_articulo`] = 'Selecciona un artículo'; }
        linea.cantidad = decimal(d.cantidad, `${prefijo}.cantidad`, 9, 3, errores);
        if (Number(d.cantidad) <= 0) errores[`${prefijo}.cantidad`] = 'La cantidad debe ser positiva';
        if (cabecera.tipo_documento === 'boleta') {
            if (!['string','number'].includes(typeof d.costo_bruto) || !/^\d{1,10}$/.test(String(d.costo_bruto))) errores[`${prefijo}.costo_bruto`] = 'Ingresa un costo bruto entero en pesos';
            else linea.costo_neto = convertirCostoBruto(d.costo_bruto);
        } else linea.costo_neto = decimal(d.costo_neto, `${prefijo}.costo_neto`, 10, 4, errores);
        // El precio lo determina el catálogo o la copia de una línea guardada.
        if (d.id_detalle_documento !== undefined) {
            try { linea.id_detalle_documento = idPositivo(d.id_detalle_documento); }
            catch { errores[`${prefijo}.id_detalle_documento`] = 'Línea inválida'; }
        }
        for (const campo of ['descuento_1', 'descuento_2', 'descuento_3']) linea[campo] = decimal(d[campo] ?? 0, `${prefijo}.${campo}`, 3, 2, errores, 100);
        return linea;
    });
    comprobarErrores(errores);
    return { cabecera, detalles, guias };
}

// Recupera el documento con sus materiales, recepciones y totales calculados.
// Acepta el pool para consultas independientes o el client de una transacción.
async function obtenerCon(conexion, idProveedor, idDocumento) {
    const r = await conexion.query(`SELECT d.*, ${relaciones}, p.rut_proveedor, p.razon_social,
        COALESCE((SELECT SUM(a.monto) FROM pago_documento a WHERE a.id_documento=d.id_documento),0) AS total_pagado,
        EXISTS (SELECT 1 FROM movimiento_cardex m JOIN detalle_documento l USING(id_detalle_documento)
            WHERE l.id_documento=d.id_documento AND m.tipo_movimiento='INGRESO') AS tiene_recepciones,
        COALESCE((SELECT json_agg(fila ORDER BY fila.id_detalle_documento) FROM (
            SELECT l.*, a.nombre AS articulo, a.unidad_medida FROM detalle_documento l JOIN articulo a USING(id_articulo)
            WHERE l.id_documento=d.id_documento) fila), '[]'::json) AS detalles
        FROM documento_tributario d JOIN proveedor p USING(id_proveedor)
        WHERE d.id_documento=$1 AND d.id_proveedor=$2`, [idDocumento, idProveedor]);
    if (!r.rows[0]) throw new ErrorHttp(404, 'Documento no encontrado para este proveedor');
    const totales = calcular(r.rows[0], r.rows[0].detalles);
    return { ...r.rows[0], detalles:r.rows[0].detalles.map(l => ({...l,...(r.rows[0].tipo_documento === 'boleta' ? {costo_bruto:costoBruto(l.costo_neto)} : {}),desglose:calcularDetalle(l,r.rows[0])})),
        ...totales, ...resumirPago(totales.total, r.rows[0].total_pagado, r.rows[0].tipo_documento, r.rows[0].total_notas_credito) };
}
// Valida los identificadores antes de consultar un documento del proveedor.
async function obtener(proveedor, documento) { return obtenerCon(pool, idPositivo(proveedor), idPositivo(documento)); }

// Lista los documentos del proveedor y reconstruye sus totales desde los detalles.
async function listar(proveedor, filtros = {}) {
    const id = idPositivo(proveedor);
    const { pagina, limite, offset } = filtrosListado(filtros);
    const total = await pool.query('SELECT COUNT(*) AS total FROM documento_tributario WHERE id_proveedor=$1', [id]);
    const r = await pool.query(`SELECT d.*, ${relaciones},
        COALESCE((SELECT SUM(a.monto) FROM pago_documento a WHERE a.id_documento=d.id_documento),0) AS total_pagado,
        COALESCE((SELECT json_agg(l) FROM detalle_documento l
        WHERE l.id_documento=d.id_documento), '[]'::json) AS detalles
        FROM documento_tributario d WHERE d.id_proveedor=$1 ORDER BY d.fecha_ingreso DESC,d.id_documento DESC LIMIT $2 OFFSET $3`, [id, limite, offset]);
    // Los importes se reconstruyen con el mismo redondeo usado al validar el registro.
    const registros = r.rows.map(d => {
        const { detalles, ...cabecera } = d;
        const totales = calcular(cabecera, detalles);
        return { ...cabecera, ...totales, ...resumirPago(totales.total, cabecera.total_pagado, cabecera.tipo_documento, cabecera.total_notas_credito) };
    });
    return { registros, total: Number(total.rows[0].total), pagina, limite };
}
// Busca artículos activos para agregarlos al documento de compra.
async function articulos(filtros = {}) {
    const { pagina, limite, offset, patron } = filtrosListado(filtros);
    const where = 'activo=true AND (nombre ILIKE $1 OR codigo_interno ILIKE $1)';
    const total = await pool.query(`SELECT COUNT(*) AS total FROM articulo WHERE ${where}`, [patron]);
    const r = await pool.query(`SELECT id_articulo,codigo_interno,nombre,unidad_medida,precio_lista FROM articulo WHERE ${where} ORDER BY nombre,id_articulo LIMIT $2 OFFSET $3`, [patron, limite, offset]);
    return { registros: r.rows, total: Number(total.rows[0].total), pagina, limite };
}
// Crea o edita documento y materiales junto con su auditoría; no modifica stock.
async function guardar(proveedor, datos, responsable, documento) {
    const idProveedor = idPositivo(proveedor);
    const id = documento === undefined ? null : idPositivo(documento);
    const { cabecera, detalles, guias } = validar(datos, id !== null && Array.isArray(datos.detalles) && datos.detalles.length === 0);
    calcular(cabecera, detalles); // Valida los límites sin guardar importes derivados.
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const p = await client.query('SELECT id_proveedor FROM proveedor WHERE id_proveedor=$1', [idProveedor]);
        if (!p.rows.length) throw new ErrorHttp(404, 'Proveedor no encontrado');
        let anterior = null;
        // Comparte el bloqueo de la factura con pagos y otras notas de credito.
        if (cabecera.tipo_documento === 'nota_credito' && id === null) {
            await client.query('SELECT id_documento FROM documento_tributario WHERE id_documento=$1 AND id_proveedor=$2 FOR UPDATE', [cabecera.id_documento_referencia,idProveedor]);
            const original = await obtenerCon(client,idProveedor,cabecera.id_documento_referencia);
            if (original.tipo_documento !== 'factura' || original.id_proveedor !== idProveedor) throw new ErrorHttp(400,'Selecciona una factura del mismo proveedor');
            if (String(original.saldo_pendiente).startsWith('-') || escalar(original.saldo_pendiente,2) === 0n || escalar(calcular(cabecera,[]).total,2) > escalar(original.saldo_pendiente,2)) throw new ErrorHttp(409,'La rebaja supera el saldo pendiente de la factura');
        }
        if (guias.length && id !== null) throw new ErrorHttp(409, 'Los vínculos de una factura de guías no se pueden reemplazar');
        if (guias.length) {
            // Todas las guías se bloquean en el mismo orden, también frente a recepciones y ediciones.
            const seleccion = await client.query(`SELECT id_documento,tipo_documento,id_proveedor FROM documento_tributario WHERE id_documento=ANY($1::int[]) ORDER BY id_documento FOR UPDATE`, [guias]);
            if (seleccion.rows.length !== guias.length || seleccion.rows.some(g => g.tipo_documento !== 'guia_despacho' || g.id_proveedor !== idProveedor)) throw new ErrorHttp(400, 'Selecciona guías del mismo proveedor');
            const vinculadas = await client.query('SELECT id_guia FROM factura_guia WHERE id_guia=ANY($1::int[])', [guias]);
            if (vinculadas.rows.length) throw new ErrorHttp(409, 'Una de las guías ya está facturada');
            for (const idGuia of guias) {
                const guia = await obtenerCon(client,idProveedor,idGuia);
                if (!guia.detalles.length) throw new ErrorHttp(400, 'La guía no tiene materiales');
                for (const linea of guia.detalles) detalles.push({...linea,id_detalle_documento:undefined,costo_neto:costoRecepcion(linea,guia),descuento_1:'0',descuento_2:'0',descuento_3:'0'});
            }
            calcular(cabecera,detalles);
        }
        if (id !== null) {
            await client.query('SELECT id_documento FROM documento_tributario WHERE id_documento=$1 AND id_proveedor=$2 FOR UPDATE', [id, idProveedor]);
            anterior = await obtenerCon(client, idProveedor, id);
            if (anterior.tipo_documento === 'nota_credito' || cabecera.tipo_documento === 'nota_credito') throw new ErrorHttp(409,'Las notas de credito registradas no admiten edicion');
            if (!detalles.length) {
                if (!anterior.es_factura_guias) throw new ErrorHttp(400, 'Agrega materiales al documento');
                detalles.push(...anterior.detalles);
            }
            if (escalar(anterior.total_pagado, 2) > 0n) throw new ErrorHttp(409, 'El documento tiene pagos registrados y no admite edición');
            // El bloqueo del documento también serializa las recepciones de Bodega.
            if (escalar(anterior.total_notas_credito ?? '0',2) > 0n || anterior.tiene_recepciones || anterior.es_factura_guias || anterior.facturas_relacionadas?.length) {
                // Con ingresos previos, los datos que determinan materiales y costos quedan bloqueados.
                const protegidos = ['tipo_documento','id_documento_referencia','descuento_general','descuento_pronto_pago','tasa_iva'];
                const cabeceraIgual = protegidos.every(campo => ['tipo_documento','id_documento_referencia'].includes(campo)
                    ? (cabecera[campo] ?? null) === (anterior[campo] ?? null)
                    : escalar(cabecera[campo],2) === escalar(anterior[campo],2));
                const ids = new Set(detalles.map(d => d.id_detalle_documento));
                const lineasIguales = detalles.length === anterior.detalles.length && ids.size === detalles.length && detalles.every(d => {
                    const previa = anterior.detalles.find(l => l.id_detalle_documento === d.id_detalle_documento);
                    return previa && d.id_articulo === previa.id_articulo && d.observaciones === (previa.observaciones || null)
                        && ['cantidad','costo_neto','descuento_1','descuento_2','descuento_3'].every(campo =>
                            escalar(d[campo],campo === 'cantidad' ? 3 : campo === 'costo_neto' ? 4 : 2)
                            === escalar(previa[campo],campo === 'cantidad' ? 3 : campo === 'costo_neto' ? 4 : 2));
                });
                if (!cabeceraIgual || !lineasIguales) throw new ErrorHttp(409, 'El documento tiene recepciones: solo puedes editar número, fechas de emisión y vencimiento y observaciones');
            }
        }
        // Al editar, excluye el propio documento de la búsqueda de duplicados.
        const repetido = await client.query('SELECT id_documento FROM documento_tributario WHERE id_proveedor=$1 AND tipo_documento=$2 AND folio=$3 AND ($4::int IS NULL OR id_documento<>$4)', [idProveedor, cabecera.tipo_documento, cabecera.folio, id]);
        if (repetido.rows.length) throw new ErrorHttp(409, 'Ya existe ese documento del proveedor');
        if (cabecera.tipo_documento !== 'nota_credito' && escalar(anterior?.total_notas_credito ?? '0',2) === 0n && !guias.length && !anterior?.tiene_recepciones && !anterior?.es_factura_guias && !anterior?.facturas_relacionadas?.length) {
            // SHARE mantiene estable la unidad y el estado mientras se guardan las líneas.
            const catalogo = await client.query('SELECT id_articulo,unidad_medida,activo,precio_lista FROM articulo WHERE id_articulo=ANY($1::int[]) FOR SHARE', [detalles.map((d) => d.id_articulo)]);
            detalles.forEach((d, i) => {
                const a = catalogo.rows.find((a) => a.id_articulo === d.id_articulo);
                if (!a || !a.activo) throw new ErrorHttp(400, 'Hay datos inválidos', { [`detalles.${i}.id_articulo`]: 'Selecciona un artículo activo' });
                if (d.id_detalle_documento !== undefined) {
                    const previa = anterior?.detalles.find((l) => l.id_detalle_documento === d.id_detalle_documento && l.id_articulo === d.id_articulo);
                    if (!previa) throw new ErrorHttp(400, 'La línea no pertenece a este documento y artículo');
                    d.precio_lista = String(previa.precio_lista);
                } else if (!guias.length) d.precio_lista = String(a.precio_lista);
                if (a.unidad_medida === 'UN' && !Number.isInteger(Number(d.cantidad))) throw new ErrorHttp(400, 'Hay datos inválidos', { [`detalles.${i}.cantidad`]: 'Este artículo se registra en unidades enteras' });
            });
        }
        const campos = ['tipo_documento','folio','fecha_emision','fecha_vencimiento','observaciones','id_documento_referencia','descuento_general','descuento_pronto_pago','tasa_iva','monto_neto_correccion'];
        const valores = campos.map((c) => cabecera[c]);
        const r = id === null
            ? await client.query(`INSERT INTO documento_tributario (${campos.join(',')},id_proveedor) VALUES (${valores.map((_,i) => '$'+(i+1)).join(',')},$11) RETURNING id_documento`, [...valores,idProveedor])
            : await client.query(`UPDATE documento_tributario SET ${campos.map((c,i) => c+'=$'+(i+1)).join(',')} WHERE id_documento=$11 AND id_proveedor=$12 RETURNING id_documento`, [...valores,id,idProveedor]);
        const guardado = r.rows[0].id_documento;
        // Sin recepciones se reemplazan las líneas; con recepciones se conservan sus IDs e ingresos.
        if (cabecera.tipo_documento !== 'nota_credito' && escalar(anterior?.total_notas_credito ?? '0',2) === 0n && !anterior?.tiene_recepciones && !anterior?.es_factura_guias && !anterior?.facturas_relacionadas?.length) {
            if (id !== null) await client.query('DELETE FROM detalle_documento WHERE id_documento=$1', [id]);
            for (const d of detalles) await client.query(`INSERT INTO detalle_documento
                (id_documento,id_articulo,cantidad,costo_neto,precio_lista,descuento_1,descuento_2,descuento_3,observaciones)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [guardado,d.id_articulo,d.cantidad,d.costo_neto,d.precio_lista,d.descuento_1,d.descuento_2,d.descuento_3,d.observaciones]);
        }
        for (const idGuia of guias) await client.query('INSERT INTO factura_guia (id_factura,id_guia) VALUES ($1,$2)',[guardado,idGuia]);
        if (!anterior && cabecera.tipo_documento === 'boleta') {
            const total = calcular(cabecera,detalles).total;
            if (escalar(total,2) > 0n) {
                const pago = await client.query(`INSERT INTO pago_documento (id_documento,monto,fecha_pago,id_usuario,observaciones) VALUES ($1,$2,$3,$4,$5) RETURNING *`,[guardado,total,cabecera.fecha_emision,responsable,'Pago completo al registrar boleta']);
                await registrarAuditoria(client,{id_usuario:responsable,tabla_afectada:'pago_documento',id_registro_afectado:pago.rows[0].id_pago,accion:'REGISTRAR_PAGO',valores_anteriores:null,valores_nuevos:pago.rows[0]});
            }
        }
        const resultado = await obtenerCon(client, idProveedor, guardado);
        await registrarAuditoria(client, { id_usuario: responsable, tabla_afectada: 'documento_tributario', id_registro_afectado: guardado,
            accion: id === null ? 'REGISTRAR_DOCUMENTO' : 'EDITAR_DOCUMENTO', valores_anteriores: anterior, valores_nuevos: resultado });
        await client.query('COMMIT');
        return resultado;
    } catch(e) {
        await client.query('ROLLBACK');
        if (e.code === '23505') throw new ErrorHttp(409, 'Documento duplicado');
        if (e.code === '23503') throw new ErrorHttp(400, 'Una referencia ya no existe');
        throw e;
    } finally { client.release(); }
}
// Solo ofrece guías sin factura; la selecci?n definitiva se comprueba bajo bloqueo al guardar.
async function guiasDisponibles(proveedor,filtros={}) {
    const id=idPositivo(proveedor);
    const {pagina,limite,offset,patron}=filtrosListado({...filtros,q:filtros.q ?? filtros.folio});
    const where = `d.id_proveedor=$1 AND d.tipo_documento='guia_despacho' AND d.folio ILIKE $2 AND NOT EXISTS (SELECT 1 FROM factura_guia fg WHERE fg.id_guia=d.id_documento)`;
    const total=await pool.query(`SELECT COUNT(*) AS total FROM documento_tributario d WHERE ${where}`,[id,patron]);
    const r=await pool.query(`SELECT d.id_documento,d.folio,d.fecha_emision FROM documento_tributario d WHERE ${where} ORDER BY d.fecha_emision DESC,d.id_documento DESC LIMIT $3 OFFSET $4`,[id,patron,limite,offset]);
    return {registros:r.rows,total:Number(total.rows[0].total),pagina,limite};
}
// Selector de originales: excluye notas y busca el folio dentro del mismo proveedor.
async function referencias(proveedor, filtros = {}) {
    const id = idPositivo(proveedor);
    const { pagina, limite, offset, patron } = filtrosListado(filtros);
    const saldo = saldoDocumentoSql;
    const where = `d.id_proveedor=$1 AND d.tipo_documento='factura' AND d.folio ILIKE $2 AND ${saldo}>0`;
    const total = await pool.query(`SELECT COUNT(*) AS total FROM documento_tributario d WHERE ${where}`, [id,patron]);
    const r = await pool.query(`SELECT d.id_documento,d.tipo_documento,d.folio,d.fecha_emision,${totalDocumentoSql} AS total,${saldo} AS saldo_pendiente
        FROM documento_tributario d WHERE ${where} ORDER BY d.fecha_emision DESC,d.id_documento DESC LIMIT $3 OFFSET $4`,[id,patron,limite,offset]);
    return {registros:r.rows,total:Number(total.rows[0].total),pagina,limite};
}
module.exports = { listar, obtener, articulos, guardar, validar, calcular, guiasDisponibles, referencias };
