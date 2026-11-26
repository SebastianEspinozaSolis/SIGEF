/*
 * Presentación compartida de montos en CLP como pesos enteros, sin modificar los cálculos ni los valores guardados.
 * También evita que la rueda del ratón cambie accidentalmente un importe mientras se completa un formulario.
 */

const formato = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

// Presentación en pesos enteros; no modifica valores de formularios ni cálculos.
export function pesos(valor) {
    return valor == null || valor === '' ? '—' : formato.format(valor);
}


// Evita que la rueda cambie accidentalmente un importe enfocado.
export function evitarCambioConRueda(evento) {
    evento.currentTarget.blur();
}
