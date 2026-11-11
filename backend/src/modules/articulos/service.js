const pool = require('../../db');
const ErrorHttp = require('../../utils/ErrorHttp');
const { registrarAuditoria } = require('../auditoria/service');
const { texto, idPositivo, filtrosListado, comprobarErrores } = require('../../utils/catalogos');

const unidadesPermitidas = new Set(['UN', 'M', 'M2', 'M3', 'KG', 'L']);

// Saldos y PMP se protegen; el precio de lista es un dato comercial editable.
function validar(datos) {
    const errores = {};
    for (const campo of ['stock_actual', 'stock_comprometido', 'precio_pmp', 'ultimo_costo_compra', 'fecha_actualizacion_precio']) {
        if (Object.hasOwn(datos, campo)) errores[campo] = 'Este dato no se modifica desde el catálogo';
    }
    const articulo = {
        codigo_interno: texto(datos.codigo_interno, 'codigo_interno', 40, errores),
        codigo_barras: texto(datos.codigo_barras, 'codigo_barras', 60, errores),
        nombre: texto(datos.nombre, 'nombre', 150, errores),
        unidad_medida: texto(datos.unidad_medida, 'unidad_medida', 20, errores),
        ubicacion_bodega: texto(datos.ubicacion_bodega, 'ubicacion_bodega', 80, errores),
        bodega_sector: texto(datos.bodega_sector, 'bodega_sector', 80, errores),
        descripcion: texto(datos.descripcion, 'descripcion', 5000, errores, false),
    };
    if (!unidadesPermitidas.has(articulo.unidad_medida)) {
        errores.unidad_medida = 'Selecciona una unidad de medida del listado';
    }
    try { articulo.id_categoria = idPositivo(datos.id_categoria); }
    catch { errores.id_categoria = 'Selecciona una categoría válida'; }
    if (!['string', 'number'].includes(typeof datos.precio_lista) || !/^\d{1,14}$/.test(String(datos.precio_lista))) {
        errores.precio_lista = 'Ingresa un precio en pesos enteros, no negativo y de hasta 14 dígitos';
    }
    articulo.precio_lista = String(datos.precio_lista);
    const minimo = datos.stock_minimo;
    // NUMERIC(12,3): hasta nueve enteros y tres decimales, sin redondeo silencioso.
    if (!['string', 'number'].includes(typeof minimo) || !/^\d{1,9}(\.\d{1,3})?$/.test(String(minimo))) {
        errores.stock_minimo = 'Ingresa un mínimo no negativo, con hasta 3 decimales';
    }
    if (!errores.stock_minimo && articulo.unidad_medida === 'UN' && !Number.isInteger(Number(minimo))) {
        errores.stock_minimo = 'Este artículo se registra en unidades enteras';
    }
    articulo.stock_minimo = String(minimo);
    if (datos.activo !== undefined && typeof datos.activo !== 'boolean') errores.activo = 'Estado inválido';
    articulo.activo = datos.activo ?? true;
    comprobarErrores(errores);
    return articulo;
}

// La resta se hace en PostgreSQL para conservar la precisión decimal.
const columnas = `a.id_articulo, a.codigo_interno, a.codigo_barras, a.nombre,
    a.id_categoria, c.nombre_categoria, a.unidad_medida, a.ubicacion_bodega,
    a.bodega_sector, a.descripcion, a.precio_lista, a.fecha_actualizacion_precio,
    (SELECT m.costo_unitario FROM movimiento_cardex m
        WHERE m.id_articulo=a.id_articulo AND m.tipo_movimiento='INGRESO' AND m.id_detalle_documento IS NOT NULL
        AND m.cantidad>COALESCE((SELECT SUM(abs(r.cantidad)) FROM movimiento_cardex r WHERE r.tipo_movimiento='REVERSA' AND r.id_movimiento_revertido=m.id_movimiento),0)
        ORDER BY m.fecha_hora DESC, m.id_movimiento DESC LIMIT 1) AS ultimo_costo_compra,
    a.stock_minimo, a.stock_actual, a.stock_comprometido, a.precio_pmp, a.activo,
    (a.stock_actual - a.stock_comprometido) AS stock_disponible,
    (a.stock_actual - a.stock_comprometido <= a.stock_minimo) AS stock_critico`;

