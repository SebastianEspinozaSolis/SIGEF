const pool = require('../../db');
const ErrorHttp = require('../../utils/ErrorHttp');
const { registrarAuditoria } = require('../auditoria/service');
const { texto, idPositivo, filtrosListado, comprobarErrores } = require('../../utils/catalogos');
const { normalizarRut, normalizarTelefono, errorRut, validarEmail } = require('../../utils/validaciones');

const campos = ['rut_cliente', 'razon_social', 'giro', 'direccion', 'id_comuna', 'ciudad'];
// Los nombres de tabla son constantes internas, nunca datos de la petición.
const areas = [
    { lista: 'contactos_proyecto', tabla: 'contacto_proyecto' },
    { lista: 'contactos_finanzas', tabla: 'contacto_finanzas' },
];

function validarContactos(datos, lista, errores) {
    if (!Array.isArray(datos) || datos.length > 50) {
        errores[lista] = 'Envía una lista de hasta 50 contactos (puede estar vacía)';
        return [];
    }
    const ruts = new Set();
    const ids = new Set();
    return datos.map((dato, indice) => {
        const prefijo = `${lista}.${indice}`;
        const entrada = dato && typeof dato === 'object' && !Array.isArray(dato) ? dato : {};
        const contacto = {
            nombre: texto(entrada.nombre, `${prefijo}.nombre`, 150, errores),
            rut: texto(normalizarRut(entrada.rut), `${prefijo}.rut`, 12, errores),
            cargo: texto(entrada.cargo, `${prefijo}.cargo`, 100, errores),
            email: texto(entrada.email, `${prefijo}.email`, 120, errores)?.toLowerCase() || '',
            telefono: texto(entrada.telefono, `${prefijo}.telefono`, 30, errores),
        };
        contacto.telefono = normalizarTelefono(contacto.telefono);
        if (!contacto.telefono) errores[`${prefijo}.telefono`] = 'Incluye +56 seguido de 9 dígitos. Solo se permiten espacios o guiones como separadores';
        if (errorRut(contacto.rut)) errores[`${prefijo}.rut`] = errorRut(contacto.rut);
        if (!validarEmail(contacto.email)) errores[`${prefijo}.email`] = 'Correo inválido';
        if (ruts.has(contacto.rut)) errores[`${prefijo}.rut`] = 'No repitas el RUT dentro de la misma área';
        ruts.add(contacto.rut);
        if (entrada.id_contacto !== undefined) {
            try { contacto.id_contacto = idPositivo(entrada.id_contacto); }
            catch { errores[`${prefijo}.nombre`] = 'Identificador de contacto inválido'; }
            if (ids.has(contacto.id_contacto)) errores[`${prefijo}.nombre`] = 'Contacto repetido';
            ids.add(contacto.id_contacto);
        }
        return contacto;
    });
}

function validar(datos) {
    const errores = {};
    // Igual que usuarios: quita puntos y espacios antes de validar el RUT.
    const ficha = {
        rut_cliente: texto(normalizarRut(datos.rut_cliente), 'rut_cliente', 12, errores),
        razon_social: texto(datos.razon_social, 'razon_social', 150, errores),
        giro: texto(datos.giro, 'giro', 150, errores),
        direccion: texto(datos.direccion, 'direccion', 200, errores),
        id_comuna: null,
        ciudad: texto(datos.ciudad, 'ciudad', 100, errores),
    };
    try { ficha.id_comuna = idPositivo(datos.id_comuna); }
    catch { errores.id_comuna = 'Selecciona una comuna del listado'; }
    if (errorRut(ficha.rut_cliente)) errores.rut_cliente = errorRut(ficha.rut_cliente);
    const contactos = Object.fromEntries(areas.map(({ lista }) => [lista, validarContactos(datos[lista], lista, errores)]));
    comprobarErrores(errores);
    return { ficha, contactos };
}

async function listar(filtros, idFicha) {
    const { pagina, limite, patron, offset } = filtrosListado(filtros);
    const where = idFicha === undefined ? 'c.rut_cliente ILIKE $1 OR c.razon_social ILIKE $1' : 'c.id_cliente=$1';
    const valor = idFicha === undefined ? patron : idPositivo(idFicha);
    const total = await pool.query(`SELECT COUNT(*) AS total FROM cliente c WHERE ${where}`, [valor]);
    const columnasContactos = areas.map(({ lista, tabla }) =>
        `COALESCE((SELECT json_agg(p ORDER BY p.id_contacto) FROM ${tabla} p WHERE p.id_cliente=c.id_cliente), '[]'::json) AS ${lista}`);
    const r = await pool.query(`SELECT c.id_cliente, ${campos.map((campo) => `c.${campo}`).join(', ')}, co.nombre AS comuna, re.id_region, re.nombre AS region, ${columnasContactos.join(', ')}
        FROM cliente c JOIN comuna co ON co.id_comuna=c.id_comuna JOIN region re ON re.id_region=co.id_region WHERE ${where} ORDER BY c.razon_social, c.id_cliente LIMIT $2 OFFSET $3`, [valor, limite, offset]);
    return { registros: r.rows,
        total: Number(total.rows[0].total), pagina, limite };
}

