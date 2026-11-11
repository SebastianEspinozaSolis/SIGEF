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
    const pagina = idPositivo(filtros.pagina ?? 1);
    const limite = idPositivo(filtros.limite ?? 20);
    if (limite > 100 || !Number.isSafeInteger((pagina - 1) * limite)) {
        throw new ErrorHttp(400, 'Paginación inválida (máximo 100 por página)');
    }
    if (filtros.q !== undefined && (typeof filtros.q !== 'string' || filtros.q.length > 150)) {
        throw new ErrorHttp(400, 'Búsqueda inválida (máximo 150 caracteres)');
    }
    // Los comodines del usuario se buscan literalmente, no amplían la consulta.
    const q = (filtros.q || '').trim().replace(/[\\%_]/g, '\\$&');
    return { pagina, limite, patron: `%${q}%`, offset: (pagina - 1) * limite };
}

function comprobarErrores(errores) {
    if (Object.keys(errores).length) throw new ErrorHttp(400, 'Hay datos inválidos', errores);
}

module.exports = { texto, idPositivo, filtrosListado, comprobarErrores };
