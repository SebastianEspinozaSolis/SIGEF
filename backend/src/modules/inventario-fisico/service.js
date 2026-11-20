const pool = require('../../db');
const ErrorHttp = require('../../utils/ErrorHttp');
const { registrarAuditoria } = require('../auditoria/service');
const { idPositivo, filtrosListado, comprobarErrores } = require('../../utils/catalogos');

// Los resúmenes se calculan desde los detalles, sin mantener columnas duplicadas.
function resumen(alias) {
    return `(SELECT COUNT(*)::int FROM detalle_inventario_fisico d WHERE d.id_inventario=${alias}.id_inventario) AS total_contados,
        (SELECT COUNT(*)::int FROM detalle_inventario_fisico d WHERE d.id_inventario=${alias}.id_inventario
         AND d.stock_fisico<>d.stock_sistema) AS total_con_diferencia`;
}

// Busca artículos para contar sin exponer costos ni exigir permiso de edición del catálogo.
async function listarArticulos(filtros = {}) {
    const { pagina, limite, patron, offset } = filtrosListado(filtros);
    const where = '(nombre ILIKE $1 OR codigo_interno ILIKE $1 OR codigo_barras ILIKE $1)';
    const total = await pool.query(`SELECT COUNT(*) AS total FROM articulo WHERE ${where}`, [patron]);
    const r = await pool.query(
        `SELECT id_articulo, codigo_interno, nombre, unidad_medida FROM articulo
         WHERE ${where} ORDER BY nombre, id_articulo LIMIT $2 OFFSET $3`, [patron, limite, offset]
    );
    return { registros: r.rows, total: Number(total.rows[0].total), pagina, limite };
}

async function listar(filtros = {}) {
    const { pagina, limite, offset } = filtrosListado(filtros);
    const valores = [];
    let where = '';
    if (filtros.estado !== undefined && filtros.estado !== '') {
        if (!['En proceso', 'Finalizado'].includes(filtros.estado)) throw new ErrorHttp(400, 'Estado inválido');
        valores.push(filtros.estado);
        where = 'WHERE estado = $1';
    }
    const total = await pool.query(`SELECT COUNT(*) AS total FROM inventario_fisico ${where}`, valores);
    const r = await pool.query(
        `SELECT *, ${resumen('inventario_fisico')} FROM inventario_fisico ${where} ORDER BY fecha_conteo DESC, id_inventario DESC
         LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`, [...valores, limite, offset]
    );
    return { registros: r.rows, total: Number(total.rows[0].total), pagina, limite };
}

async function obtener(idInventario) {
    const id = idPositivo(idInventario);
    // Una sola consulta mantiene coherentes la cabecera y los detalles de esta lectura.
    const r = await pool.query(
        `SELECT i.*, ${resumen('i')}, COALESCE((
            SELECT json_agg(fila ORDER BY fila.id_articulo) FROM (
                SELECT d.*, (d.stock_fisico - d.stock_sistema)::numeric(12,3) AS diferencia, a.codigo_interno, a.nombre, a.unidad_medida
                FROM detalle_inventario_fisico d JOIN articulo a ON a.id_articulo = d.id_articulo
                WHERE d.id_inventario = i.id_inventario
            ) fila
         ), '[]'::json) AS detalles FROM inventario_fisico i WHERE i.id_inventario = $1`, [id]
    );
    if (!r.rows[0]) throw new ErrorHttp(404, 'Inventario no encontrado');
    return r.rows[0];
}

async function crear(idResponsable) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const r = await client.query(
            `INSERT INTO inventario_fisico (id_usuario)
             VALUES ($1) RETURNING *, 0 AS total_contados, 0 AS total_con_diferencia`, [idResponsable]
        );
        const inventario = r.rows[0];
        await registrarAuditoria(client, {
            id_usuario: idResponsable, tabla_afectada: 'inventario_fisico',
            id_registro_afectado: inventario.id_inventario, accion: 'CREAR_INVENTARIO',
            valores_nuevos: inventario,
        });
        await client.query('COMMIT');
        return inventario;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

// El bloqueo de la cabecera impide guardar un conteo mientras se finaliza el inventario.
async function bloquearEnProceso(client, id, incluirResumen = false) {
    // Al finalizar se conserva el resumen anterior para la auditoría; guardar no lo necesita.
    const columnasResumen = incluirResumen ? `, ${resumen('inventario_fisico')}` : '';
    const r = await client.query(`SELECT *${columnasResumen} FROM inventario_fisico WHERE id_inventario = $1 FOR UPDATE`, [id]);
    if (!r.rows[0]) throw new ErrorHttp(404, 'Inventario no encontrado');
    if (r.rows[0].estado !== 'En proceso') throw new ErrorHttp(409, 'El inventario ya está finalizado');
    return r.rows[0];
}

