/*
 * Presentación compartida del detalle y los importes de una factura de cliente.
 * Muestra los servicios, materiales y totales recibidos; permite conservar el mismo resumen entre pantallas.
 */

import {pesos} from '../utils/importes';

export default function ResumenFacturaCliente({datos}){
    const nota=datos.tipo_documento==='nota_credito';
    return <>
        <p><strong>Cliente:</strong> {datos.razon_social} · RUT {datos.rut_cliente}</p><p><strong>Obra:</strong> {datos.nombre_obra}</p>
        {!nota && <div className="alpha-tabla"><table><caption>Servicios y materiales — valores netos</caption><thead><tr><th>Concepto</th><th>Tipo</th><th>Cantidad</th><th>Unidad</th><th>Precio neto unitario (CLP)</th><th>Subtotal neto (CLP)</th></tr></thead>
            <tbody>{datos.detalles.map((l,i)=><tr key={i}><td>{l.descripcion}</td><td>{l.tipo}</td><td>{Number(l.cantidad).toLocaleString('es-CL',{maximumFractionDigits:3})}</td><td>{l.unidad_medida}</td><td>{pesos(l.precio_neto_unitario)}</td><td>{pesos(l.subtotal)}</td></tr>)}</tbody></table></div>}
        <dl>{!nota && <><dt>Subtotal neto</dt><dd>{pesos(datos.subtotal)} CLP</dd><dt>Descuento general ({datos.descuento_general} %)</dt><dd>{pesos(datos.importe_descuento_general)} CLP</dd></>}
            <dt>{nota?'Neto de rebaja':'Total neto'}</dt><dd>{pesos(datos.total_neto)} CLP</dd><dt>IVA ({Number(datos.tasa_iva ?? 19)} %)</dt><dd>{pesos(datos.iva)} CLP</dd><dt>{nota?'Total a rebajar':'Total'}</dt><dd><strong>{pesos(datos.total)} CLP</strong></dd>
            {datos.saldo_pendiente!=null && <><dt>Notas de crédito</dt><dd>{pesos(datos.total_notas_credito)} CLP</dd><dt>Abonos</dt><dd>{pesos(datos.total_pagado)} CLP</dd><dt>Saldo por cobrar</dt><dd>{pesos(datos.saldo_pendiente)} CLP</dd></>}
        </dl>
    </>;
}
