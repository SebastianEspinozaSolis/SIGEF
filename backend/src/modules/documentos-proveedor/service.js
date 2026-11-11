const pool = require('../../db');
const ErrorHttp = require('../../utils/ErrorHttp');
const { texto, idPositivo, filtrosListado, comprobarErrores } = require('../../utils/catalogos');
const { registrarAuditoria } = require('../auditoria/service');

const tipos = ['factura', 'boleta', 'guia_despacho', 'nota_credito'];
function decimal(valor, campo, enteros, decimales, errores, maximo) {
    if (!['string', 'number'].includes(typeof valor) || !new RegExp(`^\\d{1,${enteros}}(\\.\\d{1,${decimales}})?$`).test(String(valor))
        || (maximo !== undefined && Number(valor) > maximo)) errores[campo] = 'Ingresa un valor no negativo válido';
    return String(valor);
}
function fecha(valor, campo, errores) {
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)
        || !Number.isFinite(Date.parse(`${valor}T00:00:00Z`))
        || new Date(`${valor}T00:00:00Z`).toISOString().slice(0, 10) !== valor) errores[campo] = 'Fecha inválida';
    return valor;
}
function validar(datos) {
    const errores = {};
    const cabecera = {
        tipo_documento: datos.tipo_documento,
        folio: texto(datos.folio, 'folio', 30, errores),
        fecha_emision: fecha(datos.fecha_emision, 'fecha_emision', errores),
        fecha_vencimiento: datos.fecha_vencimiento == null || datos.fecha_vencimiento === ''
            ? null : fecha(datos.fecha_vencimiento, 'fecha_vencimiento', errores),
        observaciones: texto(datos.observaciones, 'observaciones', 5000, errores, false),
    };
    if (cabecera.tipo_documento === 'factura' && !cabecera.fecha_vencimiento) errores.fecha_vencimiento = 'La fecha de vencimiento es obligatoria para facturas';
    if (!errores.fecha_emision && !errores.fecha_vencimiento && cabecera.fecha_vencimiento
        && cabecera.fecha_vencimiento < cabecera.fecha_emision) errores.fecha_vencimiento = 'No puede ser anterior a la fecha de emisión';
    if (!tipos.includes(cabecera.tipo_documento)) errores.tipo_documento = 'Selecciona un tipo de documento';
    for (const campo of ['descuento_general', 'descuento_pronto_pago', 'tasa_iva']) {
        cabecera[campo] = decimal(datos[campo] ?? (campo === 'tasa_iva' ? 19 : 0), campo, 3, 2, errores, 100);
    }
    if (datos.id_documento_referencia) {
        try { cabecera.id_documento_referencia = idPositivo(datos.id_documento_referencia); }
        catch { errores.id_documento_referencia = 'Referencia inválida'; }
    } else cabecera.id_documento_referencia = null;
    if (cabecera.tipo_documento === 'nota_credito' && !cabecera.id_documento_referencia) errores.id_documento_referencia = 'Selecciona el documento original';
    if (cabecera.tipo_documento !== 'nota_credito' && cabecera.id_documento_referencia) errores.id_documento_referencia = 'La referencia se utiliza para notas de crédito';
    if (!Array.isArray(datos.detalles) || !datos.detalles.length || datos.detalles.length > 100) errores.detalles = 'Agrega entre 1 y 100 materiales';
    const detalles = (Array.isArray(datos.detalles) ? datos.detalles.slice(0, 100) : []).map((entrada, i) => {
        const d = entrada && typeof entrada === 'object' ? entrada : {};
        const prefijo = `detalles.${i}`;
        const linea = { observaciones: texto(d.observaciones, `${prefijo}.observaciones`, 2000, errores, false) };
        try { linea.id_articulo = idPositivo(d.id_articulo); } catch { errores[`${prefijo}.id_articulo`] = 'Selecciona un artículo'; }
        linea.cantidad = decimal(d.cantidad, `${prefijo}.cantidad`, 9, 3, errores);
        if (Number(d.cantidad) <= 0) errores[`${prefijo}.cantidad`] = 'La cantidad debe ser positiva';
        linea.costo_neto = decimal(d.costo_neto, `${prefijo}.costo_neto`, 10, 4, errores);
        // El precio lo determina el catálogo o la copia de una línea guardada.
        if (d.id_detalle_documento !== undefined) {
            try { linea.id_detalle_documento = idPositivo(d.id_detalle_documento); }
            catch { errores[`${prefijo}.id_detalle_documento`] = 'Línea inválida'; }
        }
        for (const campo of ['descuento_1', 'descuento_2', 'descuento_3']) linea[campo] = decimal(d[campo] ?? 0, `${prefijo}.${campo}`, 3, 2, errores, 100);
        return linea;
    });
    comprobarErrores(errores);
    return { cabecera, detalles };
}

