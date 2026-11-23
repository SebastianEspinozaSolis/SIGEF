const router = require('express').Router();
const config = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');
const exportaciones = require('../exportaciones/service');

// El mantenimiento de documentos de proveedor está disponible para Administrador General y Administración.
router.use(autenticar, autorizar(config.roles.ADMIN, config.roles.ADMINISTRACION));

// Obtiene los articulos para el selectos y poder agregarlos a un documento
// lista los documentos de un proveedor, obtiene uno especifico, crea uno o edita uno existente

// GET /api/documentos-proveedor/articulos
router.get('/articulos', async (req, res) => {
    const articulos = await servicio.articulos(req.query);
    res.json(articulos);
});

// GET /api/documentos-proveedor/:proveedor/:id/pdf: comprobante descargable.
router.get('/:proveedor/:id/pdf', async (req, res) => {
    const documento = await servicio.obtener(req.params.proveedor, req.params.id);
    const archivo = await exportaciones.generarPdf(exportaciones.htmlDocumento(documento));
    res.set('Cache-Control', 'no-store');
    res.type('application/pdf');
    res.attachment(`comprobante-proveedor-${documento.id_documento}.pdf`);
    res.send(archivo);
});

// GET /api/documentos-proveedor/:proveedor
router.get('/:proveedor', async (req, res) => {
    const documentos = await servicio.listar(req.params.proveedor, req.query);
    res.json(documentos);
});

// Gu?as disponibles antes de la ruta con identificador de documento.
router.get('/:proveedor/guias-disponibles', async (req,res) => {
    res.json(await servicio.guiasDisponibles(req.params.proveedor,req.query));
});

// GET /api/documentos-proveedor/:proveedor/referencias: originales para notas de crédito.
router.get('/:proveedor/referencias', async (req, res) => {
    res.json(await servicio.referencias(req.params.proveedor, req.query));
});

// GET /api/documentos-proveedor/:proveedor/:id
router.get('/:proveedor/:id', async (req, res) => {
    const documento = await servicio.obtener(req.params.proveedor, req.params.id);
    res.json(documento);
});

// POST /api/documentos-proveedor/:proveedor
router.post('/:proveedor', async (req, res) => {
    const documento = await servicio.guardar(req.params.proveedor, req.body || {}, req.user.id_usuario);
    res.status(201).json(documento);
});

// PUT /api/documentos-proveedor/:proveedor/:id
router.put('/:proveedor/:id', async (req, res) => {
    const documento = await servicio.guardar(
        req.params.proveedor, req.body || {}, req.user.id_usuario, req.params.id
    );
    res.json(documento);
});

module.exports = router;
