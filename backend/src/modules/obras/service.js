const pool = require('../../db');
const config = require('../../config');
const ErrorHttp = require('../../utils/ErrorHttp');
const { texto, idPositivo, filtrosListado, comprobarErrores } = require('../../utils/catalogos');
const { registrarAuditoria } = require('../auditoria/service');
const { comprobarObraNoFacturada } = require('../../utils/bloqueoFacturacion');

const consultaObra = `FROM obra o JOIN presupuesto p ON p.id_presupuesto = o.id_presupuesto
    JOIN cliente c ON c.id_cliente = p.id_cliente
    LEFT JOIN categoria_servicio s ON s.id_categoria_servicio = p.id_categoria_servicio
    JOIN usuario u ON u.id_usuario = o.id_tecnico`;
const columnas = `o.id_obra,o.nombre_obra,o.id_presupuesto,p.id_categoria_servicio,o.id_tecnico,
    o.estado,o.sin_materiales,o.fecha_creacion,o.fecha_cierre,p.id_cliente, p.monto_total, c.razon_social, c.rut_cliente,
    s.nombre_servicio, u.nombres || ' ' || u.apellidos AS tecnico,
    (o.firma_conformidad IS NOT NULL) AS conformidad_recibida,
    (SELECT d.id_documento FROM documento_tributario d WHERE d.id_obra=o.id_obra AND d.id_proveedor IS NULL AND d.tipo_documento='factura' ORDER BY d.id_documento LIMIT 1) AS id_factura_cliente,
    (EXISTS (SELECT 1 FROM detalle_presupuesto d WHERE d.id_presupuesto=o.id_presupuesto)
    AND NOT EXISTS (SELECT 1 FROM detalle_presupuesto d WHERE d.id_presupuesto=o.id_presupuesto
        AND (SELECT COUNT(*) FROM hoja_de_servicio h WHERE h.id_detalle_presupuesto=d.id_detalle_presupuesto
            AND h.numero_unidad BETWEEN 1 AND d.cantidad AND h.estado='Completada')<d.cantidad)) AS tareas_completadas`;

// La firma permanece en la obra, sin copiarla a respuestas generales o auditoría.
function sinFirma(registro) {
    if (!registro) return registro;
    const datos = { ...registro };
    delete datos.firma_conformidad;
    return datos;
}

async function listar(filtros = {}) {
    const { pagina, limite, patron, offset } = filtrosListado(filtros);
    const estado = filtros.estado || null;
    if (estado && !['En proceso', 'Suspendida', 'Cancelada', 'Finalizada'].includes(estado)) throw new ErrorHttp(400, 'Estado inválido');
    const where = `WHERE (o.nombre_obra ILIKE $1 OR c.razon_social ILIKE $1) AND ($2::text IS NULL OR o.estado = $2)`;
    const total = await pool.query(`SELECT COUNT(*) AS total ${consultaObra} ${where}`, [patron, estado]);
    const r = await pool.query(`SELECT ${columnas} ${consultaObra} ${where}
        ORDER BY o.id_obra DESC LIMIT $3 OFFSET $4`, [patron, estado, limite, offset]);
    return { registros: r.rows, total: Number(total.rows[0].total), pagina, limite };
}

