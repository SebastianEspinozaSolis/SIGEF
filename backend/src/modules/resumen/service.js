const pool = require('../../db');
const ErrorHttp = require('../../utils/ErrorHttp');
const { filtrosListado } = require('../../utils/catalogos');

async function obtener(filtros = {}, exportar = false) {
    const hoy = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Santiago' }).format(new Date());
    const mes = filtros.mes ?? hoy.slice(0, 7);
    if (typeof mes !== 'string' || !/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new ErrorHttp(400, 'Selecciona un mes válido');
    const { pagina, limite, offset } = filtrosListado({ pagina: filtros.pagina, limite: 20 });
    // Una sola lectura mantiene coherentes tarjetas, gráficos y tablas.
    const r = await pool.query(`WITH
        fechas AS (SELECT $1::date AS inicio, ($1::date + interval '1 month') AS fin,
            (SELECT (actualizado_en AT TIME ZONE 'America/Santiago')::date FROM mv_resumen_control) AS hoy),
        periodo AS (SELECT m.* FROM mv_resumen_movimientos m CROSS JOIN fechas f WHERE m.mes=f.inicio),
        compras AS (SELECT m.mes,m.compras_netas AS importe FROM mv_resumen_movimientos m CROSS JOIN fechas f
            WHERE m.mes>=f.inicio-interval '5 months' AND m.mes<f.fin),
        presupuestos AS (SELECT p.estado,p.cantidad FROM mv_resumen_presupuestos p CROSS JOIN fechas f WHERE p.mes=f.inicio),
        obras_estado AS (SELECT estado,SUM(cantidad)::int AS cantidad FROM mv_resumen_obras GROUP BY estado),
        criticos AS (SELECT * FROM mv_resumen_stock),
        deudas AS (SELECT * FROM mv_resumen_documentos),
        por_vencer AS (SELECT d.* FROM deudas d CROSS JOIN fechas f
            WHERE d.tipo_documento='factura' AND d.saldo>0 AND d.fecha_vencimiento BETWEEN f.hoy AND f.hoy+7),
        materiales AS (SELECT p.id_articulo,p.codigo_interno,p.nombre,p.unidad_medida,p.tipo_efectivo AS tipo,
            SUM(p.cantidad)::text AS cantidad,SUM(p.registros)::int AS registros
            FROM periodo p GROUP BY p.id_articulo,p.codigo_interno,p.nombre,p.unidad_medida,p.tipo_efectivo)
        -- No construye ni transfiere el informe si supera el limite de filas.
        SELECT CASE WHEN $4::boolean AND (
            (SELECT COUNT(*) FROM materiales) + (SELECT COUNT(*) FROM criticos)
            + (SELECT COUNT(*) FROM por_vencer) > 10000
        ) THEN NULL ELSE json_build_object(
            'actualizado_en',(SELECT actualizado_en FROM mv_resumen_control),
            'disponible_en',(SELECT actualizado_en+interval '5 minutes' FROM mv_resumen_control),
            'espera_segundos',(SELECT GREATEST(0,CEIL(EXTRACT(EPOCH FROM actualizado_en+interval '5 minutes'-clock_timestamp())))::int FROM mv_resumen_control),
            'indicadores',json_build_object(
                'compras_mes',COALESCE((SELECT SUM(c.importe) FROM compras c CROSS JOIN fechas f WHERE c.mes>=f.inicio),0)::text,
                'presupuestos_aprobados',COALESCE((SELECT cantidad FROM presupuestos WHERE estado='Aprobado'),0),
                'presupuestos_pendientes',COALESCE((SELECT cantidad FROM presupuestos WHERE estado='Pendiente'),0),
                'cuentas_por_pagar',COALESCE((SELECT SUM(saldo) FROM deudas WHERE saldo>0),0)::text,
                'facturas_por_vencer',(SELECT COUNT(*)::int FROM por_vencer),
                'facturas_vencidas',(SELECT COUNT(*)::int FROM deudas d CROSS JOIN fechas f WHERE d.tipo_documento='factura' AND saldo>0 AND fecha_vencimiento<f.hoy),
                'stock_critico',(SELECT COUNT(*)::int FROM criticos),
                'obras_en_proceso',COALESCE((SELECT cantidad FROM obras_estado WHERE estado='En proceso'),0),
                'servicios_realizados',COALESCE((SELECT SUM(o.cantidad)::int FROM mv_resumen_obras o CROSS JOIN fechas f
                    WHERE o.estado='Finalizada' AND o.mes_cierre>=f.inicio AND o.mes_cierre<f.fin),0)),
            'compras_por_mes',COALESCE((SELECT json_agg(x ORDER BY x.mes) FROM (
                SELECT to_char(s.mes,'YYYY-MM') AS mes,COALESCE(SUM(c.importe),0)::text AS total
                FROM fechas f CROSS JOIN LATERAL generate_series(f.inicio-interval '5 months',f.inicio,interval '1 month') s(mes)
                LEFT JOIN compras c ON c.mes=s.mes
                GROUP BY s.mes) x),'[]'::json),
            'presupuestos',COALESCE((SELECT json_agg(p ORDER BY p.estado) FROM presupuestos p),'[]'::json),
            'obras',COALESCE((SELECT json_agg(o ORDER BY o.estado) FROM obras_estado o),'[]'::json),
            'movimientos',COALESCE((SELECT json_agg(x ORDER BY x.tipo) FROM (
                SELECT tipo_movimiento AS tipo,SUM(registros)::int AS cantidad FROM periodo GROUP BY tipo_movimiento) x),'[]'::json),
            'stock_critico',COALESCE((SELECT json_agg(x) FROM (
                SELECT id_articulo,codigo_interno,nombre,unidad_medida,disponible,minimo
                FROM criticos ORDER BY diferencia,id_articulo ${exportar ? '' : 'LIMIT 10'}) x),'[]'::json),
            'vencimientos',COALESCE((SELECT json_agg(x) FROM (
                SELECT id_documento,id_proveedor,folio,razon_social,fecha_vencimiento,saldo::text AS saldo
                FROM por_vencer ORDER BY fecha_vencimiento,id_documento ${exportar ? '' : 'LIMIT 10'}) x),'[]'::json),
            'materiales',json_build_object('total',(SELECT COUNT(*)::int FROM materiales),
                'registros',COALESCE((SELECT json_agg(x) FROM (
                    SELECT * FROM materiales ORDER BY nombre,id_articulo,tipo LIMIT $2 OFFSET $3) x),'[]'::json))
        ) END AS resultado`, [`${mes}-01`, exportar ? null : limite, exportar ? 0 : offset, exportar]).catch(errorVistas);
    const datos = r.rows[0].resultado;
    if (exportar && datos === null) throw new ErrorHttp(413, 'El informe supera el límite de 10.000 filas para una descarga');
    return { ...datos, mes,
        indicadores: { ...datos.indicadores, ventas_mes: null, cuentas_por_cobrar: null },
        materiales: { ...datos.materiales, pagina, limite } };
}

function errorVistas(err) {
    if (err.code === '42P01' || err.code === '55000') throw new ErrorHttp(503, 'Las vistas del resumen no estan instaladas o inicializadas. Ejecuta crearVistasResumen.js desde backend.');
    throw err;
}

async function actualizar() {
    const client = await pool.connect();
    let bloqueo = false, transaccion = false;
    try {
        // El bloqueo de sesion se toma antes de abrir la instantanea del refresco.
        const r = await client.query('SELECT pg_try_advisory_lock(75273, 1) AS adquirido');
        bloqueo = r.rows[0].adquirido;
        if (!bloqueo) throw new ErrorHttp(409, 'El resumen ya se esta actualizando. Intenta consultarlo en unos momentos.');
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
        transaccion = true;
        await client.query("SET LOCAL statement_timeout = '60s'");
        const estado = await client.query(`SELECT actualizado_en, actualizado_en+interval '5 minutes' AS disponible_en,
            clock_timestamp() >= actualizado_en+interval '5 minutes' AS permitido FROM mv_resumen_control`);
        if (!estado.rows[0].permitido) {
            await client.query('COMMIT');
            transaccion = false;
            return { ...estado.rows[0], actualizado: false };
        }
        // Los indices unicos permiten mantener disponible la version anterior.
        for (const vista of ['movimientos', 'documentos', 'stock', 'presupuestos', 'obras', 'control']) {
            await client.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_resumen_${vista}`);
        }
        const nuevo = await client.query(`SELECT actualizado_en, actualizado_en+interval '5 minutes' AS disponible_en
            FROM mv_resumen_control`);
        await client.query('COMMIT');
        transaccion = false;
        return { ...nuevo.rows[0], actualizado: true };
    } catch (err) {
        if (transaccion) await client.query('ROLLBACK');
        errorVistas(err);
    } finally {
        let errorLiberacion;
        if (bloqueo) {
            try { await client.query('SELECT pg_advisory_unlock(75273, 1)'); }
            catch (err) { errorLiberacion = err; }
        }
        // Si no se pudo desbloquear, pg descarta la conexion y su bloqueo de sesion.
        client.release(errorLiberacion);
    }
}

module.exports = { obtener, actualizar };
