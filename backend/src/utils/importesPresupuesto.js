const ErrorHttp = require('./ErrorHttp');
const { escalar } = require('./decimales');

// Cada línea se redondea al peso; el IVA se aplica una vez al neto acumulado.
function calcularPresupuesto(detalles) {
    const subtotal = detalles.reduce((suma, linea) => suma
        + (escalar(linea.cantidad, 3) * BigInt(linea.precio_neto_unitario) + 500n) / 1000n, 0n);
    const iva = (subtotal * 19n + 50n) / 100n;
    if (subtotal + iva > 999999999999n) throw new ErrorHttp(400, 'El total del presupuesto supera el máximo permitido');
    return { subtotal_neto: String(subtotal), iva: String(iva), monto_total: String(subtotal + iva) };
}

module.exports = { calcularPresupuesto };
