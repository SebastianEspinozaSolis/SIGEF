// Convierte un decimal no negativo ya validado a entero: escalar('1.25', 2) = 125n.
function escalar(valor, precision) {
    const [entero, fraccion = ''] = String(valor).split('.');
    return BigInt(entero) * 10n ** BigInt(precision) + BigInt(fraccion.padEnd(precision, '0'));
}

// Conserva signo y precision al convertir el entero escalado a texto.
function decimal(n, precision) {
    const factor = 10n ** BigInt(precision);
    const absoluto = n < 0n ? -n : n;
    return `${n < 0n ? '-' : ''}${absoluto / factor}.${String(absoluto % factor).padStart(precision, '0')}`;
}

module.exports = { escalar, decimal };
