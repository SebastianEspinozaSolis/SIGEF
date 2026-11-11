const router = require('express').Router();
const config = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');

router.use(autenticar);
// Categorías acompaña la gestión de Bodega; Administración no accede al catálogo.
router.get('/', autorizar(config.roles.ADMIN, config.roles.BODEGA),
    async (req, res) => res.json(await servicio.listar(req.query)));
// La creación y edición siguen reservadas a Administrador General y Bodega.
router.use(autorizar(config.roles.ADMIN, config.roles.BODEGA));
router.post('/', async (req, res) => {
    res.status(201).json(await servicio.guardar(req.body || {}, req.user.id_usuario));
});
router.put('/:id', async (req, res) => {
    res.json(await servicio.guardar(req.body || {}, req.user.id_usuario, req.params.id));
});
module.exports = router;
