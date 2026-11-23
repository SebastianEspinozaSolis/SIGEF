// Formato de importes en pesos chilenos para documentos de presentación.
const formato = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

// Solo para documentos de presentación; las operaciones mantienen su precisión.
function pesos(valor) { return valor == null || valor === '' ? '—' : formato.format(valor); }
module.exports = { pesos };
