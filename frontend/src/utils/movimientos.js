// Nombres compartidos por el formulario y el historial de movimientos.
export const tiposMovimiento = [
    ['INGRESO', 'Ingreso'], ['EGRESO', 'Egreso'], ['MERMA', 'Merma'],
    ['DEVOLUCION_PROVEEDOR', 'Devolución a proveedor'], ['AJUSTE', 'Ajuste'],
    ['USO_INTERNO', 'Uso interno'], ['REVERSA', 'Reversa'],
];

export const nombresMovimiento = Object.fromEntries(tiposMovimiento);

// Quita ceros decimales sobrantes sin redondear la cantidad.
export function cantidadVisible(valor) {
    return String(valor).replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
}