async function obtener(idFicha) {
    const id = idPositivo(idFicha);
    const r = await pool.query(`SELECT ${columnas} ${consultaObra} WHERE o.id_obra = $1`, [id]);
    if (!r.rows[0]) throw new ErrorHttp(404, 'Obra no encontrada');
    // El egreso se registra positivo; las reversas reducen su cantidad efectiva.
    const materiales = await pool.query(`SELECT m.id_movimiento, a.id_articulo, a.nombre,
        a.unidad_medida, m.fecha_hora, m.cantidad, m.costo_unitario,
        m.cantidad - COALESCE(r.revertido, 0) AS cantidad_neta,
        ROUND((m.cantidad - COALESCE(r.revertido, 0)) * m.costo_unitario,0) AS costo_neto,
        SUM(ROUND((m.cantidad - COALESCE(r.revertido, 0)) * m.costo_unitario,0)) OVER () AS costo_materiales_total
        FROM movimiento_cardex m JOIN articulo a ON a.id_articulo = m.id_articulo
        LEFT JOIN LATERAL (SELECT SUM(ABS(v.cantidad)) AS revertido FROM movimiento_cardex v
            WHERE v.id_movimiento_revertido = m.id_movimiento AND v.tipo_movimiento = 'REVERSA') r ON TRUE
        WHERE m.id_obra = $1 AND m.tipo_movimiento = 'EGRESO'
        ORDER BY m.fecha_hora, m.id_movimiento`, [id]);
    // Cada hoja conserva su consumo efectivo, sin confundirlo con entregas directas.
    const hojas=await pool.query(`SELECT d.id_detalle_presupuesto,d.descripcion,unidad.numero_unidad,d.cantidad AS cantidad_contratada,
        h.id_hoja_servicio,COALESCE(h.estado,'Sin iniciar') AS estado,h.horas_trabajadas,
        COALESCE((SELECT json_agg(consumo) FROM (
            SELECT a.id_articulo,a.nombre,a.unidad_medida,
                SUM(m.cantidad-COALESCE((SELECT SUM(ABS(v.cantidad)) FROM movimiento_cardex v
                    WHERE v.id_movimiento_revertido=m.id_movimiento AND v.tipo_movimiento='REVERSA'),0)) AS cantidad
            FROM material_utilizado mu JOIN movimiento_cardex m ON m.id_movimiento=mu.id_movimiento_egreso
            JOIN articulo a ON a.id_articulo=m.id_articulo
            WHERE mu.id_hoja_servicio=h.id_hoja_servicio AND m.tipo_movimiento = 'EGRESO'
            GROUP BY a.id_articulo,a.nombre,a.unidad_medida ORDER BY a.nombre,a.id_articulo
        ) consumo WHERE consumo.cantidad>0),'[]'::json) AS materiales
        FROM detalle_presupuesto d JOIN obra o ON o.id_presupuesto=d.id_presupuesto
        CROSS JOIN LATERAL generate_series(1,d.cantidad) unidad(numero_unidad)
        LEFT JOIN hoja_de_servicio h ON h.id_detalle_presupuesto=d.id_detalle_presupuesto AND h.numero_unidad=unidad.numero_unidad
        WHERE o.id_obra=$1 ORDER BY d.id_detalle_presupuesto,unidad.numero_unidad`,[id]);
    return { ...r.rows[0], hojas:hojas.rows, materiales: materiales.rows, costo_materiales: materiales.rows[0]?.costo_materiales_total || '0' };
}

// La firma se consulta aparte: no se incluye en listados ni en descargas de terreno.
async function obtenerFirma(idFicha) {
    const r = await pool.query('SELECT estado, firma_conformidad FROM obra WHERE id_obra=$1', [idPositivo(idFicha)]);
    const obra = r.rows[0];
    if (!obra) throw new ErrorHttp(404, 'Obra no encontrada');
    if (obra.estado !== 'Finalizada') throw new ErrorHttp(409, 'La firma se consulta al finalizar la obra');
    return { firma_conformidad: obra.firma_conformidad };
}

async function listarTecnicos(filtros) {
    const { pagina, limite, patron, offset } = filtrosListado(filtros);
    const from = `FROM usuario u JOIN rol r ON r.id_rol = u.id_rol
        WHERE u.estado = 'Activo' AND r.nombre_rol = $1
        AND (u.nombres || ' ' || u.apellidos) ILIKE $2`;
    const total = await pool.query(`SELECT COUNT(*) AS total ${from}`, [config.roles.TECNICO, patron]);
    const r = await pool.query(`SELECT u.id_usuario, u.nombres, u.apellidos ${from}
        ORDER BY u.nombres, u.apellidos, u.id_usuario LIMIT $3 OFFSET $4`, [config.roles.TECNICO, patron, limite, offset]);
    return { registros: r.rows, total: Number(total.rows[0].total), pagina, limite };
}

