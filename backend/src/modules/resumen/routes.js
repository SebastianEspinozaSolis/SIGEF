const router = require('express').Router();
const config = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');
const exportaciones = require('../exportaciones/service');
const ErrorHttp = require('../../utils/ErrorHttp');

router.use(autenticar, autorizar(config.roles.ADMIN, config.roles.ADMINISTRACION));

// POST /api/resumen/actualizar: refresco global, con un mínimo de cinco minutos.
router.post('/actualizar', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await servicio.actualizar());
});

// GET /api/resumen/exportar/:formato: exporta todas las filas del período consultado.
router.get('/exportar/:formato', async (req, res) => {
    const formato = req.params.formato;
    if (!['pdf', 'xlsx'].includes(formato)) throw new ErrorHttp(400, 'Formato de exportación inválido');
    const datos = await servicio.obtener(req.query, true);
    const archivo = formato === 'pdf'
        ? await exportaciones.generarPdf(exportaciones.htmlResumen(datos))
        : exportaciones.crearExcel(datos);
    res.set('Cache-Control', 'no-store');
    res.type(formato === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.attachment(`resumen-${datos.mes}.${formato}`);
    res.send(archivo);
});

// GET /api/resumen: indicadores, gráficos y tablas; solo lectura.
router.get('/', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await servicio.obtener(req.query));
});

module.exports = router;
