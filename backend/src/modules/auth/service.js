// Logica de autenticacion. Recibe datos y devuelve resultados, sin req ni res
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../db');
const config = require('../../config');
const { validarPassword, validarEmail } = require('../../utils/validaciones');
const ErrorHttp = require('../../utils/ErrorHttp');
const { registrarAuditoria } = require('../auditoria/service');

// Valida credenciales y genera el token de una semana
async function login(datos) {
    const { email, password } = datos;
    // Valida que se envíen email y password
    if (typeof email !== 'string' || !validarEmail(email.trim()) ||
        typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 72) {
        throw new ErrorHttp(400, 'Email y contraseña son obligatorios');
    }

    // Busca usuario por email y trae su rol
    const r = await pool.query(
        `SELECT u.id_usuario, u.nombres, u.apellidos, u.password_hash, u.estado, r.nombre_rol
        FROM usuario u
        JOIN rol r ON r.id_rol = u.id_rol
        WHERE u.email = $1`,
        [String(email).trim().toLowerCase()]
    );
    const usuario = r.rows[0];

    // Valida que exista, este activo o clave correcta
    const valido =
        usuario &&
        usuario.estado === 'Activo' &&
        (await bcrypt.compare(password, usuario.password_hash));

    // De lo contrario devuelve mismo error para no dar pistas
    if (!valido) {
        throw new ErrorHttp(401, 'Credenciales inválidas');
    }

    // Genera token con el id y rol, expira en 7 dias 
    const token = jwt.sign(
        { id_usuario: usuario.id_usuario, rol: usuario.nombre_rol },
        config.jwtSecret,
        { algorithm: 'HS256', expiresIn: '7d' }
    );

    // Devuelve token y datos del usuario
    return {
        token,
        usuario: {
            id_usuario: usuario.id_usuario,
            nombres: usuario.nombres,
            apellidos: usuario.apellidos,
            rol: usuario.nombre_rol,
        },
    };
}

// Obtiene los datos del usuario identificado por el token
async function obtenerUsuario(idUsuario) {
    const r = await pool.query(
        `SELECT u.id_usuario, u.nombres, u.apellidos, u.email, r.nombre_rol AS rol
        FROM usuario u
        JOIN rol r ON r.id_rol = u.id_rol
        WHERE u.id_usuario = $1`,
        [idUsuario]
    );
    return r.rows[0];
}

// Cambia solamente la contraseña del usuario autenticado
async function cambiarPassword(idUsuario, datos) {
    // Recibe la contraseña actual, la nueva y su confirmacion desde el formulario
    // La ruta entrega un objeto vacio si no se envio un cuerpo
    const { passwordActual, passwordNueva, confirmacion } = datos;

    // Comprueba que la actual sea texto, no este vacia y no supere 72 bytes
    // byteLength cuenta bytes: una tilde o emoji puede ocupar mas de uno
    // validarPassword comprueba las reglas de la nueva: minimo 8 caracteres,
    // una letra, un numero y maximo 72 bytes, que es el limite de bcrypt
    if (typeof passwordActual !== 'string' || !passwordActual ||
        Buffer.byteLength(passwordActual, 'utf8') > 72 || !validarPassword(passwordNueva)) {
        throw new ErrorHttp(400, 'Revisa la contraseña actual. La nueva debe tener mínimo 8 caracteres, una letra, un número.');
    }
    // Evita guardar una contraseña escrita por error al exigir que se repita igual
    if (passwordNueva !== confirmacion) {
        throw new ErrorHttp(400, 'La confirmación no coincide');
    }
    // Busca el hash del usuario identificado por el token, no por un id del formulario
    // Asi cada usuario solo puede cambiar su propia contraseña
    // $1 recibe el id como parametro separado del SQL
    const r = await pool.query('SELECT password_hash FROM usuario WHERE id_usuario = $1', [idUsuario]);
    // rows[0] es el usuario encontrado. ?. devuelve undefined si no existe
    const anterior = r.rows[0]?.password_hash;

    // Compara la contraseña actual con el hash guardado, sin descifrarlo
    // Si no hay hash o la contraseña no coincide, detiene el cambio
    if (!anterior || !(await bcrypt.compare(passwordActual, anterior))) {
        throw new ErrorHttp(400, 'La contraseña actual es incorrecta');
    }
    // Comprueba que la nueva no sea la misma que ya usa el usuario
    if (await bcrypt.compare(passwordNueva, anterior)) {
        throw new ErrorHttp(400, 'La nueva contraseña debe ser diferente de la actual');
    }
    // Genera el nuevo hash con una sal aleatoria incluida por bcrypt
    // 10 es el factor de costo del calculo. Solo el hash se guarda en la base
    const hash = await bcrypt.hash(passwordNueva, 10);

    // Actualiza solo si la cuenta sigue activa y conserva el hash que acabamos de leer
    // Evita sobrescribir otro cambio de contraseña ocurrido mientras se procesaba este
    // RETURNING devuelve el id del usuario actualizado
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const actualizado = await client.query(
            `UPDATE usuario SET password_hash = $1
            WHERE id_usuario = $2 AND password_hash = $3 AND estado = 'Activo' RETURNING id_usuario`,
            [hash, idUsuario, anterior]
        );
        // rowCount indica cuantas filas se actualizaron. Si es cero, hubo un cambio
        // en la cuenta y se devuelve 409 (conflicto) para que el usuario vuelva a intentarlo
        if (!actualizado.rowCount) throw new ErrorHttp(409, 'La cuenta cambió. Vuelve a iniciar sesión e inténtalo nuevamente.');
        // Solo registra que cambio la contraseña: nunca la contraseña ni su hash
        await registrarAuditoria(client, {
            id_usuario: idUsuario,
            tabla_afectada: 'usuario',
            id_registro_afectado: idUsuario,
            accion: 'CAMBIAR_PASSWORD',
        });
        await client.query('COMMIT');
        // Confirma el cambio sin devolver contraseñas ni hashes al frontend
        return { mensaje: 'Contraseña actualizada' };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { login, obtenerUsuario, cambiarPassword };
