const router = require('express').Router();
const config = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');

router.use(autenticar, autorizar(config.roles.ADMIN, config.roles.ADMINISTRACION));

// GET /api/pagos-documento/:id: historial y saldo calculado del documento.
router.get('/:id', async (req, res) => {
    res.json(await servicio.listar(req.params.id, req.query));
});

// POST /api/pagos-documento/:id: registra un abono sin sobrescribir los anteriores.
router.post('/:id', async (req, res) => {
    res.status(201).json(await servicio.registrar(req.params.id, req.body || {}, req.user.id_usuario));
});

module.exports = router;
