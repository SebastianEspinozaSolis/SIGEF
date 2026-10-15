//Script para crear un usuario administrador en la base de datos
const bcrypt = require('bcryptjs'); // Libreria de hashing
const pool = require('../db');  //Conexión base de datos
const config = require('../config');    //Configuraciones del sistema

//Función para crear un administrador
//Abre consola y toma correo y clave
//Verifica que se haya ingresado
async function main() {
    const [email, password] = process.argv.slice(2);
    if (!email || !password) {
        console.log('Uso: node src/scripts/crearAdmin.js correo clave');
        process.exit(1);
    }

    //hashea
    const hash = await bcrypt.hash(password, 10);
    //Busca id del rol administrador
    const rol = await pool.query('SELECT id_rol FROM rol WHERE nombre_rol = $1', [config.roles.ADMIN]);

    //Crea administrador
    await pool.query(
        `INSERT INTO usuario (rut, nombres, apellidos, email, password_hash, id_rol)
        VALUES ($1, $2, $3, $4, $5, $6)`,
        ['11111111-1', 'Administrador', 'General', email, hash, rol.rows[0].id_rol]
    );

    //Cierra conexion
    console.log('Administrador creado:', email);
    await pool.end();
}

//Ejecuta la funcion y maneja errores
main().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
