/*
 * Definición de los campos y nombres que comparten las fichas de clientes, proveedores y categorías.
 * También reúne campos de contactos, cuentas y opciones de documentos para evitar repetirlos en los formularios.
 */

export const fichas = {
    clientes: {
        titulo: 'Clientes', id: 'id_cliente', campos: [
            ['rut_cliente', 'RUT', 12, true], ['razon_social', 'Razón social', 150, true],
            ['giro', 'Giro comercial', 150, true], ['direccion', 'Dirección', 200, true],
            ['id_region', 'Región', 100, true], ['id_comuna', 'Comuna', 100, true], ['ciudad', 'Ciudad', 100, true],
        ],
    },
    proveedores: {
        titulo: 'Proveedores', id: 'id_proveedor', campos: [
            ['rut_proveedor', 'RUT', 12, true], ['razon_social', 'Razón social', 150, true],
            ['direccion', 'Dirección', 200, true], ['id_region', 'Región', 100, true],
            ['id_comuna', 'Comuna', 100, true], ['ciudad', 'Ciudad', 100, true],
        ],
    },
    categorias: {
        titulo: 'Categorías de artículos', id: 'id_categoria',
        campos: [['nombre_categoria', 'Nombre de la categoría', 80, true]],
    },
};

export const camposEjecutivo = [['nombre', 'Nombre', 150], ['rut', 'RUT', 12], ['cargo', 'Cargo', 100],
    ['email', 'Correo electrónico', 120], ['telefono', 'Teléfono con prefijo país', 30]];
export const areasCliente = [['contactos_proyecto', 'Contactos de proyectos'], ['contactos_finanzas', 'Contactos de finanzas']];
export const camposBanco = [['banco', 'Banco', 100], ['tipo_cuenta', 'Tipo de cuenta', 50],
    ['numero_cuenta', 'Número de cuenta', 50], ['email_pagos', 'Correo para pagos', 120]];

export const tiposDocumento = [['factura', 'Factura'], ['boleta', 'Boleta'], ['guia_despacho', 'Guía de Despacho'], ['nota_credito', 'Nota de Crédito']];
