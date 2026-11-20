const pool = require('../db');
const { idPositivo } = require('./catalogos');

// Los nombres y relaciones territoriales se mantienen en PostgreSQL.
async function listarRegiones() {
    const resultado = await pool.query('SELECT id_region, nombre FROM region ORDER BY nombre');
    return resultado.rows;
}


async function listarComunas(idRegion) {
    const id = idPositivo(idRegion);
    const resultado = await pool.query(
        'SELECT id_comuna, id_region, nombre FROM comuna WHERE id_region=$1 ORDER BY nombre', [id]);
    return resultado.rows;
}

module.exports = { listarRegiones, listarComunas };
