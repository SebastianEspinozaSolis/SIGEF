const router=require('express').Router();
const config=require('../../config');
const {autenticar,autorizar}=require('../../middlewares/auth');
const servicio=require('./service');
router.use(autenticar,autorizar(config.roles.ADMIN, config.roles.BODEGA));
router.get('/receptores',async(req,res)=>res.json(await servicio.receptores(req.query)));
router.get('/:idArticulo/referencias',async(req,res)=>res.json(await servicio.referencias(req.params.idArticulo,req.query)));
router.post('/:idArticulo',async(req,res)=>res.json(await servicio.registrar(req.params.idArticulo,req.body||{},req.user.id_usuario)));
module.exports=router;