async function guardar(datos, idResponsable, idFicha) {
    const errores = {};
    const nombre = texto(datos.nombre_obra, 'nombre_obra', 150, errores);
    if (typeof datos.sin_materiales !== 'boolean') errores.sin_materiales = 'Indica si la obra no utiliza materiales';
    comprobarErrores(errores);
    const presupuesto = idPositivo(datos.id_presupuesto);
    const tecnico = idPositivo(datos.id_tecnico);
    const id = idFicha === undefined ? null : idPositivo(idFicha);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const p = (await client.query('SELECT * FROM presupuesto WHERE id_presupuesto = $1 FOR UPDATE', [presupuesto])).rows[0];
        if (!p) throw new ErrorHttp(400, 'Presupuesto no encontrado');
        if (p.estado !== 'Aprobado') throw new ErrorHttp(409, 'La obra requiere un presupuesto aprobado');
        if (p.id_categoria_servicio == null) throw new ErrorHttp(409, 'Asigna una categoría al presupuesto antes de crear o editar su obra');
        let anterior = null;
        if (id !== null) {
            anterior = (await client.query('SELECT * FROM obra WHERE id_obra = $1 FOR UPDATE', [id])).rows[0];
            if (!anterior) throw new ErrorHttp(404, 'Obra no encontrada');
            await comprobarObraNoFacturada(client,id);
            if (!['En proceso', 'Suspendida'].includes(anterior.estado)) throw new ErrorHttp(409, 'La obra ya no admite edición');
            if (anterior.id_presupuesto !== presupuesto) throw new ErrorHttp(409, 'No puedes cambiar el presupuesto de la obra');
        }
        const t = await client.query(`SELECT u.id_usuario FROM usuario u JOIN rol r ON r.id_rol = u.id_rol
            WHERE u.id_usuario = $1 AND u.estado = 'Activo' AND r.nombre_rol = $2 FOR SHARE OF u`, [tecnico, config.roles.TECNICO]);
        if (!t.rows[0]) throw new ErrorHttp(400, 'Selecciona un técnico activo');
        const valores = [nombre, presupuesto, tecnico, datos.sin_materiales];
        const r = id === null
            ? await client.query(`INSERT INTO obra (nombre_obra, id_presupuesto, id_tecnico, sin_materiales)
                VALUES ($1, $2, $3, $4) RETURNING *`, valores)
            : await client.query(`UPDATE obra SET nombre_obra = $1, id_tecnico = $3,
                sin_materiales = $4 WHERE id_obra = $5 AND id_presupuesto = $2 RETURNING *`, [...valores, id]);
        await registrarAuditoria(client, { id_usuario: idResponsable, tabla_afectada: 'obra',
            id_registro_afectado: r.rows[0].id_obra, accion: id === null ? 'CREAR_OBRA' : 'EDITAR_OBRA',
            valores_anteriores: sinFirma(anterior), valores_nuevos: sinFirma(r.rows[0]) });
        await client.query('COMMIT');
        return sinFirma(r.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') throw new ErrorHttp(409, 'Ese presupuesto ya está asociado a una obra');
        throw err;
    } finally { client.release(); }
}

