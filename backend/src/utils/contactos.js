const { texto } = require('./catalogos');
const { normalizarRut, normalizarTelefono, errorRut, validarEmail } = require('./validaciones');

// Valida los campos comunes; cada servicio controla la lista, sus IDs y duplicados.
function validarContacto(entrada, prefijo, errores) {
    const contacto = {
        nombre: texto(entrada.nombre, `${prefijo}.nombre`, 150, errores),
        rut: texto(normalizarRut(entrada.rut), `${prefijo}.rut`, 12, errores),
        cargo: texto(entrada.cargo, `${prefijo}.cargo`, 100, errores),
        email: texto(entrada.email, `${prefijo}.email`, 120, errores)?.toLowerCase() || '',
        telefono: texto(entrada.telefono, `${prefijo}.telefono`, 30, errores),
    };
    // Además de limpiar texto, comprueba formato de teléfono, RUT y correo.
    contacto.telefono = normalizarTelefono(contacto.telefono);
    if (!contacto.telefono) errores[`${prefijo}.telefono`] = 'Incluye +56 seguido de 9 dígitos. Solo se permiten espacios o guiones como separadores';
    const mensajeRut = errorRut(contacto.rut);
    if (mensajeRut) errores[`${prefijo}.rut`] = mensajeRut;
    if (!validarEmail(contacto.email)) errores[`${prefijo}.email`] = 'Correo inválido';
    return contacto;
}

module.exports = { validarContacto };
