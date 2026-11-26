/*
 * Funciones compartidas para preparar y mostrar fechas con el criterio de Santiago de Chile.
 * Distingue una fecha de calendario de un instante con hora, evitando cambiar de día los campos que solo representan una fecha.
 */

const calendario = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Santiago' });

// Conserva los DATE del calendario y obtiene el día de Santiago para instantes con zona.
export function fechaSantiago(valor = new Date()) {
    if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
    const fecha = valor instanceof Date ? valor : new Date(valor);
    return Number.isFinite(fecha.getTime()) ? calendario.format(fecha) : '';
}
