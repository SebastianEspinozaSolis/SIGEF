const pool = require('../../db');
const { roles } = require('../../config');
const ErrorHttp = require('../../utils/ErrorHttp');
const { filtrosListado } = require('../../utils/catalogos');
const { totalDocumentoSql, totalFacturaClienteSql, totalNotasCreditoSql } = require('../../utils/pagos');

// Alertas operativas en vivo; no dependen del refresco del resumen materializado.
async function listar(tipo, rol, filtros = {}) {
    // lista de alertas validas
    if (!['stock', 'por-vencer', 'vencidas', 'clientes-por-vencer', 'clientes-vencidas', 'obras-por-cerrar', 'presupuestos-pendientes'].includes(tipo)) throw new ErrorHttp(400, 'Tipo de alerta inválido');

    const gestionObras = ['obras-por-cerrar', 'presupuestos-pendientes'].includes(tipo);
    const permitidos = gestionObras ? [roles.ADMIN, roles.SUPERVISOR]
        : tipo === 'stock' ? [roles.ADMIN, roles.ADMINISTRACION, roles.BODEGA] : [roles.ADMIN, roles.ADMINISTRACION];
    if (!permitidos.includes(rol)) throw new ErrorHttp(403, 'No tienes permiso para consultar estas alertas');

    // Se usa un límite de 5 registros por página, para no saturar la vista de alertas.
    const { pagina, limite, offset } = filtrosListado({ pagina: filtros.pagina, limite: 5 });
    // Se usa la misma regla de mínimo del catálogo; solo participan artículos activos.
    const hoy = `(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date`;
    const cliente=tipo.startsWith('clientes-');
    const tercero=cliente?'cliente':'proveedor';
    const totalSql=cliente?totalFacturaClienteSql:totalDocumentoSql;
    const origen = tipo === 'obras-por-cerrar'
        ? `SELECT o.id_obra,o.nombre_obra,o.fecha_creacion,c.razon_social
            FROM obra o JOIN presupuesto p ON p.id_presupuesto=o.id_presupuesto
            JOIN cliente c ON c.id_cliente=p.id_cliente
            WHERE o.estado='En proceso'
            AND EXISTS (SELECT 1 FROM detalle_presupuesto d WHERE d.id_presupuesto=o.id_presupuesto)
            AND NOT EXISTS (SELECT 1 FROM detalle_presupuesto d WHERE d.id_presupuesto=o.id_presupuesto
                AND (SELECT COUNT(*) FROM hoja_de_servicio h WHERE h.id_detalle_presupuesto=d.id_detalle_presupuesto
                    AND h.numero_unidad BETWEEN 1 AND d.cantidad AND h.estado='Completada')<d.cantidad)`
        : tipo === 'presupuestos-pendientes'
            ? `SELECT p.id_presupuesto,p.fecha_emision,p.monto_total,p.origen,c.razon_social
                FROM presupuesto p JOIN cliente c ON c.id_cliente=p.id_cliente WHERE p.estado='Pendiente'`
        : tipo === 'stock'
        ? `SELECT id_articulo,codigo_interno,nombre,unidad_medida,stock_minimo,
            stock_actual-stock_comprometido AS stock_disponible FROM articulo
            WHERE activo=true AND stock_actual-stock_comprometido<=stock_minimo`
        : `SELECT d.id_documento,${cliente ? 'pres.id_cliente' : 'd.id_proveedor'},d.folio,d.fecha_vencimiento,p.razon_social,
            d.fecha_vencimiento-${hoy} AS dias_restantes,
            importes.total - COALESCE(abonos.pagado,0) - ${totalNotasCreditoSql} AS saldo_pendiente
            FROM documento_tributario d ${cliente
                ? 'JOIN obra o USING(id_obra) JOIN presupuesto pres ON pres.id_presupuesto=o.id_presupuesto JOIN cliente p ON p.id_cliente=pres.id_cliente'
                : 'JOIN proveedor p USING(id_proveedor)'}
            CROSS JOIN LATERAL (SELECT ${totalSql} AS total) importes
            LEFT JOIN LATERAL (SELECT SUM(a.monto) AS pagado FROM pago_documento a WHERE a.id_documento=d.id_documento) abonos ON TRUE
            WHERE d.tipo_documento='factura' ${cliente ? 'AND d.id_proveedor IS NULL ' : ''}AND importes.total > COALESCE(abonos.pagado,0) + ${totalNotasCreditoSql}
            AND ${tipo.endsWith('vencidas') ? `d.fecha_vencimiento < ${hoy}`
                : `d.fecha_vencimiento BETWEEN ${hoy} AND ${hoy}+7`}`;
    const orden = tipo === 'obras-por-cerrar' ? 'fecha_creacion,id_obra'
        : tipo === 'presupuestos-pendientes' ? 'fecha_emision,id_presupuesto'
            : tipo === 'stock' ? 'stock_disponible-stock_minimo,id_articulo' : 'fecha_vencimiento,id_documento';
    // Total y página se obtienen en una misma lectura, incluso si no hay resultados.
    const r = await pool.query(`WITH alertas AS (${origen})
        SELECT COUNT(*) AS total,COALESCE((SELECT json_agg(fila) FROM (
            SELECT * FROM alertas ORDER BY ${orden} LIMIT $1 OFFSET $2
        ) fila),'[]'::json) AS registros FROM alertas`, [limite, offset]);
    return { registros: r.rows[0].registros, total: Number(r.rows[0].total), pagina, limite };
}

module.exports = { listar };
