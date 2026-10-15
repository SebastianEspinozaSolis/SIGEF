//Configuraciones del sistema
//Puertos, url, nombres de roles
require('dotenv').config(); // carga env

module.exports = {
    port: process.env.PORT || 3000,
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET,
    // Nombres de los roles, tal cual están en la tabla rol
    roles: {
    ADMIN: 'Administrador General',
    ADMINISTRACION: 'Administración',
    BODEGA: 'Bodega/Logística',
    SUPERVISOR: 'Supervisor de Obras',
    TECNICO: 'Técnico',
    },
};