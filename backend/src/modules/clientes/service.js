const pool = require('../../db');
const ErrorHttp = require('../../utils/ErrorHttp');
const { registrarAuditoria } = require('../auditoria/service');
const { texto, idPositivo, filtrosListado, comprobarErrores } = require('../../utils/catalogos');
const { normalizarRut, errorRut } = require('../../utils/validaciones');
const { validarContacto } = require('../../utils/contactos');

const campos = ['rut_cliente', 'razon_social', 'giro', 'direccion', 'id_comuna', 'ciudad'];
// Relaciona cada lista de contactos del JSON con su área en la tabla compartida.
// Permite recorrer ambas áreas usando la misma lógica de validación y guardado.
const areas = [
    { lista: 'contactos_proyecto', area: 'Proyecto' },
    { lista: 'contactos_finanzas', area: 'Finanzas' },
];

// Listado y consulta individual comparten los datos completos de la ficha.
const columnasContactos = areas.map(({ lista, area }) =>
    `COALESCE((SELECT json_agg(p ORDER BY p.id_contacto) FROM contacto_cliente p WHERE p.id_cliente=c.id_cliente AND p.area='${area}'), '[]'::json) AS ${lista}`);
const consultaFicha = `SELECT c.id_cliente, ${campos.map((campo) => `c.${campo}`).join(', ')}, co.nombre AS comuna, re.id_region, re.nombre AS region, ${columnasContactos.join(', ')}
    FROM cliente c JOIN comuna co ON co.id_comuna=c.id_comuna JOIN region re ON re.id_region=co.id_region`;

// Valida la lista de contactos de un área, asegurando que cada contacto tenga nombre, RUT, cargo, correo y teléfono válidos.
// lista identifica el área (ej. 'contactos_proyecto'); errores acumula los problemas
// para que validar() los rechace juntos mediante comprobarErrores().
function validarContactos(datos, lista, errores) {
    // Se permite no registrar contactos, pero debe enviarse [] y no un dato de otro tipo.
    // limita a 3 contactos por área para no saturar la ficha de cliente.
    if (!Array.isArray(datos) || datos.length > 3) {
        errores[lista] = 'Envía una lista de hasta 3 contactos (puede estar vacía)';
        return [];
    }
    // Recuerdan RUT e IDs ya encontrados: los duplicados se revisan solo en esta área.
    const ruts = new Set();
    const ids = new Set();
    // map transforma cada contacto recibido en un objeto con los campos permitidos.
    return datos.map((dato, indice) => {
        // Ejemplo: contactos_proyecto.0.email señala el correo del primer contacto.
        const prefijo = `${lista}.${indice}`;
        // Si llega algo distinto de un objeto, se validan sus campos como vacíos.
        const entrada = dato && typeof dato === 'object' && !Array.isArray(dato) ? dato : {};
        const contacto = validarContacto(entrada, prefijo, errores);
        if (ruts.has(contacto.rut)) errores[`${prefijo}.rut`] = 'No repitas el RUT dentro de la misma área';
        ruts.add(contacto.rut);
        // Un contacto existente lleva ID; uno nuevo no. Aquí se valida y evita repetirlo.
        // La pertenencia de ese ID al cliente se comprueba después, en guardar().
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
    const mensajeRut = errorRut(ficha.rut_cliente);
    if (mensajeRut) errores.rut_cliente = mensajeRut;
    const contactos = Object.fromEntries(areas.map(({ lista }) => [lista, validarContactos(datos[lista], lista, errores)]));
    comprobarErrores(errores);
    return { ficha, contactos };
}

async function listar(filtros) {
    const { pagina, limite, patron, offset } = filtrosListado(filtros);
    const where = 'c.rut_cliente ILIKE $1 OR c.razon_social ILIKE $1';
    const total = await pool.query(`SELECT COUNT(*) AS total FROM cliente c WHERE ${where}`, [patron]);
    const r = await pool.query(`${consultaFicha} WHERE ${where} ORDER BY c.razon_social, c.id_cliente LIMIT $2 OFFSET $3`, [patron, limite, offset]);
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
            if(anterior.rut_cliente!==ficha.rut_cliente || anterior.razon_social!==ficha.razon_social) {
                const facturado=await client.query("SELECT d.id_documento FROM documento_tributario d JOIN obra o USING(id_obra) JOIN presupuesto p ON p.id_presupuesto=o.id_presupuesto WHERE p.id_cliente=$1 AND d.id_proveedor IS NULL AND d.tipo_documento='factura' LIMIT 1",[id]);
                if(facturado.rows.length)throw new ErrorHttp(409,'El RUT y la razón social respaldan facturas confirmadas y no pueden cambiarse');
            }
        }
        // Primero comprueba todas las referencias para no modificar contactos de otra empresa o área.
        for (const { lista, area } of areas) {
            const anteriores = id === null ? [] : (await client.query('SELECT * FROM contacto_cliente WHERE id_cliente=$1 AND area=$2 ORDER BY id_contacto', [id, area])).rows;
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
        for (const { lista, area } of areas) {
            const conservados = contactos[lista].filter((c) => c.id_contacto !== undefined).map((c) => c.id_contacto);
            if (id !== null) await client.query('DELETE FROM contacto_cliente WHERE id_cliente=$1 AND NOT (id_contacto = ANY($2::int[])) AND area=$3', [id, conservados, area]);
            for (const contacto of contactos[lista]) {
                const valoresContacto = [contacto.nombre, contacto.rut, contacto.cargo, contacto.email, contacto.telefono, registro.id_cliente];
                if (contacto.id_contacto === undefined) {
                    await client.query('INSERT INTO contacto_cliente (nombre,rut,cargo,email,telefono,id_cliente,area) VALUES ($1,$2,$3,$4,$5,$6,$7)', [...valoresContacto, area]);
                } else {
                    await client.query('UPDATE contacto_cliente SET nombre=$1,rut=$2,cargo=$3,email=$4,telefono=$5 WHERE id_cliente=$6 AND id_contacto=$7 AND area=$8', [...valoresContacto, contacto.id_contacto, area]);
                }
            }
            registro[lista] = (await client.query('SELECT * FROM contacto_cliente WHERE id_cliente=$1 AND area=$2 ORDER BY id_contacto', [registro.id_cliente, area])).rows;
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
    const resultado = await pool.query(`${consultaFicha} WHERE c.id_cliente=$1`, [idPositivo(id)]);
    if (!resultado.rows.length) throw new ErrorHttp(404, 'Registro no encontrado');
    return resultado.rows[0];
}

module.exports = { listar, obtener, guardar };