async function listar(filtros = {}) {
    const { pagina, limite, patron, offset } = filtrosListado(filtros);
    const condiciones = ['(a.nombre ILIKE $1 OR a.codigo_interno ILIKE $1 OR a.codigo_barras ILIKE $1)'];
    const valores = [patron];
    if (filtros.id_categoria !== undefined && filtros.id_categoria !== '') {
        valores.push(idPositivo(filtros.id_categoria));
        condiciones.push(`a.id_categoria = $${valores.length}`);
    }
    if (filtros.activo !== undefined && filtros.activo !== '') {
        if (!['true', 'false'].includes(filtros.activo)) throw new ErrorHttp(400, 'Filtro de estado inválido');
        valores.push(filtros.activo === 'true');
        condiciones.push(`a.activo = $${valores.length}`);
    }
    if (filtros.critico !== undefined && filtros.critico !== '') {
        if (filtros.critico !== 'true') throw new ErrorHttp(400, 'Filtro de stock inválido');
        condiciones.push('a.stock_actual - a.stock_comprometido <= a.stock_minimo');
    }
    const where = condiciones.join(' AND ');
    const total = await pool.query(`SELECT COUNT(*) AS total FROM articulo a WHERE ${where}`, valores);
    const r = await pool.query(
        `SELECT ${columnas} FROM articulo a LEFT JOIN categoria_articulo c ON c.id_categoria = a.id_categoria
         WHERE ${where} ORDER BY a.nombre, a.id_articulo LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
        [...valores, limite, offset]
    );
    return { registros: r.rows, total: Number(total.rows[0].total), pagina, limite };
}

async function guardar(datos, idResponsable, idArticulo) {
    const id = idArticulo === undefined ? null : idPositivo(idArticulo);
    const articulo = validar(datos);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let anterior = null;
        if (id !== null) {
            const r = await client.query('SELECT * FROM articulo WHERE id_articulo = $1 FOR UPDATE', [id]);
            anterior = r.rows[0];
            if (!anterior) throw new ErrorHttp(404, 'Artículo no encontrado');
        }
        const valores = [articulo.codigo_interno, articulo.codigo_barras, articulo.nombre,
            articulo.id_categoria, articulo.unidad_medida, articulo.ubicacion_bodega,
            articulo.stock_minimo, articulo.activo, articulo.bodega_sector, articulo.descripcion, articulo.precio_lista];
        // Solo se actualizan los datos editables; se preservan los saldos y el PMP.
        const r = id === null
            ? await client.query(`INSERT INTO articulo
                (codigo_interno, codigo_barras, nombre, id_categoria, unidad_medida, ubicacion_bodega, stock_minimo, activo, bodega_sector, descripcion, precio_lista)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id_articulo`, valores)
            : await client.query(`UPDATE articulo SET codigo_interno=$1, codigo_barras=$2, nombre=$3,
                id_categoria=$4, unidad_medida=$5, ubicacion_bodega=$6, stock_minimo=$7, activo=$8,
                bodega_sector=$9, descripcion=$10,
                fecha_actualizacion_precio=CASE WHEN precio_lista IS DISTINCT FROM $11::numeric THEN now() ELSE fecha_actualizacion_precio END,
                precio_lista=$11
                WHERE id_articulo=$12 RETURNING id_articulo`, [...valores, id]);
        const idGuardado = r.rows[0].id_articulo;
        const resultado = await client.query(`SELECT ${columnas} FROM articulo a
            LEFT JOIN categoria_articulo c ON c.id_categoria = a.id_categoria WHERE a.id_articulo = $1`, [idGuardado]);
        await registrarAuditoria(client, {
            id_usuario: idResponsable, tabla_afectada: 'articulo', id_registro_afectado: idGuardado,
            accion: id === null ? 'CREAR_ARTICULO' : 'EDITAR_ARTICULO',
            valores_anteriores: anterior, valores_nuevos: resultado.rows[0],
        });
        await client.query('COMMIT');
        return resultado.rows[0];
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') throw new ErrorHttp(409, 'El código interno o de barras ya está registrado');
        if (err.code === '23503') throw new ErrorHttp(400, 'La categoría indicada no existe');
        throw err;
    } finally {
        client.release();
    }
}

// Consulta del historial por artículo, sin registrar, modificar ni revertir movimientos.
async function listarCardex(idArticulo, filtros = {}) {
    const id = idPositivo(idArticulo);
    const { pagina, limite, offset } = filtrosListado(filtros);
    const ficha = await pool.query(
        'SELECT id_articulo, codigo_interno, nombre, unidad_medida, activo FROM articulo WHERE id_articulo = $1', [id]
    );
    if (!ficha.rows[0]) throw new ErrorHttp(404, 'Artículo no encontrado');
    const total = await pool.query('SELECT COUNT(*) AS total FROM movimiento_cardex WHERE id_articulo = $1', [id]);
    const r = await pool.query(
        `SELECT m.*, u.nombres, u.apellidos,
            original.tipo_movimiento AS tipo_movimiento_original,
            original.cantidad AS cantidad_original,
            receptor.nombres AS receptor_nombres, receptor.apellidos AS receptor_apellidos
         FROM movimiento_cardex m
         JOIN usuario u ON u.id_usuario = m.id_usuario
         LEFT JOIN recepcion_material recepcion ON recepcion.id_recepcion=m.id_recepcion
         LEFT JOIN usuario receptor ON receptor.id_usuario=recepcion.id_usuario_receptor
         LEFT JOIN movimiento_cardex original ON original.id_movimiento=COALESCE(m.id_movimiento_revertido,m.id_movimiento_origen)
             AND original.id_articulo=m.id_articulo
         WHERE m.id_articulo = $1
         ORDER BY m.fecha_hora DESC, m.id_movimiento DESC LIMIT $2 OFFSET $3`, [id, limite, offset]
    );
    return { articulo: ficha.rows[0], registros: r.rows, total: Number(total.rows[0].total), pagina, limite };
}

// Selector de obras para el borrador de egreso; no modifica obras ni movimientos.
async function listarObras(filtros = {}) {
    const { pagina, limite, patron, offset } = filtrosListado(filtros);
    const where = '(o.nombre_obra ILIKE $1 OR c.razon_social ILIKE $1)';
    const total = await pool.query(`SELECT COUNT(*) AS total FROM obra o JOIN presupuesto p ON p.id_presupuesto=o.id_presupuesto JOIN cliente c ON c.id_cliente=p.id_cliente WHERE ${where}`, [patron]);
    const r = await pool.query(`SELECT o.id_obra, o.nombre_obra, c.razon_social AS cliente
        FROM obra o JOIN presupuesto p ON p.id_presupuesto=o.id_presupuesto JOIN cliente c ON c.id_cliente=p.id_cliente WHERE ${where}
        ORDER BY o.nombre_obra, o.id_obra LIMIT $2 OFFSET $3`, [patron, limite, offset]);
    return { registros: r.rows, total: Number(total.rows[0].total), pagina, limite };
}

async function obtener(idArticulo) {
    const id = idPositivo(idArticulo);
    const r = await pool.query(`SELECT ${columnas} FROM articulo a
        LEFT JOIN categoria_articulo c ON c.id_categoria=a.id_categoria WHERE a.id_articulo=$1`, [id]);
    if (!r.rows[0]) throw new ErrorHttp(404, 'Artículo no encontrado');
    return r.rows[0];
}

module.exports = { listar, obtener, guardar, listarCardex, listarObras };
