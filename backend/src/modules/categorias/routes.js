const router = require('express').Router();
const config = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');

// Administrador General y Bodega 
router.use(autenticar, autorizar(config.roles.ADMIN, config.roles.BODEGA));

// Lista categorias con busqueda, guarda una nueva o edita existente.

// GET /api/categorias
router.get('/', async (req, res) => {
    const categorias = await servicio.listar(req.query);
    res.json(categorias);
});

// POST /api/categorias
router.post('/', async (req, res) => {
    const categoria = await servicio.guardar(req.body || {}, req.user.id_usuario);
    res.status(201).json(categoria);
});

// PUT /api/categorias/:id
router.put('/:id', async (req, res) => {
    const categoria = await servicio.guardar(req.body || {}, req.user.id_usuario, req.params.id);
    res.json(categoria);
});

module.exports = router;
