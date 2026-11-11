// Cuentas ficticias de desarrollo; no forman parte del seed mínimo del sistema.
const bcrypt = require('bcryptjs');
const pool = require('../db');
const config = require('../config');
const { validarRut, validarPassword } = require('../utils/validaciones');

// Se mantienen los mismos datos entre ejecuciones para no generar cuentas nuevas cada vez.
function rutPrueba(cuerpo) {
    return '0123456789K'.split('').map((dv) => `${cuerpo}-${dv}`).find(validarRut);
}

const usuariosPrueba = [
    { rut: rutPrueba('20000001'), nombres: 'Ana', apellidos: 'Prueba Administración', email: 'administracion@fyag.cl', password: 'Administracion1234', rol: config.roles.ADMINISTRACION },
    { rut: rutPrueba('20000002'), nombres: 'Bruno', apellidos: 'Prueba Bodega', email: 'bodega@fyag.cl', password: 'Bodega1234', rol: config.roles.BODEGA },
    { rut: rutPrueba('20000003'), nombres: 'Sofía', apellidos: 'Prueba Supervisión', email: 'supervisor@fyag.cl', password: 'Supervisor1234', rol: config.roles.SUPERVISOR },
    { rut: rutPrueba('20000004'), nombres: 'Tomás', apellidos: 'Prueba Terreno', email: 'tecnico@fyag.cl', password: 'Tecnico1234', rol: config.roles.TECNICO },
];

async function crearUsuariosPrueba() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const roles = await client.query('SELECT id_rol, nombre_rol FROM rol WHERE nombre_rol = ANY($1::text[])',
            [usuariosPrueba.map((u) => u.rol)]);
        const ids = new Map(roles.rows.map((r) => [r.nombre_rol, r.id_rol]));
        if (usuariosPrueba.some((u) => !ids.has(u.rol))) {
            throw new Error('Faltan roles. Ejecuta db/seed.sql antes de crear los usuarios de prueba');
        }
        const resultados = [];
        for (const usuario of usuariosPrueba) {
            if (!validarRut(usuario.rut) || !validarPassword(usuario.password)) {
                throw new Error('Los datos de una cuenta de prueba son inválidos');
            }
            const hash = await bcrypt.hash(usuario.password, 10);
            // Ante un correo o RUT existente, no cambia datos, rol, estado ni contraseña.
            const r = await client.query(`INSERT INTO usuario
                (rut, nombres, apellidos, email, password_hash, id_rol, estado)
                VALUES ($1,$2,$3,$4,$5,$6,'Activo')
                ON CONFLICT DO NOTHING RETURNING id_usuario`,
            [usuario.rut, usuario.nombres, usuario.apellidos, usuario.email, hash, ids.get(usuario.rol)]);
            resultados.push({ email: usuario.email, creada: r.rows.length > 0 });
        }
        await client.query('COMMIT');
        return resultados;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

if (require.main === module) {
    crearUsuariosPrueba()
        .then((resultados) => {
            for (const r of resultados) console.log(`${r.creada ? 'Creada' : 'Omitida: correo o RUT ya existente'}: ${r.email}`);
            console.log('El administrador se mantiene separado: src/scripts/crearAdmin.js');
        })
        .catch((err) => { console.error('No se crearon las cuentas:', err.message); process.exitCode = 1; })
        .finally(() => pool.end());
}

module.exports = { crearUsuariosPrueba, usuariosPrueba };