async function guardar(datos, idResponsable, idFicha) {
    const id = idFicha === undefined ? null : idPositivo(idFicha);
    const { ficha, contactos } = validar(datos);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let anterior = null;
        if (id !== null) {
            const consulta = await client.query(`SELECT id_cliente, ${campos.join(', ')} FROM cliente WHERE id_cliente=$1 FOR UPDATE`, [id]);
            anterior = consulta.rows[0];
            if (!anterior) throw new ErrorHttp(404, 'Registro no encontrado');
        }
        // Primero comprueba todas las referencias para no modificar contactos de otra empresa o área.
        for (const { lista, tabla } of areas) {
            const anteriores = id === null ? [] : (await client.query(`SELECT * FROM ${tabla} WHERE id_cliente=$1 ORDER BY id_contacto`, [id])).rows;
            if (anterior) anterior[lista] = anteriores;
            const propios = new Set(anteriores.map((c) => c.id_contacto));
            if (contactos[lista].some((c) => c.id_contacto !== undefined && !propios.has(c.id_contacto))) {
                throw new ErrorHttp(400, 'Un contacto no pertenece a este cliente o área');
            }
        }
        const valores = campos.map((campo) => ficha[campo]);
        const r = id === null
            ? await client.query(`INSERT INTO cliente (${campos.join(', ')}) VALUES (${campos.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id_cliente, ${campos.join(', ')}`, valores)
            : await client.query(`UPDATE cliente SET ${campos.map((campo, i) => `${campo}=$${i + 1}`).join(', ')} WHERE id_cliente=$7 RETURNING id_cliente, ${campos.join(', ')}`, [...valores, id]);
        const registro = r.rows[0];
        for (const { lista, tabla } of areas) {
            const conservados = contactos[lista].filter((c) => c.id_contacto !== undefined).map((c) => c.id_contacto);
            if (id !== null) await client.query(`DELETE FROM ${tabla} WHERE id_cliente=$1 AND NOT (id_contacto = ANY($2::int[]))`, [id, conservados]);
            for (const contacto of contactos[lista]) {
                const valoresContacto = [contacto.nombre, contacto.rut, contacto.cargo, contacto.email, contacto.telefono, registro.id_cliente];
                if (contacto.id_contacto === undefined) {
                    await client.query(`INSERT INTO ${tabla} (nombre,rut,cargo,email,telefono,id_cliente) VALUES ($1,$2,$3,$4,$5,$6)`, valoresContacto);
                } else {
                    await client.query(`UPDATE ${tabla} SET nombre=$1,rut=$2,cargo=$3,email=$4,telefono=$5 WHERE id_cliente=$6 AND id_contacto=$7`, [...valoresContacto, contacto.id_contacto]);
                }
            }
            registro[lista] = (await client.query(`SELECT * FROM ${tabla} WHERE id_cliente=$1 ORDER BY id_contacto`, [registro.id_cliente])).rows;
        }
        await registrarAuditoria(client, {
            id_usuario: idResponsable, tabla_afectada: 'cliente', id_registro_afectado: registro.id_cliente,
            accion: id === null ? 'CREAR_FICHA' : 'EDITAR_FICHA', valores_anteriores: anterior, valores_nuevos: registro,
        });
        await client.query('COMMIT');
        return registro;
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23503' && err.constraint === 'cliente_id_comuna_fkey') {
            throw new ErrorHttp(400, 'Hay datos inválidos', { id_comuna: 'Selecciona una comuna existente' });
        }
        if (err.code === '23505') throw new ErrorHttp(409, 'El RUT del cliente o de un contacto ya está registrado en esta área');
        throw err;
    } finally { client.release(); }
}

async function obtener(id) {
    const resultado = await listar({}, id);
    if (!resultado.registros.length) throw new ErrorHttp(404, 'Registro no encontrado');
    return resultado.registros[0];
}

module.exports = { listar, obtener, guardar };

