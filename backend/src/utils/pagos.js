const { escalar, decimal } = require('./decimales');

// Conserva precisión y evita asignar una deuda a guías o notas de crédito.
function resumirPago(total, pagado = '0', tipo, notas) {
    if (!['factura', 'boleta'].includes(tipo)) return { total_pagado: '0.00', saldo_pendiente: null, estado_pago: 'No aplica' };
    const abonos = escalar(pagado, 2);
    const creditos = escalar(notas ?? '0', 2);
    const saldo = escalar(total, 2) - abonos - creditos;
    return { ...(notas !== undefined ? {total_notas_credito:decimal(creditos,2)} : {}), total_pagado: decimal(abonos, 2), saldo_pendiente: decimal(saldo, 2),
        estado_pago: saldo < 0n ? 'Saldo a favor' : saldo === 0n ? 'Pagada' : abonos + creditos > 0n ? 'Parcialmente pagada' : 'Pendiente' };
}

// Los alias son constantes internas; replica los redondeos del calculo en JavaScript.
function totalBaseSql(alias) {
    return `(SELECT CASE WHEN ${alias}.tipo_documento='boleta' THEN importe ELSE importe + ROUND(importe * ${alias}.tasa_iva / 100,0) END
        FROM (SELECT general - ROUND(general * ${alias}.descuento_pronto_pago / 100,0) AS importe
            FROM (SELECT subtotal - ROUND(subtotal * ${alias}.descuento_general / 100,0) AS general
                FROM (SELECT COALESCE(SUM(p3.valor),0) AS subtotal FROM detalle_documento l
                    CROSS JOIN LATERAL (SELECT ROUND(l.cantidad * (CASE WHEN ${alias}.tipo_documento='boleta'
                        THEN ROUND(l.costo_neto * (1+${alias}.tasa_iva/100),0) ELSE l.costo_neto END),0) AS valor) b
                    CROSS JOIN LATERAL (SELECT b.valor-ROUND(b.valor*l.descuento_1/100,0) AS valor) p1
                    CROSS JOIN LATERAL (SELECT p1.valor-ROUND(p1.valor*l.descuento_2/100,0) AS valor) p2
                    CROSS JOIN LATERAL (SELECT p2.valor-ROUND(p2.valor*l.descuento_3/100,0) AS valor) p3
                    WHERE l.id_documento=${alias}.id_documento) lineas) generales) importes)`;
}
const totalDocumentoSql = `(CASE WHEN d.tipo_documento='nota_credito' AND d.monto_neto_correccion IS NOT NULL
    THEN ROUND(d.monto_neto_correccion,0) + ROUND(ROUND(d.monto_neto_correccion,0) * d.tasa_iva / 100,0)
    WHEN EXISTS(SELECT 1 FROM documento_tributario guia WHERE guia.id_factura=d.id_documento)
    THEN (SELECT COALESCE(SUM(${totalBaseSql('g')}),0) FROM documento_tributario g WHERE g.id_factura=d.id_documento)
    ELSE ${totalBaseSql('d')} END)`;

const documentosGuiasSql = `COALESCE((SELECT json_agg(json_build_object(
    'tipo_documento',g.tipo_documento,'descuento_general',g.descuento_general,
    'descuento_pronto_pago',g.descuento_pronto_pago,'tasa_iva',g.tasa_iva,
    'detalles',COALESCE((SELECT json_agg(gl) FROM detalle_documento gl WHERE gl.id_documento=g.id_documento),'[]'::json)))
    FROM documento_tributario g WHERE g.id_factura=d.id_documento),'[]'::json)`;

// Las NC globales reducen deuda; no se confunden con pagos ni con recepciones.
const totalNotasCreditoSql = `COALESCE((SELECT SUM(ROUND(nc.monto_neto_correccion,0) + ROUND(ROUND(nc.monto_neto_correccion,0) * nc.tasa_iva / 100,0))
    FROM documento_tributario nc WHERE nc.id_documento_referencia=d.id_documento
    AND nc.tipo_documento='nota_credito'),0)`;
const saldoDocumentoSql = `(${totalDocumentoSql} - COALESCE((SELECT SUM(a.monto) FROM pago_documento a WHERE a.id_documento=d.id_documento),0) - ${totalNotasCreditoSql})`;

// Misma reconstrucción que facturas-cliente: servicios y egresos netos al precio histórico.
const totalFacturaClienteSql=`(SELECT neto+ROUND(neto*d.tasa_iva/100,0) FROM (
    SELECT subtotal-ROUND(subtotal*d.descuento_general/100,0) AS neto FROM (
        SELECT COALESCE(SUM(importe),0) AS subtotal FROM (
            SELECT ROUND(s.cantidad*s.precio_neto_unitario,0) AS importe FROM detalle_presupuesto s
                JOIN obra o ON o.id_presupuesto=s.id_presupuesto WHERE o.id_obra=d.id_obra
            UNION ALL
            SELECT ROUND(e.cantidad_neta*ROUND(e.precio_lista_vigente*100/119,4),0) FROM (
                SELECT m.precio_lista_vigente,m.cantidad-COALESCE((SELECT SUM(ABS(v.cantidad)) FROM movimiento_cardex v
                    WHERE v.id_movimiento_revertido=m.id_movimiento AND v.tipo_movimiento='REVERSA'),0) AS cantidad_neta
                FROM movimiento_cardex m WHERE m.id_obra=d.id_obra AND m.tipo_movimiento='EGRESO'
            ) e WHERE e.cantidad_neta>0
        ) lineas
    ) subtotales
) netos)`;

module.exports = { resumirPago, totalDocumentoSql, totalFacturaClienteSql, documentosGuiasSql, totalNotasCreditoSql, saldoDocumentoSql };
