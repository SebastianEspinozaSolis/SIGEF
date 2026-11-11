const router = require('express').Router();
const config = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');

// El conteo y sus diferencias están disponibles para Bodega y Administrador General.
router.use(autenticar, autorizar(config.roles.BODEGA, config.roles.ADMIN));
// Selector propio del conteo: no concede acceso al mantenimiento de artículos.
router.get('/articulos', async (req, res) => res.json(await servicio.listarArticulos(req.query)));
router.get('/', async (req, res) => res.json(await servicio.listar(req.query)));
router.post('/', async (req, res) => {
    res.status(201).json(await servicio.crear(req.user.id_usuario));
});
router.get('/:id', async (req, res) => res.json(await servicio.obtener(req.params.id)));
router.put('/:id/articulos/:idArticulo', async (req, res) => {
    res.json(await servicio.guardarConteo(req.params.id, req.params.idArticulo, req.body || {}, req.user.id_usuario));
});
router.patch('/:id/finalizar', async (req, res) => {
    res.json(await servicio.finalizar(req.params.id, req.user.id_usuario));
});

module.exports = router;
