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
        password.length <= 72 && // Máximo 72 caracteres (bcrypt ignora lo que pase de 72)
        /[A-Za-z]/.test(password) && // Al menos una letra
        /\d/.test(password) // Al menos un número
    );
}

module.exports = {
    limpiarTexto,
    normalizarRut,
    validarRut,
    validarEmail,
    validarNombre,
    validarPassword,
};