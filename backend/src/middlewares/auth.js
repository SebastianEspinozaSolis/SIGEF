// trae libreria y config con clave para JWT
const jwt = require('jsonwebtoken');
const config = require('../config');

// Verifica que este logeado y que sea valido
function autenticar(req, res, next) {
    const [tipo, token] = (req.headers.authorization || '').split(' ');

    //Usa Bearer que es el estandar para JWT y verifica token
    if (tipo !== 'Bearer' || !token) {
        return res.status(401).json({ mensaje: 'Token requerido' });
    }

    // Verifica que el token use el JWT secreto
    // el algoritmo es un estandar para JWT sin ser tan largo 
    // si es valido continua, si no da error
    try {
        req.user = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
        next();
    } catch (err) {
        return res.status(401).json({ mensaje: 'Token inválido o expirado' });
    }
}

// Verifica que el usuario tenga permisos para la acción
function autorizar(...rolesPermitidos) {
    return (req, res, next) => {
        if (!rolesPermitidos.includes(req.user.rol)) {
        return res.status(403).json({ mensaje: 'No tienes permiso para esta acción' });
        }
        next();
    };
}

module.exports = { autenticar, autorizar };