const router = require('express').Router();
const config = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');

router.use(autenticar, autorizar(config.roles.ADMIN, config.roles.SUPERVISOR));

// GET /api/obras/tecnicos: solo identificación de técnicos activos.
router.get('/tecnicos', async (req, res) => {
    res.json(await servicio.listarTecnicos(req.query));
});

// GET /api/obras
router.get('/', async (req, res) => {
    res.json(await servicio.listar(req.query));
});

// GET /api/obras/:id/firma: conformidad de una obra finalizada, solo lectura.
router.get('/:id/firma', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await servicio.obtenerFirma(req.params.id));
});

// GET /api/obras/:id: ficha con egresos netos de reversas.
router.get('/:id', async (req, res) => {
    res.json(await servicio.obtener(req.params.id));
});

// POST /api/obras
router.post('/', async (req, res) => {
    res.status(201).json(await servicio.guardar(req.body || {}, req.user.id_usuario));
});

// PUT /api/obras/:id
router.put('/:id', async (req, res) => {
    res.json(await servicio.guardar(req.body || {}, req.user.id_usuario, req.params.id));
});

// PATCH /api/obras/:id/estado
router.patch('/:id/estado', async (req, res) => {
    res.json(await servicio.cambiarEstado(req.params.id, req.body || {}, req.user.id_usuario));
});

module.exports = router;
