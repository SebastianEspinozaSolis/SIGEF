const router=require('express').Router();
const config=require('../../config');
const {autenticar,autorizar}=require('../../middlewares/auth');
const servicio=require('./service');
const exportaciones=require('../exportaciones/service');

router.use(autenticar,autorizar(config.roles.ADMIN,config.roles.ADMINISTRACION));

// GET /api/facturas-cliente/obras: selector de obras finalizadas sin factura.
router.get('/obras',async(req,res)=>res.json(await servicio.obrasDisponibles(req.query)));
// GET /api/facturas-cliente/previsualizar/:obra: precios y cantidades del servidor.
router.get('/previsualizar/:obra',async(req,res)=>res.json(await servicio.previsualizar(req.params.obra,req.query.descuento)));
// GET /api/facturas-cliente
router.get('/',async(req,res)=>res.json(await servicio.listar(req.query)));
// POST /api/facturas-cliente: confirmación definitiva, sin editar líneas de origen.
router.post('/',async(req,res)=>res.status(201).json(await servicio.confirmar(req.body || {},req.user.id_usuario)));
// GET /api/facturas-cliente/:id/pdf
router.get('/:id/pdf',async(req,res)=>{
    const d=await servicio.obtener(req.params.id);
    const archivo=await exportaciones.generarPdf(exportaciones.htmlFacturaCliente(d));
    res.set('Cache-Control','no-store');res.type('application/pdf');res.attachment(`documento-cliente-${d.id_documento}.pdf`);res.send(archivo);
});
// POST /api/facturas-cliente/:id/notas-credito: rebaja de monto sin stock.
router.post('/:id/notas-credito',async(req,res)=>res.status(201).json(await servicio.notaCredito(req.params.id,req.body || {},req.user.id_usuario)));
// GET /api/facturas-cliente/:id
router.get('/:id',async(req,res)=>res.json(await servicio.obtener(req.params.id)));
module.exports=router;
