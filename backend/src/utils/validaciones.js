// Reglas de validación reutilizables (usuarios ahora; clientes y proveedores después)

// Quita espacios sobrantes: "  Juan   Pérez " -> "Juan Pérez"
// evita errores de null o undefined, y reemplaza múltiples espacios por uno solo
function limpiarTexto(valor) {
    return String(valor ?? '').trim().replace(/\s+/g, ' ');
}

// "12.345.678-k" -> "12345678-K"  (formato único: sin puntos, con guion)
function normalizarRut(rut) {
    return String(rut ?? '').replace(/[.\s]/g, '').toUpperCase();
}

// Verifica el formato y el dígito verificador
function validarRut(rut) {
    if (!/^\d{7,8}-[\dK]$/.test(rut)) return false; // 7 u 8 dígitos, guion, dígito verificador (0-9 o K)

    // Calcula el dígito verificador esperado según el algoritmo chileno
    const [cuerpo, dv] = rut.split('-');
    let suma = 0;
    let factor = 2;
    for (let i = cuerpo.length - 1; i >= 0; i--) {
        suma += Number(cuerpo[i]) * factor;
        factor = factor === 7 ? 2 : factor + 1;
    }
    const resto = 11 - (suma % 11);
    const esperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);

    return dv === esperado;
}

// Recibe el RUT normalizado y distingue formato de cálculo del verificador.
function errorRut(rut) {
    if (!/^\d{7,8}-[\dK]$/.test(rut)) {
        return 'Escribe el RUT con 7 u 8 números, guion y dígito verificador (0–9 o K)';
    }
    if (!validarRut(rut)) return 'El dígito verificador no coincide. Revisa el RUT ingresado';
    return null;
}

// Exige prefijo chileno explícito; no elimina letras ni símbolos para hacerlos válidos.
function normalizarTelefono(valor) {
    if (typeof valor !== 'string' || !/^\+56[\d -]+$/.test(valor.trim())) return null;
    const telefono = valor.trim().replace(/[ -]/g, '');
    return /^\+56\d{9}$/.test(telefono) ? telefono : null;
}

// Valida que el correo tenga un formato válido y no sea demasiado largo
function validarEmail(email) {
    return email.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

// Nombres y apellidos: mínimo 2 letras, permite tildes, ñ, espacios, guion y apóstrofe
function validarNombre(texto) {
    return texto.length >= 2 && texto.length <= 80 && /^\p{L}[\p{L}' -]*$/u.test(texto);
}

function validarPassword(password) {
    return (
        typeof password === 'string' && // Verifica que sea una cadena de texto
        password.length >= 8 && // Mínimo 8 caracteres
        Buffer.byteLength(password, 'utf8') <= 72 && // Límite de bcrypt en bytes
        /[A-Za-z]/.test(password) && // Al menos una letra
        /\d/.test(password) // Al menos un número
    );
}

// Comprueba el formato y la existencia de una fecha del calendario.
function fechaValida(valor) {
    return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)
        && Number.isFinite(Date.parse(`${valor}T00:00:00Z`))
        && new Date(`${valor}T00:00:00Z`).toISOString().slice(0, 10) === valor;
}

function uuidValido(valor) {
    return typeof valor === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor);
}

module.exports = {
    fechaValida,
    uuidValido,
    limpiarTexto,
    normalizarRut,
    normalizarTelefono,
    validarRut,
    errorRut,
    validarEmail,
    validarNombre,
    validarPassword,
};
