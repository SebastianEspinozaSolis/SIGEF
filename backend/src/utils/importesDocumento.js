const ErrorHttp = require('./ErrorHttp');
const { escalar, decimal } = require('./decimales');

// Conserva el formato decimal de la API, pero cada importe CLP cierra al peso.
function redondear(n, d) { return (n + d / 2n) / d; }
const pesosCentavos=n=>redondear(n,100n)*100n;
const descontar=(importe,porcentaje)=>importe-redondear(importe*porcentaje,1000000n)*100n;

// Descuentos sucesivos sobre el importe ya redondeado de la etapa anterior.
function importesLinea(d) {
    const base = escalar(d.cantidad,3) * escalar(d.costo_neto,4);
    const subtotal = redondear(base,10000000n)*100n;
    let neto = subtotal;
    const descuentos = [];
    for (const [indice,campo] of ['descuento_1','descuento_2','descuento_3'].entries()) {
        const porcentaje = escalar(d[campo],2);
        const siguiente = descontar(neto,porcentaje);
        if (porcentaje > 0n) descuentos.push({orden:indice+1,porcentaje:String(d[campo]),importe:decimal(neto-siguiente,2)});
        neto = siguiente;
    }
    return {subtotal,neto,descuentos};
}
function convertirCostoBruto(valor) {
    return decimal(redondear(escalar(valor, 0) * 1000000n, 119n), 4);
}
function costoBruto(neto, tasa = 19) {
    return redondear(escalar(neto, 4) * (10000n + escalar(tasa, 2)), 100000000n).toString();
}
function lineaSegunDocumento(d, cabecera) {
    return cabecera.tipo_documento === 'boleta' ? {...d, costo_neto:costoBruto(d.costo_neto, cabecera.tasa_iva ?? 19)} : d;
}
function calcularDetalle(d, cabecera = {}) {
    const linea = importesLinea(lineaSegunDocumento(d, cabecera));
    return {subtotal:decimal(linea.subtotal,2),total_neto:decimal(linea.neto,2),descuentos:linea.descuentos};
}
// Calcula descuentos por producto, general y pronto pago; después aplica IVA.
function calcular(cabecera, detalles) {
    if (cabecera.tipo_documento === 'nota_credito' && cabecera.monto_neto_correccion != null) {
        const neto = pesosCentavos(escalar(cabecera.monto_neto_correccion, 2));
        const iva = redondear(neto * escalar(cabecera.tasa_iva ?? 19, 2), 1000000n)*100n;
        return {subtotal:decimal(neto,2),descuento_productos:'0.00',neto_productos:decimal(neto,2),
            importe_descuento_general:'0.00',importe_descuento_pronto_pago:'0.00',
            total_neto:decimal(neto,2),iva:decimal(iva,2),total:decimal(neto+iva,2)};
    }
    // Una factura de guias conserva los redondeos originales de cada documento.
    if (cabecera.documentos_guias?.length) {
        const sumas = {};
        for (const guia of cabecera.documentos_guias) {
            for (const [campo, valor] of Object.entries(calcular(guia, guia.detalles))) {
                sumas[campo] = (sumas[campo] ?? 0n) + escalar(valor, 2);
            }
        }
        if (Object.values(sumas).some(n => n > 99999999999999n)) throw new ErrorHttp(400, 'El importe supera el maximo admitido');
        return Object.fromEntries(Object.entries(sumas).map(([campo, valor]) => [campo, decimal(valor, 2)]));
    }
    let subtotal = 0n, netoLineas = 0n;
    for (const d of detalles) {
        const linea = importesLinea(lineaSegunDocumento(d, cabecera));
        subtotal += linea.subtotal;
        netoLineas += linea.neto;
    }
    const general = descontar(netoLineas,escalar(cabecera.descuento_general, 2));
    let neto = descontar(general,escalar(cabecera.descuento_pronto_pago, 2));
    const importeFinal = neto;
    const boleta = cabecera.tipo_documento === 'boleta';
    if (boleta) neto = redondear(importeFinal * 100n, 10000n + escalar(cabecera.tasa_iva, 2))*100n;
    const iva = boleta ? importeFinal - neto : redondear(neto * escalar(cabecera.tasa_iva, 2), 1000000n)*100n;
    if ([subtotal, neto, iva, neto + iva].some((n) => n > 99999999999999n)) throw new ErrorHttp(400, 'El importe supera el máximo admitido');
    return { subtotal: decimal(subtotal, 2), descuento_productos: decimal(subtotal - netoLineas, 2),
        neto_productos: decimal(netoLineas, 2), importe_descuento_general: decimal(netoLineas - general, 2),
        importe_descuento_pronto_pago: decimal(general - importeFinal, 2),
        total_neto: decimal(neto, 2), iva: decimal(iva, 2), total: decimal(neto + iva, 2) };
}

module.exports = { calcular, calcularDetalle, convertirCostoBruto, costoBruto };
