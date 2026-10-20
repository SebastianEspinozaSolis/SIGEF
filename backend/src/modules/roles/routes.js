const router = require('express').Router();
const config = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');

// GET /api/roles: solo el administrador consulta los roles para crear usuarios
router.get('/', autenticar, autorizar(config.roles.ADMIN), async (req, res) => {
    const roles = await servicio.listarRoles();
    res.json(roles);
});

module.exports = router;
