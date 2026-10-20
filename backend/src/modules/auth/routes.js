// Rutas HTTP: reciben la peticion, aplican seguridad y envian la respuesta
const router = require('express').Router();
const { autenticar } = require('../../middlewares/auth');
const servicio = require('./service');

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const resultado = await servicio.login(req.body || {});
    res.json(resultado);
});

// GET /api/auth/me: requiere una cuenta activa y un token valido
router.get('/me', autenticar, async (req, res) => {
    const usuario = await servicio.obtenerUsuario(req.user.id_usuario);
    res.json(usuario);
});

// PATCH /api/auth/password: el id sale del token, no del formulario
router.patch('/password', autenticar, async (req, res) => {
    const resultado = await servicio.cambiarPassword(req.user.id_usuario, req.body || {});
    res.json(resultado);
});

module.exports = router;
