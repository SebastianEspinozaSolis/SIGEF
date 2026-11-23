const ErrorHttp = require('../../utils/ErrorHttp');
const { calcularDetalle } = require('../../utils/importesDocumento');

const tipos = { factura: 'Factura', boleta: 'Boleta', guia_despacho: 'Guía de despacho', nota_credito: 'Nota de crédito' };
const movimientos = { INGRESO: 'Ingreso', EGRESO: 'Egreso', MERMA: 'Merma', AJUSTE: 'Ajuste', USO_INTERNO: 'Uso interno', DEVOLUCION_PROVEEDOR: 'Devolución a proveedor', REVERSA: 'Reversa' };
const escapar = valor => String(valor ?? '—').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const { pesos } = require('../../utils/formatoImportes');
function decimal(valor) {
    if (valor == null) return '—';
    const [entero, fraccion = ''] = String(valor).split('.');
    const decimales = fraccion.replace(/0+$/, '');
    return `${entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${decimales ? `,${decimales}` : ''}`;
}
function fecha(valor) {
    if (!valor) return '—';
    // pg entrega DATE como medianoche local; los JSON de agregados usan texto ISO.
    if (valor instanceof Date) return `${String(valor.getDate()).padStart(2, '0')}-${String(valor.getMonth() + 1).padStart(2, '0')}-${valor.getFullYear()}`;
    return String(valor).slice(0, 10).split('-').reverse().join('-');
}
function fechaHora(valor) { return valor ? new Date(valor).toLocaleString('es-CL', { timeZone: 'America/Santiago' }) : '—'; }

