//recepcion de peticiones, contraseña, tokens y verificacion de permisos
const router = require('express').Router(); //Crear router para centralizar rutas
const bcrypt = require('bcryptjs'); //hash de contraseñas
const jwt = require('jsonwebtoken');//generacion y validacion de token
const pool = require('../db');//base de datos
const config = require('../config');//configuraciones del sistema
const { autenticar } = require('../middlewares/auth');//funcion para verificar token

// POST /api/auth/login
// Recibe email y password, valida y devuelve token
router.post('/login', async (req, res) => {
    const { email, password } = req.body || {};
    // Valida que se envíen email y password
    if (!email || !password) {
        return res.status(400).json({ mensaje: 'Email y contraseña son obligatorios' });
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
        return res.status(401).json({ mensaje: 'Credenciales inválidas' });
    }

    // Genera token con el id y rol, expira en 7 dias 
    const token = jwt.sign(
        { id_usuario: usuario.id_usuario, rol: usuario.nombre_rol },
        config.jwtSecret,
        { algorithm: 'HS256', expiresIn: '7d' }
    );

    // Devuelve token y datos del usuario
    res.json({
        token,
        usuario: {
            id_usuario: usuario.id_usuario,
            nombres: usuario.nombres,
            apellidos: usuario.apellidos,
            rol: usuario.nombre_rol,
        },
    });
});

// GET /api/auth/me  (ruta protegida)
// Comprobar token y devuelve datos del usuario logueado
router.get('/me', autenticar, async (req, res) => {
    const r = await pool.query(
        `SELECT u.id_usuario, u.nombres, u.apellidos, u.email, r.nombre_rol AS rol
        FROM usuario u
        JOIN rol r ON r.id_rol = u.id_rol
        WHERE u.id_usuario = $1`,
        [req.user.id_usuario]
    );
    res.json(r.rows[0]);
});

// Encapsula la autenticacion y verificacion para usarla en resto de rutas
module.exports = router;