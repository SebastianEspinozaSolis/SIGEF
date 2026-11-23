const pool = require('../../db');
const ErrorHttp = require('../../utils/ErrorHttp');
const { texto, idPositivo, filtrosListado, comprobarErrores } = require('../../utils/catalogos');
const { registrarAuditoria } = require('../auditoria/service');

async function listar(filtros) {
    const { pagina, limite, patron, offset } = filtrosListado(filtros);
    const total = await pool.query('SELECT COUNT(*) AS total FROM categoria_servicio WHERE nombre_servicio ILIKE $1', [patron]);
    const r = await pool.query(`SELECT * FROM categoria_servicio WHERE nombre_servicio ILIKE $1
        ORDER BY nombre_servicio, id_categoria_servicio LIMIT $2 OFFSET $3`, [patron, limite, offset]);
    return { registros: r.rows, total: Number(total.rows[0].total), pagina, limite };
}

async function guardar(datos, idResponsable, idFicha) {
    const errores = {};
    const nombre = texto(datos.nombre_servicio, 'nombre_servicio', 80, errores);
    comprobarErrores(errores);
    const id = idFicha === undefined ? null : idPositivo(idFicha);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let anterior = null;
        if (id !== null) {
            anterior = (await client.query('SELECT * FROM categoria_servicio WHERE id_categoria_servicio = $1 FOR UPDATE', [id])).rows[0];
            if (!anterior) throw new ErrorHttp(404, 'Categoría de servicio no encontrada');
        }
        const r = id === null
            ? await client.query('INSERT INTO categoria_servicio (nombre_servicio) VALUES ($1) RETURNING *', [nombre])
            : await client.query('UPDATE categoria_servicio SET nombre_servicio = $1 WHERE id_categoria_servicio = $2 RETURNING *', [nombre, id]);
        await registrarAuditoria(client, { id_usuario: idResponsable, tabla_afectada: 'categoria_servicio',
            id_registro_afectado: r.rows[0].id_categoria_servicio, accion: id === null ? 'CREAR_FICHA' : 'EDITAR_FICHA',
            valores_anteriores: anterior, valores_nuevos: r.rows[0] });
        await client.query('COMMIT');
        return r.rows[0];
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') throw new ErrorHttp(409, 'La categoría de servicio ya existe');
        throw err;
    } finally { client.release(); }
}

module.exports = { listar, guardar };
