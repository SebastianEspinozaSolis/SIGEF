const pool = require('../../db');
const { roles } = require('../../config');
const ErrorHttp = require('../../utils/ErrorHttp');
const { filtrosListado } = require('../../utils/catalogos');

async function listar(tipo, rol, filtros = {}) {
    if (!['stock', 'por-vencer', 'vencidas'].includes(tipo)) throw new ErrorHttp(400, 'Tipo de alerta inválido');
    if (![roles.ADMIN, roles.ADMINISTRACION, roles.BODEGA].includes(rol)
        || (rol === roles.BODEGA && tipo !== 'stock')) throw new ErrorHttp(403, 'No tienes permiso para consultar estas alertas');
    const { pagina, limite, offset } = filtrosListado({ pagina: filtros.pagina, limite: 5 });
    // Se usa la misma regla de mínimo del catálogo; solo participan artículos activos.
    const hoy = `(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date`;
    const origen = tipo === 'stock'
        ? `SELECT id_articulo,codigo_interno,nombre,unidad_medida,stock_minimo,
            stock_actual-stock_comprometido AS stock_disponible FROM articulo
            WHERE activo=true AND stock_actual-stock_comprometido<=stock_minimo`
        : `SELECT d.id_documento,d.id_proveedor,d.folio,d.fecha_vencimiento,p.razon_social
            FROM documento_tributario d JOIN proveedor p USING(id_proveedor)
            WHERE d.tipo_documento='factura' AND d.estado_pago='Pendiente'
            AND ${tipo === 'vencidas' ? `d.fecha_vencimiento < ${hoy}`
                : `d.fecha_vencimiento BETWEEN ${hoy} AND ${hoy}+7`}`;
    const orden = tipo === 'stock' ? 'stock_disponible-stock_minimo,id_articulo' : 'fecha_vencimiento,id_documento';
    // Total y página se obtienen en una misma lectura, incluso si no hay resultados.
    const r = await pool.query(`WITH alertas AS (${origen})
        SELECT COUNT(*) AS total,COALESCE((SELECT json_agg(fila) FROM (
            SELECT * FROM alertas ORDER BY ${orden} LIMIT $1 OFFSET $2
        ) fila),'[]'::json) AS registros FROM alertas`, [limite, offset]);
    return { registros: r.rows[0].registros, total: Number(r.rows[0].total), pagina, limite };
}

module.exports = { listar };
