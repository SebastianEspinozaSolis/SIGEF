// Libreria para conectar node.js a PostgreSQL
const { Pool, types } = require('pg');
// carga configuraciones del sistema
const config = require('./config');

// DATE representa un día del calendario, sin convertirlo a la zona horaria de Node.
types.setTypeParser(1082, valor => valor);
// Las horas sin zona recibidas por PostgreSQL se interpretan en Santiago.
const pool = new Pool({ connectionString: config.databaseUrl, options: '-c timezone=America/Santiago' });

// Permite usar pool desde otros archivos
module.exports = pool;