async function guardarConteo(idInventario, idArticulo, datos, idResponsable) {
    const id = idPositivo(idInventario);
    const articulo = idPositivo(idArticulo);
    const errores = {};
    // Se permite contar cero y fracciones, con el mismo límite NUMERIC(12,3) del esquema.
    if (!['string', 'number'].includes(typeof datos.stock_fisico) ||
        !/^\d{1,9}(\.\d{1,3})?$/.test(String(datos.stock_fisico))) {
        errores.stock_fisico = 'Ingresa una cantidad no negativa, con hasta 3 decimales';
    }
    // La referencia y la diferencia se obtienen en el servidor, nunca desde el formulario.
    for (const campo of ['stock_sistema', 'diferencia', 'stock_actual', 'stock_comprometido', 'precio_pmp']) {
        if (Object.hasOwn(datos, campo)) errores[campo] = 'Este dato no se modifica desde el conteo';
    }
    comprobarErrores(errores);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await bloquearEnProceso(client, id);
        const consulta = await client.query(
            'SELECT *, (stock_fisico - stock_sistema)::numeric(12,3) AS diferencia FROM detalle_inventario_fisico WHERE id_inventario = $1 AND id_articulo = $2', [id, articulo]
        );
        const anterior = consulta.rows[0] || null;
        // Lo asignado a técnicos está fuera de bodega y no se incluye en este conteo.
        // PostgreSQL resta con precisión decimal; FOR SHARE mantiene estable la referencia.
        const saldo = await client.query(`SELECT stock_actual, unidad_medida,
            (stock_actual - stock_comprometido)::numeric(12,3) AS stock_bodega
            FROM articulo WHERE id_articulo = $1 FOR SHARE`, [articulo]);
        if (!saldo.rows[0]) throw new ErrorHttp(404, 'Artículo no encontrado');
        // La unidad se consulta en la base: el formulario no decide si admite fracciones.
        if (saldo.rows[0].unidad_medida === 'UN' && !Number.isInteger(Number(datos.stock_fisico))) {
            throw new ErrorHttp(400, 'Hay datos inválidos', { stock_fisico: 'Este artículo se registra en unidades enteras' });
        }
        // Al corregir el conteo se conserva la referencia del primer registro de ese artículo.
        const referencia = anterior ? anterior.stock_sistema : saldo.rows[0].stock_bodega;
        const r = await client.query(
            `INSERT INTO detalle_inventario_fisico
                (id_inventario, id_articulo, stock_sistema, stock_fisico)
             VALUES ($1, $2, $3::numeric, $4::numeric)
             ON CONFLICT (id_inventario, id_articulo) DO UPDATE
             SET stock_fisico = EXCLUDED.stock_fisico
             RETURNING *, (stock_fisico - stock_sistema)::numeric(12,3) AS diferencia`, [id, articulo, referencia, String(datos.stock_fisico)]
        );
        const detalle = r.rows[0];
        await registrarAuditoria(client, {
            id_usuario: idResponsable, tabla_afectada: 'detalle_inventario_fisico',
            id_registro_afectado: detalle.id_detalle_inventario, accion: 'GUARDAR_CONTEO',
            valores_anteriores: anterior, valores_nuevos: detalle,
        });
        // Solo guarda evidencia: no crea movimientos Cardex ni cambia stock o PMP.
        await client.query('COMMIT');
        return detalle;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function finalizar(idInventario, idResponsable) {
    const id = idPositivo(idInventario);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const anterior = await bloquearEnProceso(client, id, true);
        // Finalizar únicamente cierra el conteo; no aplica las diferencias al inventario real.
        const r = await client.query(`UPDATE inventario_fisico SET estado = 'Finalizado' WHERE id_inventario = $1 RETURNING *, ${resumen('inventario_fisico')}`, [id]);
        const inventario = r.rows[0];
        await registrarAuditoria(client, {
            id_usuario: idResponsable, tabla_afectada: 'inventario_fisico',
            id_registro_afectado: id, accion: 'FINALIZAR_INVENTARIO',
            valores_anteriores: anterior, valores_nuevos: inventario,
        });
        await client.query('COMMIT');
        return inventario;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { listar, obtener, crear, guardarConteo, finalizar, listarArticulos };
