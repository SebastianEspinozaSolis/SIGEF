const router = require('express').Router();
const config = require('../../config');
const { autenticar, autorizar } = require('../../middlewares/auth');
const servicio = require('./service');

// El mantenimiento de documentos de proveedor está disponible para Administrador General y Administración.
router.use(autenticar, autorizar(config.roles.ADMIN, config.roles.ADMINISTRACION));

// Obtiene los articulos para el selectos y poder agregarlos a un documento
// lista los documentos de un proveedor, obtiene uno especifico, crea uno o edita uno existente

// GET /api/documentos-proveedor/articulos
router.get('/articulos', async (req, res) => {
    const articulos = await servicio.articulos(req.query);
    res.json(articulos);
});

// GET /api/documentos-proveedor/:proveedor
router.get('/:proveedor', async (req, res) => {
    const documentos = await servicio.listar(req.params.proveedor, req.query);
    res.json(documentos);
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
