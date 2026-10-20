const pool = require('../../db');

// Consulta los roles disponibles en la base de datos
async function listarRoles() {
    const r = await pool.query('SELECT id_rol, nombre_rol FROM rol ORDER BY id_rol');
    return r.rows;
}

module.exports = { listarRoles };
