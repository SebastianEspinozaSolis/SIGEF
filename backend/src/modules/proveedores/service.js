const pool = require('../../db');
const ErrorHttp = require('../../utils/ErrorHttp');
const { registrarAuditoria } = require('../auditoria/service');
const { texto, idPositivo, filtrosListado, comprobarErrores } = require('../../utils/catalogos');
const { normalizarRut, normalizarTelefono, errorRut, validarEmail } = require('../../utils/validaciones');

// Columnas fijas de la ficha; no se construyen identificadores SQL desde datos del usuario.
const campos = ['rut_proveedor', 'razon_social', 'direccion', 'id_comuna', 'ciudad'];
const camposBancarios = ['banco', 'tipo_cuenta', 'numero_cuenta', 'email_pagos'];

function validar(datos) {
    const errores = {};
    // Igual que usuarios: quita puntos y espacios antes de validar el RUT.
    const ficha = {
        rut_proveedor: texto(normalizarRut(datos.rut_proveedor), 'rut_proveedor', 12, errores),
        razon_social: texto(datos.razon_social, 'razon_social', 150, errores),
        direccion: texto(datos.direccion, 'direccion', 200, errores),
        id_comuna: null,
        ciudad: texto(datos.ciudad, 'ciudad', 100, errores),
        banco: texto(datos.banco, 'banco', 100, errores, false),
        tipo_cuenta: texto(datos.tipo_cuenta, 'tipo_cuenta', 50, errores, false),
        numero_cuenta: texto(datos.numero_cuenta, 'numero_cuenta', 50, errores, false),
        email_pagos: texto(datos.email_pagos, 'email_pagos', 120, errores, false)?.toLowerCase() || null,
    };
    try { ficha.id_comuna = idPositivo(datos.id_comuna); }
    catch { errores.id_comuna = 'Selecciona una comuna del listado'; }
    if (errorRut(ficha.rut_proveedor)) errores.rut_proveedor = errorRut(ficha.rut_proveedor);
    if (ficha.email_pagos && !validarEmail(ficha.email_pagos)) errores.email_pagos = 'Correo para pagos inválido';
    // La ficha bancaria es opcional como conjunto, pero no admite datos parciales.
    if (camposBancarios.some((campo) => ficha[campo] !== null)) {
        for (const campo of camposBancarios) {
            if (!ficha[campo]) errores[campo] = 'Completa este dato de la ficha bancaria';
        }
    }
    // La lista explícita evita borrar contactos por omitir el campo durante una edición.
    if (!Array.isArray(datos.ejecutivos) || datos.ejecutivos.length > 50) {
        errores.ejecutivos = 'Envía una lista de hasta 50 ejecutivos (puede estar vacía)';
    }
    const vistos = new Set();
    const ids = new Set();
    const ejecutivos = (Array.isArray(datos.ejecutivos) ? datos.ejecutivos.slice(0, 50) : []).map((datosEjecutivo, indice) => {
        const prefijo = `ejecutivos.${indice}`;
        const dato = datosEjecutivo && typeof datosEjecutivo === 'object' && !Array.isArray(datosEjecutivo) ? datosEjecutivo : {};
        const ejecutivo = {
            nombre: texto(dato.nombre, `${prefijo}.nombre`, 150, errores),
            rut: texto(normalizarRut(dato.rut), `${prefijo}.rut`, 12, errores),
            cargo: texto(dato.cargo, `${prefijo}.cargo`, 100, errores),
            email: texto(dato.email, `${prefijo}.email`, 120, errores)?.toLowerCase() || '',
            telefono: texto(dato.telefono, `${prefijo}.telefono`, 30, errores),
        };
        ejecutivo.telefono = normalizarTelefono(ejecutivo.telefono);
        if (!ejecutivo.telefono) errores[`${prefijo}.telefono`] = 'Incluye +56 seguido de 9 dígitos. Solo se permiten espacios o guiones como separadores';
        if (errorRut(ejecutivo.rut)) errores[`${prefijo}.rut`] = errorRut(ejecutivo.rut);
        if (!validarEmail(ejecutivo.email)) errores[`${prefijo}.email`] = 'Correo inválido';
        if (vistos.has(ejecutivo.rut)) errores[`${prefijo}.rut`] = 'No repitas el RUT dentro del proveedor';
        vistos.add(ejecutivo.rut);
        if (dato.id_ejecutivo !== undefined) {
            try { ejecutivo.id_ejecutivo = idPositivo(dato.id_ejecutivo); }
            catch { errores[`${prefijo}.nombre`] = 'Identificador de ejecutivo inválido'; }
            if (ids.has(ejecutivo.id_ejecutivo)) errores[`${prefijo}.nombre`] = 'Ejecutivo repetido';
            ids.add(ejecutivo.id_ejecutivo);
        }
        return ejecutivo;
    });
    comprobarErrores(errores);
    return { ficha, ejecutivos };
}

async function listar(filtros, idFicha) {
    const { pagina, limite, patron, offset } = filtrosListado(filtros);
    const where = idFicha === undefined ? 'p.rut_proveedor ILIKE $1 OR p.razon_social ILIKE $1' : 'p.id_proveedor=$1';
    const valor = idFicha === undefined ? patron : idPositivo(idFicha);
    const total = await pool.query(`SELECT COUNT(*) AS total FROM proveedor p WHERE ${where}`, [valor]);
    // Una consulta trae todos los ejecutivos de cada ficha, sin consultas por cada fila.
    const r = await pool.query(`SELECT p.id_proveedor, ${campos.map((c) => `p.${c}`).join(', ')}, co.nombre AS comuna, re.id_region, re.nombre AS region, ${camposBancarios.map((c) => `b.${c}`).join(', ')},
        COALESCE((SELECT json_agg(e ORDER BY e.id_ejecutivo) FROM ejecutivo_comercial e
            WHERE e.id_proveedor=p.id_proveedor), '[]'::json) AS ejecutivos
        FROM proveedor p JOIN comuna co ON co.id_comuna=p.id_comuna JOIN region re ON re.id_region=co.id_region
        LEFT JOIN datos_bancarios_proveedor b ON b.id_proveedor=p.id_proveedor
        WHERE ${where} ORDER BY p.razon_social, p.id_proveedor LIMIT $2 OFFSET $3`, [valor, limite, offset]);
    return { registros: r.rows,
        total: Number(total.rows[0].total), pagina, limite };
}

