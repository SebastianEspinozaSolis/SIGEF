const router = require('express').Router();
const config = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');

// Administrador General y Bodega comparten el flujo completo de artículos.
router.use(autenticar, autorizar(config.roles.ADMIN, config.roles.BODEGA));
router.get('/obras', async (req, res) => res.json(await servicio.listarObras(req.query)));
router.get('/', async (req, res) => res.json(await servicio.listar(req.query)));
router.get('/:id/cardex', async (req, res) => res.json(await servicio.listarCardex(req.params.id, req.query)));
router.get('/:id', async (req, res) => res.json(await servicio.obtener(req.params.id)));
router.post('/', async (req, res) => {
    res.status(201).json(await servicio.guardar(req.body || {}, req.user.id_usuario));
});
router.put('/:id', async (req, res) => {
    res.json(await servicio.guardar(req.body || {}, req.user.id_usuario, req.params.id));
});
module.exports = router;
