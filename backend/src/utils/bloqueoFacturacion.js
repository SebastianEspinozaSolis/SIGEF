const ErrorHttp=require('./ErrorHttp');

// La misma obra se bloquea al facturar y al modificar sus movimientos.
async function comprobarObraNoFacturada(client,id) {
    const factura=await client.query("SELECT id_documento FROM documento_tributario WHERE id_obra=$1 AND id_proveedor IS NULL AND tipo_documento='factura' LIMIT 1",[id]);
    if(factura.rows.length)throw new ErrorHttp(409,'La obra está facturada. Sus datos de cobro están bloqueados; registra una nota de crédito para corregir montos');
}
module.exports={comprobarObraNoFacturada};
