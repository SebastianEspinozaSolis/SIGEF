const router = require('express').Router();
const config = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');

// Todas las rutas de movimientos requieren autenticación y autorización de Bodega o Administrador General
router.use(autenticar, autorizar(config.roles.ADMIN, config.roles.BODEGA));

// GET /api/movimientos/receptores
router.get('/receptores', async (req, res) => {
    const receptores = await servicio.receptores(req.query);
    res.json(receptores);
});

// GET /api/movimientos/:idArticulo/referencias
router.get('/:idArticulo/referencias', async (req, res) => {
    const referencias = await servicio.referencias(req.params.idArticulo, req.query);
    res.json(referencias);
});

// POST /api/movimientos/:idArticulo
router.post('/:idArticulo', async (req, res) => {
    const movimiento = await servicio.registrar(req.params.idArticulo, req.body || {}, req.user.id_usuario);
    res.json(movimiento);
});

module.exports = router;
