// Convierte un decimal no negativo ya validado a entero: escalar('1.25', 2) = 125n.
function escalar(valor, precision) {
    const [entero, fraccion = ''] = String(valor).split('.');
    return BigInt(entero) * 10n ** BigInt(precision) + BigInt(fraccion.padEnd(precision, '0'));
}

module.exports = { escalar };
