const pool = require('../../db');
const ErrorHttp = require('../../utils/ErrorHttp');

// Valida numeros recibidos como texto en los filtros de la URL
function enteroPositivo(valor, nombre) {
    if (!/^\d+$/.test(String(valor)) || !Number.isSafeInteger(Number(valor)) || Number(valor) <= 0) {
        throw new ErrorHttp(400, `${nombre} debe ser un entero positivo`);
    }
    return Number(valor);
}

// Devuelve registros recientes primero, junto con el nombre del responsable
async function listarAuditoria(filtros = {}) {
    const pagina = enteroPositivo(filtros.pagina ?? 1, 'La página');
    const limite = enteroPositivo(filtros.limite ?? 20, 'El límite');
    if (limite > 100 || !Number.isSafeInteger((pagina - 1) * limite)) {
        throw new ErrorHttp(400, 'Paginación inválida: el límite máximo es 100');
    }

    const condiciones = [];
    const parametros = [];
    if (filtros.id_usuario !== undefined) {
        parametros.push(enteroPositivo(filtros.id_usuario, 'El usuario'));
        condiciones.push(`a.id_usuario = $${parametros.length}`);
    }
    if (filtros.accion !== undefined) {
        if (typeof filtros.accion !== 'string' || !filtros.accion.trim() || filtros.accion.length > 20) {
            throw new ErrorHttp(400, 'Acción inválida');
        }
        parametros.push(filtros.accion.trim());
        condiciones.push(`a.accion = $${parametros.length}`);
    }
    // Solo se construyen fragmentos fijos de SQL; los valores van por separado
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const cantidad = await pool.query(
        `SELECT COUNT(*) AS total FROM registro_auditoria a ${where}`, parametros
    );
    const r = await pool.query(
        `SELECT a.id_auditoria, a.id_usuario, u.nombres, u.apellidos,
                a.tabla_afectada, a.id_registro_afectado, a.accion,
                a.valores_anteriores, a.valores_nuevos, a.fecha_hora
         FROM registro_auditoria a
         LEFT JOIN usuario u ON u.id_usuario = a.id_usuario
         ${where}
         ORDER BY a.fecha_hora DESC, a.id_auditoria DESC
         LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
        [...parametros, limite, (pagina - 1) * limite]
    );
    return { registros: r.rows, total: Number(cantidad.rows[0].total), pagina, limite };
}

// Evita guardar campos de contraseñas o tokens, incluso dentro de objetos anidados
function sinSecretos(valor) {
    if (Array.isArray(valor)) return valor.map(sinSecretos);
    if (valor && typeof valor === 'object') {
        return Object.fromEntries(Object.entries(valor)
            .filter(([clave]) => !/password|contrase[nñ]a|token|secret|hash/i.test(clave))
            .map(([clave, dato]) => [clave, sinSecretos(dato)]));
    }
    return valor;
}

// Recibe la conexion de la misma transaccion que realiza la operacion del negocio
// El modulo que llama obtiene id_usuario desde req.user, nunca desde el formulario
async function registrarAuditoria(client, datos) {
    const { id_usuario, tabla_afectada, id_registro_afectado, accion,
        valores_anteriores = null, valores_nuevos = null } = datos;
    const responsable = enteroPositivo(id_usuario, 'El responsable');
    const registro = enteroPositivo(id_registro_afectado, 'El registro afectado');
    if (typeof tabla_afectada !== 'string' || !tabla_afectada.trim() || tabla_afectada.length > 60 ||
        typeof accion !== 'string' || !accion.trim() || accion.length > 20) {
        throw new ErrorHttp(400, 'Tabla o acción de auditoría inválida');
    }

    // Para cambios de contraseña se registra solo la accion, sin valores sensibles
    const r = await client.query(
        `INSERT INTO registro_auditoria
         (id_usuario, tabla_afectada, id_registro_afectado, accion, valores_anteriores, valores_nuevos)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id_auditoria, fecha_hora`,
        [responsable, tabla_afectada.trim(), registro, accion.trim(),
            valores_anteriores === null ? null : JSON.stringify(sinSecretos(valores_anteriores)),
            valores_nuevos === null ? null : JSON.stringify(sinSecretos(valores_nuevos))]
    );
    // La transaccion (BEGIN, COMMIT, ROLLBACK y release) la controla el servicio que llama
    return r.rows[0];
}

module.exports = { listarAuditoria, registrarAuditoria };
