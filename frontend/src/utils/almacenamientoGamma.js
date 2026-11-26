/*
 * Tratamiento de errores al guardar datos de terreno en el dispositivo, incluida la falta de espacio.
 * Prepara avisos para indicar que el guardado no se completó y permitir actuar; no reserva una cantidad fija de almacenamiento.
 */

// Algunos navegadores informan la falta de espacio como causa del error de la transacción.
export function errorAlmacenamiento(error) {
    if (error?.name === 'QuotaExceededError' || error?.cause?.name === 'QuotaExceededError') {
        return new Error('No hay espacio suficiente en este dispositivo. No se guardaron estos cambios. Mantén esta pantalla abierta para reintentar o respalda los datos en papel antes de salir.', { cause: error });
    }
    return error || new Error('No se pudo guardar en este dispositivo.');
}
