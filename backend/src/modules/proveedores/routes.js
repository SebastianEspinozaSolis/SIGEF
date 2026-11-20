const router = require('express').Router();
const config = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');
const { listarRegiones, listarComunas } = require('../../utils/ubicaciones');

// Solo Administrador General y Administración pueden consultar, crear y editar proveedores.
router.use(autenticar, autorizar(config.roles.ADMIN, config.roles.ADMINISTRACION));

// GET /api/proveedores/regiones
router.get('/regiones', async (req, res) => {
    const regiones = await listarRegiones();
    res.json(regiones);
});

// GET /api/proveedores/comunas
router.get('/comunas', async (req, res) => {
    const comunas = await listarComunas(req.query.id_region);
    res.json(comunas);
});

// GET /api/proveedores
router.get('/', async (req, res) => {
    const proveedores = await servicio.listar(req.query);
    res.json(proveedores);
});

// GET /api/proveedores/:id
router.get('/:id', async (req, res) => {
    const proveedor = await servicio.obtener(req.params.id);
    res.json(proveedor);
});

// POST /api/proveedores
router.post('/', async (req, res) => {
    const proveedor = await servicio.guardar(req.body || {}, req.user.id_usuario);
    res.status(201).json(proveedor);
});

// PUT /api/proveedores/:id
router.put('/:id', async (req, res) => {
    const proveedor = await servicio.guardar(req.body || {}, req.user.id_usuario, req.params.id);
    res.json(proveedor);
});

module.exports = router;
