const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const config = require('../config');
const { autenticar, autorizar } = require('../middlewares/auth');
const {limpiarTexto, normalizarRut, validarRut, validarEmail, validarNombre, validarPassword,} = require('../utils/validaciones');

// Todo este archivo es solo para el Administrador General
router.use(autenticar, autorizar(config.roles.ADMIN));

// GET /api/usuarios
// Trae todos los usuarios con rol, estado y datos basicos
router.get('/', async (req, res) => {
    const r = await pool.query(
        `SELECT u.id_usuario, u.rut, u.nombres, u.apellidos, u.email, u.estado, r.nombre_rol AS rol
        FROM usuario u
        JOIN rol r ON r.id_rol = u.id_rol
        ORDER BY u.id_usuario`
    );
    res.json(r.rows);
});

// POST /api/usuarios
// Crea usuario y verifica que no tenga errores
router.post('/', async (req, res) => {
    const b = req.body || {};
    const rut = normalizarRut(b.rut);
    const nombres = limpiarTexto(b.nombres);
    const apellidos = limpiarTexto(b.apellidos);
    const email = limpiarTexto(b.email).toLowerCase();
    const password = b.password;
    const id_rol = Number(b.id_rol);

    // Se juntan todos los errores para mostrarlos de una vez, campo por campo
    const errores = {};
    if (!validarRut(rut)) errores.rut = 'RUT inválido (ej: 12345678-5)';
    if (!validarNombre(nombres)) errores.nombres = 'Mínimo 2 letras, sin números ni símbolos';
    if (!validarNombre(apellidos)) errores.apellidos = 'Mínimo 2 letras, sin números ni símbolos';
    if (!validarEmail(email)) errores.email = 'Correo inválido (ej: nombre@empresa.cl)';
    if (!validarPassword(password)) errores.password = 'De 8 a 72 caracteres, con al menos una letra y un número';
    if (!Number.isInteger(id_rol) || id_rol <= 0) errores.id_rol = 'Selecciona un rol';

    if (Object.keys(errores).length > 0) {
        return res.status(400).json({ mensaje: 'Hay datos inválidos', errores });
    }

    const hash = await bcrypt.hash(password, 10);

    try {
        const r = await pool.query(
            `INSERT INTO usuario (rut, nombres, apellidos, email, password_hash, id_rol)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id_usuario, rut, nombres, apellidos, email, id_rol, estado`,
            [rut, nombres, apellidos, email, hash, id_rol]
        );
        res.status(201).json(r.rows[0]);
    } catch (err) {
    if (err.code === '23505') {
        return res.status(409).json({ mensaje: 'El RUT o el correo ya están registrados' });
    }
    if (err.code === '23503') {
        return res.status(400).json({ mensaje: 'El rol indicado no existe' });
    }
    throw err;
    }
});

// Encapsula para usarlo en otras rutas
module.exports = router;