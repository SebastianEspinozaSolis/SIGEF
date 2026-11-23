const router = require('express').Router();
const config = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');

router.use(autenticar, autorizar(config.roles.ADMIN, config.roles.SUPERVISOR));

// GET /api/presupuestos/clientes: selector de clientes para la cotización.
router.get('/clientes', async (req, res) => {
    res.json(await servicio.listarClientes(req.query));
});

// GET /api/presupuestos
router.get('/', async (req, res) => {
    res.json(await servicio.listar(req.query));
});

// GET /api/presupuestos/:id
router.get('/:id', async (req, res) => {
    res.json(await servicio.obtener(req.params.id));
});

// POST /api/presupuestos
router.post('/', async (req, res) => {
    res.status(201).json(await servicio.guardar(req.body || {}, req.user.id_usuario));
});

// PUT /api/presupuestos/:id: reemplaza los datos editables mientras esté Pendiente.
router.put('/:id', async (req, res) => {
    res.json(await servicio.guardar(req.body || {}, req.user.id_usuario, req.params.id));
});

// PATCH /api/presupuestos/:id/estado
router.patch('/:id/estado', async (req, res) => {
    res.json(await servicio.cambiarEstado(req.params.id, req.body || {}, req.user.id_usuario));
});

module.exports = router;
