const formato = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

// Presentación en pesos enteros; no modifica valores de formularios ni cálculos.
export function pesos(valor) {
    return valor == null || valor === '' ? '—' : formato.format(valor);
}


// Evita que la rueda cambie accidentalmente un importe enfocado.
export function evitarCambioConRueda(evento) {
    evento.currentTarget.blur();
}