// Solo las plantillas internas aportan HTML; todo texto del documento se escapa.
function pagina(titulo, subtitulo, cuerpo) {
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapar(titulo)}</title><style>
        *{box-sizing:border-box}html{background:#fff;color-scheme:light}body{background:#fff;font-family:Arial,sans-serif;color:#213347;font-size:12px;line-height:1.5;margin:0}
        header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #24588c;padding-bottom:14px;margin-bottom:22px}
        .marca{font-size:27px;letter-spacing:2px;font-weight:bold;color:#24588c}.empresa{font-size:10px;color:#526477}
        .sistema{font-size:11px;text-align:right}h1{font-size:21px;margin:0 0 4px}h2{font-size:13px;margin:20px 0 8px;color:#24588c}
        .subtitulo,.nota{color:#526477}.subtitulo{margin:0 0 16px}.datos{display:grid;grid-template-columns:1fr 1fr;gap:8px 22px;padding:14px;background:#f2f6fa;border-radius:5px}
        .datos b{display:block;font-size:9px;color:#526477;text-transform:uppercase}.datos span{font-size:11px}
        table{width:100%;border-collapse:collapse;margin:8px 0 16px;table-layout:auto}thead{display:table-header-group}
        th{background:#24588c;color:white;font-size:10px;text-align:left;padding:8px}td{padding:7px;border-bottom:1px solid #dde4eb;vertical-align:top;overflow-wrap:anywhere}
        tbody tr:nth-child(even){background:#f5f8fb}tr{break-inside:avoid}h2{break-after:avoid}
        .numero{text-align:right;white-space:nowrap}.totales{width:62%;margin-left:auto}.totales td{padding:6px 9px}.total{background:#e3edf7!important;font-size:13px;font-weight:bold}
        .observaciones{white-space:pre-wrap;overflow-wrap:anywhere}.aviso{padding:10px 12px;background:#f2f6fa;border-left:3px solid #24588c;margin:14px 0}
        .barras{margin:10px 0 18px}.barra-fila{margin:8px 0}.barra-fila p{display:flex;justify-content:space-between;margin:0 0 3px}
        .pista{background:#e7edf3;height:9px}.barra{height:9px;background:#24588c}.negativa{background:#a01818}
        @page{size:A4}footer{margin-top:20px;padding-top:10px;border-top:1px solid #ccd6df;font-size:9px;color:#526477}
        </style></head><body><header><div><div class="marca">FYAG</div><div class="empresa">Frío y Agroindustria SpA</div></div>
        <div class="sistema"><strong>SIGEF</strong><br>Gestión empresarial</div></header><h1>${escapar(titulo)}</h1><p class="subtitulo">${escapar(subtitulo)}</p>
        ${cuerpo}<footer>Documento generado por SIGEF · Importes expresados en CLP.</footer></body></html>`;
}

function tabla(titulo, columnas, filas, numericas = [], monetarias = []) {
    return `<h2>${escapar(titulo)}</h2>${!filas.length ? '<p class="nota">Sin registros.</p>' : `<table><thead><tr>${columnas.map(c => `<th>${escapar(c)}</th>`).join('')}</tr></thead><tbody>
        ${filas.map(f => `<tr>${f.map((v, i) => `<td${numericas.includes(i) ? ' class="numero"' : ''}>${escapar(monetarias.includes(i) ? pesos(v) : numericas.includes(i) && v != null ? decimal(v) : v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`}`;
}

function htmlDocumento(d) {
    const esNota = d.tipo_documento === 'nota_credito';
    const esBoleta = d.tipo_documento === 'boleta';
    const datos = [['Proveedor', d.razon_social], ['RUT', d.rut_proveedor], ['Fecha de emisión', fecha(d.fecha_emision)],
        ...(d.tipo_documento === 'factura' ? [['Vencimiento', fecha(d.fecha_vencimiento)]] : []), ['Fecha de registro', fechaHora(d.fecha_ingreso)], ['Factura de referencia', d.id_documento_referencia ? `Folio ${d.folio_documento_referencia || d.id_documento_referencia}` : '—']];
    const totales = esNota ? [['Neto de la correcci\u00f3n', d.total_neto], ['IVA (19 %)', d.iva], ['Total a rebajar', d.total]] : [[esBoleta ? 'Subtotal bruto (IVA incluido)' : 'Subtotal', d.subtotal], ['Descuentos por producto', d.descuento_productos], [esBoleta ? 'Bruto tras descuentos por producto' : 'Subtotal tras descuentos por producto', d.neto_productos],
        [d.es_factura_guias ? 'Descuentos generales incluidos en las guías' : `Descuento general (${decimal(d.descuento_general)} %)`, d.importe_descuento_general], [d.es_factura_guias ? 'Descuentos por pronto pago incluidos en las guías' : `Descuento pronto pago (${decimal(d.descuento_pronto_pago)} %)`, d.importe_descuento_pronto_pago],
        ['Total neto', d.total_neto], [`IVA ${esBoleta ? 'incluido ' : ''}(${decimal(d.tasa_iva)} %)`, d.iva], ['Total final', d.total]];
    if (d.saldo_pendiente != null) {
        totales.push(['Pagado', d.total_pagado]);
        if (Number(d.total_notas_credito) > 0) totales.push(['Notas de cr\u00e9dito aplicadas', d.total_notas_credito]);
        totales.push(['Saldo pendiente', d.saldo_pendiente]);
    }
    return pagina('Comprobante de registro', `${tipos[d.tipo_documento] || d.tipo_documento} · Folio ${d.folio}`, `
        <div class="datos">${datos.map(([k, v]) => `<div><b>${escapar(k)}</b><span>${escapar(v)}</span></div>`).join('')}</div>
        ${esBoleta ? '<p>Pagada: pago incluido al registrar la boleta.</p>' : ''}
        ${d.tipo_documento === 'guia_despacho' ? '<p>Importes referenciales. La guía no genera deuda.</p>' : ''}
        ${d.es_factura_guias ? `<p>Factura de guías. Los importes incluyen los descuentos aplicados en cada guía. La recepción se realiza desde las guías: ${(d.guias || []).map(g => escapar(g.folio)).join(', ')}.</p>` : ''}
        ${(d.facturas_relacionadas || []).map(f => `<p>Facturada en factura ${escapar(f.folio)}.</p>`).join('')}
        ${esNota ? '' : `<h2>Materiales · importes ${esBoleta ? 'con IVA incluido' : 'sin IVA'}</h2>
        <table><thead><tr><th>Artículo / observaciones</th><th>Cantidad</th><th>Unidad</th><th>Costo ${esBoleta ? 'bruto' : 'neto'} unitario</th><th>Detalle del importe (CLP)</th></tr></thead><tbody>
        ${d.detalles.map(l => {
            const detalle = l.desglose || calcularDetalle(l, d);
            return `<tr><td>${escapar(l.articulo)}${l.observaciones ? `<p>${escapar(l.observaciones)}</p>` : ''}</td>
                <td class="numero">${escapar(decimal(l.cantidad))}</td><td>${escapar(l.unidad_medida)}</td><td class="numero">${escapar(pesos(esBoleta ? l.costo_bruto : l.costo_neto))}</td>
                <td><div>Subtotal producto: ${escapar(pesos(detalle.subtotal))}</div>
                    ${detalle.descuentos.map(x => `<div>Descuento ${x.orden} (${escapar(decimal(x.porcentaje))} %): −${escapar(pesos(x.importe))}</div>`).join('')}
                    ${detalle.descuentos.length ? `<div><b>${esBoleta ? 'Bruto' : 'Neto'} producto: ${escapar(pesos(detalle.total_neto))}</b></div>` : ''}</td></tr>`;
        }).join('')}</tbody></table>`}
        <table class="totales"><tbody>${totales.map(([k, v]) => `<tr${k === 'Total final' || k === 'Total a rebajar' ? ' class="total"' : ''}><td>${escapar(k)}</td><td class="numero">${escapar(pesos(v))} CLP</td></tr>`).join('')}</tbody></table>
        ${d.observaciones ? `<h2>Observaciones</h2><p class="observaciones">${escapar(d.observaciones)}</p>` : ''}
        <p class="aviso">Comprobante interno de SIGEF. No reemplaza el documento emitido por el proveedor.</p>`);
}

function seccionesResumen(r) {
    const i = r.indicadores;
    return [
        { nombre: 'Indicadores', columnas: ['Indicador', 'Valor', 'Alcance'], numericas: [1], filas: [
            ['Compras recibidas (CLP)', i.compras_mes, 'Mes seleccionado · Sin IVA · Corregidas por reversas'],
            ['Presupuestos aprobados', i.presupuestos_aprobados, 'Emitidos en el mes; estado actual'], ['Presupuestos pendientes', i.presupuestos_pendientes, 'Emitidos en el mes; estado actual'],
            ['Servicios realizados', i.servicios_realizados, 'Obras finalizadas con cierre en el mes; flujo de cierre pendiente'],
            ['Cuentas por pagar (CLP)', i.cuentas_por_pagar, 'Saldo actual menos abonos y notas de crédito aplicadas'],
            ['Stock crítico', i.stock_critico, 'Situación actual'], ['Facturas próximas a vencer', i.facturas_por_vencer, 'Situación actual · próximos 7 días'],
            ['Facturas vencidas', i.facturas_vencidas, 'Situación actual'], ['Obras en proceso', i.obras_en_proceso, 'Situación actual'],
            ['Ventas del mes', null, 'Pendiente de documentos de clientes'], ['Cuentas por cobrar', null, 'Pendiente de documentos y cobros de clientes'],
        ] },
        { nombre: 'Compras', columnas: ['Mes', 'Costo neto recibido (CLP)'], numericas: [1], monetarias: [1], filas: r.compras_por_mes.map(x => [x.mes, x.total]) },
        { nombre: 'Presupuestos', columnas: ['Estado actual', 'Cantidad emitida en el mes'], numericas: [1], filas: r.presupuestos.map(x => [x.estado, x.cantidad]) },
        { nombre: 'Obras', columnas: ['Estado actual', 'Cantidad'], numericas: [1], filas: r.obras.map(x => [x.estado, x.cantidad]) },
        { nombre: 'Movimientos', columnas: ['Tipo', 'Registros del mes'], numericas: [1], filas: r.movimientos.map(x => [movimientos[x.tipo] || x.tipo, x.cantidad]) },
        { nombre: 'Stock critico', columnas: ['Código', 'Artículo', 'Unidad', 'Disponible', 'Mínimo'], numericas: [3, 4], filas: r.stock_critico.map(x => [x.codigo_interno, x.nombre, x.unidad_medida, x.disponible, x.minimo]) },
        { nombre: 'Vencimientos', columnas: ['Proveedor', 'Folio', 'Vencimiento', 'Saldo (CLP)'], numericas: [3], monetarias: [3], filas: r.vencimientos.map(x => [x.razon_social, x.folio, fecha(x.fecha_vencimiento), x.saldo]) },
        { nombre: 'Materiales', columnas: ['Código', 'Artículo', 'Tipo', 'Cantidad neta', 'Unidad', 'Registros incluidos'], numericas: [3, 5], filas: r.materiales.registros.map(x => [x.codigo_interno, x.nombre, movimientos[x.tipo] || x.tipo, x.cantidad, x.unidad_medida, x.registros]) },
    ];
}

function grafico(titulo, filas, moneda = false) {
    const maximo = Math.max(1, ...filas.map(f => Math.abs(Number(f[1]) || 0)));
    return `<h2>${escapar(titulo)}</h2><div class="barras">${filas.map(([k, v]) => `<div class="barra-fila"><p><span>${escapar(k)}</span><b>${escapar(moneda ? pesos(v) : decimal(v))}</b></p>
        <div class="pista"><div class="barra${Number(v) < 0 ? ' negativa' : ''}" style="width:${Math.abs(Number(v) || 0) / maximo * 100}%"></div></div></div>`).join('')}</div>`;
}

function htmlResumen(r) {
    const secciones = seccionesResumen(r);
    return pagina('Resumen de gestión', `Período ${r.mes} · Consulta ${fechaHora(r.actualizado_en)}`, `
        <p class="aviso">Actividad del mes seleccionado y situación actual de saldos, stock y obras. Los datos pendientes no se presentan como cero.</p>
        ${tabla(secciones[0].nombre, secciones[0].columnas, secciones[0].filas.map(f => [f[0], f[1] == null ? 'Pendiente' : f[0].includes('(CLP)') ? pesos(f[1]) : decimal(f[1]), f[2]]))}
        ${grafico('Compras recibidas · últimos seis meses · CLP sin IVA', r.compras_por_mes.map(x => [x.mes, x.total]), true)}
        ${grafico('Presupuestos por estado', r.presupuestos.map(x => [x.estado, x.cantidad]))}
        ${secciones.slice(1).map(s => tabla(s.nombre, s.columnas, s.filas, s.numericas, s.monetarias)).join('')}
        <p class="nota">Las cantidades de materiales se separan por artículo y unidad. Las reversas corrigen el tipo original en su fecha de registro; pueden producir netos negativos. Uso interno representa asignación.</p>`);
}

// Excel admite aproximadamente quince dígitos significativos; los importes mayores quedan como texto.
function numeroExcel(valor) {
    if (valor == null) return 'Pendiente';
    const texto = String(valor);
    if (!/^-?\d+(\.\d+)?$/.test(texto)) return texto;
    const significativos = texto.replace('-', '').replace('.', '').replace(/^0+/, '').replace(/0+$/, '');
    return significativos.length <= 15 && Number.isFinite(Number(texto)) ? Number(texto) : texto;
}

function crearExcel(r) {
    const XLSX = require('xlsx');
    const libro = XLSX.utils.book_new();
    const metadatos = [['Informe', 'Resumen de gestión SIGEF'], ['Mes', r.mes], ['Consulta', fechaHora(r.actualizado_en)],
        ['Regla', 'Actividad mensual; saldos y stock actuales. Importes en CLP. Notas de crédito aún no aplicadas.']];
    XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(metadatos), 'Informe');
    for (const s of seccionesResumen(r)) {
        const filas = s.filas.map(f => Object.fromEntries(s.columnas.map((c, n) => [c, s.numericas.includes(n) ? numeroExcel(f[n]) : String(f[n] ?? '—')])));
        const hoja = XLSX.utils.json_to_sheet(filas, { header: s.columnas });
        // Excel conserva el valor numérico: el formato solo muestra pesos enteros.
        for (const columna of (s.nombre === 'Indicadores' ? [1] : s.monetarias || [])) {
            for (let fila = 0; fila < s.filas.length; fila++) {
                const celda = hoja[XLSX.utils.encode_cell({r:fila+1,c:columna})];
                if (celda?.t === 'n') celda.z = '#,##0';
            }
        }
        hoja['!cols'] = s.columnas.map((c, n) => ({ wch: Math.min(55, Math.max(c.length + 2, ...s.filas.map(f => String(f[n] ?? '').length + 2), 12)) }));
        if (hoja['!ref']) hoja['!autofilter'] = { ref: hoja['!ref'] };
        XLSX.utils.book_append_sheet(libro, hoja, s.nombre);
    }
    return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx', compression: true });
}

let pdfEnCurso = 0;
async function generarPdf(html) {
    if (pdfEnCurso >= 2) throw new ErrorHttp(429, 'Hay informes generándose. Intenta nuevamente en unos momentos');
    pdfEnCurso++;
    let navegador;
    try {
        const puppeteer = require('puppeteer');
        navegador = await puppeteer.launch({ headless: true, timeout: 30000 });
        const hoja = await navegador.newPage();
        await hoja.setJavaScriptEnabled(false);
        await hoja.setRequestInterception(true);
        hoja.on('request', solicitud => { solicitud.abort().catch(() => {}); });
        await hoja.setContent(html, { waitUntil: 'load', timeout: 15000 });
        return Buffer.from(await hoja.pdf({ format: 'A4', printBackground: true, timeout: 30000,
            margin: { top: '16mm', bottom: '19mm', left: '14mm', right: '14mm' },
            displayHeaderFooter: true, headerTemplate: '<span></span>',
            footerTemplate: '<div style="font-size:9px;width:100%;text-align:center;color:#526477">SIGEF · Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>',
        }));
    } finally {
        try { if (navegador) await navegador.close(); } finally { pdfEnCurso--; }
    }
}

function htmlFacturaCliente(d) {
    const nota=d.tipo_documento==='nota_credito';
    return pagina(nota?'Nota de crédito de cliente':'Factura de cliente',`Folio ${d.folio}`,`
        <p><b>Cliente:</b> ${escapar(d.razon_social)} · RUT ${escapar(d.rut_cliente)}</p>
        <p><b>Obra:</b> ${escapar(d.nombre_obra)}</p><p>Emisión: ${escapar(fecha(d.fecha_emision))}${nota?'':` · Vencimiento: ${escapar(fecha(d.fecha_vencimiento))}`}</p>
        ${nota?`<p>Factura de referencia: ${escapar(d.folio_referencia)}</p>`:tabla('Servicios y materiales',
            ['Concepto','Tipo','Cantidad','Unidad','Precio neto unitario (CLP)','Subtotal neto (CLP)'],d.detalles.map(l=>[l.descripcion,l.tipo,l.cantidad,l.unidad_medida,l.precio_neto_unitario,l.subtotal]),[2,4,5],[4,5])}
        ${tabla('Importes (CLP)',['Concepto','Monto'],nota?[['Neto de rebaja',d.total_neto],['IVA 19 %',d.iva],['Total a rebajar',d.total]]:
            [['Subtotal neto',d.subtotal],[`Descuento (${d.descuento_general} %)`,d.importe_descuento_general],['Total neto',d.total_neto],['IVA 19 %',d.iva],['Total',d.total],['Notas de crédito',d.total_notas_credito],['Abonos',d.total_pagado],['Saldo por cobrar',d.saldo_pendiente]],[1],[1])}
        ${d.observaciones?`<p>${escapar(d.observaciones)}</p>`:''}
        <p class="aviso">Registro interno de SIGEF. No reemplaza un documento tributario emitido ante el SII.</p>`);
}
module.exports = { htmlDocumento, htmlFacturaCliente, htmlResumen, crearExcel, generarPdf };
