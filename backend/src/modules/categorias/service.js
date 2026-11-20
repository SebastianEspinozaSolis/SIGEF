const pool = require('../../db');
const ErrorHttp = require('../../utils/ErrorHttp');
const { registrarAuditoria } = require('../auditoria/service');
const { texto, idPositivo, filtrosListado, comprobarErrores } = require('../../utils/catalogos');

// Valida el nombre de la categoría con las reglas compartidas.
// si hay errores lanza el error
function validar(datos) {
    const errores = {};
    const ficha = {
        nombre_categoria: texto(datos.nombre_categoria, 'nombre_categoria', 80, errores, true),
    };

    comprobarErrores(errores);
    return ficha;
}

// Lista categorías con búsqueda y paginación.
async function listar(filtros) {
    const { pagina, limite, patron, offset } = filtrosListado(filtros);
    // Ejemplo: '%tubo%' encuentra 'Tubos PVC' y 'TUBO COBRE'.
    const where = 'nombre_categoria ILIKE $1';
    const total = await pool.query('SELECT COUNT(*) AS total FROM categoria_articulo WHERE ' + where, [patron]);
    const r = await pool.query(
        'SELECT id_categoria, nombre_categoria FROM categoria_articulo WHERE ' + where + ' ORDER BY nombre_categoria, id_categoria LIMIT $2 OFFSET $3',
        [patron, limite, offset]
    );
    return { registros: r.rows, total: Number(total.rows[0].total), pagina, limite };
}

// Crea o edita la categoría y guarda su auditoría en la misma transacción.
async function guardar(datos, idResponsable, idFicha) {
    const id = idFicha === undefined ? null : idPositivo(idFicha);
    const ficha = validar(datos);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let anterior = null;
        if (id !== null) {
            // Bloquea la fila para auditar el estado anterior sin cambios concurrentes.
            const consulta = await client.query('SELECT id_categoria, nombre_categoria FROM categoria_articulo WHERE id_categoria = $1 FOR UPDATE', [id]);
            anterior = consulta.rows[0];
            if (!anterior) throw new ErrorHttp(404, 'Registro no encontrado');
        }
        const valores = [ficha.nombre_categoria];
        const r = id === null
        // Si es creación, inserta y devuelve el id y nombre de la nueva categoría. Si es edición, actualiza y devuelve el id y nombre de la categoría editada.
            ? await client.query('INSERT INTO categoria_articulo (nombre_categoria) VALUES ($1) RETURNING id_categoria, nombre_categoria', valores)
            : await client.query('UPDATE categoria_articulo SET nombre_categoria = $1 WHERE id_categoria = $2 RETURNING id_categoria, nombre_categoria', [...valores, id]);
        const registro = r.rows[0];
        // Registra la auditoria de creacion o actualización
        await registrarAuditoria(client, {
            id_usuario: idResponsable, tabla_afectada: 'categoria_articulo',
            id_registro_afectado: registro.id_categoria,
            accion: id === null ? 'CREAR_FICHA' : 'EDITAR_FICHA',
            valores_anteriores: anterior, valores_nuevos: registro,
        });
        // Confirma la transacción y devuelve la ficha creada o editada.
        await client.query('COMMIT');
        return registro;
    } catch (err) {
        // Si hay error, revierte la transacción y lanza el error. Si es un error de clave duplicada, lanza un error 409.
        await client.query('ROLLBACK');
        if (err.code === '23505') throw new ErrorHttp(409, 'La categoría ya existe');
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { listar, guardar };
