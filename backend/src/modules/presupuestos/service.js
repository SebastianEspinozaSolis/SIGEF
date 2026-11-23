const pool = require('../../db');
const ErrorHttp = require('../../utils/ErrorHttp');
const { texto, idPositivo, filtrosListado, comprobarErrores } = require('../../utils/catalogos');
const { calcularPresupuesto } = require('../../utils/importesPresupuesto');
const { registrarAuditoria } = require('../auditoria/service');

function validar(datos, legado = false) {
    const errores = {};
    const id_cliente = idPositivo(datos.id_cliente);
    if (legado && datos.id_categoria_servicio == null && (!datos.detalles || datos.detalles.length === 0)) {
        const monto = String(datos.monto_total ?? '').trim();
        if (!/^\d{1,12}(\.\d{1,2})?$/.test(monto)) errores.monto_total = 'Ingresa un monto no negativo, con hasta dos decimales';
        comprobarErrores(errores);
        return { id_cliente, id_categoria_servicio: null, monto_total: monto, detalles: [] };
    }
    const id_categoria_servicio = idPositivo(datos.id_categoria_servicio);
    if (!Array.isArray(datos.detalles) || !datos.detalles.length || datos.detalles.length > 100) {
        throw new ErrorHttp(400, 'Añade entre 1 y 100 tareas');
    }
    const tareas = new Set();
    const detalles = datos.detalles.map((linea, i) => {
        if (!linea || typeof linea !== 'object') throw new ErrorHttp(400, 'Tarea inválida');
        const id_tarea = idPositivo(linea.id_tarea);
        if (tareas.has(id_tarea)) throw new ErrorHttp(400, 'Una tarea no puede repetirse en el presupuesto');
        tareas.add(id_tarea);
        const cantidad = String(linea.cantidad ?? '').trim();
        const precio_neto_unitario = String(linea.precio_neto_unitario ?? '').trim();
        if (!/^\d{1,9}(\.0{1,3})?$/.test(cantidad) || Number(cantidad) <= 0) errores[`detalles.${i}.cantidad`] = 'Ingresa una cantidad entera mayor que cero';
        if (!/^\d{1,14}$/.test(precio_neto_unitario)) errores[`detalles.${i}.precio_neto_unitario`] = 'Ingresa un precio neto entero en pesos';
        const descripcion = linea.descripcion === undefined ? null : texto(linea.descripcion, `detalles.${i}.descripcion`, 255, errores);
        return { id_tarea, descripcion, cantidad: String(Number(cantidad)), precio_neto_unitario };
    });
    comprobarErrores(errores);
    return { id_cliente, id_categoria_servicio, detalles, ...calcularPresupuesto(detalles) };
}

function conImportes(registro, detalles = []) {
    return { ...registro, detalles, ...(detalles.length ? calcularPresupuesto(detalles) : { subtotal_neto: null, iva: null }) };
}

async function detallesCon(conexion, id) {
    return (await conexion.query('SELECT * FROM detalle_presupuesto WHERE id_presupuesto = $1 ORDER BY id_detalle_presupuesto', [id])).rows;
}

async function listar(filtros = {}) {
    const { pagina, limite, patron, offset } = filtrosListado(filtros);
    const estado = filtros.estado || null;
    if (estado && !['Pendiente', 'Aprobado', 'Rechazado'].includes(estado)) throw new ErrorHttp(400, 'Estado inválido');
    const from = `FROM presupuesto p JOIN cliente c ON c.id_cliente = p.id_cliente
        LEFT JOIN categoria_servicio cs ON cs.id_categoria_servicio = p.id_categoria_servicio
        LEFT JOIN obra o ON o.id_presupuesto = p.id_presupuesto
        WHERE (c.razon_social ILIKE $1 OR c.rut_cliente ILIKE $1 OR p.id_presupuesto::text ILIKE $1)
        AND ($2::text IS NULL OR p.estado = $2)`;
    const total = await pool.query(`SELECT COUNT(*) AS total ${from}`, [patron, estado]);
    const r = await pool.query(`SELECT p.*, c.razon_social, c.rut_cliente, o.id_obra, cs.nombre_servicio ${from}
        ORDER BY p.id_presupuesto DESC LIMIT $3 OFFSET $4`, [patron, estado, limite, offset]);
    return { registros: r.rows, total: Number(total.rows[0].total), pagina, limite };
}

async function obtener(idFicha) {
    const r = await pool.query(`SELECT p.*, c.razon_social, c.rut_cliente, o.id_obra, cs.nombre_servicio
        FROM presupuesto p JOIN cliente c ON c.id_cliente = p.id_cliente
        LEFT JOIN categoria_servicio cs ON cs.id_categoria_servicio = p.id_categoria_servicio
        LEFT JOIN obra o ON o.id_presupuesto = p.id_presupuesto WHERE p.id_presupuesto = $1`, [idPositivo(idFicha)]);
    if (!r.rows[0]) throw new ErrorHttp(404, 'Presupuesto no encontrado');
    return conImportes(r.rows[0], await detallesCon(pool, idPositivo(idFicha)));
}

// Selector limitado: consultar clientes no concede permisos para modificar sus fichas.
async function listarClientes(filtros) {
    const { pagina, limite, patron, offset } = filtrosListado(filtros);
    const where = 'FROM cliente WHERE razon_social ILIKE $1 OR rut_cliente ILIKE $1';
    const total = await pool.query(`SELECT COUNT(*) AS total ${where}`, [patron]);
    const r = await pool.query(`SELECT id_cliente, razon_social, rut_cliente ${where}
        ORDER BY razon_social, id_cliente LIMIT $2 OFFSET $3`, [patron, limite, offset]);
    return { registros: r.rows, total: Number(total.rows[0].total), pagina, limite };
}

