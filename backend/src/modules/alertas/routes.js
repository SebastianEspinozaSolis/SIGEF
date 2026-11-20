const router = require('express').Router();
const { roles } = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');

// Las alertas de stock estaran para todos los roles, pero las de vencimiento de documentos solo para Administrador General y Administración.
router.use(autenticar, autorizar(roles.ADMIN, roles.ADMINISTRACION, roles.BODEGA));

// GET /api/alertas/:tipo
router.get('/:tipo', async (req, res) => {
    const alertas = await servicio.listar(req.params.tipo, req.user.rol, req.query);
    res.json(alertas);
});

module.exports = router;
