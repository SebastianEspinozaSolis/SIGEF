const router = require('express').Router();
const config = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');

router.use(autenticar, autorizar(config.roles.TECNICO));
router.use((req,res,next) => { res.set('Cache-Control','no-store'); next(); });
router.get('/descarga', async (req,res) => res.json(await servicio.descargar(req.user.id_usuario)));
router.post('/sincronizar', async (req,res) => res.json(await servicio.sincronizar(req.body || {},req.user.id_usuario)));
module.exports = router;