async function guardar(datos, idResponsable, idFicha) {
    const id = idFicha === undefined ? null : idPositivo(idFicha);
    const { ficha, ejecutivos } = validar(datos);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let anterior = null;
        let anteriores = [];
        if (id !== null) {
            const consulta = await client.query(`SELECT p.id_proveedor, ${campos.map((c) => `p.${c}`).join(', ')}, ${camposBancarios.map((c) => `b.${c}`).join(', ')}
                FROM proveedor p LEFT JOIN datos_bancarios_proveedor b ON b.id_proveedor=p.id_proveedor
                WHERE p.id_proveedor=$1 FOR UPDATE OF p`, [id]);
            anterior = consulta.rows[0];
            if (!anterior) throw new ErrorHttp(404, 'Registro no encontrado');
            anteriores = (await client.query('SELECT * FROM ejecutivo_comercial WHERE id_proveedor=$1 ORDER BY id_ejecutivo', [id])).rows;
            anterior.ejecutivos = anteriores;
        }
        const propios = new Set(anteriores.map((e) => e.id_ejecutivo));
        if (ejecutivos.some((e) => e.id_ejecutivo !== undefined && !propios.has(e.id_ejecutivo))) {
            throw new ErrorHttp(400, 'Un ejecutivo no pertenece a este proveedor');
        }
        const valores = campos.map((campo) => ficha[campo]);
        const r = id === null
            ? await client.query(`INSERT INTO proveedor (${campos.join(', ')}) VALUES (${campos.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id_proveedor, ${campos.join(', ')}`, valores)
            : await client.query(`UPDATE proveedor SET ${campos.map((campo, i) => `${campo}=$${i + 1}`).join(', ')} WHERE id_proveedor=$6 RETURNING id_proveedor, ${campos.join(', ')}`, [...valores, id]);
        const registro = r.rows[0];
        if (ficha.banco !== null) {
            await client.query(`INSERT INTO datos_bancarios_proveedor (id_proveedor,banco,tipo_cuenta,numero_cuenta,email_pagos)
                VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id_proveedor) DO UPDATE
                SET banco=EXCLUDED.banco, tipo_cuenta=EXCLUDED.tipo_cuenta,
                    numero_cuenta=EXCLUDED.numero_cuenta, email_pagos=EXCLUDED.email_pagos`,
            [registro.id_proveedor, ...camposBancarios.map((campo) => ficha[campo])]);
        } else if (id !== null) {
            await client.query('DELETE FROM datos_bancarios_proveedor WHERE id_proveedor=$1', [id]);
        }
        for (const campo of camposBancarios) registro[campo] = ficha[campo];
        const conservados = ejecutivos.filter((e) => e.id_ejecutivo !== undefined).map((e) => e.id_ejecutivo);
        // Retirar un contacto del formulario lo elimina al guardar; la auditoría conserva el anterior.
        if (id !== null) await client.query('DELETE FROM ejecutivo_comercial WHERE id_proveedor=$1 AND NOT (id_ejecutivo = ANY($2::int[]))', [id, conservados]);
        for (const ejecutivo of ejecutivos) {
            const valoresEjecutivo = [ejecutivo.nombre, ejecutivo.rut, ejecutivo.cargo, ejecutivo.email, ejecutivo.telefono, registro.id_proveedor];
            if (ejecutivo.id_ejecutivo === undefined) {
                await client.query('INSERT INTO ejecutivo_comercial (nombre,rut,cargo,email,telefono,id_proveedor) VALUES ($1,$2,$3,$4,$5,$6)', valoresEjecutivo);
            } else {
                await client.query('UPDATE ejecutivo_comercial SET nombre=$1,rut=$2,cargo=$3,email=$4,telefono=$5 WHERE id_proveedor=$6 AND id_ejecutivo=$7', [...valoresEjecutivo, ejecutivo.id_ejecutivo]);
            }
        }
        registro.ejecutivos = (await client.query('SELECT * FROM ejecutivo_comercial WHERE id_proveedor=$1 ORDER BY id_ejecutivo', [registro.id_proveedor])).rows;
        await registrarAuditoria(client, {
            id_usuario: idResponsable, tabla_afectada: 'proveedor', id_registro_afectado: registro.id_proveedor,
            accion: id === null ? 'CREAR_FICHA' : 'EDITAR_FICHA', valores_anteriores: anterior, valores_nuevos: registro,
        });
        await client.query('COMMIT');
        return registro;
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23503' && err.constraint === 'proveedor_id_comuna_fkey') {
            throw new ErrorHttp(400, 'Hay datos inválidos', { id_comuna: 'Selecciona una comuna existente' });
        }
        if (err.code === '23505') throw new ErrorHttp(409, 'El RUT del proveedor o de un ejecutivo ya está registrado en esta ficha');
        throw err;
    } finally { client.release(); }
}

async function obtener(id) {
    const resultado = await listar({}, id);
    if (!resultado.registros.length) throw new ErrorHttp(404, 'Registro no encontrado');
    return resultado.registros[0];
}

module.exports = { listar, obtener, guardar };

