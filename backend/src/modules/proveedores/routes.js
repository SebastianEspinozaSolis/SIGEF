const router = require('express').Router();
const config = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');
const { listarRegiones, listarComunas } = require('../../utils/ubicaciones');

// Solo Administrador General y Administración pueden consultar, crear y editar proveedores.
router.use(autenticar, autorizar(config.roles.ADMIN, config.roles.ADMINISTRACION));
router.get('/regiones', async (req, res) => res.json(await listarRegiones()));
router.get('/comunas', async (req, res) => res.json(await listarComunas(req.query.id_region)));
router.get('/', async (req, res) => res.json(await servicio.listar(req.query)));
router.get('/:id', async (req, res) => res.json(await servicio.obtener(req.params.id)));
router.post('/', async (req, res) => {
    res.status(201).json(await servicio.guardar(req.body || {}, req.user.id_usuario));
});
router.put('/:id', async (req, res) => {
    res.json(await servicio.guardar(req.body || {}, req.user.id_usuario, req.params.id));
});
module.exports = router;