async function guardar(datos, idResponsable, idFicha) {
    const id = idFicha === undefined ? null : idPositivo(idFicha);
    const fichaNueva = id === null ? validar(datos) : null;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let anterior = null;
        if (id !== null) {
            anterior = (await client.query('SELECT * FROM presupuesto WHERE id_presupuesto = $1 FOR UPDATE', [id])).rows[0];
            if (!anterior) throw new ErrorHttp(404, 'Presupuesto no encontrado');
            if (anterior.estado !== 'Pendiente') throw new ErrorHttp(409, 'Solo puedes editar un presupuesto Pendiente');
        }
        const anteriores = id === null ? [] : await detallesCon(client, id);
        if (anterior) anterior = conImportes(anterior, anteriores);
        const ficha = fichaNueva ?? validar(datos, !!anterior && anterior.id_categoria_servicio == null && !anteriores.length);
        const cliente = await client.query('SELECT id_cliente FROM cliente WHERE id_cliente = $1 FOR KEY SHARE', [ficha.id_cliente]);
        if (!cliente.rows[0]) throw new ErrorHttp(400, 'Cliente no encontrado');
        if (ficha.id_categoria_servicio !== null) {
            const categoria = await client.query('SELECT id_categoria_servicio FROM categoria_servicio WHERE id_categoria_servicio = $1 FOR KEY SHARE', [ficha.id_categoria_servicio]);
            if (!categoria.rows[0]) throw new ErrorHttp(400, 'Categoría de servicio no encontrada');
            const tareas = (await client.query('SELECT * FROM tarea_servicio WHERE id_tarea = ANY($1::int[]) ORDER BY id_tarea FOR SHARE', [ficha.detalles.map(l => l.id_tarea).sort((a, b) => a - b)])).rows;
            for (const linea of ficha.detalles) {
                const tarea = tareas.find(t => t.id_tarea === linea.id_tarea);
                const existente = anterior?.id_categoria_servicio === ficha.id_categoria_servicio
                    && anteriores.some(l => l.id_tarea === linea.id_tarea);
                if (!tarea || (!existente && tarea.id_categoria_servicio !== ficha.id_categoria_servicio)) throw new ErrorHttp(400, 'La tarea no pertenece a la categoría seleccionada');
                if (!tarea.activo && !existente) throw new ErrorHttp(400, 'No puedes añadir una tarea inactiva');
                linea.descripcion = linea.descripcion ?? (existente ? anteriores.find(l => l.id_tarea === linea.id_tarea).descripcion : tarea.nombre_tarea);
            }
        }
        const valores = [ficha.id_cliente, ficha.monto_total, ficha.id_categoria_servicio];
        const r = id === null
            ? await client.query(`INSERT INTO presupuesto (id_cliente, monto_total, id_categoria_servicio, estado, origen)
                VALUES ($1, $2, $3, 'Pendiente', 'Oficina') RETURNING *`, valores)
            : await client.query('UPDATE presupuesto SET id_cliente = $1, monto_total = $2, id_categoria_servicio = $3 WHERE id_presupuesto = $4 RETURNING *', [...valores, id]);
        const cabecera = r.rows[0];
        if (id !== null) await client.query('DELETE FROM detalle_presupuesto WHERE id_presupuesto = $1', [id]);
        const detalles = [];
        for (const linea of ficha.detalles) {
            const insertado = await client.query(`INSERT INTO detalle_presupuesto
                (id_presupuesto, id_tarea, descripcion, cantidad, precio_neto_unitario)
                VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [cabecera.id_presupuesto, linea.id_tarea, linea.descripcion, linea.cantidad, linea.precio_neto_unitario]);
            detalles.push(insertado.rows[0]);
        }
        const registro = conImportes(cabecera, detalles);
        await registrarAuditoria(client, { id_usuario: idResponsable, tabla_afectada: 'presupuesto',
            id_registro_afectado: registro.id_presupuesto, accion: id === null ? 'CREAR_PRESUPUESTO' : 'EDITAR_PRESUPUESTO',
            valores_anteriores: anterior, valores_nuevos: registro });
        await client.query('COMMIT');
        return registro;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally { client.release(); }
}

// La misma fila se bloquea al aprobar y al crear su obra para evitar carreras.
async function cambiarEstado(idFicha, datos, idResponsable) {
    const id = idPositivo(idFicha);
    if (!['Aprobado', 'Rechazado'].includes(datos.estado)) throw new ErrorHttp(400, 'Selecciona Aprobado o Rechazado');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const anterior = (await client.query('SELECT * FROM presupuesto WHERE id_presupuesto = $1 FOR UPDATE', [id])).rows[0];
        if (!anterior) throw new ErrorHttp(404, 'Presupuesto no encontrado');
        if (anterior.estado !== 'Pendiente') throw new ErrorHttp(409, 'El presupuesto ya tiene una decisión registrada');
        const r = await client.query('UPDATE presupuesto SET estado = $1 WHERE id_presupuesto = $2 RETURNING *', [datos.estado, id]);
        await registrarAuditoria(client, { id_usuario: idResponsable, tabla_afectada: 'presupuesto',
            id_registro_afectado: id, accion: 'ESTADO_PRESUPUESTO', valores_anteriores: anterior, valores_nuevos: r.rows[0] });
        await client.query('COMMIT');
        return r.rows[0];
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally { client.release(); }
}

module.exports = { listar, obtener, listarClientes, guardar, cambiarEstado, validar };
