-- =====================================================
-- SIGEF - schema.sql (PostgreSQL)
-- Fuente de verdad del modelo de datos.
-- OJO: las dos primeras lineas BORRAN todo y recrean la base vacia.
-- Sirve en desarrollo para re-ejecutar el archivo sin errores.
-- NO usar en produccion con datos reales.
-- =====================================================
SET client_encoding TO 'UTF8';
SET TIME ZONE 'America/Santiago';
-- TIMESTAMPTZ conserva instantes; las consultas y pantallas usan el calendario de Santiago.
-- DATE conserva días de emisión, vencimiento y pago, sin convertirlos en instantes.

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- ---------- TRANSVERSAL ----------
CREATE TABLE rol (
  id_rol      SERIAL PRIMARY KEY,
  nombre_rol  VARCHAR(50) NOT NULL UNIQUE
);

COMMENT ON TABLE rol IS
  'Catálogo de roles utilizados para controlar el acceso a las funcionalidades del sistema.';
COMMENT ON COLUMN rol.id_rol IS
  'Identificador del rol.';
COMMENT ON COLUMN rol.nombre_rol IS
  'Nombre del rol.';

CREATE TABLE usuario (
  id_usuario       SERIAL PRIMARY KEY,
  rut              VARCHAR(12)  NOT NULL UNIQUE,
  nombres          VARCHAR(80)  NOT NULL,
  apellidos        VARCHAR(80)  NOT NULL,
  email            VARCHAR(120) NOT NULL UNIQUE,
  password_hash    VARCHAR(255) NOT NULL,
  id_rol           INT NOT NULL REFERENCES rol(id_rol),
  estado           VARCHAR(20) NOT NULL DEFAULT 'Activo'
  CHECK (estado IN ('Activo', 'Inactivo'))
);

COMMENT ON TABLE usuario IS
  'Usuarios del sistema, con sus datos de identificación, credenciales de acceso, rol y estado.';
COMMENT ON COLUMN usuario.id_usuario IS
  'Identificador del usuario.';
COMMENT ON COLUMN usuario.rut IS
  'RUT del usuario.';
COMMENT ON COLUMN usuario.nombres IS
  'Nombres del usuario.';
COMMENT ON COLUMN usuario.apellidos IS
  'Apellidos del usuario.';
COMMENT ON COLUMN usuario.email IS
  'Correo electrónico utilizado para iniciar sesión.';
COMMENT ON COLUMN usuario.password_hash IS
  'Hash de la contraseña del usuario, no su texto original.';
COMMENT ON COLUMN usuario.id_rol IS
  'Rol asignado al usuario.';
COMMENT ON COLUMN usuario.estado IS
  'Estado del usuario.';

