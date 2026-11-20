const router = require('express').Router();
const config = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');

// Administrador General y Bodega comparten el flujo completo de artículos.
router.use(autenticar, autorizar(config.roles.ADMIN, config.roles.BODEGA));

// GET /api/articulos/obras
router.get('/obras', async (req, res) => {
    const obras = await servicio.listarObras(req.query);
    res.json(obras);
});

// GET /api/articulos
router.get('/', async (req, res) => {
    const articulos = await servicio.listar(req.query);
    res.json(articulos);
});

// GET /api/articulos/:id/cardex
router.get('/:id/cardex', async (req, res) => {
    const movimientos = await servicio.listarCardex(req.params.id, req.query);
    res.json(movimientos);
});

// GET /api/articulos/:id
router.get('/:id', async (req, res) => {
    const articulo = await servicio.obtener(req.params.id);
    res.json(articulo);
});

// POST /api/articulos
router.post('/', async (req, res) => {
    const articulo = await servicio.guardar(req.body || {}, req.user.id_usuario);
    res.status(201).json(articulo);
});

// PUT /api/articulos/:id
router.put('/:id', async (req, res) => {
    const articulo = await servicio.guardar(req.body || {}, req.user.id_usuario, req.params.id);
    res.json(articulo);
});

module.exports = router;
