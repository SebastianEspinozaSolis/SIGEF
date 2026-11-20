const ErrorHttp = require('./ErrorHttp');
const { limpiarTexto } = require('./validaciones');

// Reglas comunes de las fichas; los campos opcionales vacíos se guardan como NULL.
function texto(valor, campo, maximo, errores, obligatorio = true) {
    if (valor != null && typeof valor !== 'string') {
        errores[campo] = 'Debe ser un texto';
        return null;
    }
    const limpio = limpiarTexto(valor);
    if ((obligatorio && !limpio) || limpio.length > maximo) {
        errores[campo] = `Campo ${obligatorio ? 'obligatorio, ' : ''}máximo ${maximo} caracteres`;
    }
    return limpio || null;
}

function idPositivo(valor) {
    if (!/^\d+$/.test(String(valor)) || !Number.isSafeInteger(Number(valor)) || Number(valor) <= 0 || Number(valor) > 2147483647) {
        throw new ErrorHttp(400, 'Identificador inválido');
    }
    return Number(valor);
}

function filtrosListado(filtros = {}) {
    // numero de pagina y limite por pagina por defecto
    const pagina = idPositivo(filtros.pagina ?? 1);
    const limite = idPositivo(filtros.limite ?? 20);
    // Evitar que supere 100 para no sobrecargar la base de datos
    if (limite > 100 || !Number.isSafeInteger((pagina - 1) * limite)) {
        throw new ErrorHttp(400, 'Paginación inválida (máximo 100 por página)');
    }
    // Evitar errores en la busqueda
    if (filtros.q !== undefined && (typeof filtros.q !== 'string' || filtros.q.length > 150)) {
        throw new ErrorHttp(400, 'Búsqueda inválida (máximo 150 caracteres)');
    }
    // Los comodines del usuario se buscan literalmente, no amplían la consulta.
    const q = (filtros.q || '').trim().replace(/[\\%_]/g, '\\$&');
    return { pagina, limite, patron: `%${q}%`, offset: (pagina - 1) * limite };
}

// Comprueba si hay errores y lanza una excepción si los hay
function comprobarErrores(errores) {
    if (Object.keys(errores).length) throw new ErrorHttp(400, 'Hay datos inválidos', errores);
}

module.exports = { texto, idPositivo, filtrosListado, comprobarErrores };
