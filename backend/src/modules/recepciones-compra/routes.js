const router = require('express').Router();
const config = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');

// Todas las rutas de recepciones de compra requieren autenticación y autorización de Bodega o Administrador General
router.use(autenticar, autorizar(config.roles.ADMIN, config.roles.BODEGA));

// GET /api/recepciones-compra
router.get('/', async (req, res) => {
    const compras = await servicio.listar(req.query);
    res.json(compras);
});

// GET /api/recepciones-compra/articulos/:id/pendientes
router.get('/articulos/:id/pendientes', async (req, res) => {
    const pendientes = await servicio.pendientesArticulo(req.params.id, req.query);
    res.json(pendientes);
});

// GET /api/recepciones-compra/:id
router.get('/:id', async (req, res) => {
    const documento = await servicio.obtener(req.params.id);
    res.json(documento);
});

// POST /api/recepciones-compra/:id
router.post('/:id', async (req, res) => {
    const recepcion = await servicio.recibir(req.params.id, req.body || {}, req.user.id_usuario);
    res.json(recepcion);
});

module.exports = router;
