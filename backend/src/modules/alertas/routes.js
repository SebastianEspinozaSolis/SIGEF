const router = require('express').Router();
const { roles } = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');

router.use(autenticar, autorizar(roles.ADMIN, roles.ADMINISTRACION, roles.BODEGA));
router.get('/:tipo', async (req, res) => res.json(await servicio.listar(req.params.tipo, req.user.rol, req.query)));

module.exports = router;
