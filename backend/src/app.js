// Archivo principal de la API
// Carga Middlewares, rutas y conexiones
const config = require('./config'); // Trae variables
const express = require('express'); //Framework
const cors = require('cors'); // Permisos para API
const helmet = require('helmet'); // Seguridad
const pool = require('./db'); // Conexión a db.js
const ErrorHttp = require('./utils/ErrorHttp');

const app = express(); //Instancia de express

app.use(helmet()); // cabeceras http
app.use(cors());
app.use(express.json());      // permite leer el cuerpo JSON de las peticiones

// Ruta de prueba: comprueba el servidor y la base de datos
app.get('/api/health', async (req, res) => {
  try {
    const r = await pool.query('SELECT COUNT(*) AS roles FROM rol');
    res.json({ estado: 'ok', roles: Number(r.rows[0].roles) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ estado: 'error', mensaje: 'No se pudo consultar la base de datos' });
  }
});

// Modulos
app.use('/api/auth', require('./modules/auth/routes'));
app.use('/api/usuarios', require('./modules/usuarios/routes'));
app.use('/api/roles', require('./modules/roles/routes'));
app.use('/api/auditoria', require('./modules/auditoria/routes'));
// Primera entrega de Alpha: fichas y catálogo, sin movimientos de inventario.
app.use('/api/clientes', require('./modules/clientes/routes'));
app.use('/api/recepciones-compra', require('./modules/recepciones-compra/routes'));
app.use('/api/documentos-proveedor', require('./modules/documentos-proveedor/routes'));
app.use('/api/proveedores', require('./modules/proveedores/routes'));
app.use('/api/categorias', require('./modules/categorias/routes'));
app.use('/api/movimientos', require('./modules/movimientos/routes'));
app.use('/api/articulos', require('./modules/articulos/routes'));
app.use('/api/inventario-fisico', require('./modules/inventario-fisico/routes'));
app.use('/api/alertas', require('./modules/alertas/routes'));

// Manejo de errores
app.use((err, req, res, next) => {
  // Los servicios lanzan estos errores para conservar los mensajes y estados esperados
  if (err instanceof ErrorHttp) {
    const respuesta = { mensaje: err.message };
    if (err.errores) respuesta.errores = err.errores;
    return res.status(err.status).json(respuesta);
  }
  console.error(err);
  res.status(500).json({mensaje:'Error interno del servidor'});
})

app.listen(config.port, () => console.log(`Servidor en http://localhost:${config.port}`));
