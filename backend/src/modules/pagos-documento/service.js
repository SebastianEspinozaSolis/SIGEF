const { fechaValida, uuidValido } = require('../../utils/validaciones');
const pool = require('../../db');
const ErrorHttp = require('../../utils/ErrorHttp');
const { idPositivo, texto, comprobarErrores, filtrosListado } = require('../../utils/catalogos');
const { escalar, decimal } = require('../../utils/decimales');
const { resumirPago, documentosGuiasSql, totalNotasCreditoSql } = require('../../utils/pagos');
const { calcular } = require('../../utils/importesDocumento');
const { registrarAuditoria } = require('../auditoria/service');
const { obtenerCon: obtenerFacturaCliente } = require('../facturas-cliente/service');

async function obtenerCon(conexion, id) {
    const r = await conexion.query(`SELECT d.*, ${totalNotasCreditoSql} AS total_notas_credito, ${documentosGuiasSql} AS documentos_guias,
        COALESCE((SELECT SUM(p.monto) FROM pago_documento p WHERE p.id_documento=d.id_documento),0) AS total_pagado,
        COALESCE((SELECT json_agg(l) FROM detalle_documento l WHERE l.id_documento=d.id_documento),'[]'::json) AS detalles
        FROM documento_tributario d WHERE d.id_documento=$1`, [id]);
    const documento = r.rows[0];
    if (!documento) throw new ErrorHttp(404, 'Documento no encontrado');
    if (documento.id_proveedor == null && documento.id_obra != null) {
        const factura=await obtenerFacturaCliente(conexion,id);
        if(factura.tipo_documento!=='factura')throw new ErrorHttp(409,'Solo puedes registrar abonos de facturas de clientes');
        return {id_documento:id,id_cliente:factura.id_cliente,tipo_documento:factura.tipo_documento,folio:factura.folio,total:factura.total,
            ...resumirPago(factura.total,factura.total_pagado,factura.tipo_documento,factura.total_notas_credito)};
    }
    if (!documento.id_proveedor) throw new ErrorHttp(409, 'El documento no tiene un proveedor o cliente válido');
    const { total } = calcular(documento, documento.detalles);
    return { id_documento: id, id_proveedor: documento.id_proveedor, tipo_documento: documento.tipo_documento,
        folio: documento.folio, total, ...resumirPago(total, documento.total_pagado, documento.tipo_documento, documento.total_notas_credito) };
}

async function listar(idDocumento, filtros = {}) {
    const id = idPositivo(idDocumento);
    const { pagina, limite, offset } = filtrosListado(filtros);
    const documento = await obtenerCon(pool, id);
    const cantidad = await pool.query('SELECT COUNT(*) AS total FROM pago_documento WHERE id_documento=$1', [id]);
    const r = await pool.query(`SELECT p.*, u.nombres, u.apellidos FROM pago_documento p
        JOIN usuario u USING(id_usuario) WHERE p.id_documento=$1
        ORDER BY p.fecha_pago DESC, p.id_pago DESC LIMIT $2 OFFSET $3`, [id, limite, offset]);
    return { documento, registros: r.rows, total: Number(cantidad.rows[0].total), pagina, limite };
}

async function registrar(idDocumento, datos, responsable) {
    const id = idPositivo(idDocumento);
    const errores = {};
    const monto = String(datos.monto ?? '');
    if (!/^\d{1,14}(\.0{1,2})?$/.test(monto) || /^0+(\.0+)?$/.test(monto)) errores.monto = 'Ingresa un monto mayor que cero, en pesos enteros';
    if (!uuidValido(datos.id_operacion)) errores.id_operacion = 'Identificador de operación inválido';
    const fecha = datos.fecha_pago;
    if (!fechaValida(fecha)) errores.fecha_pago = 'Fecha de pago inválida';
    const observaciones = texto(datos.observaciones, 'observaciones', 2000, errores, false);
    comprobarErrores(errores);
    const idOperacion = datos.id_operacion.toLowerCase();
    const solicitud = { id_documento: id, monto: escalar(monto, 2).toString(), fecha_pago: fecha, observaciones };
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Un reintento de la misma confirmación devuelve el pago ya registrado.
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [idOperacion]);
        const previa = await client.query(`SELECT valores_nuevos FROM registro_auditoria
            WHERE accion='REGISTRAR_PAGO' AND valores_nuevos->>'id_operacion'=$1 ORDER BY id_auditoria LIMIT 1`, [idOperacion]);
        if (previa.rows[0]) {
            const anterior = previa.rows[0].valores_nuevos;
            if (anterior.id_usuario !== responsable || Object.keys(solicitud).some(campo => solicitud[campo] !== anterior.solicitud[campo])) throw new ErrorHttp(409, 'Esta confirmación ya se utilizó con otros datos');
            await client.query('COMMIT');
            return anterior.resultado;
        }
        // Primero espera el bloqueo; después lee los abonos con una instantánea nueva.
        const bloqueo = await client.query('SELECT id_documento FROM documento_tributario WHERE id_documento=$1 FOR UPDATE', [id]);
        if (!bloqueo.rows[0]) throw new ErrorHttp(404, 'Documento no encontrado');
        const anterior = await obtenerCon(client, id);
        if (!['factura', 'boleta'].includes(anterior.tipo_documento)) throw new ErrorHttp(409, 'Solo puedes registrar pagos de facturas o boletas');
        if (anterior.saldo_pendiente.startsWith('-') || escalar(monto, 2) > escalar(anterior.saldo_pendiente, 2)) throw new ErrorHttp(409, 'El monto supera el saldo pendiente');
        const r = await client.query(`INSERT INTO pago_documento (id_documento,monto,fecha_pago,id_usuario,observaciones)
            VALUES ($1,$2,$3,$4,$5) RETURNING *`, [id, monto, fecha, responsable, observaciones]);
        const totalPagado = escalar(anterior.total_pagado, 2) + escalar(monto, 2);
        const pagado = decimal(totalPagado, 2);
        const documento = { ...anterior, ...resumirPago(anterior.total, pagado, anterior.tipo_documento, anterior.total_notas_credito) };
        const resultado = { pago: r.rows[0], documento };
        await registrarAuditoria(client, { id_usuario: responsable, tabla_afectada: 'pago_documento',
            id_registro_afectado: r.rows[0].id_pago, accion: 'REGISTRAR_PAGO',
            valores_nuevos: { id_operacion: idOperacion, id_usuario: responsable, solicitud, resultado } });
        await client.query('COMMIT');
        return resultado;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally { client.release(); }
}

module.exports = { listar, registrar };
