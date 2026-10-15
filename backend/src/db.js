// Libreria para conectar node.js a PostgreSQL
const { Pool } = require('pg');
// carga configuraciones del sistema
const config = require('./config');

const pool = new Pool({ connectionString: config.databaseUrl });

// Permite usar pool desde otros archivos
module.exports = pool;