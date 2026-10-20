const router = require('express').Router();
const config = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');

// Todas las rutas de gestion de usuarios son solo para Administrador General
router.use(autenticar, autorizar(config.roles.ADMIN));

// GET /api/usuarios
router.get('/', async (req, res) => {
    const usuarios = await servicio.listarUsuarios();
    res.json(usuarios);
});

// POST /api/usuarios
router.post('/', async (req, res) => {
    const usuario = await servicio.crearUsuario(req.body || {}, req.user.id_usuario);
    res.status(201).json(usuario);
});

// PATCH /api/usuarios/:id/estado
router.patch('/:id/estado', async (req, res) => {
    const usuario = await servicio.cambiarEstado(
        req.params.id, req.body?.estado, req.user.id_usuario
    );
    res.json(usuario);
});

module.exports = router;
