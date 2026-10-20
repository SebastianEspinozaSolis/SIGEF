// Logica de usuarios: validaciones, hashing y consultas a PostgreSQL
const bcrypt = require('bcryptjs');
const pool = require('../../db');
const ErrorHttp = require('../../utils/ErrorHttp');
const { registrarAuditoria } = require('../auditoria/service');
const { limpiarTexto, normalizarRut, validarRut, validarEmail, validarNombre, validarPassword } = require('../../utils/validaciones');

// Lista usuarios sin devolver hashes de contraseñas
async function listarUsuarios() {
    const r = await pool.query(
        `SELECT u.id_usuario, u.rut, u.nombres, u.apellidos, u.email, u.estado, r.nombre_rol AS rol
        FROM usuario u
        JOIN rol r ON r.id_rol = u.id_rol
        ORDER BY u.id_usuario`
    );
    return r.rows;
}

// Normaliza y valida los datos antes de crear el usuario
async function crearUsuario(datos, idResponsable) {
    const rut = normalizarRut(datos.rut);
    const nombres = limpiarTexto(datos.nombres);
    const apellidos = limpiarTexto(datos.apellidos);
    const email = limpiarTexto(datos.email).toLowerCase();
    const password = datos.password;
    const id_rol = Number(datos.id_rol);

    // Se juntan todos los errores para mostrarlos de una vez, campo por campo
    const errores = {};
    if (!validarRut(rut)) errores.rut = 'RUT inválido (ej: 12345678-5)';
    if (!validarNombre(nombres)) errores.nombres = 'Mínimo 2 letras, sin números ni símbolos';
    if (!validarNombre(apellidos)) errores.apellidos = 'Mínimo 2 letras, sin números ni símbolos';
    if (!validarEmail(email)) errores.email = 'Correo inválido (ej: nombre@empresa.cl)';
    if (!validarPassword(password)) errores.password = 'Mínimo 8 caracteres, con al menos una letra y un número';
    if (!Number.isInteger(id_rol) || id_rol <= 0) errores.id_rol = 'Selecciona un rol';

    if (Object.keys(errores).length > 0) {
        throw new ErrorHttp(400, 'Hay datos inválidos', errores);
    }

    const hash = await bcrypt.hash(password, 10);

    // Una misma conexion guarda el usuario y su auditoria: se confirman ambos o ninguno
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const r = await client.query(
            `INSERT INTO usuario (rut, nombres, apellidos, email, password_hash, id_rol)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id_usuario, rut, nombres, apellidos, email, id_rol, estado`,
            [rut, nombres, apellidos, email, hash, id_rol]
        );
        const usuario = r.rows[0];
        await registrarAuditoria(client, {
            id_usuario: idResponsable,
            tabla_afectada: 'usuario',
            id_registro_afectado: usuario.id_usuario,
            accion: 'CREAR_USUARIO',
            valores_nuevos: usuario,
        });
        await client.query('COMMIT');
        return usuario;
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') {
            throw new ErrorHttp(409, 'El RUT o el correo ya están registrados');
        }
        if (err.code === '23503') {
            throw new ErrorHttp(400, 'El rol indicado no existe');
        }
        throw err;
    } finally {
        client.release();
    }
}

// Valida el estado e impide desactivar la cuenta del propio responsable
async function cambiarEstado(idUsuario, estado, idResponsable) {
    const id = Number(idUsuario);
    if (!Number.isSafeInteger(id) || id <= 0 || !['Activo', 'Inactivo'].includes(estado)) {
        throw new ErrorHttp(400, 'Usuario o estado inválido');
    }
    // Evita que el administrador pierda su propio acceso por accidente.
    if (id === idResponsable && estado === 'Inactivo') {
        throw new ErrorHttp(400, 'No puedes desactivar tu propia cuenta');
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Bloquea la fila hasta terminar para registrar el estado anterior real
        const anterior = await client.query('SELECT estado FROM usuario WHERE id_usuario = $1 FOR UPDATE', [id]);
        if (!anterior.rows[0]) throw new ErrorHttp(404, 'Usuario no encontrado');
        // Repetir el mismo estado no genera un evento de cambio
        if (anterior.rows[0].estado === estado) {
            await client.query('COMMIT');
            return { id_usuario: id, estado };
        }
        const r = await client.query(
            'UPDATE usuario SET estado = $1 WHERE id_usuario = $2 RETURNING id_usuario, estado',
            [estado, id]
        );
        await registrarAuditoria(client, {
            id_usuario: idResponsable,
            tabla_afectada: 'usuario',
            id_registro_afectado: id,
            accion: 'CAMBIAR_ESTADO',
            valores_anteriores: { estado: anterior.rows[0].estado },
            valores_nuevos: { estado },
        });
        await client.query('COMMIT');
        return r.rows[0];
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { listarUsuarios, crearUsuario, cambiarEstado };