CREATE TABLE registro_auditoria (
  id_auditoria          SERIAL PRIMARY KEY,
  id_usuario            INT NOT NULL REFERENCES usuario(id_usuario),
  tabla_afectada        VARCHAR(60) NOT NULL,
  id_registro_afectado  INT NOT NULL,
  accion                VARCHAR(20) NOT NULL,
  valores_anteriores    JSONB,
  valores_nuevos        JSONB,
  fecha_hora            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE registro_auditoria IS
  'Historial de acciones y sus responsables, sin contraseñas, hashes ni tokens.';
COMMENT ON COLUMN registro_auditoria.id_auditoria IS
  'Identificador de la auditoría.';
COMMENT ON COLUMN registro_auditoria.id_usuario IS
  'Responsable obtenido de la identidad autenticada.';
COMMENT ON COLUMN registro_auditoria.tabla_afectada IS
  'Nombre de la tabla sobre la que se realizó la acción.';
COMMENT ON COLUMN registro_auditoria.id_registro_afectado IS
  'ID del registro afectado; no es FK porque puede pertenecer a distintas tablas.';
COMMENT ON COLUMN registro_auditoria.accion IS
  'Acción auditada, por ejemplo CREAR_FICHA o CAMBIAR_PASSWORD.';
COMMENT ON COLUMN registro_auditoria.valores_anteriores IS
  'Datos previos sin secretos; NULL en altas o cambios de contraseña.';
COMMENT ON COLUMN registro_auditoria.valores_nuevos IS
  'Datos posteriores sin secretos; NULL cuando no corresponde registrar valores.';
COMMENT ON COLUMN registro_auditoria.fecha_hora IS
  'Instante de registro de la auditoría. Se presenta en America/Santiago.';

-- ---------- ALPHA: CATALOGOS ----------
-- Catálogo geográfico compartido; cada comuna pertenece a una sola región.
CREATE TABLE region (
  id_region  SERIAL PRIMARY KEY,
  nombre     VARCHAR(100) NOT NULL UNIQUE
);

COMMENT ON TABLE region IS
  'Catálogo de regiones utilizado junto con las comunas para seleccionar ubicaciones en las fichas de clientes y proveedores.';
COMMENT ON COLUMN region.id_region IS
  'Identificador interno de la región; no es un código territorial oficial.';
COMMENT ON COLUMN region.nombre IS
  'Nombre de la región.';

CREATE TABLE comuna (
  id_comuna  SERIAL PRIMARY KEY,
  id_region  INT NOT NULL REFERENCES region(id_region),
  nombre     VARCHAR(100) NOT NULL,
  UNIQUE (id_region, nombre)
);

COMMENT ON TABLE comuna IS
  'Catálogo de comunas.';
COMMENT ON COLUMN comuna.id_comuna IS
  'Identificador interno de la comuna; no es un código territorial oficial.';
COMMENT ON COLUMN comuna.id_region IS
  'Región a la que pertenece la comuna.';
COMMENT ON COLUMN comuna.nombre IS
  'Nombre único dentro de la región; puede repetirse en otra región.';

CREATE TABLE categoria_articulo (
  id_categoria      SERIAL PRIMARY KEY,
  nombre_categoria  VARCHAR(80) NOT NULL UNIQUE
);

COMMENT ON TABLE categoria_articulo IS
  'Catálogo de categorías utilizadas para clasificar los artículos del inventario.';
COMMENT ON COLUMN categoria_articulo.id_categoria IS
  'Identificador de la categoría.';
COMMENT ON COLUMN categoria_articulo.nombre_categoria IS
  'Nombre de la categoría.';

CREATE TABLE proveedor (
  id_proveedor          SERIAL PRIMARY KEY,
  rut_proveedor         VARCHAR(12)  NOT NULL UNIQUE,
  razon_social          VARCHAR(150) NOT NULL,
  direccion             VARCHAR(200) NOT NULL,
  id_comuna             INT NOT NULL REFERENCES comuna(id_comuna),
  ciudad                VARCHAR(100) NOT NULL
);

COMMENT ON TABLE proveedor IS
  'Ficha de identificación y ubicación de cada proveedor de la empresa.';
COMMENT ON COLUMN proveedor.id_proveedor IS
  'Identificador del proveedor.';
COMMENT ON COLUMN proveedor.rut_proveedor IS
  'RUT del proveedor.';
COMMENT ON COLUMN proveedor.razon_social IS
  'Nombre legal de la empresa proveedora.';
COMMENT ON COLUMN proveedor.direccion IS
  'Dirección del proveedor.';
COMMENT ON COLUMN proveedor.id_comuna IS
  'Comuna del proveedor; permite obtener su región.';
COMMENT ON COLUMN proveedor.ciudad IS
  'Ciudad del proveedor.';

-- Cero o varias cuentas por proveedor; se inactivan sin eliminar su registro.
CREATE TABLE datos_bancarios_proveedor (
  id_datos_bancarios SERIAL PRIMARY KEY,
  id_proveedor  INT NOT NULL REFERENCES proveedor(id_proveedor),
  banco         VARCHAR(100) NOT NULL,
  tipo_cuenta   VARCHAR(50) NOT NULL,
  numero_cuenta VARCHAR(50) NOT NULL,
  email_pagos   VARCHAR(120) NOT NULL,
  activo        BOOLEAN NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE datos_bancarios_proveedor IS
  'Cuentas de proveedores: cero o varias por proveedor; pueden inactivarse sin borrarlas.';
COMMENT ON COLUMN datos_bancarios_proveedor.id_datos_bancarios IS
  'Identificador de la cuenta bancaria.';
COMMENT ON COLUMN datos_bancarios_proveedor.id_proveedor IS
  'Proveedor de la cuenta; un proveedor puede tener varias cuentas.';
COMMENT ON COLUMN datos_bancarios_proveedor.banco IS
  'Nombre del banco de la cuenta del proveedor.';
COMMENT ON COLUMN datos_bancarios_proveedor.tipo_cuenta IS
  'Tipo de cuenta bancaria.';
COMMENT ON COLUMN datos_bancarios_proveedor.numero_cuenta IS
  'Número de cuenta como texto para conservar formato y ceros iniciales.';
COMMENT ON COLUMN datos_bancarios_proveedor.email_pagos IS
  'Correo electrónico para comunicaciones de pagos al proveedor.';
COMMENT ON COLUMN datos_bancarios_proveedor.activo IS
  'Habilita la cuenta sin borrar su historial; pagar no la inactiva.';

-- Cada proveedor puede tener varios ejecutivos
CREATE TABLE ejecutivo_comercial (
  id_ejecutivo  SERIAL PRIMARY KEY,
  id_proveedor  INT NOT NULL REFERENCES proveedor(id_proveedor),
  nombre        VARCHAR(150) NOT NULL,
  rut           VARCHAR(12) NOT NULL,
  cargo         VARCHAR(100) NOT NULL,
  email         VARCHAR(120) NOT NULL,
  telefono      VARCHAR(30) NOT NULL,
  UNIQUE (id_proveedor, rut) -- Un ejecutivo por proveedor no puede tener el mismo RUT que otro ejecutivo del mismo proveedor
);

COMMENT ON TABLE ejecutivo_comercial IS
  'Contactos comerciales de proveedores, sin repetir RUT dentro del mismo proveedor.';
COMMENT ON COLUMN ejecutivo_comercial.id_ejecutivo IS
  'Identificador del ejecutivo comercial.';
COMMENT ON COLUMN ejecutivo_comercial.id_proveedor IS
  'Proveedor al que pertenece el ejecutivo.';
COMMENT ON COLUMN ejecutivo_comercial.nombre IS
  'Nombre del ejecutivo comercial.';
COMMENT ON COLUMN ejecutivo_comercial.rut IS
  'RUT validado y normalizado; único por proveedor.';
COMMENT ON COLUMN ejecutivo_comercial.cargo IS
  'Cargo del ejecutivo comercial.';
COMMENT ON COLUMN ejecutivo_comercial.email IS
  'Correo electrónico de contacto del ejecutivo.';
COMMENT ON COLUMN ejecutivo_comercial.telefono IS
  'Teléfono chileno validado con prefijo +56 y nueve dígitos nacionales.';

CREATE TABLE cliente (
  id_cliente         SERIAL PRIMARY KEY,
  rut_cliente        VARCHAR(12)  NOT NULL UNIQUE,
  razon_social       VARCHAR(150) NOT NULL,
  giro               VARCHAR(150) NOT NULL,
  direccion          VARCHAR(200) NOT NULL,
  id_comuna          INT NOT NULL REFERENCES comuna(id_comuna),
  ciudad             VARCHAR(100) NOT NULL
);

COMMENT ON TABLE cliente IS
  'Identificación, giro y ubicación del cliente; contactos separados por área en contacto_cliente.';
COMMENT ON COLUMN cliente.id_cliente IS
  'Identificador del cliente.';
COMMENT ON COLUMN cliente.rut_cliente IS
  'RUT del cliente.';
COMMENT ON COLUMN cliente.razon_social IS
  'Nombre legal de la empresa cliente.';
COMMENT ON COLUMN cliente.giro IS
  'Giro comercial o actividad económica del cliente.';
COMMENT ON COLUMN cliente.direccion IS
  'Dirección del cliente.';
COMMENT ON COLUMN cliente.id_comuna IS
  'Comuna del cliente; permite obtener su región.';
COMMENT ON COLUMN cliente.ciudad IS
  'Ciudad del cliente.';

-- Se admiten varios encargados de cada área para una misma empresa.
CREATE TABLE contacto_cliente (
  id_contacto  SERIAL PRIMARY KEY,
  id_cliente   INT NOT NULL REFERENCES cliente(id_cliente),
  area         VARCHAR(30) NOT NULL CHECK (area IN ('Proyecto', 'Finanzas')),
  nombre       VARCHAR(150) NOT NULL,
  rut          VARCHAR(12) NOT NULL,
  cargo        VARCHAR(100) NOT NULL,
  email        VARCHAR(120) NOT NULL,
  telefono     VARCHAR(30) NOT NULL,
  UNIQUE (id_cliente, area, rut)
);

COMMENT ON TABLE contacto_cliente IS
  'Contactos de Proyecto o Finanzas; un RUT puede figurar en ambas áreas o en otros clientes.';
COMMENT ON COLUMN contacto_cliente.id_contacto IS
  'Identificador del contacto.';
COMMENT ON COLUMN contacto_cliente.id_cliente IS
  'Cliente al que pertenece el contacto.';
COMMENT ON COLUMN contacto_cliente.area IS
  'Área Proyecto o Finanzas, determinada por el apartado del formulario.';
COMMENT ON COLUMN contacto_cliente.nombre IS
  'Nombre del contacto.';
COMMENT ON COLUMN contacto_cliente.rut IS
  'RUT validado y normalizado; único por cliente y área.';
COMMENT ON COLUMN contacto_cliente.cargo IS
  'Cargo del contacto en la empresa cliente.';
COMMENT ON COLUMN contacto_cliente.email IS
  'Correo electrónico del contacto.';
COMMENT ON COLUMN contacto_cliente.telefono IS
  'Teléfono chileno validado con prefijo +56 y nueve dígitos nacionales.';

CREATE TABLE articulo (
  id_articulo         SERIAL PRIMARY KEY,
  codigo_interno      VARCHAR(40)  NOT NULL UNIQUE,
  codigo_barras       VARCHAR(60) NOT NULL UNIQUE,
  nombre              VARCHAR(150) NOT NULL,
  id_categoria        INT NOT NULL REFERENCES categoria_articulo(id_categoria),
  unidad_medida       VARCHAR(20)  NOT NULL,
  ubicacion_bodega    VARCHAR(80) NOT NULL,
  bodega_sector       VARCHAR(80) NOT NULL,
  descripcion         TEXT,
  precio_lista        NUMERIC(14,0) NOT NULL CHECK (precio_lista >= 0),
  fecha_actualizacion_precio TIMESTAMPTZ NOT NULL DEFAULT now(),
  stock_minimo        NUMERIC(12,3) NOT NULL DEFAULT 0,
  stock_actual        NUMERIC(12,3) NOT NULL DEFAULT 0,
  stock_comprometido  NUMERIC(12,3) NOT NULL DEFAULT 0,
  precio_pmp          NUMERIC(14,4) NOT NULL DEFAULT 0,
  activo              BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT chk_articulo_stock_minimo CHECK (stock_minimo >= 0),
  CONSTRAINT chk_articulo_stock_actual CHECK (stock_actual >= 0),
  CONSTRAINT chk_articulo_stock_comprometido CHECK (stock_comprometido >= 0),
  CONSTRAINT chk_articulo_stock_disponible CHECK (stock_actual >= stock_comprometido)
);

COMMENT ON TABLE articulo IS
  'Catálogo y existencias. Disponible en bodega = stock_actual - stock_comprometido.';
COMMENT ON COLUMN articulo.id_articulo IS
  'Identificador del artículo.';
COMMENT ON COLUMN articulo.codigo_interno IS
  'Código interno utilizado para identificar y buscar el artículo.';
COMMENT ON COLUMN articulo.codigo_barras IS
  'Código de barras como texto para conservar ceros iniciales.';
COMMENT ON COLUMN articulo.nombre IS
  'Nombre del artículo.';
COMMENT ON COLUMN articulo.id_categoria IS
  'Categoría del artículo.';
COMMENT ON COLUMN articulo.unidad_medida IS
  'UN, M, M2, M3, KG o L, validados por el backend. UN exige enteros; las demás admiten tres decimales.';
COMMENT ON COLUMN articulo.ubicacion_bodega IS
  'Ubicación física del artículo dentro de la bodega, por ejemplo estante o pasillo.';
COMMENT ON COLUMN articulo.bodega_sector IS
  'Número de bodega o sector de almacenamiento del artículo.';
COMMENT ON COLUMN articulo.descripcion IS
  'Descripción adicional del artículo.';
COMMENT ON COLUMN articulo.precio_lista IS
  'Precio comercial unitario en CLP, con IVA incluido; se edita en el catálogo.';
COMMENT ON COLUMN articulo.fecha_actualizacion_precio IS
  'Fecha del precio de lista; el backend la actualiza al cambiar precio_lista.';
COMMENT ON COLUMN articulo.stock_minimo IS
  'Umbral de alerta: se compara con el disponible en bodega, no con el stock total.';
COMMENT ON COLUMN articulo.stock_actual IS
  'Existencias totales, incluido lo asignado a técnicos y aún no consumido; se actualizan mediante movimientos.';
COMMENT ON COLUMN articulo.stock_comprometido IS
  'Existencias asignadas por USO_INTERNO, incluidas en stock_actual; se restan para obtener el disponible.';
COMMENT ON COLUMN articulo.precio_pmp IS
  'Costo promedio ponderado sin IVA, calculado mediante movimientos; conserva cuatro decimales.';
COMMENT ON COLUMN articulo.activo IS
  'Habilita nuevos movimientos; inactivar conserva el artículo y su historial.';

-- ---------- BETA ----------
CREATE TABLE categoria_servicio (
  id_categoria_servicio  SERIAL PRIMARY KEY,
  nombre_servicio        VARCHAR(80) NOT NULL UNIQUE
);

COMMENT ON TABLE categoria_servicio IS
  'Categorías que agrupan tareas y clasifican presupuestos; las obras las obtienen desde su presupuesto.';
COMMENT ON COLUMN categoria_servicio.id_categoria_servicio IS
  'Identificador de la categoría de servicio.';
COMMENT ON COLUMN categoria_servicio.nombre_servicio IS
  'Nombre de la categoría de servicio, por ejemplo Mantención o Emergencia.';

-- Catalogo editable de tareas; los presupuestos conservan sus propias descripciones y precios.
CREATE TABLE tarea_servicio (
  id_tarea SERIAL PRIMARY KEY,
  id_categoria_servicio INT NOT NULL REFERENCES categoria_servicio(id_categoria_servicio),
  nombre_tarea VARCHAR(150) NOT NULL CHECK (length(trim(nombre_tarea)) > 0),
  precio_neto NUMERIC(14,0) NOT NULL CHECK (precio_neto >= 0),
  activo BOOLEAN NOT NULL DEFAULT TRUE
);
COMMENT ON TABLE tarea_servicio IS
  'Tareas por categoría, con precio neto sugerido en CLP; desactivarlas conserva el historial.';
COMMENT ON COLUMN tarea_servicio.id_tarea IS
  'Identificador de la tarea.';
COMMENT ON COLUMN tarea_servicio.id_categoria_servicio IS
  'Categoría a la que pertenece la tarea.';
COMMENT ON COLUMN tarea_servicio.nombre_tarea IS
  'Nombre de la tarea del catálogo.';
COMMENT ON COLUMN tarea_servicio.precio_neto IS
  'Precio neto sugerido en CLP, sin IVA.';
COMMENT ON COLUMN tarea_servicio.activo IS
  'Disponibilidad para nuevas selecciones; desactivar conserva el historial.';

-- El presupuesto puede existir antes de crear su obra.
CREATE TABLE presupuesto (
  id_presupuesto        SERIAL PRIMARY KEY,
  id_cliente            INT NOT NULL REFERENCES cliente(id_cliente),
  id_categoria_servicio INT NOT NULL REFERENCES categoria_servicio(id_categoria_servicio),
  fecha_emision         TIMESTAMPTZ NOT NULL DEFAULT now(),
  monto_total           NUMERIC(14,0) NOT NULL DEFAULT 0,
  estado                VARCHAR(30) NOT NULL DEFAULT 'Pendiente'
                        CHECK (estado IN ('Pendiente', 'Aprobado', 'Rechazado')),
  origen                VARCHAR(20) NOT NULL DEFAULT 'Oficina'
                        CHECK (origen IN ('Oficina', 'Terreno')),
  id_operacion_offline  VARCHAR(64) UNIQUE
);

COMMENT ON TABLE presupuesto IS
  'Propuesta para un cliente, creada en oficina o terreno, con categoría y tareas; puede preceder a una obra.';
COMMENT ON COLUMN presupuesto.id_presupuesto IS
  'Identificador del presupuesto.';
COMMENT ON COLUMN presupuesto.id_cliente IS
  'Cliente al que se presenta el presupuesto.';
COMMENT ON COLUMN presupuesto.id_categoria_servicio IS
  'Categoría obligatoria del presupuesto; sus tareas deben pertenecer a ella. La obra la obtiene desde aquí.';
COMMENT ON COLUMN presupuesto.fecha_emision IS
  'Instante de creación del presupuesto. Se presenta en America/Santiago.';
COMMENT ON COLUMN presupuesto.monto_total IS
  'Total en CLP con IVA 19 %, calculado desde las tareas y redondeado al peso; no es un monto manual.';
COMMENT ON COLUMN presupuesto.estado IS
  'Estado del presupuesto.';
COMMENT ON COLUMN presupuesto.origen IS
  'Lugar de creación del presupuesto.';
COMMENT ON COLUMN presupuesto.id_operacion_offline IS
  'Identificador de creación desde terreno para evitar duplicados; NULL en presupuestos de oficina.';

CREATE TABLE detalle_presupuesto (
  id_detalle_presupuesto SERIAL PRIMARY KEY,
  id_presupuesto INT NOT NULL REFERENCES presupuesto(id_presupuesto),
  id_tarea INT NOT NULL REFERENCES tarea_servicio(id_tarea),
  descripcion VARCHAR(255) NOT NULL CHECK (length(trim(descripcion)) > 0),
  cantidad INTEGER NOT NULL CHECK (cantidad BETWEEN 1 AND 100),
  precio_neto_unitario NUMERIC(14,0) NOT NULL CHECK (precio_neto_unitario >= 0)
);
COMMENT ON TABLE detalle_presupuesto IS
  'Tareas contratadas con descripción y precio históricos; editables mientras el presupuesto está Pendiente.';
COMMENT ON COLUMN detalle_presupuesto.id_detalle_presupuesto IS
  'Identificador de la línea del presupuesto.';
COMMENT ON COLUMN detalle_presupuesto.id_presupuesto IS
  'Presupuesto al que pertenece la línea.';
COMMENT ON COLUMN detalle_presupuesto.id_tarea IS
  'Tarea del catálogo que origina la línea.';
COMMENT ON COLUMN detalle_presupuesto.descripcion IS
  'Descripción acordada; se conserva aunque cambie el nombre del catálogo.';
COMMENT ON COLUMN detalle_presupuesto.cantidad IS
  'Número entero de tareas contratadas, entre 1 y 100; no corresponde a materiales ni horas.';
COMMENT ON COLUMN detalle_presupuesto.precio_neto_unitario IS
  'Precio neto acordado en CLP, sin IVA.';

CREATE TABLE obra (
  id_obra                SERIAL PRIMARY KEY,
  nombre_obra            VARCHAR(150) NOT NULL, -- Nombre visible para identificar la obra
  -- El cliente y la categoría se obtienen desde el presupuesto asociado.
  id_presupuesto         INT NOT NULL UNIQUE REFERENCES presupuesto(id_presupuesto), -- Un presupuesto por obra, sin compartirlo entre obras.
  id_tecnico             INT NOT NULL REFERENCES usuario(id_usuario),
  estado                 VARCHAR(20) NOT NULL DEFAULT 'En proceso'
  CHECK (estado IN ('En proceso', 'Finalizada', 'Suspendida', 'Cancelada')),
  sin_materiales         BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_creacion         TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_cierre           TIMESTAMPTZ,
  firma_conformidad      TEXT
);

COMMENT ON TABLE obra IS
  'Trabajo asignado a un técnico; cliente y categoría se obtienen desde su presupuesto.';
COMMENT ON COLUMN obra.id_obra IS
  'Identificador de la obra.';
COMMENT ON COLUMN obra.nombre_obra IS
  'Nombre visible para identificar el trabajo.';
COMMENT ON COLUMN obra.id_presupuesto IS
  'Presupuesto aprobado que respalda la obra; cada presupuesto puede generar como máximo una obra.';
COMMENT ON COLUMN obra.id_tecnico IS
  'Técnico asignado; el backend valida su rol y estado.';
COMMENT ON COLUMN obra.estado IS
  'Estado de la obra; el backend valida las transiciones y requisitos de cierre.';
COMMENT ON COLUMN obra.sin_materiales IS
  'Indica que el trabajo no utiliza materiales.';
COMMENT ON COLUMN obra.fecha_creacion IS
  'Instante de creación de la obra. Se presenta en America/Santiago.';
COMMENT ON COLUMN obra.fecha_cierre IS
  'Fecha de finalización; NULL mientras no se registre el cierre.';
COMMENT ON COLUMN obra.firma_conformidad IS
  'Firma final del cliente en trazos comprimidos; no es la firma de recepción del técnico.';

CREATE TABLE documento_tributario (
  id_documento             SERIAL PRIMARY KEY,
  tipo_documento           VARCHAR(30) NOT NULL
                           CHECK (tipo_documento IN ('factura', 'boleta', 'guia_despacho', 'nota_credito')),
  folio                    VARCHAR(30) NOT NULL,
  fecha_emision            DATE NOT NULL,
  fecha_vencimiento        DATE CHECK (fecha_vencimiento >= fecha_emision),
  fecha_ingreso            TIMESTAMPTZ NOT NULL DEFAULT now(),
  observaciones            TEXT,
  descuento_general        NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (descuento_general BETWEEN 0 AND 100),
  descuento_pronto_pago    NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (descuento_pronto_pago BETWEEN 0 AND 100),
  tasa_iva                 NUMERIC(5,2) NOT NULL DEFAULT 19 CHECK (tasa_iva BETWEEN 0 AND 100),
  id_proveedor             INT REFERENCES proveedor(id_proveedor),
  id_obra                  INT REFERENCES obra(id_obra),
  id_documento_referencia  INT REFERENCES documento_tributario(id_documento),
  monto_neto_correccion    NUMERIC(14,0),
  id_factura              INT REFERENCES documento_tributario(id_documento),
  CONSTRAINT chk_factura_guia CHECK (
    id_factura IS NULL OR (tipo_documento = 'guia_despacho' AND id_proveedor IS NOT NULL AND id_factura <> id_documento)
  ),
  CONSTRAINT chk_monto_nota_credito CHECK (
    (tipo_documento = 'nota_credito' AND monto_neto_correccion IS NOT NULL AND monto_neto_correccion > 0)
    OR (tipo_documento <> 'nota_credito' AND monto_neto_correccion IS NULL)
  ),
  -- Los documentos de clientes obtienen su cliente desde la obra y el presupuesto.
  CONSTRAINT chk_obra_o_proveedor
    CHECK ((id_obra IS NOT NULL)::int + (id_proveedor IS NOT NULL)::int = 1),
  CONSTRAINT chk_vencimiento_factura
    CHECK (tipo_documento <> 'factura' OR fecha_vencimiento IS NOT NULL)
);

-- Impide duplicar proveedor, tipo y folio, incluso con registros simultáneos.
-- Permite el mismo folio en otro proveedor o en un tipo de documento distinto.
CREATE UNIQUE INDEX uq_doc_proveedor_folio
  ON documento_tributario (id_proveedor, tipo_documento, folio)
  WHERE id_proveedor IS NOT NULL;
COMMENT ON INDEX uq_doc_proveedor_folio IS
  'Impide repetir proveedor, tipo y folio; excluye documentos de clientes.';

-- Búsqueda de facturas de una obra y notas de crédito de un documento original.
-- El índice único anterior ya cubre las búsquedas por id_proveedor.
CREATE INDEX idx_documento_obra ON documento_tributario (id_obra)
  WHERE id_obra IS NOT NULL;
CREATE INDEX idx_documento_referencia ON documento_tributario (id_documento_referencia)
  WHERE id_documento_referencia IS NOT NULL;

COMMENT ON TABLE documento_tributario IS
  'Documentos de proveedor o cliente; registrar no mueve stock. Totales y saldos se calculan al consultar.';
COMMENT ON COLUMN documento_tributario.monto_neto_correccion IS
  'Rebaja neta de NC en CLP: admite NULL; CHECK exige monto positivo para NC y NULL en los demás tipos.';
COMMENT ON COLUMN documento_tributario.id_documento IS
  'Identificador del documento.';
COMMENT ON COLUMN documento_tributario.tipo_documento IS
  'Tipo de documento.';
COMMENT ON COLUMN documento_tributario.folio IS
  'Folio tributario almacenado como texto. Frontend y backend exigen de 1 a 10 dígitos, positivo y sin ceros iniciales; no hay CHECK de formato en PostgreSQL.';
COMMENT ON COLUMN documento_tributario.fecha_emision IS
  'Fecha de emisión indicada en el documento original.';
COMMENT ON COLUMN documento_tributario.fecha_vencimiento IS
  'Vencimiento: admite NULL; obligatorio solo para Factura mediante CHECK.';
COMMENT ON COLUMN documento_tributario.fecha_ingreso IS
  'Fecha y hora de registro, asignadas por el servidor.';
COMMENT ON COLUMN documento_tributario.observaciones IS
  'Observaciones generales del documento.';
COMMENT ON COLUMN documento_tributario.descuento_general IS
  'Descuento porcentual sobre el documento, aplicado después de los descuentos por producto.';
COMMENT ON COLUMN documento_tributario.descuento_pronto_pago IS
  'Descuento porcentual aplicado después del descuento general.';
COMMENT ON COLUMN documento_tributario.tasa_iva IS
  'Tasa porcentual: 19 para documentos nuevos; las NC heredan la de su factura.';
COMMENT ON COLUMN documento_tributario.id_proveedor IS
  'Proveedor del documento; CHECK exige proveedor u obra, exclusivamente uno.';
COMMENT ON COLUMN documento_tributario.id_obra IS
  'Obra facturada; permite obtener el cliente. CHECK exige obra o proveedor, exclusivamente uno.';
COMMENT ON COLUMN documento_tributario.id_documento_referencia IS
  'FK autorreferencial: factura original corregida por una NC del mismo proveedor o cliente.';

-- Una factura reúne guías completas; sus recepciones permanecen en cada guía.
CREATE INDEX idx_documento_factura ON documento_tributario (id_factura) WHERE id_factura IS NOT NULL;
COMMENT ON COLUMN documento_tributario.id_factura IS
  'FK autorreferencial: factura que agrupa esta guía; NULL hasta facturar. Varias guías pueden apuntar a una factura del mismo proveedor.';

CREATE TABLE pago_documento (
  id_pago        SERIAL PRIMARY KEY,
  id_documento   INT NOT NULL REFERENCES documento_tributario(id_documento),
  monto          NUMERIC(14,0) NOT NULL CHECK (monto > 0),
  fecha_pago     DATE NOT NULL,
  id_usuario     INT NOT NULL REFERENCES usuario(id_usuario),
  fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now(),
  observaciones  TEXT
);

CREATE INDEX idx_pago_documento_documento ON pago_documento (id_documento);

COMMENT ON TABLE pago_documento IS
  'Abonos asociados a documentos; saldo y estado de pago se calculan, sin guardarlos.';
COMMENT ON COLUMN pago_documento.id_pago IS
  'Identificador del abono.';
COMMENT ON COLUMN pago_documento.id_documento IS
  'Documento al que corresponde el abono; admite varios pagos.';
COMMENT ON COLUMN pago_documento.monto IS
  'Abono en CLP enteros; el backend impide superar el saldo bajo bloqueo.';
COMMENT ON COLUMN pago_documento.fecha_pago IS
  'Fecha efectiva del pago, elegida al registrar el abono.';
COMMENT ON COLUMN pago_documento.id_usuario IS
  'Responsable del abono, obtenido de la sesión autenticada.';
COMMENT ON COLUMN pago_documento.fecha_registro IS
  'Instante de registro del abono. Se presenta en America/Santiago.';
COMMENT ON COLUMN pago_documento.observaciones IS
  'Referencia o comentario del pago.';

-- Líneas editables mientras el documento no tenga ingresos asociados; no representan recepción física.
CREATE TABLE detalle_documento (
  id_detalle_documento SERIAL PRIMARY KEY,
  id_documento INT NOT NULL REFERENCES documento_tributario(id_documento),
  id_articulo INT NOT NULL REFERENCES articulo(id_articulo),
  cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
  costo_neto NUMERIC(14,4) NOT NULL CHECK (costo_neto >= 0),
  precio_lista NUMERIC(14,0) NOT NULL CHECK (precio_lista >= 0),
  descuento_1 NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (descuento_1 BETWEEN 0 AND 100),
  descuento_2 NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (descuento_2 BETWEEN 0 AND 100),
  descuento_3 NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (descuento_3 BETWEEN 0 AND 100),
  observaciones TEXT
);

-- Recupera las líneas de un documento sin recorrer el detalle de todas las compras.
CREATE INDEX idx_detalle_documento_documento ON detalle_documento (id_documento);

COMMENT ON TABLE detalle_documento IS
  'Materiales documentados y sus descuentos; recibido y pendiente se obtienen del Cardex, no de estas cantidades.';
COMMENT ON COLUMN detalle_documento.id_detalle_documento IS
  'Línea de compra referenciada por los ingresos del Cardex.';
COMMENT ON COLUMN detalle_documento.id_documento IS
  'Documento al que pertenece la línea.';
COMMENT ON COLUMN detalle_documento.id_articulo IS
  'Artículo de la línea; su unidad se obtiene del catálogo.';
COMMENT ON COLUMN detalle_documento.cantidad IS
  'Cantidad documentada, no necesariamente recibida; UN exige enteros.';
COMMENT ON COLUMN detalle_documento.costo_neto IS
  'Costo unitario sin IVA y antes de descuentos; los descuentos determinan el costo de recepción.';
COMMENT ON COLUMN detalle_documento.precio_lista IS
  'Copia del precio de lista con IVA al agregar la línea; no se edita desde el documento.';
COMMENT ON COLUMN detalle_documento.descuento_1 IS
  'Primer descuento porcentual por producto.';
COMMENT ON COLUMN detalle_documento.descuento_2 IS
  'Segundo descuento, aplicado sobre el resultado del primero; no se suman porcentajes.';
COMMENT ON COLUMN detalle_documento.descuento_3 IS
  'Tercer descuento sucesivo, previo a los descuentos generales.';
COMMENT ON COLUMN detalle_documento.observaciones IS
  'Observaciones específicas del material en esta línea del documento.';

-- ---------- ALPHA: MOVIMIENTOS ----------
-- Una recepción agrupa los artículos de una entrega y se firma una sola vez.
-- Recepcion tecnico Gamma
CREATE TABLE recepcion_material (
  id_recepcion        SERIAL PRIMARY KEY,
  id_usuario_receptor INT NOT NULL REFERENCES usuario(id_usuario),
  firma               TEXT,
  fecha_firma         TIMESTAMPTZ,
  -- Sin firma queda pendiente; firma y fecha se completan juntas al confirmar.
  CONSTRAINT chk_firma_recepcion CHECK (
    (firma IS NULL AND fecha_firma IS NULL)
    OR (firma IS NOT NULL AND length(trim(firma)) > 0 AND fecha_firma IS NOT NULL)
  )
);

COMMENT ON TABLE recepcion_material IS
  'Entrega al técnico por USO_INTERNO o EGRESO directo a obra; se firma desde Gamma sin modificar stock.';
COMMENT ON COLUMN recepcion_material.id_recepcion IS
  'Identificador de la recepción.';
COMMENT ON COLUMN recepcion_material.id_usuario_receptor IS
  'Técnico que recibe y confirma su propia recepción desde Gamma.';
COMMENT ON COLUMN recepcion_material.firma IS
  'Firma comprimida del técnico; NULL mientras esté pendiente. CHECK la exige junto con fecha_firma.';
COMMENT ON COLUMN recepcion_material.fecha_firma IS
  'Fecha asignada al confirmar la firma; NULL mientras esté pendiente. CHECK exige fecha y firma juntas.';

CREATE TABLE movimiento_cardex (
  id_movimiento            SERIAL PRIMARY KEY,
  id_articulo              INT NOT NULL REFERENCES articulo(id_articulo),
  id_usuario               INT NOT NULL REFERENCES usuario(id_usuario), -- Quien registra y entrega en las salidas.
  id_recepcion             INT REFERENCES recepcion_material(id_recepcion), -- Entrega al técnico por uso interno o egreso directo.
  id_obra                  INT REFERENCES obra(id_obra),
  id_movimiento_revertido  INT REFERENCES movimiento_cardex(id_movimiento),
  id_movimiento_origen     INT REFERENCES movimiento_cardex(id_movimiento), -- Asignación consumida o ingreso devuelto.
  id_detalle_documento     INT REFERENCES detalle_documento(id_detalle_documento),
  tipo_movimiento          VARCHAR(30) NOT NULL
                           CHECK (tipo_movimiento IN (
                             'INGRESO', 'EGRESO', 'MERMA', 'DEVOLUCION_PROVEEDOR',
                             'AJUSTE', 'USO_INTERNO', 'REVERSA'
                           )),
  cantidad                 NUMERIC(12,3) NOT NULL,
  costo_unitario           NUMERIC(14,4) NOT NULL DEFAULT 0,
  precio_lista_vigente     NUMERIC(14,0) CHECK (precio_lista_vigente >= 0), -- Precio comercial al confirmar el egreso, separado del costo.
  fecha_hora               TIMESTAMPTZ NOT NULL DEFAULT now(),
  justificacion            TEXT, -- Motivo u observaciones del movimiento.
  -- Cliente y presupuesto se consultan desde la obra asociada, sin duplicarlos.
  CONSTRAINT chk_datos_egreso CHECK (
    tipo_movimiento <> 'EGRESO'
    OR (id_obra IS NOT NULL AND precio_lista_vigente IS NOT NULL)
  ),
  CONSTRAINT chk_recepcion_material CHECK (
    (tipo_movimiento = 'USO_INTERNO' AND id_recepcion IS NOT NULL)
    OR tipo_movimiento = 'EGRESO'
    OR (tipo_movimiento NOT IN ('EGRESO', 'USO_INTERNO') AND id_recepcion IS NULL)
  )
);

-- El orden del índice coincide con el historial paginado y la consulta del último ingreso.
CREATE INDEX idx_cardex_articulo_historial
  ON movimiento_cardex (id_articulo, fecha_hora DESC, id_movimiento DESC);
-- Apoyan egresos por obra, recepciones de compras y cálculo de cantidades revertidas.
CREATE INDEX idx_cardex_obra ON movimiento_cardex (id_obra)
  WHERE id_obra IS NOT NULL;
CREATE INDEX idx_cardex_detalle_documento ON movimiento_cardex (id_detalle_documento)
  WHERE id_detalle_documento IS NOT NULL;
CREATE INDEX idx_cardex_revertido ON movimiento_cardex (id_movimiento_revertido)
  WHERE id_movimiento_revertido IS NOT NULL;

COMMENT ON TABLE movimiento_cardex IS
  'Historial de artículos; movimiento, stock, PMP y auditoría se guardan juntos. Los errores se corrigen con reversas.';
COMMENT ON COLUMN movimiento_cardex.id_movimiento IS
  'Identificador del movimiento.';
COMMENT ON COLUMN movimiento_cardex.id_articulo IS
  'Artículo afectado por el movimiento.';
COMMENT ON COLUMN movimiento_cardex.id_usuario IS
  'Responsable autenticado; en salidas directas también representa a quien entrega.';
COMMENT ON COLUMN movimiento_cardex.id_recepcion IS
  'Recepción del técnico: CHECK la exige en USO_INTERNO, la permite en EGRESO y exige NULL en otros tipos. Bodega la crea al técnico de la obra en egresos directos; los consumos Gamma no crean otra.';
COMMENT ON COLUMN movimiento_cardex.id_obra IS
  'Obra asociada: admite NULL; obligatoria para EGRESO mediante CHECK y opcional para MERMA. Las reversas conservan la original.';
COMMENT ON COLUMN movimiento_cardex.id_movimiento_revertido IS
  'FK autorreferencial al movimiento corregido por REVERSA; admite correcciones parciales sin exceder su saldo, nunca otra reversa.';
COMMENT ON COLUMN movimiento_cardex.id_movimiento_origen IS
  'FK autorreferencial al INGRESO devuelto al proveedor o al USO_INTERNO consumido desde Gamma.';
COMMENT ON COLUMN movimiento_cardex.id_detalle_documento IS
  'Línea de compra recibida; NULL en ingresos libres. Devoluciones y reversas siguen el movimiento original.';
COMMENT ON COLUMN movimiento_cardex.tipo_movimiento IS
  'Tipo de operación.';
COMMENT ON COLUMN movimiento_cardex.cantidad IS
  'Cantidad del movimiento: su efecto depende del tipo, no solo del signo. UN exige enteros; AJUSTE admite diferencias negativas.';
COMMENT ON COLUMN movimiento_cardex.costo_unitario IS
  'Costo neto aplicado: costo de compra en ingresos, PMP en salidas y costo original en devoluciones o reversas.';
COMMENT ON COLUMN movimiento_cardex.precio_lista_vigente IS
  'Precio comercial con IVA copiado del catálogo: admite NULL; obligatorio solo para EGRESO mediante CHECK.';
COMMENT ON COLUMN movimiento_cardex.fecha_hora IS
  'Instante de registro del movimiento. Se presenta en America/Santiago.';
COMMENT ON COLUMN movimiento_cardex.justificacion IS
  'Motivo exigido en movimientos manuales; admite NULL en recepciones de compras con observación opcional.';

CREATE TABLE inventario_fisico (
  id_inventario         SERIAL PRIMARY KEY,
  fecha_conteo          TIMESTAMPTZ NOT NULL DEFAULT now(),
  id_usuario            INT NOT NULL REFERENCES usuario(id_usuario),
  estado                VARCHAR(20) NOT NULL DEFAULT 'En proceso'
  CHECK (estado IN ('En proceso', 'Finalizado'))
);

COMMENT ON TABLE inventario_fisico IS
  'Conteo de bodega, sin material asignado a técnicos. Finalizarlo no mueve stock ni genera ajustes.';
COMMENT ON COLUMN inventario_fisico.id_inventario IS
  'Identificador del conteo físico.';
COMMENT ON COLUMN inventario_fisico.fecha_conteo IS
  'Creación del conteo; la referencia de stock se toma por artículo al contarlo por primera vez.';
COMMENT ON COLUMN inventario_fisico.id_usuario IS
  'Usuario que crea el conteo; otros responsables de guardado y cierre quedan en auditoría.';
COMMENT ON COLUMN inventario_fisico.estado IS
  'Estado del conteo; Finalizado impide guardar o corregir detalles.';

CREATE TABLE detalle_inventario_fisico (
  id_detalle_inventario  SERIAL PRIMARY KEY,
  id_inventario          INT NOT NULL REFERENCES inventario_fisico(id_inventario) ON DELETE CASCADE,
  id_articulo            INT NOT NULL REFERENCES articulo(id_articulo),
  stock_sistema          NUMERIC(12,3) NOT NULL, -- Referencia de bodega: stock_actual - stock_comprometido al primer conteo.
  stock_fisico           NUMERIC(12,3) NOT NULL CHECK (stock_fisico >= 0),
  UNIQUE (id_inventario, id_articulo) -- Un detalle por artículo dentro del inventario
);

COMMENT ON TABLE detalle_inventario_fisico IS
  'Conteo por artículo; diferencia = stock_fisico - stock_sistema. Guardarlo no modifica existencias.';
COMMENT ON COLUMN detalle_inventario_fisico.id_detalle_inventario IS
  'Identificador del detalle contado.';
COMMENT ON COLUMN detalle_inventario_fisico.id_inventario IS
  'Conteo al que pertenece; ON DELETE CASCADE elimina el detalle junto con su cabecera.';
COMMENT ON COLUMN detalle_inventario_fisico.id_articulo IS
  'Artículo contado; único dentro del inventario físico.';
COMMENT ON COLUMN detalle_inventario_fisico.stock_sistema IS
  'Disponible en bodega al primer conteo: stock_actual - stock_comprometido; se conserva al corregir.';
COMMENT ON COLUMN detalle_inventario_fisico.stock_fisico IS
  'Cantidad contada en bodega, sin asignaciones a técnicos; admite cero y exige enteros para UN.';

-- ---------- GAMMA ----------
CREATE TABLE item_checklist (
  id_item       SERIAL PRIMARY KEY,
  id_tarea      INT NOT NULL REFERENCES tarea_servicio(id_tarea),
  pregunta      VARCHAR(255) NOT NULL CHECK (length(trim(pregunta)) > 0),
  UNIQUE (id_tarea, pregunta)
);
COMMENT ON TABLE item_checklist IS
  'Comprobaciones por tarea, sin repetir pregunta; cambiar el catálogo no modifica respuestas guardadas.';
COMMENT ON COLUMN item_checklist.id_item IS
  'Identificador del ítem de checklist.';
COMMENT ON COLUMN item_checklist.id_tarea IS
  'Tarea del catálogo a la que pertenece la comprobación.';
COMMENT ON COLUMN item_checklist.pregunta IS
  'Comprobación predeterminada, única dentro de su tarea.';

CREATE TABLE hoja_de_servicio (
  id_hoja_servicio      SERIAL PRIMARY KEY,
  id_detalle_presupuesto INT NOT NULL REFERENCES detalle_presupuesto(id_detalle_presupuesto),
  numero_unidad         INT NOT NULL CHECK (numero_unidad BETWEEN 1 AND 100),
  id_usuario            INT NOT NULL REFERENCES usuario(id_usuario),
  fecha_servicio        TIMESTAMPTZ NOT NULL DEFAULT now(),
  horas_trabajadas      NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (horas_trabajadas >= 0 AND horas_trabajadas <> 'NaN'::numeric),
  estado                VARCHAR(20) NOT NULL DEFAULT 'Borrador' CHECK (estado IN ('Borrador', 'Completada')),
  id_operacion_offline  VARCHAR(64) NOT NULL UNIQUE,
  UNIQUE (id_detalle_presupuesto, numero_unidad)
);
COMMENT ON TABLE hoja_de_servicio IS
  'Trabajo de una unidad contratada; una hoja por tarea y unidad, editable en Borrador. La firma final pertenece a la obra.';
COMMENT ON COLUMN hoja_de_servicio.id_hoja_servicio IS
  'Identificador de la hoja de servicio.';
COMMENT ON COLUMN hoja_de_servicio.id_detalle_presupuesto IS
  'Línea contratada; admite una hoja por unidad de su cantidad.';
COMMENT ON COLUMN hoja_de_servicio.numero_unidad IS
  'Unidad documentada, entre 1 y la cantidad contratada; el backend valida el rango y UNIQUE impide repetir tarea y unidad.';
COMMENT ON COLUMN hoja_de_servicio.id_usuario IS
  'Técnico autenticado que registra la hoja; el backend valida su acceso a la obra.';
COMMENT ON COLUMN hoja_de_servicio.fecha_servicio IS
  'Día del servicio enviado por Gamma, convertido a medianoche de Santiago; no es la fecha de sincronización.';
COMMENT ON COLUMN hoja_de_servicio.horas_trabajadas IS
  'Horas decimales acumuladas; la interfaz convierte horas y minutos. Completar exige un tiempo mayor que cero.';
COMMENT ON COLUMN hoja_de_servicio.estado IS
  'Borrador permite continuar; Completada bloquea edición y exige horas y comprobaciones resueltas.';
COMMENT ON COLUMN hoja_de_servicio.id_operacion_offline IS
  'UUID de la última versión confirmada; permite controlar avances y reconocer reintentos.';


CREATE TABLE respuesta_checklist (
  id_respuesta      SERIAL PRIMARY KEY,
  id_hoja_servicio  INT NOT NULL REFERENCES hoja_de_servicio(id_hoja_servicio),
  id_item           INT REFERENCES item_checklist(id_item) ON DELETE SET NULL,
  pregunta          VARCHAR(255) NOT NULL CHECK (length(trim(pregunta)) > 0),
  estado            VARCHAR(20) NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Completado', 'No aplica')),
  observacion       VARCHAR(255),
  CHECK (estado <> 'No aplica' OR length(trim(COALESCE(observacion, ''))) > 0),
  UNIQUE (id_hoja_servicio, id_item),
  UNIQUE (id_hoja_servicio, pregunta)
);
COMMENT ON TABLE respuesta_checklist IS
  'Comprobaciones y resultados de la hoja; conserva el texto histórico y admite ítems propios del técnico.';
COMMENT ON COLUMN respuesta_checklist.id_respuesta IS
  'Identificador de la respuesta.';
COMMENT ON COLUMN respuesta_checklist.id_hoja_servicio IS
  'Hoja a la que pertenece la comprobación.';
COMMENT ON COLUMN respuesta_checklist.id_item IS
  'Ítem original; NULL para comprobaciones propias o si se elimina el ítem. ON DELETE SET NULL conserva la respuesta.';
COMMENT ON COLUMN respuesta_checklist.pregunta IS
  'Texto histórico de la comprobación, único dentro de la hoja.';
COMMENT ON COLUMN respuesta_checklist.estado IS
  'Resultado de la comprobación; una hoja no puede completarse con respuestas Pendiente.';
COMMENT ON COLUMN respuesta_checklist.observacion IS
  'Comentario opcional; CHECK exige un motivo no vacío para No aplica.';

-- Material consumido en una atención, separado de las respuestas del checklist.
CREATE TABLE material_utilizado (
  id_material_utilizado SERIAL PRIMARY KEY,
  id_hoja_servicio      INT NOT NULL REFERENCES hoja_de_servicio(id_hoja_servicio),
  id_movimiento_egreso  INT NOT NULL UNIQUE REFERENCES movimiento_cardex(id_movimiento),
  id_operacion_offline  VARCHAR(64) NOT NULL UNIQUE
                        CHECK (length(trim(id_operacion_offline)) > 0)
);

COMMENT ON TABLE material_utilizado IS
  'Vincula hoja y egreso; artículo, cantidad, costo y asignación se obtienen del movimiento, sin duplicarlos.';
COMMENT ON COLUMN material_utilizado.id_material_utilizado IS
  'Identificador del registro de material utilizado.';
COMMENT ON COLUMN material_utilizado.id_hoja_servicio IS
  'Hoja que registra el consumo; permite obtener la tarea y la obra.';
COMMENT ON COLUMN material_utilizado.id_movimiento_egreso IS
  'EGRESO de la obra asociado al consumo; único para evitar reutilizarlo en otra hoja.';
COMMENT ON COLUMN material_utilizado.id_operacion_offline IS
  'UUID de sincronización e índice del material; identifica cada consumo y evita duplicados.';

-- BEGIN VISTAS RESUMEN
-- Este bloque también lo utiliza crearVistasResumen.js sin recrear las tablas.
-- Guardan resultados para el resumen; las operaciones del ERP no las refrescan automáticamente.
-- El botón Actualizar llama al backend, que refresca las seis juntas mediante REFRESH MATERIALIZED VIEW.
-- El backend exige cinco minutos desde el último refresco y bloquea actualizaciones simultáneas.
-- Al crear las vistas se calculan sus resultados iniciales; consultar el resumen solo lee la copia guardada.

-- Agrupa movimientos por mes, artículo y tipo para consultar cantidades y compras netas.
-- Las reversas se relacionan con el tipo original y descuentan sus cantidades e importes.
-- Solo los ingresos respaldados por proveedor aportan al importe de compras, redondeado a pesos.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_resumen_movimientos AS
WITH base AS (
  SELECT date_trunc('month', m.fecha_hora AT TIME ZONE 'America/Santiago')::date AS mes,
    m.id_articulo, a.codigo_interno, a.nombre, a.unidad_medida,
    m.tipo_movimiento,
    CASE WHEN m.tipo_movimiento = 'REVERSA' THEN original.tipo_movimiento
      ELSE m.tipo_movimiento END AS tipo_efectivo,
    CASE WHEN m.tipo_movimiento = 'REVERSA' AND original.tipo_movimiento <> 'AJUSTE'
      THEN -ABS(m.cantidad) ELSE m.cantidad END AS cantidad_neta,
    m.costo_unitario, d.id_proveedor
  FROM movimiento_cardex m
  JOIN articulo a USING (id_articulo)
  LEFT JOIN movimiento_cardex original ON original.id_movimiento = m.id_movimiento_revertido
  LEFT JOIN detalle_documento l ON l.id_detalle_documento = COALESCE(m.id_detalle_documento, original.id_detalle_documento)
  LEFT JOIN documento_tributario d ON d.id_documento = l.id_documento
)
SELECT mes, id_articulo, codigo_interno, nombre, unidad_medida, tipo_movimiento, tipo_efectivo,
  SUM(cantidad_neta) AS cantidad, COUNT(*)::int AS registros,
  SUM(CASE WHEN tipo_efectivo = 'INGRESO' AND id_proveedor IS NOT NULL
    THEN ROUND(cantidad_neta * costo_unitario,0) ELSE 0 END) AS compras_netas
FROM base
GROUP BY mes, id_articulo, codigo_interno, nombre, unidad_medida, tipo_movimiento, tipo_efectivo;
CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_resumen_movimientos
  ON mv_resumen_movimientos (mes, id_articulo, tipo_movimiento, tipo_efectivo);
COMMENT ON MATERIALIZED VIEW mv_resumen_movimientos IS
  'Movimientos agrupados por mes y artículo; las reversas corrigen cantidades y compras del tipo original.';

-- Conserva el saldo de facturas y boletas de proveedores al momento del refresco.
-- Calcula el total con descuentos sucesivos e IVA y resta abonos y notas de crédito.
-- En facturas que agrupan guías toma los importes de esas guías; no duplica recepciones.
-- No incluye facturas de clientes ni cambia los documentos o pagos originales.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_resumen_documentos AS
SELECT d.id_documento, d.id_proveedor, d.folio, d.tipo_documento, d.fecha_vencimiento, p.razon_social,
  ((CASE WHEN d.tipo_documento='nota_credito' AND d.monto_neto_correccion IS NOT NULL
    THEN ROUND(d.monto_neto_correccion,0) + ROUND(ROUND(d.monto_neto_correccion,0) * d.tasa_iva / 100,0)
    WHEN EXISTS(SELECT 1 FROM documento_tributario guia WHERE guia.id_factura=d.id_documento)
    THEN (SELECT COALESCE(SUM((SELECT CASE WHEN g.tipo_documento='boleta' THEN importe ELSE importe + ROUND(importe * g.tasa_iva / 100,0) END
        FROM (SELECT general - ROUND(general * g.descuento_pronto_pago / 100,0) AS importe
            FROM (SELECT subtotal - ROUND(subtotal * g.descuento_general / 100,0) AS general
                FROM (SELECT COALESCE(SUM(p3.valor),0) AS subtotal FROM detalle_documento l
                    CROSS JOIN LATERAL (SELECT ROUND(l.cantidad * (CASE WHEN g.tipo_documento='boleta'
                        THEN ROUND(l.costo_neto * (1+g.tasa_iva/100),0) ELSE l.costo_neto END),0) AS valor) b
                    CROSS JOIN LATERAL (SELECT b.valor-ROUND(b.valor*l.descuento_1/100,0) AS valor) p1
                    CROSS JOIN LATERAL (SELECT p1.valor-ROUND(p1.valor*l.descuento_2/100,0) AS valor) p2
                    CROSS JOIN LATERAL (SELECT p2.valor-ROUND(p2.valor*l.descuento_3/100,0) AS valor) p3
                    WHERE l.id_documento=g.id_documento) lineas) generales) importes)),0) FROM documento_tributario g WHERE g.id_factura=d.id_documento)
    ELSE (SELECT CASE WHEN d.tipo_documento='boleta' THEN importe ELSE importe + ROUND(importe * d.tasa_iva / 100,0) END
        FROM (SELECT general - ROUND(general * d.descuento_pronto_pago / 100,0) AS importe
            FROM (SELECT subtotal - ROUND(subtotal * d.descuento_general / 100,0) AS general
                FROM (SELECT COALESCE(SUM(p3.valor),0) AS subtotal FROM detalle_documento l
                    CROSS JOIN LATERAL (SELECT ROUND(l.cantidad * (CASE WHEN d.tipo_documento='boleta'
                        THEN ROUND(l.costo_neto * (1+d.tasa_iva/100),0) ELSE l.costo_neto END),0) AS valor) b
                    CROSS JOIN LATERAL (SELECT b.valor-ROUND(b.valor*l.descuento_1/100,0) AS valor) p1
                    CROSS JOIN LATERAL (SELECT p1.valor-ROUND(p1.valor*l.descuento_2/100,0) AS valor) p2
                    CROSS JOIN LATERAL (SELECT p2.valor-ROUND(p2.valor*l.descuento_3/100,0) AS valor) p3
                    WHERE l.id_documento=d.id_documento) lineas) generales) importes) END) - COALESCE((SELECT SUM(a.monto) FROM pago_documento a WHERE a.id_documento=d.id_documento),0) - COALESCE((SELECT SUM(ROUND(nc.monto_neto_correccion,0) + ROUND(ROUND(nc.monto_neto_correccion,0) * nc.tasa_iva / 100,0))
    FROM documento_tributario nc WHERE nc.id_documento_referencia=d.id_documento
    AND nc.tipo_documento='nota_credito'),0)) AS saldo
FROM documento_tributario d JOIN proveedor p USING (id_proveedor)
WHERE d.tipo_documento IN ('factura', 'boleta');
CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_resumen_documentos ON mv_resumen_documentos (id_documento);
COMMENT ON MATERIALIZED VIEW mv_resumen_documentos IS
  'Saldos de proveedores al refrescar: descuentos sucesivos, IVA y abonos. No modifica el saldo operativo.';

-- Lista artículos activos cuyo disponible está en el mínimo o por debajo.
-- Disponible = stock_actual - stock_comprometido; diferencia = disponible - stock_minimo.
-- Es una copia para el resumen; los movimientos siguen trabajando con el stock actual del artículo.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_resumen_stock AS
SELECT id_articulo, codigo_interno, nombre, unidad_medida,
  (stock_actual - stock_comprometido)::text AS disponible, stock_minimo::text AS minimo,
  stock_actual - stock_comprometido - stock_minimo AS diferencia
FROM articulo WHERE activo = true AND stock_actual - stock_comprometido <= stock_minimo;
CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_resumen_stock ON mv_resumen_stock (id_articulo);
COMMENT ON MATERIALIZED VIEW mv_resumen_stock IS
  'Artículos activos en mínimo o bajo, según disponibilidad al refrescar.';

-- Cuenta presupuestos por mes de emisión y estado actual al refrescar.
-- Permite mostrar cantidades de pendientes, aprobados y rechazados sin recorrer sus detalles.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_resumen_presupuestos AS
SELECT date_trunc('month', fecha_emision AT TIME ZONE 'America/Santiago')::date AS mes, estado, COUNT(*)::int AS cantidad
FROM presupuesto GROUP BY date_trunc('month', fecha_emision AT TIME ZONE 'America/Santiago')::date, estado;
CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_resumen_presupuestos ON mv_resumen_presupuestos (mes, estado);
COMMENT ON MATERIALIZED VIEW mv_resumen_presupuestos IS
  'Cantidad de presupuestos agrupados por mes de emisión y estado al refrescar. No conserva el historial de cambios de estado ni suma importes.';

-- Cuenta obras por estado y mes de cierre para mostrar obras en proceso y servicios finalizados.
-- La fecha técnica 0001-01-01 agrupa las obras sin fecha_cierre; no es una fecha real del trabajo.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_resumen_obras AS
SELECT estado, COALESCE(date_trunc('month', fecha_cierre AT TIME ZONE 'America/Santiago')::date, DATE '0001-01-01') AS mes_cierre,
  COUNT(*)::int AS cantidad
FROM obra GROUP BY estado, COALESCE(date_trunc('month', fecha_cierre AT TIME ZONE 'America/Santiago')::date, DATE '0001-01-01');
CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_resumen_obras ON mv_resumen_obras (estado, mes_cierre);
COMMENT ON MATERIALIZED VIEW mv_resumen_obras IS
  'Obras por estado y mes de cierre; 0001-01-01 representa ausencia de cierre.';

-- Guarda una sola fila con la fecha y hora del refresco del conjunto.
-- El backend la consulta para informar la última actualización y habilitar otra tras cinco minutos.
-- No es un temporizador: cumplir el plazo no refresca las vistas sin pulsar Actualizar.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_resumen_control AS
SELECT 1 AS id, clock_timestamp() AS actualizado_en;
CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_resumen_control ON mv_resumen_control (id);
COMMENT ON MATERIALIZED VIEW mv_resumen_control IS
  'Fecha del conjunto materializado, incluso vacío. El refresco manual exige cinco minutos y es transaccional.';
-- END VISTAS RESUMEN
