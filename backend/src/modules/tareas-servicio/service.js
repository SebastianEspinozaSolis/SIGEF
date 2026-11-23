const pool = require('../../db');
const ErrorHttp = require('../../utils/ErrorHttp');
const { texto, idPositivo, filtrosListado, comprobarErrores } = require('../../utils/catalogos');
const { registrarAuditoria } = require('../auditoria/service');

async function listar(filtros = {}) {
    const { pagina, limite, patron, offset } = filtrosListado(filtros);
    const categoria = filtros.id_categoria_servicio ? idPositivo(filtros.id_categoria_servicio) : null;
    let activo = null;
    if (filtros.activo !== undefined) {
        if (!['true', 'false', true, false].includes(filtros.activo)) throw new ErrorHttp(400, 'Estado inválido');
        activo = String(filtros.activo) === 'true';
    }
    const from = `FROM tarea_servicio t JOIN categoria_servicio c USING (id_categoria_servicio)
        WHERE t.nombre_tarea ILIKE $1 AND ($2::int IS NULL OR t.id_categoria_servicio = $2)
        AND ($3::boolean IS NULL OR t.activo = $3)`;
    const valores = [patron, categoria, activo];
    const total = await pool.query(`SELECT COUNT(*) AS total ${from}`, valores);
    const r = await pool.query(`SELECT t.*, c.nombre_servicio ${from}
        ORDER BY t.nombre_tarea, t.id_tarea LIMIT $4 OFFSET $5`, [...valores, limite, offset]);
    return { registros: r.rows, total: Number(total.rows[0].total), pagina, limite };
}

async function obtener(idFicha) {
    const r = await pool.query(`SELECT t.*, c.nombre_servicio FROM tarea_servicio t
        JOIN categoria_servicio c USING (id_categoria_servicio) WHERE id_tarea = $1`, [idPositivo(idFicha)]);
    if (!r.rows[0]) throw new ErrorHttp(404, 'Tarea no encontrada');
    const items = await pool.query('SELECT id_item,pregunta FROM item_checklist WHERE id_tarea=$1 ORDER BY id_item',[idPositivo(idFicha)]);
    return { ...r.rows[0], items:items.rows };
}

async function guardar(datos, idResponsable, idFicha) {
    const errores = {};
    const nombre = texto(datos.nombre_tarea, 'nombre_tarea', 150, errores);
    const categoria = idPositivo(datos.id_categoria_servicio);
    const precio = String(datos.precio_neto ?? '').trim();
    if (!/^\d{1,14}$/.test(precio)) errores.precio_neto = 'Ingresa un precio neto entero en pesos';
    const activo = datos.activo === undefined ? true : datos.activo;
    if (typeof activo !== 'boolean') errores.activo = 'Selecciona un estado válido';
    let items;
    if (datos.items !== undefined) {
        if (!Array.isArray(datos.items) || datos.items.length>100) throw new ErrorHttp(400,'Máximo 100 comprobaciones por tarea');
        items=datos.items.map((item,i)=>({id_item:item?.id_item == null ? null : idPositivo(item.id_item),pregunta:texto(item?.pregunta,`items.${i}.pregunta`,255,errores)}));
        if (new Set(items.map(i=>i.pregunta)).size!==items.length || new Set(items.filter(i=>i.id_item!=null).map(i=>i.id_item)).size!==items.filter(i=>i.id_item!=null).length) errores.items='No repitas comprobaciones';
    }
    comprobarErrores(errores);
    const id = idFicha === undefined ? null : idPositivo(idFicha);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let anterior = null;
        if (id !== null) {
            anterior = (await client.query('SELECT * FROM tarea_servicio WHERE id_tarea = $1 FOR UPDATE', [id])).rows[0];
            if (!anterior) throw new ErrorHttp(404, 'Tarea no encontrada');
            if (anterior.id_categoria_servicio !== categoria) throw new ErrorHttp(409, 'No puedes cambiar la categoría de servicio de una tarea existente');
        }
        const categoriaExiste = await client.query('SELECT id_categoria_servicio FROM categoria_servicio WHERE id_categoria_servicio = $1 FOR KEY SHARE', [categoria]);
        if (!categoriaExiste.rows[0]) throw new ErrorHttp(400, 'Categoría de servicio no encontrada');
        const valores = [categoria, nombre, precio, activo];
        const r = id === null
            ? await client.query(`INSERT INTO tarea_servicio (id_categoria_servicio, nombre_tarea, precio_neto, activo)
                VALUES ($1, $2, $3, $4) RETURNING *`, valores)
            : await client.query(`UPDATE tarea_servicio SET id_categoria_servicio = $1, nombre_tarea = $2,
                precio_neto = $3, activo = $4 WHERE id_tarea = $5 RETURNING *`, [...valores, id]);
        const registro = r.rows[0];
        if (items !== undefined) {
            const anteriores=(await client.query('SELECT id_item,pregunta FROM item_checklist WHERE id_tarea=$1 ORDER BY id_item FOR UPDATE',[registro.id_tarea])).rows;
            if (items.some(i=>i.id_item!=null && !anteriores.some(a=>a.id_item===i.id_item))) throw new ErrorHttp(400,'La comprobación no pertenece a esta tarea');
            await client.query('DELETE FROM item_checklist WHERE id_tarea=$1 AND NOT(id_item=ANY($2::int[]))',[registro.id_tarea,items.filter(i=>i.id_item!=null).map(i=>i.id_item)]);
            // Las hojas conservan su propio texto aunque cambie el catálogo.
            for (const item of items) {
                if(item.id_item==null) await client.query('INSERT INTO item_checklist(id_tarea,pregunta) VALUES($1,$2)',[registro.id_tarea,item.pregunta]);
                else await client.query('UPDATE item_checklist SET pregunta=$2 WHERE id_item=$1 AND id_tarea=$3',[item.id_item,item.pregunta,registro.id_tarea]);
            }
            if (anterior) anterior.items=anteriores;
            registro.items=items;
        }
        await registrarAuditoria(client, { id_usuario: idResponsable, tabla_afectada: 'tarea_servicio',
            id_registro_afectado: registro.id_tarea, accion: id === null ? 'CREAR_TAREA' : 'EDITAR_TAREA',
            valores_anteriores: anterior, valores_nuevos: registro });
        await client.query('COMMIT');
        return registro;
    } catch (err) {
        await client.query('ROLLBACK');
        if(err.code==='23505') throw new ErrorHttp(409,'No repitas comprobaciones de la tarea');
        throw err;
    } finally { client.release(); }
}

module.exports = { listar, obtener, guardar };
