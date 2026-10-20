const router = require('express').Router();
const config = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');

// Solo el Administrador General puede consultar la auditoria completa
// Los demas usuarios generan eventos desde los servicios de sus propios modulos
router.use(autenticar, autorizar(config.roles.ADMIN));

// GET /api/auditoria?pagina=1&limite=20&accion=CAMBIAR_ESTADO&id_usuario=1
// Recibe filtros, consulta el servicio y devuelve los registros paginados
router.get('/', async (req, res) => {
    const resultado = await servicio.listarAuditoria(req.query);
    res.json(resultado);
});

// No se exponen rutas para insertar, editar o eliminar registros de auditoria
module.exports = router;