// El cierre usa los respaldos de terreno; no confunde entrega con consumo.
async function comprobarCierre(client, obra) {
    if (!obra.id_tecnico) throw new ErrorHttp(409, 'La obra necesita un técnico asignado para finalizar');
    const r = await client.query(`WITH egresos AS (
        SELECT m.*, m.cantidad - COALESCE((SELECT SUM(ABS(v.cantidad)) FROM movimiento_cardex v
            WHERE v.id_movimiento_revertido=m.id_movimiento AND v.tipo_movimiento='REVERSA'),0) AS cantidad_neta
        FROM movimiento_cardex m WHERE m.id_obra=$1 AND m.tipo_movimiento='EGRESO'
    ), hojas AS (
        SELECT h.*,o.id_obra FROM hoja_de_servicio h JOIN detalle_presupuesto d USING(id_detalle_presupuesto)
        JOIN obra o ON o.id_presupuesto=d.id_presupuesto WHERE o.id_obra=$1
    ) SELECT
        EXISTS (SELECT 1 FROM detalle_presupuesto d JOIN obra o USING(id_presupuesto) WHERE o.id_obra=$1
            AND (SELECT COUNT(*) FROM hojas h WHERE h.id_detalle_presupuesto=d.id_detalle_presupuesto
                AND h.numero_unidad BETWEEN 1 AND d.cantidad AND h.estado='Completada')<d.cantidad) AS tareas_pendientes,
        EXISTS (SELECT 1 FROM hojas h WHERE h.id_obra=$1 AND h.horas_trabajadas>0
            AND h.horas_trabajadas<>'NaN'::numeric) AS horas_registradas,
        (SELECT COUNT(*)::int FROM egresos WHERE cantidad_neta>0) AS materiales_entregados,
        (SELECT COUNT(*)::int FROM material_utilizado mu JOIN hojas h USING(id_hoja_servicio)
            JOIN egresos e ON e.id_movimiento=mu.id_movimiento_egreso
            WHERE h.id_obra=$1 AND e.cantidad_neta>0) AS consumos_registrados,
        (EXISTS (SELECT 1 FROM hojas h WHERE h.id_obra=$1 AND (h.horas_trabajadas<0 OR h.horas_trabajadas='NaN'::numeric))
        OR EXISTS (SELECT 1 FROM egresos WHERE cantidad_neta<0 OR cantidad<=0 OR costo_unitario<0 OR costo_unitario IS NULL
            OR cantidad_neta='NaN'::numeric OR cantidad='NaN'::numeric OR costo_unitario='NaN'::numeric)
        OR EXISTS (SELECT 1 FROM material_utilizado mu JOIN hojas h USING(id_hoja_servicio)
            JOIN movimiento_cardex m ON m.id_movimiento=mu.id_movimiento_egreso
            WHERE h.id_obra=$1 AND (m.tipo_movimiento<>'EGRESO' OR m.id_obra IS DISTINCT FROM $1
                OR m.cantidad<=0 OR m.costo_unitario<0 OR m.costo_unitario IS NULL
                OR m.cantidad='NaN'::numeric OR m.costo_unitario='NaN'::numeric))) AS datos_invalidos`, [obra.id_obra]);
    const respaldo = r.rows[0];
    if (respaldo?.tareas_pendientes) throw new ErrorHttp(409, 'Completa las hojas de todas las tareas contratadas antes de finalizar');
    if (!respaldo?.horas_registradas) throw new ErrorHttp(409, 'Registra las horas trabajadas en una hoja de servicio antes de finalizar');
    if (respaldo.datos_invalidos) throw new ErrorHttp(409, 'Revisa las horas y los egresos que respaldan los materiales utilizados antes de finalizar');
    if (obra.sin_materiales) {
        if (respaldo.materiales_entregados > 0 || respaldo.consumos_registrados > 0) throw new ErrorHttp(409, 'La obra está marcada sin materiales, pero tiene egresos vigentes. Revisa esa declaración antes de finalizar');
    } else if (!respaldo.consumos_registrados) {
        throw new ErrorHttp(409, 'Registra los materiales utilizados con su egreso valorizado, o confirma que la obra no utilizó materiales');
    }
}

async function cambiarEstado(idFicha, datos, idResponsable) {
    const id = idPositivo(idFicha);
    if (!['En proceso', 'Suspendida', 'Cancelada', 'Finalizada'].includes(datos.estado)) throw new ErrorHttp(400, 'Estado inválido');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const anterior = (await client.query('SELECT * FROM obra WHERE id_obra = $1 FOR UPDATE', [id])).rows[0];
        if (!anterior) throw new ErrorHttp(404, 'Obra no encontrada');
        await comprobarObraNoFacturada(client,id);
        const transiciones = { 'En proceso': ['Suspendida', 'Cancelada', 'Finalizada'], Suspendida: ['En proceso', 'Cancelada'] };
        if (!transiciones[anterior.estado]?.includes(datos.estado)) throw new ErrorHttp(409, 'Cambio de estado no permitido');
        if (datos.estado === 'Finalizada') await comprobarCierre(client, anterior);
        const r = await client.query(`UPDATE obra SET estado = $1::varchar,
            fecha_cierre = CASE WHEN $1::varchar='Finalizada' THEN CURRENT_TIMESTAMP ELSE fecha_cierre END
            WHERE id_obra = $2 RETURNING *`, [datos.estado, id]);
        await registrarAuditoria(client, { id_usuario: idResponsable, tabla_afectada: 'obra',
            id_registro_afectado: id, accion: 'ESTADO_OBRA', valores_anteriores: sinFirma(anterior), valores_nuevos: sinFirma(r.rows[0]) });
        await client.query('COMMIT');
        return sinFirma(r.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally { client.release(); }
}

module.exports = { listar, obtener, obtenerFirma, listarTecnicos, guardar, cambiarEstado, comprobarCierre };
