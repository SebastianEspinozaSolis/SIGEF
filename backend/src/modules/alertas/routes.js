const router = require('express').Router();
const { roles } = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');

// El servicio restringe cada tipo: stock, vencimientos o gestión de obras y presupuestos.
router.use(autenticar, autorizar(roles.ADMIN, roles.ADMINISTRACION, roles.BODEGA, roles.SUPERVISOR));

// GET /api/alertas/:tipo
router.get('/:tipo', async (req, res) => {
    const alertas = await servicio.listar(req.params.tipo, req.user.rol, req.query);
    res.json(alertas);
});

module.exports = router;