// Cálculo exacto con enteros: importes en centésimos, redondeo por línea y etapa.
function escala(valor, precision) {
    const [entero, fraccion = ''] = String(valor).split('.');
    return BigInt(entero) * 10n ** BigInt(precision) + BigInt(fraccion.padEnd(precision, '0'));
}
function redondear(n, d) { return (n + d / 2n) / d; }
function importe(n) { return `${n / 100n}.${String(n % 100n).padStart(2, '0')}`; }
function calcular(cabecera, detalles) {
    let subtotal = 0n, netoLineas = 0n;
    for (const d of detalles) {
        const base = escala(d.cantidad, 3) * escala(d.costo_neto, 4);
        subtotal += redondear(base, 100000n);
        const factor = ['descuento_1', 'descuento_2', 'descuento_3'].reduce((acum, campo) => acum * (10000n - escala(d[campo], 2)), 1n);
        netoLineas += redondear(base * factor, 100000n * 10000n ** 3n);
    }
    const general = redondear(netoLineas * (10000n - escala(cabecera.descuento_general, 2)), 10000n);
    const neto = redondear(general * (10000n - escala(cabecera.descuento_pronto_pago, 2)), 10000n);
    const iva = redondear(neto * escala(cabecera.tasa_iva, 2), 10000n);
    if ([subtotal, neto, iva, neto + iva].some((n) => n > 99999999999999n)) throw new ErrorHttp(400, 'El importe supera el máximo admitido');
    return { subtotal: importe(subtotal), descuento_productos: importe(subtotal - netoLineas),
        neto_productos: importe(netoLineas), importe_descuento_general: importe(netoLineas - general),
        importe_descuento_pronto_pago: importe(general - neto),
        total_neto: importe(neto), iva: importe(iva), total: importe(neto + iva) };
}
async function obtenerCon(conexion, idProveedor, idDocumento) {
    const r = await conexion.query(`SELECT d.*, p.rut_proveedor, p.razon_social,
        EXISTS (SELECT 1 FROM movimiento_cardex m JOIN detalle_documento l USING(id_detalle_documento)
            WHERE l.id_documento=d.id_documento AND m.tipo_movimiento='INGRESO') AS tiene_recepciones,
        COALESCE((SELECT json_agg(fila ORDER BY fila.id_detalle_documento) FROM (
            SELECT l.*, a.nombre AS articulo, a.unidad_medida FROM detalle_documento l JOIN articulo a USING(id_articulo)
            WHERE l.id_documento=d.id_documento) fila), '[]'::json) AS detalles
        FROM documento_tributario d JOIN proveedor p USING(id_proveedor)
        WHERE d.id_documento=$1 AND d.id_proveedor=$2`, [idDocumento, idProveedor]);
    if (!r.rows[0]) throw new ErrorHttp(404, 'Documento no encontrado para este proveedor');
    return { ...r.rows[0], ...calcular(r.rows[0], r.rows[0].detalles) };
}
async function obtener(proveedor, documento) { return obtenerCon(pool, idPositivo(proveedor), idPositivo(documento)); }
async function listar(proveedor, filtros = {}) {
    const id = idPositivo(proveedor);
    const { pagina, limite, offset } = filtrosListado(filtros);
    const total = await pool.query('SELECT COUNT(*) AS total FROM documento_tributario WHERE id_proveedor=$1', [id]);
    const r = await pool.query(`SELECT d.*, COALESCE((SELECT json_agg(l) FROM detalle_documento l
        WHERE l.id_documento=d.id_documento), '[]'::json) AS detalles
        FROM documento_tributario d WHERE d.id_proveedor=$1 ORDER BY d.fecha_ingreso DESC,d.id_documento DESC LIMIT $2 OFFSET $3`, [id, limite, offset]);
    // Los importes se reconstruyen con el mismo redondeo usado al validar el registro.
    const registros = r.rows.map(d => {
        const { detalles, ...cabecera } = d;
        return { ...cabecera, ...calcular(cabecera, detalles) };
    });
    return { registros, total: Number(total.rows[0].total), pagina, limite };
}
async function articulos(filtros = {}) {
    const { pagina, limite, offset, patron } = filtrosListado(filtros);
    const where = 'activo=true AND (nombre ILIKE $1 OR codigo_interno ILIKE $1)';
    const total = await pool.query(`SELECT COUNT(*) AS total FROM articulo WHERE ${where}`, [patron]);
    const r = await pool.query(`SELECT id_articulo,codigo_interno,nombre,unidad_medida,precio_lista FROM articulo WHERE ${where} ORDER BY nombre,id_articulo LIMIT $2 OFFSET $3`, [patron, limite, offset]);
    return { registros: r.rows, total: Number(total.rows[0].total), pagina, limite };
}
async function guardar(proveedor, datos, responsable, documento) {
    const idProveedor = idPositivo(proveedor);
    const id = documento === undefined ? null : idPositivo(documento);
    const { cabecera, detalles } = validar(datos);
    calcular(cabecera, detalles); // Valida los límites sin guardar importes derivados.
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const p = await client.query('SELECT id_proveedor FROM proveedor WHERE id_proveedor=$1', [idProveedor]);
        if (!p.rows.length) throw new ErrorHttp(404, 'Proveedor no encontrado');
        let anterior = null;
        if (id !== null) {
            await client.query('SELECT id_documento FROM documento_tributario WHERE id_documento=$1 AND id_proveedor=$2 FOR UPDATE', [id, idProveedor]);
            anterior = await obtenerCon(client, idProveedor, id);
            // El bloqueo del documento también serializa las recepciones de Bodega.
            if (anterior.tiene_recepciones) {
                const protegidos = ['tipo_documento','id_documento_referencia','descuento_general','descuento_pronto_pago','tasa_iva'];
                const cabeceraIgual = protegidos.every(campo => ['tipo_documento','id_documento_referencia'].includes(campo)
                    ? (cabecera[campo] ?? null) === (anterior[campo] ?? null)
                    : escala(cabecera[campo],2) === escala(anterior[campo],2));
                const ids = new Set(detalles.map(d => d.id_detalle_documento));
                const lineasIguales = detalles.length === anterior.detalles.length && ids.size === detalles.length && detalles.every(d => {
                    const previa = anterior.detalles.find(l => l.id_detalle_documento === d.id_detalle_documento);
                    return previa && d.id_articulo === previa.id_articulo && d.observaciones === (previa.observaciones || null)
                        && ['cantidad','costo_neto','descuento_1','descuento_2','descuento_3'].every(campo =>
                            escala(d[campo],campo === 'cantidad' ? 3 : campo === 'costo_neto' ? 4 : 2)
                            === escala(previa[campo],campo === 'cantidad' ? 3 : campo === 'costo_neto' ? 4 : 2));
                });
                if (!cabeceraIgual || !lineasIguales) throw new ErrorHttp(409, 'El documento tiene recepciones: solo puedes editar número, fechas de emisión y vencimiento y observaciones');
            }
        }
        if (cabecera.id_documento_referencia) {
            if (cabecera.id_documento_referencia === id) throw new ErrorHttp(400, 'Un documento no puede referenciarse a sí mismo');
            const ref = await client.query("SELECT id_documento FROM documento_tributario WHERE id_documento=$1 AND id_proveedor=$2 AND tipo_documento <> 'nota_credito'", [cabecera.id_documento_referencia, idProveedor]);
            if (!ref.rows.length) throw new ErrorHttp(400, 'El documento original debe pertenecer al mismo proveedor');
        }
        const repetido = await client.query('SELECT id_documento FROM documento_tributario WHERE id_proveedor=$1 AND tipo_documento=$2 AND folio=$3 AND ($4::int IS NULL OR id_documento<>$4)', [idProveedor, cabecera.tipo_documento, cabecera.folio, id]);
        if (repetido.rows.length) throw new ErrorHttp(409, 'Ya existe ese documento del proveedor');
        if (!anterior?.tiene_recepciones) {
            // SHARE mantiene estable la unidad y el estado mientras se guardan las líneas.
            const catalogo = await client.query('SELECT id_articulo,unidad_medida,activo,precio_lista FROM articulo WHERE id_articulo=ANY($1::int[]) FOR SHARE', [detalles.map((d) => d.id_articulo)]);
            detalles.forEach((d, i) => {
                const a = catalogo.rows.find((a) => a.id_articulo === d.id_articulo);
                if (!a || !a.activo) throw new ErrorHttp(400, 'Hay datos inválidos', { [`detalles.${i}.id_articulo`]: 'Selecciona un artículo activo' });
                if (d.id_detalle_documento !== undefined) {
                    const previa = anterior?.detalles.find((l) => l.id_detalle_documento === d.id_detalle_documento && l.id_articulo === d.id_articulo);
                    if (!previa) throw new ErrorHttp(400, 'La línea no pertenece a este documento y artículo');
                    d.precio_lista = String(previa.precio_lista);
                } else d.precio_lista = String(a.precio_lista);
                if (a.unidad_medida === 'UN' && !Number.isInteger(Number(d.cantidad))) throw new ErrorHttp(400, 'Hay datos inválidos', { [`detalles.${i}.cantidad`]: 'Este artículo se registra en unidades enteras' });
            });
        }
        const campos = ['tipo_documento','folio','fecha_emision','fecha_vencimiento','observaciones','id_documento_referencia','descuento_general','descuento_pronto_pago','tasa_iva'];
        const valores = campos.map((c) => cabecera[c]);
        const r = id === null
            ? await client.query(`INSERT INTO documento_tributario (${campos.join(',')},id_proveedor) VALUES (${valores.map((_,i) => '$'+(i+1)).join(',')},$10) RETURNING id_documento`, [...valores,idProveedor])
            : await client.query(`UPDATE documento_tributario SET ${campos.map((c,i) => c+'=$'+(i+1)).join(',')} WHERE id_documento=$10 AND id_proveedor=$11 RETURNING id_documento`, [...valores,id,idProveedor]);
        const guardado = r.rows[0].id_documento;
        if (!anterior?.tiene_recepciones) {
            if (id !== null) await client.query('DELETE FROM detalle_documento WHERE id_documento=$1', [id]);
            for (const d of detalles) await client.query(`INSERT INTO detalle_documento
                (id_documento,id_articulo,cantidad,costo_neto,precio_lista,descuento_1,descuento_2,descuento_3,observaciones)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [guardado,d.id_articulo,d.cantidad,d.costo_neto,d.precio_lista,d.descuento_1,d.descuento_2,d.descuento_3,d.observaciones]);
        }
        const resultado = await obtenerCon(client, idProveedor, guardado);
        await registrarAuditoria(client, { id_usuario: responsable, tabla_afectada: 'documento_tributario', id_registro_afectado: guardado,
            accion: id === null ? 'REGISTRAR_DOCUMENTO' : 'EDITAR_DOCUMENTO', valores_anteriores: anterior, valores_nuevos: resultado });
        await client.query('COMMIT');
        return resultado;
    } catch(e) {
        await client.query('ROLLBACK');
        if (e.code === '23505') throw new ErrorHttp(409, 'Documento duplicado');
        if (e.code === '23503') throw new ErrorHttp(400, 'Una referencia ya no existe');
        throw e;
    } finally { client.release(); }
}
module.exports = { listar, obtener, articulos, guardar, validar, calcular };
