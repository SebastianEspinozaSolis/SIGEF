const router = require('express').Router();
const config = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');

router.use(autenticar, autorizar(config.roles.ADMIN, config.roles.SUPERVISOR));

// GET /api/tareas-servicio
router.get('/', async (req, res) => {
    res.json(await servicio.listar(req.query));
});

// GET /api/tareas-servicio/:id
router.get('/:id', async (req, res) => {
    res.json(await servicio.obtener(req.params.id));
});

// POST /api/tareas-servicio
router.post('/', async (req, res) => {
    res.status(201).json(await servicio.guardar(req.body || {}, req.user.id_usuario));
});

// PUT /api/tareas-servicio/:id
router.put('/:id', async (req, res) => {
    res.json(await servicio.guardar(req.body || {}, req.user.id_usuario, req.params.id));
});

module.exports = router;
