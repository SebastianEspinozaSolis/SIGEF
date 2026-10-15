const router = require('express').Router();
const pool = require('../db');
const config = require('../config');
const { autenticar, autorizar } = require('../middlewares/auth');

// GET /api/roles
// Traer los roles disponibles
router.get('/', autenticar, autorizar(config.roles.ADMIN), async (req, res) => {
    const r = await pool.query('SELECT id_rol, nombre_rol FROM rol ORDER BY id_rol');
    res.json(r.rows);
});

// Permitir que se pueda acceder en otras partes
module.exports = router;