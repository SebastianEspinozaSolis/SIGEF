// Pool de conexiones a PostgreSQL: permite ejecutar consultas o reservar una conexión.
const pool = require('../../db');
// Error esperado con código HTTP y mensaje que recibirá el frontend.
const ErrorHttp = require('../../utils/ErrorHttp');
// Guarda quién hizo el cambio y cuáles eran los valores anteriores y nuevos.
const { registrarAuditoria } = require('../auditoria/service');
// Validaciones y filtros compartidos con los otros catálogos.
const { texto, idPositivo, filtrosListado, comprobarErrores } = require('../../utils/catalogos');


// Prepara y valida los datos antes de consultar o modificar la base de datos.
function validar(datos) {
    // Los problemas de cada campo se acumulan en este objeto.
    const errores = {};
    const ficha = {
        // Limpia el nombre, exige un máximo de 80 caracteres y lo hace obligatorio (true).
        nombre_categoria: texto(datos.nombre_categoria, 'nombre_categoria', 80, errores, true),
    };

    // Si hay errores, lanza un ErrorHttp 400; si no, devuelve la ficha validada.
    comprobarErrores(errores);
    return ficha;
}

// Devuelve una página de categorías y el total que coincide con la búsqueda.
// async permite usar await para esperar cada respuesta de PostgreSQL.
async function listar(filtros) {
    // Por defecto: página 1 y límite 20. El patrón rodea la búsqueda con %.
    // offset = (pagina - 1) * limite: indica cuántas filas saltar.
    const { pagina, limite, patron, offset } = filtrosListado(filtros);
    // WHERE filtra filas. ILIKE compara texto sin distinguir mayúsculas de minúsculas.
    // Ejemplo: el patrón '%tubo%' encuentra 'Tubos PVC' y 'TUBO COBRE'.
    // $1 es un parámetro: PostgreSQL recibe el valor aparte, sin insertarlo en el SQL.
    const where = 'nombre_categoria ILIKE $1';
    // COUNT(*) cuenta TODAS las coincidencias, antes de limitar la página.
    // AS total da un nombre al resultado. Aquí solo se concatena SQL fijo, no datos del usuario.
    const total = await pool.query('SELECT COUNT(*) AS total FROM categoria_articulo WHERE ' + where, [patron]);
    // SELECT elige columnas; FROM indica la tabla; ORDER BY ordena por nombre y luego id.
    // LIMIT limita cuántas filas devolver y OFFSET indica cuántas saltar.
    // Ejemplo: página 2 con límite 20 usa LIMIT 20 OFFSET 20 (filas 21 a 40, si existen).
    const r = await pool.query(
        'SELECT id_categoria, nombre_categoria FROM categoria_articulo WHERE ' + where + ' ORDER BY nombre_categoria, id_categoria LIMIT $2 OFFSET $3',
        // Los valores corresponden, en orden, a $1, $2 y $3 de la consulta.
        [patron, limite, offset]
    );
    // rows contiene las filas obtenidas. COUNT llega como texto y Number lo convierte.
    return { registros: r.rows, total: Number(total.rows[0].total), pagina, limite };
}

// El bloqueo conserva la ficha anterior real para auditar una edición concurrente.
// Sin idFicha crea una categoría; con idFicha modifica esa categoría.
// idResponsable es el usuario autenticado que entrega routes.js para la auditoría.
async function guardar(datos, idResponsable, idFicha) {
    // El operador condición ? valorA : valorB elige según se cumpla la condición.
    // null representa una creación; para editar se exige un identificador válido y positivo.
    const id = idFicha === undefined ? null : idPositivo(idFicha);
    const ficha = validar(datos);
    // Reserva UNA conexión: todos los pasos de la transacción deben usar el mismo client.
    const client = await pool.connect();
    try {
        // BEGIN inicia la transacción: categoría y auditoría se confirman o deshacen juntas.
        await client.query('BEGIN');
        // Al crear no hay valores anteriores; al editar se recuperan desde PostgreSQL.
        let anterior = null;
        if (id !== null) {
            // FOR UPDATE bloquea esta fila hasta COMMIT o ROLLBACK.
            // Otra transacción que quiera modificarla debe esperar: así auditamos su estado real.
            const consulta = await client.query('SELECT id_categoria, nombre_categoria FROM categoria_articulo WHERE id_categoria = $1 FOR UPDATE', [id]);
            // rows[0] es la primera fila; si no existe, no hay categoría con ese id.
            anterior = consulta.rows[0];
            if (!anterior) throw new ErrorHttp(404, 'Registro no encontrado');
        }
        const valores = [ficha.nombre_categoria];
        // INSERT crea; UPDATE modifica solo la fila indicada por WHERE.
        // RETURNING devuelve las columnas guardadas sin necesitar otro SELECT.
        // [...valores, id] copia el arreglo y añade el id: [nombre_categoria, id].
        const r = id === null
            ? await client.query('INSERT INTO categoria_articulo (nombre_categoria) VALUES ($1) RETURNING id_categoria, nombre_categoria', valores)
            : await client.query('UPDATE categoria_articulo SET nombre_categoria = $1 WHERE id_categoria = $2 RETURNING id_categoria, nombre_categoria', [...valores, id]);
        const registro = r.rows[0];
        // Usa la misma conexión para incluir la auditoría dentro de la transacción.
        // Registra responsable, tabla, id, acción y valores antes/después del cambio.
        await registrarAuditoria(client, {
            id_usuario: idResponsable, tabla_afectada: 'categoria_articulo',
            id_registro_afectado: registro.id_categoria,
            accion: id === null ? 'CREAR_FICHA' : 'EDITAR_FICHA',
            valores_anteriores: anterior, valores_nuevos: registro,
        });
        // COMMIT confirma y guarda tanto la categoría como su auditoría.
        await client.query('COMMIT');
        return registro;
    } catch (err) {
        // Si algún paso falla, ROLLBACK deshace los cambios pendientes de esta transacción.
        // Por ejemplo: si falla la auditoría, tampoco se guarda la categoría.
        await client.query('ROLLBACK');
        // 23505 es el código de PostgreSQL para un valor duplicado en un campo único.
        // Se traduce a un error HTTP 409 (conflicto) con un mensaje comprensible.
        if (err.code === '23505') throw new ErrorHttp(409, 'La categoría ya existe');
        // Los demás errores se propagan para que los gestione el manejo de errores del backend.
        throw err;
    } finally {
        // finally se ejecuta tanto al tener éxito como al fallar.
        // Devuelve la conexión al pool para que otras operaciones puedan reutilizarla.
        client.release();
    }
}

// routes.js importa estas funciones para atender las solicitudes HTTP.
module.exports = { listar, guardar };
