const router = require('express').Router();
const config = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');

router.use(autenticar, autorizar(config.roles.ADMIN, config.roles.ADMINISTRACION));
router.get('/articulos', async (req,res) => res.json(await servicio.articulos(req.query)));
router.get('/:proveedor', async (req,res) => res.json(await servicio.listar(req.params.proveedor, req.query)));
router.get('/:proveedor/:id', async (req,res) => res.json(await servicio.obtener(req.params.proveedor, req.params.id)));
router.post('/:proveedor', async (req,res) => res.status(201).json(await servicio.guardar(req.params.proveedor, req.body || {}, req.user.id_usuario)));
router.put('/:proveedor/:id', async (req,res) => res.json(await servicio.guardar(req.params.proveedor, req.body || {}, req.user.id_usuario, req.params.id)));
module.exports = router;
