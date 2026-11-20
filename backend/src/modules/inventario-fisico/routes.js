const router = require('express').Router();
const config = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');

// El conteo y sus diferencias están disponibles para Bodega y Administrador General.
router.use(autenticar, autorizar(config.roles.BODEGA, config.roles.ADMIN));

// Obtiene los articulos para listarlos y agregarlos al conteo
// lista anteriores inventarios, obtiene uno en especifico, crea uno o edita uno existente, finaliza un conteo

// GET /api/inventario-fisico/articulos
router.get('/articulos', async (req, res) => {
    const articulos = await servicio.listarArticulos(req.query);
    res.json(articulos);
});

// GET /api/inventario-fisico
router.get('/', async (req, res) => {
    const inventarios = await servicio.listar(req.query);
    res.json(inventarios);
});

// POST /api/inventario-fisico
router.post('/', async (req, res) => {
    const inventario = await servicio.crear(req.user.id_usuario);
    res.status(201).json(inventario);
});

// GET /api/inventario-fisico/:id
router.get('/:id', async (req, res) => {
    const inventario = await servicio.obtener(req.params.id);
    res.json(inventario);
});

// PUT /api/inventario-fisico/:id/articulos/:idArticulo
router.put('/:id/articulos/:idArticulo', async (req, res) => {
    const detalle = await servicio.guardarConteo(
        req.params.id, req.params.idArticulo, req.body || {}, req.user.id_usuario
    );
    res.json(detalle);
});

// PATCH /api/inventario-fisico/:id/finalizar
router.patch('/:id/finalizar', async (req, res) => {
    const inventario = await servicio.finalizar(req.params.id, req.user.id_usuario);
    res.json(inventario);
});

module.exports = router;
