const router = require('express').Router();
const config = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');
const { listarRegiones, listarComunas } = require('../../utils/ubicaciones');

// Solo Administrador General y Administración pueden consultar, crear y editar clientes.
router.use(autenticar, autorizar(config.roles.ADMIN, config.roles.ADMINISTRACION));

// obtiene regiones y comuna para el selector
// lista clientes, obtiene uno en especifico, crea uno o edita uno existente

// GET /api/clientes/regiones
router.get('/regiones', async (req, res) => {
    const regiones = await listarRegiones();
    res.json(regiones);
});

// GET /api/clientes/comunas
router.get('/comunas', async (req, res) => {
    const comunas = await listarComunas(req.query.id_region);
    res.json(comunas);
});

// GET /api/clientes
router.get('/', async (req, res) => {
    const clientes = await servicio.listar(req.query);
    res.json(clientes);
});

// GET /api/clientes/:id
router.get('/:id', async (req, res) => {
    const cliente = await servicio.obtener(req.params.id);
    res.json(cliente);
});

// POST /api/clientes
router.post('/', async (req, res) => {
    const cliente = await servicio.guardar(req.body || {}, req.user.id_usuario);
    res.status(201).json(cliente);
});

// PUT /api/clientes/:id
router.put('/:id', async (req, res) => {
    const cliente = await servicio.guardar(req.body || {}, req.user.id_usuario, req.params.id);
    res.json(cliente);
});

module.exports = router;
