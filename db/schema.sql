-- =====================================================
-- SIGEF - schema.sql (PostgreSQL)
-- Fuente de verdad del modelo de datos.
-- OJO: las dos primeras lineas BORRAN todo y recrean la base vacia.
-- Sirve en desarrollo para re-ejecutar el archivo sin errores.
-- NO usar en produccion con datos reales.
-- =====================================================
SET client_encoding TO 'UTF8';

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
  'Identificador del rol. Clave primaria entera, autoincremental y no nula.';
COMMENT ON COLUMN rol.nombre_rol IS
  'Nombre del rol. Texto de hasta 50 caracteres, obligatorio y único.';

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
  'Identificador del usuario. Clave primaria entera, autoincremental y no nula.';
COMMENT ON COLUMN usuario.rut IS
  'RUT del usuario. Texto de hasta 12 caracteres, obligatorio y único; el backend lo normaliza y valida.';
COMMENT ON COLUMN usuario.nombres IS
  'Nombres del usuario. Texto de hasta 80 caracteres, obligatorio.';
COMMENT ON COLUMN usuario.apellidos IS
  'Apellidos del usuario. Texto de hasta 80 caracteres, obligatorio.';
COMMENT ON COLUMN usuario.email IS
  'Correo electrónico utilizado para iniciar sesión. Texto de hasta 120 caracteres, obligatorio y único.';
COMMENT ON COLUMN usuario.password_hash IS
  'Hash de la contraseña del usuario, no su texto original. Texto de hasta 255 caracteres, obligatorio.';
COMMENT ON COLUMN usuario.id_rol IS
  'Rol asignado al usuario. Entero obligatorio y clave foránea hacia rol(id_rol).';
COMMENT ON COLUMN usuario.estado IS
  'Estado del usuario. Texto de hasta 20 caracteres, obligatorio y con valor predeterminado Activo. Solo admite Activo o Inactivo mediante una restricción CHECK.';

CREATE TABLE registro_auditoria (
  id_auditoria          SERIAL PRIMARY KEY,
  id_usuario            INT REFERENCES usuario(id_usuario),
  tabla_afectada        VARCHAR(60) NOT NULL,
  id_registro_afectado  INT NOT NULL,
  accion                VARCHAR(20) NOT NULL,
  valores_anteriores    JSONB,
  valores_nuevos        JSONB,
  fecha_hora            TIMESTAMP NOT NULL DEFAULT now()
);

COMMENT ON TABLE registro_auditoria IS
  'Historial de acciones auditadas por el backend. Conserva responsable, registro afectado y datos anteriores y posteriores, sin contraseñas, hashes ni tokens.';
COMMENT ON COLUMN registro_auditoria.id_auditoria IS
  'Identificador de la auditoría. Clave primaria entera, autoincremental y no nula.';
COMMENT ON COLUMN registro_auditoria.id_usuario IS
  'Usuario responsable de la acción auditada. Entero y clave foránea hacia usuario(id_usuario). La columna admite NULL, aunque el backend actual exige un responsable.';
COMMENT ON COLUMN registro_auditoria.tabla_afectada IS
  'Nombre de la tabla sobre la que se realizó la acción. Texto de hasta 60 caracteres, obligatorio y establecido por el backend.';
COMMENT ON COLUMN registro_auditoria.id_registro_afectado IS
  'Identificador del registro afectado dentro de la tabla indicada. Entero obligatorio, enviado por el backend. No es una clave foránea porque puede identificar registros de distintas tablas.';
COMMENT ON COLUMN registro_auditoria.accion IS
  'Acción realizada, por ejemplo CREAR_FICHA o CAMBIAR_PASSWORD. Texto de hasta 20 caracteres, obligatorio y establecido por el backend; no tiene un catálogo de valores restringido mediante CHECK.';
COMMENT ON COLUMN registro_auditoria.valores_anteriores IS
  'Datos anteriores a la acción en formato JSONB. Admite NULL, por ejemplo al crear un registro o cambiar una contraseña. El backend excluye los campos sensibles.';
COMMENT ON COLUMN registro_auditoria.valores_nuevos IS
  'Datos posteriores a la acción en formato JSONB. Admite NULL; en cambios de contraseña se omite para no registrar valores sensibles. El backend excluye los campos sensibles.';
COMMENT ON COLUMN registro_auditoria.fecha_hora IS
  'Fecha y hora de referencia de la auditoría. TIMESTAMP sin zona horaria, obligatorio y con valor predeterminado now(), correspondiente al inicio de la transacción si no se proporciona otro valor.';

-- ---------- ALPHA: CATALOGOS ----------
-- Catálogo geográfico compartido; cada comuna pertenece a una sola región.
CREATE TABLE region (
  id_region  SERIAL PRIMARY KEY,
  nombre     VARCHAR(100) NOT NULL UNIQUE
);

COMMENT ON TABLE region IS
  'Catálogo de regiones utilizado junto con las comunas para seleccionar ubicaciones en las fichas de clientes y proveedores.';
COMMENT ON COLUMN region.id_region IS
  'Identificador interno de la región. Clave primaria entera, autoincremental y no nula; no representa necesariamente un código territorial oficial.';
COMMENT ON COLUMN region.nombre IS
  'Nombre de la región. Texto de hasta 100 caracteres, obligatorio y único.';

CREATE TABLE comuna (
  id_comuna  SERIAL PRIMARY KEY,
  id_region  INT NOT NULL REFERENCES region(id_region),
  nombre     VARCHAR(100) NOT NULL,
  UNIQUE (id_region, nombre)
);

COMMENT ON TABLE comuna IS
  'Catálogo de comunas. Cada comuna pertenece a una región y puede ser referenciada por las fichas de clientes y proveedores.';
COMMENT ON COLUMN comuna.id_comuna IS
  'Identificador interno de la comuna. Clave primaria entera, autoincremental y no nula; no representa necesariamente un código territorial oficial.';
COMMENT ON COLUMN comuna.id_region IS
  'Región a la que pertenece la comuna. Entero obligatorio y clave foránea hacia region(id_region). Una región puede tener varias comunas.';
COMMENT ON COLUMN comuna.nombre IS
  'Nombre de la comuna. Texto de hasta 100 caracteres, obligatorio. La combinación de región y nombre es única; el nombre no tiene unicidad global.';

CREATE TABLE categoria_articulo (
  id_categoria      SERIAL PRIMARY KEY,
  nombre_categoria  VARCHAR(80) NOT NULL UNIQUE
);

COMMENT ON TABLE categoria_articulo IS
  'Catálogo de categorías utilizadas para clasificar los artículos del inventario.';
COMMENT ON COLUMN categoria_articulo.id_categoria IS
  'Identificador de la categoría. Clave primaria entera, autoincremental y no nula.';
COMMENT ON COLUMN categoria_articulo.nombre_categoria IS
  'Nombre de la categoría. Texto de hasta 80 caracteres, obligatorio y único.';

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
  'Identificador del proveedor. Clave primaria entera, autoincremental y no nula.';
COMMENT ON COLUMN proveedor.rut_proveedor IS
  'RUT del proveedor. Texto de hasta 12 caracteres, obligatorio y único; el backend lo normaliza y valida.';
COMMENT ON COLUMN proveedor.razon_social IS
  'Nombre legal de la empresa proveedora. Texto de hasta 150 caracteres, obligatorio.';
COMMENT ON COLUMN proveedor.direccion IS
  'Dirección del proveedor. Texto de hasta 200 caracteres, obligatorio.';
COMMENT ON COLUMN proveedor.id_comuna IS
  'Comuna del proveedor. Entero obligatorio y clave foránea hacia comuna(id_comuna). La región se obtiene mediante la comuna asociada, sin duplicarla en esta tabla.';
COMMENT ON COLUMN proveedor.ciudad IS
  'Ciudad del proveedor. Texto de hasta 100 caracteres, obligatorio.';

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
  'Cuentas bancarias de proveedores. Relación de cero a muchas: un proveedor puede no tener cuentas o registrar varias. Cada cuenta pertenece a un proveedor existente y puede inactivarse sin eliminar su registro.';
COMMENT ON COLUMN datos_bancarios_proveedor.id_datos_bancarios IS
  'Identificador de la cuenta bancaria. Clave primaria entera, autoincremental y no nula; se conserva al inactivar la cuenta.';
COMMENT ON COLUMN datos_bancarios_proveedor.id_proveedor IS
  'Proveedor al que pertenece la cuenta. Entero obligatorio y clave foránea hacia proveedor(id_proveedor). No es único: varias cuentas pueden pertenecer al mismo proveedor.';
COMMENT ON COLUMN datos_bancarios_proveedor.banco IS
  'Nombre del banco de la cuenta del proveedor. Texto de hasta 100 caracteres, obligatorio cuando existe la ficha bancaria.';
COMMENT ON COLUMN datos_bancarios_proveedor.tipo_cuenta IS
  'Tipo de cuenta bancaria. Texto de hasta 50 caracteres, obligatorio cuando existe la ficha bancaria.';
COMMENT ON COLUMN datos_bancarios_proveedor.numero_cuenta IS
  'Número de la cuenta bancaria. Texto de hasta 50 caracteres, obligatorio cuando existe la ficha bancaria; se almacena como texto para conservar su formato y posibles ceros iniciales.';
COMMENT ON COLUMN datos_bancarios_proveedor.email_pagos IS
  'Correo electrónico para comunicaciones de pagos al proveedor. Texto de hasta 120 caracteres, obligatorio cuando existe la ficha bancaria.';
COMMENT ON COLUMN datos_bancarios_proveedor.activo IS
  'Indica si la cuenta está habilitada. Booleano obligatorio con valor predeterminado TRUE. Inactivarla conserva el registro; no se inactiva automáticamente al realizar un pago.';

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
  'Contactos comerciales asociados a proveedores. Un proveedor puede tener varios ejecutivos; no se permite repetir un mismo RUT dentro del mismo proveedor.';
COMMENT ON COLUMN ejecutivo_comercial.id_ejecutivo IS
  'Identificador del ejecutivo comercial. Clave primaria entera, autoincremental y no nula.';
COMMENT ON COLUMN ejecutivo_comercial.id_proveedor IS
  'Proveedor al que pertenece el ejecutivo. Entero obligatorio y clave foránea hacia proveedor(id_proveedor).';
COMMENT ON COLUMN ejecutivo_comercial.nombre IS
  'Nombre del ejecutivo comercial. Texto de hasta 150 caracteres, obligatorio.';
COMMENT ON COLUMN ejecutivo_comercial.rut IS
  'RUT del ejecutivo comercial. Texto de hasta 12 caracteres, obligatorio; el backend lo normaliza y valida. La combinación de proveedor y RUT es única, pero el mismo RUT puede aparecer en proveedores distintos.';
COMMENT ON COLUMN ejecutivo_comercial.cargo IS
  'Cargo del ejecutivo comercial. Texto de hasta 100 caracteres, obligatorio.';
COMMENT ON COLUMN ejecutivo_comercial.email IS
  'Correo electrónico de contacto del ejecutivo. Texto de hasta 120 caracteres, obligatorio; el backend valida su formato.';
COMMENT ON COLUMN ejecutivo_comercial.telefono IS
  'Teléfono de contacto del ejecutivo. Texto de hasta 30 caracteres, obligatorio; el backend valida el formato chileno con prefijo +56 y nueve dígitos nacionales.';

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
  'Ficha de identificación, giro comercial y ubicación de cada cliente. Sus contactos de proyectos y finanzas se registran en tablas separadas.';
COMMENT ON COLUMN cliente.id_cliente IS
  'Identificador del cliente. Clave primaria entera, autoincremental y no nula.';
COMMENT ON COLUMN cliente.rut_cliente IS
  'RUT del cliente. Texto de hasta 12 caracteres, obligatorio y único; el backend lo normaliza y valida.';
COMMENT ON COLUMN cliente.razon_social IS
  'Nombre legal de la empresa cliente. Texto de hasta 150 caracteres, obligatorio.';
COMMENT ON COLUMN cliente.giro IS
  'Giro comercial o actividad económica del cliente. Texto de hasta 150 caracteres, obligatorio.';
COMMENT ON COLUMN cliente.direccion IS
  'Dirección del cliente. Texto de hasta 200 caracteres, obligatorio.';
COMMENT ON COLUMN cliente.id_comuna IS
  'Comuna del cliente. Entero obligatorio y clave foránea hacia comuna(id_comuna). La región se obtiene mediante la comuna asociada, sin duplicarla en esta tabla.';
COMMENT ON COLUMN cliente.ciudad IS
  'Ciudad del cliente. Texto de hasta 100 caracteres, obligatorio.';

-- Se admiten varios encargados de cada área para una misma empresa.
CREATE TABLE contacto_proyecto (
  id_contacto  SERIAL PRIMARY KEY,
  id_cliente   INT NOT NULL REFERENCES cliente(id_cliente),
  nombre       VARCHAR(150) NOT NULL,
  rut          VARCHAR(12) NOT NULL,
  cargo        VARCHAR(100) NOT NULL,
  email        VARCHAR(120) NOT NULL,
  telefono     VARCHAR(30) NOT NULL,
  UNIQUE (id_cliente, rut)
);

COMMENT ON TABLE contacto_proyecto IS
  'Contactos del área de proyectos de cada cliente. Un cliente puede tener cero o varios contactos; un mismo RUT no se repite dentro de esta área del mismo cliente, pero puede aparecer en finanzas o en otros clientes.';
COMMENT ON COLUMN contacto_proyecto.id_contacto IS
  'Identificador del contacto de proyectos. Clave primaria entera, autoincremental y no nula, independiente de los identificadores de contacto_finanzas.';
COMMENT ON COLUMN contacto_proyecto.id_cliente IS
  'Cliente al que pertenece el contacto de proyectos. Entero obligatorio y clave foránea hacia cliente(id_cliente).';
COMMENT ON COLUMN contacto_proyecto.nombre IS
  'Nombre del contacto de proyectos. Texto de hasta 150 caracteres, obligatorio.';
COMMENT ON COLUMN contacto_proyecto.rut IS
  'RUT del contacto de proyectos. Texto de hasta 12 caracteres, obligatorio; el backend lo normaliza y valida. La combinación de cliente y RUT es única en esta tabla.';
COMMENT ON COLUMN contacto_proyecto.cargo IS
  'Cargo del contacto de proyectos. Texto de hasta 100 caracteres, obligatorio.';
COMMENT ON COLUMN contacto_proyecto.email IS
  'Correo electrónico del contacto de proyectos. Texto de hasta 120 caracteres, obligatorio; el backend valida su formato.';
COMMENT ON COLUMN contacto_proyecto.telefono IS
  'Teléfono del contacto de proyectos. Texto de hasta 30 caracteres, obligatorio; el backend valida el formato chileno con prefijo +56 y nueve dígitos nacionales.';

CREATE TABLE contacto_finanzas (
  id_contacto  SERIAL PRIMARY KEY,
  id_cliente   INT NOT NULL REFERENCES cliente(id_cliente),
  nombre       VARCHAR(150) NOT NULL,
  rut          VARCHAR(12) NOT NULL,
  cargo        VARCHAR(100) NOT NULL,
  email        VARCHAR(120) NOT NULL,
  telefono     VARCHAR(30) NOT NULL,
  UNIQUE (id_cliente, rut)
);

COMMENT ON TABLE contacto_finanzas IS
  'Contactos del área de finanzas de cada cliente. Un cliente puede tener cero o varios contactos; un mismo RUT no se repite dentro de esta área del mismo cliente, pero puede aparecer en proyectos o en otros clientes.';
COMMENT ON COLUMN contacto_finanzas.id_contacto IS
  'Identificador del contacto de finanzas. Clave primaria entera, autoincremental y no nula, independiente de los identificadores de contacto_proyecto.';
COMMENT ON COLUMN contacto_finanzas.id_cliente IS
  'Cliente al que pertenece el contacto de finanzas. Entero obligatorio y clave foránea hacia cliente(id_cliente).';
COMMENT ON COLUMN contacto_finanzas.nombre IS
  'Nombre del contacto de finanzas. Texto de hasta 150 caracteres, obligatorio.';
COMMENT ON COLUMN contacto_finanzas.rut IS
  'RUT del contacto de finanzas. Texto de hasta 12 caracteres, obligatorio; el backend lo normaliza y valida. La combinación de cliente y RUT es única en esta tabla.';
COMMENT ON COLUMN contacto_finanzas.cargo IS
  'Cargo del contacto de finanzas. Texto de hasta 100 caracteres, obligatorio.';
COMMENT ON COLUMN contacto_finanzas.email IS
  'Correo electrónico del contacto de finanzas. Texto de hasta 120 caracteres, obligatorio; el backend valida su formato.';
COMMENT ON COLUMN contacto_finanzas.telefono IS
  'Teléfono del contacto de finanzas. Texto de hasta 30 caracteres, obligatorio; el backend valida el formato chileno con prefijo +56 y nueve dígitos nacionales.';

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
  fecha_actualizacion_precio TIMESTAMP NOT NULL DEFAULT now(),
  stock_minimo        NUMERIC(12,3) NOT NULL DEFAULT 0,
  stock_actual        NUMERIC(12,3) NOT NULL DEFAULT 0,
  stock_comprometido  NUMERIC(12,3) NOT NULL DEFAULT 0,
  precio_pmp          NUMERIC(14,4) NOT NULL DEFAULT 0,
  activo              BOOLEAN NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE articulo IS
  'Catálogo de artículos del inventario, con identificación, clasificación, ubicación, precio comercial y saldos de existencias. El disponible en bodega se calcula como stock_actual menos stock_comprometido; no se almacena en otra columna. El backend mantiene los saldos y el PMP al registrar movimientos.';
COMMENT ON COLUMN articulo.id_articulo IS
  'Identificador del artículo. Clave primaria entera, autoincremental y no nula.';
COMMENT ON COLUMN articulo.codigo_interno IS
  'Código interno utilizado para identificar y buscar el artículo. Texto de hasta 40 caracteres, obligatorio y único.';
COMMENT ON COLUMN articulo.codigo_barras IS
  'Código de barras del artículo. Texto de hasta 60 caracteres, obligatorio y único; se conserva como texto para admitir ceros iniciales.';
COMMENT ON COLUMN articulo.nombre IS
  'Nombre del artículo. Texto de hasta 150 caracteres, obligatorio.';
COMMENT ON COLUMN articulo.id_categoria IS
  'Categoría del artículo. Entero obligatorio y clave foránea hacia categoria_articulo(id_categoria). Una categoría puede agrupar varios artículos.';
COMMENT ON COLUMN articulo.unidad_medida IS
  'Unidad de medida. Texto de hasta 20 caracteres, obligatorio. El backend admite UN, M, M2, M3, KG y L; UN exige cantidades enteras y las otras unidades admiten hasta tres decimales. El schema no impone esta lista mediante CHECK.';
COMMENT ON COLUMN articulo.ubicacion_bodega IS
  'Ubicación física del artículo dentro de la bodega, por ejemplo estante o pasillo. Texto de hasta 80 caracteres, obligatorio.';
COMMENT ON COLUMN articulo.bodega_sector IS
  'Número de bodega o sector de almacenamiento del artículo. Texto de hasta 80 caracteres, obligatorio.';
COMMENT ON COLUMN articulo.descripcion IS
  'Descripción adicional del artículo. Campo TEXT opcional que admite NULL.';
COMMENT ON COLUMN articulo.precio_lista IS
  'Precio comercial unitario en CLP con IVA incluido, según el uso actual del sistema. NUMERIC(14,0), obligatorio y sin decimales; CHECK impide valores negativos. Se edita en el catálogo y no representa el costo PMP.';
COMMENT ON COLUMN articulo.fecha_actualizacion_precio IS
  'Fecha y hora de referencia del precio de lista. TIMESTAMP sin zona horaria, obligatorio y con valor predeterminado now() al crear. El backend lo actualiza cuando cambia precio_lista; no existe un trigger para hacerlo automáticamente.';
COMMENT ON COLUMN articulo.stock_minimo IS
  'Umbral mínimo de existencias. NUMERIC(12,3), obligatorio y con valor predeterminado cero. El backend exige un valor no negativo y muestra alerta cuando el disponible en bodega es menor o igual a este mínimo.';
COMMENT ON COLUMN articulo.stock_actual IS
  'Cantidad total de existencias, incluida la asignada a técnicos y todavía no consumida. NUMERIC(12,3), obligatorio y con valor predeterminado cero. El backend actualiza este saldo mediante los movimientos; no se edita directamente desde la ficha.';
COMMENT ON COLUMN articulo.stock_comprometido IS
  'Cantidad asignada a técnicos mediante USO_INTERNO y todavía no consumida ni liberada. NUMERIC(12,3), obligatorio y con valor predeterminado cero. Está incluida en stock_actual y se resta para calcular el disponible en bodega.';
COMMENT ON COLUMN articulo.precio_pmp IS
  'Costo unitario promedio ponderado utilizado para valorar las existencias, sin IVA. NUMERIC(14,4), obligatorio y con valor predeterminado cero. El backend lo calcula según las reglas de los movimientos; sus cuatro decimales conservan precisión aunque los precios comerciales se expresen en pesos enteros.';
COMMENT ON COLUMN articulo.activo IS
  'Indica si el artículo está habilitado. Booleano obligatorio con valor predeterminado TRUE. El backend impide registrar nuevos movimientos cuando está inactivo, conservando el artículo y su historial.';

-- ---------- BETA ----------
CREATE TABLE categoria_servicio (
  id_categoria_servicio  SERIAL PRIMARY KEY,
  nombre_servicio        VARCHAR(80) NOT NULL UNIQUE
);

-- El presupuesto puede existir antes de crear su obra.
CREATE TABLE presupuesto (
  id_presupuesto        SERIAL PRIMARY KEY,
  id_cliente            INT NOT NULL REFERENCES cliente(id_cliente),
  fecha_emision         TIMESTAMP NOT NULL DEFAULT now(),
  monto_total           NUMERIC(14,2) NOT NULL DEFAULT 0,
  estado                VARCHAR(30) NOT NULL DEFAULT 'Pendiente'
                        CHECK (estado IN ('Pendiente', 'Aprobado', 'Rechazado')),
  origen                VARCHAR(20) NOT NULL DEFAULT 'Oficina'
                        CHECK (origen IN ('Oficina', 'Terreno')),
  id_operacion_offline  VARCHAR(64) UNIQUE
);

CREATE TABLE obra (
  id_obra                SERIAL PRIMARY KEY,
  nombre_obra            VARCHAR(150) NOT NULL, -- Nombre visible para identificar la obra
  -- El cliente se obtiene desde el presupuesto asociado.
  id_presupuesto         INT NOT NULL UNIQUE REFERENCES presupuesto(id_presupuesto), -- Un presupuesto por obra, sin compartirlo entre obras.
  id_categoria_servicio  INT NOT NULL REFERENCES categoria_servicio(id_categoria_servicio),
  id_tecnico             INT NOT NULL REFERENCES usuario(id_usuario),
  estado                 VARCHAR(20) NOT NULL DEFAULT 'En proceso'
  CHECK (estado IN ('En proceso', 'Finalizada', 'Suspendida', 'Cancelada')),
  sin_materiales         BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_creacion         TIMESTAMP NOT NULL DEFAULT now(),
  fecha_cierre           TIMESTAMP
);

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
  id_cliente               INT REFERENCES cliente(id_cliente),
  id_proveedor             INT REFERENCES proveedor(id_proveedor),
  id_obra                  INT REFERENCES obra(id_obra),
  id_documento_referencia  INT REFERENCES documento_tributario(id_documento),
  estado_pago              VARCHAR(20) NOT NULL DEFAULT 'Pendiente'
  CHECK (estado_pago IN ('Pendiente', 'Pagada')),
  -- exactamente uno: cliente o proveedor
  CONSTRAINT chk_cliente_o_proveedor
    CHECK ((id_cliente IS NOT NULL)::int + (id_proveedor IS NOT NULL)::int = 1),
  CONSTRAINT chk_vencimiento_factura
    CHECK (tipo_documento <> 'factura' OR fecha_vencimiento IS NOT NULL)
);

COMMENT ON TABLE documento_tributario IS
  'Cabecera de documentos asociados a un proveedor o un cliente, exclusivamente uno de ellos. Actualmente se implementa la gestión de documentos de proveedores; registrar el documento no modifica existencias. Los totales se calculan desde sus detalles, descuentos e IVA. La facturación de clientes, gestión de pagos y aplicación automática de notas de crédito siguen pendientes.';
COMMENT ON COLUMN documento_tributario.id_documento IS
  'Identificador del documento. Clave primaria entera, autoincremental y no nula.';
COMMENT ON COLUMN documento_tributario.tipo_documento IS
  'Tipo de documento. Texto de hasta 30 caracteres, obligatorio; CHECK admite factura, boleta, guia_despacho o nota_credito.';
COMMENT ON COLUMN documento_tributario.folio IS
  'Número o folio del documento emitido por el proveedor. Texto de hasta 30 caracteres, obligatorio; no se exige que sea exclusivamente numérico. El backend evita repetir proveedor, tipo y folio, pero el schema no impone esa unicidad.';
COMMENT ON COLUMN documento_tributario.fecha_emision IS
  'Fecha de emisión indicada en el documento original. DATE obligatorio, elegido al registrar el documento; puede ser anterior a su registro en el sistema.';
COMMENT ON COLUMN documento_tributario.fecha_vencimiento IS
  'Fecha límite de pago. DATE, obligatorio para tipo factura mediante CHECK y opcional para los otros tipos. Si se informa, otro CHECK exige que no sea anterior a fecha_emision. Se utiliza en alertas de facturas pendientes.';
COMMENT ON COLUMN documento_tributario.fecha_ingreso IS
  'Fecha y hora de registro en el sistema, no de recepción física del material. TIMESTAMPTZ obligatorio con valor predeterminado now(), correspondiente al inicio de la transacción. El backend actual no recibe esta fecha desde el formulario.';
COMMENT ON COLUMN documento_tributario.observaciones IS
  'Observaciones generales del documento. TEXT opcional que admite NULL.';
COMMENT ON COLUMN documento_tributario.descuento_general IS
  'Porcentaje de descuento sobre el conjunto del documento, aplicado después de los descuentos por producto. NUMERIC(5,2), obligatorio, predeterminado cero y limitado entre 0 y 100 mediante CHECK.';
COMMENT ON COLUMN documento_tributario.descuento_pronto_pago IS
  'Porcentaje de descuento por pago anticipado concedido en el documento. Se aplica después del descuento general; no registra un pago. NUMERIC(5,2), obligatorio, predeterminado cero y limitado entre 0 y 100 mediante CHECK.';
COMMENT ON COLUMN documento_tributario.tasa_iva IS
  'Porcentaje de IVA utilizado para calcular los importes del documento. NUMERIC(5,2), obligatorio, predeterminado 19 y limitado entre 0 y 100 mediante CHECK.';
COMMENT ON COLUMN documento_tributario.id_cliente IS
  'Cliente asociado al documento. Entero y clave foránea hacia cliente(id_cliente). Admite NULL individualmente, pero el CHECK exige exactamente uno entre id_cliente e id_proveedor. La gestión de documentos de clientes sigue pendiente.';
COMMENT ON COLUMN documento_tributario.id_proveedor IS
  'Proveedor asociado al documento. Entero y clave foránea hacia proveedor(id_proveedor). Admite NULL individualmente, pero el CHECK exige exactamente uno entre id_cliente e id_proveedor. El servicio actual de documentos de proveedores establece esta relación.';
COMMENT ON COLUMN documento_tributario.id_obra IS
  'Obra asociada al documento cuando corresponda. Entero opcional y clave foránea hacia obra(id_obra). El formulario actual de documentos de proveedores no establece esta relación.';
COMMENT ON COLUMN documento_tributario.id_documento_referencia IS
  'Documento original al que se refiere una nota de crédito. Entero opcional y clave foránea hacia documento_tributario(id_documento). El backend lo exige para notas de crédito del mismo proveedor, impide autorreferenciar el registro y no admite otra nota de crédito como original; la aplicación automática a inventario y costos sigue pendiente.';
COMMENT ON COLUMN documento_tributario.estado_pago IS
  'Estado de pago. Texto de hasta 20 caracteres, obligatorio y predeterminado Pendiente; CHECK admite Pendiente o Pagada. Se utiliza en las alertas de facturas. La gestión de pagos que actualice este estado sigue pendiente.';

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

COMMENT ON TABLE detalle_documento IS
  'Materiales incluidos en un documento, con cantidad documentada, costo unitario, copia del precio de lista y descuentos por producto. No representa la recepción física: lo recibido y pendiente se calcula desde los ingresos y sus reversas en el Cardex. El backend bloquea cambios de materiales y costos cuando existen ingresos asociados al documento.';
COMMENT ON COLUMN detalle_documento.id_detalle_documento IS
  'Identificador de la línea del documento. Clave primaria entera, autoincremental y no nula. Los ingresos por compra referencian esta línea para identificar su documento y calcular cantidades recibidas.';
COMMENT ON COLUMN detalle_documento.id_documento IS
  'Documento al que pertenece la línea. Entero obligatorio y clave foránea hacia documento_tributario(id_documento). Un documento puede tener varias líneas.';
COMMENT ON COLUMN detalle_documento.id_articulo IS
  'Artículo incluido en la línea. Entero obligatorio y clave foránea hacia articulo(id_articulo). La unidad de medida se consulta desde el artículo y no se duplica en esta tabla.';
COMMENT ON COLUMN detalle_documento.cantidad IS
  'Cantidad del artículo documentada, no necesariamente recibida. NUMERIC(12,3), obligatorio y mayor que cero mediante CHECK. El backend exige cantidades enteras cuando la unidad del artículo es UN.';
COMMENT ON COLUMN detalle_documento.costo_neto IS
  'Costo neto unitario en CLP, sin IVA y antes de aplicar los descuentos de la línea y del documento. NUMERIC(14,4), obligatorio y no negativo mediante CHECK. El costo aplicado al ingreso se calcula con los descuentos correspondientes.';
COMMENT ON COLUMN detalle_documento.precio_lista IS
  'Copia del precio de lista unitario del catálogo, con IVA incluido según el uso actual. NUMERIC(14,0), obligatorio y no negativo mediante CHECK. El backend lo copia al agregar la línea y conserva la copia al editar una línea existente; no se edita desde el formulario del documento.';
COMMENT ON COLUMN detalle_documento.descuento_1 IS
  'Primer descuento porcentual por producto. NUMERIC(5,2), obligatorio, predeterminado cero y limitado entre 0 y 100 mediante CHECK. Se aplica al importe antes del segundo descuento.';
COMMENT ON COLUMN detalle_documento.descuento_2 IS
  'Segundo descuento porcentual por producto. NUMERIC(5,2), obligatorio, predeterminado cero y limitado entre 0 y 100 mediante CHECK. Se aplica sobre el resultado del primer descuento, sin sumar porcentajes.';
COMMENT ON COLUMN detalle_documento.descuento_3 IS
  'Tercer descuento porcentual por producto. NUMERIC(5,2), obligatorio, predeterminado cero y limitado entre 0 y 100 mediante CHECK. Se aplica sobre el resultado del segundo descuento, antes de los descuentos generales del documento.';
COMMENT ON COLUMN detalle_documento.observaciones IS
  'Observaciones específicas del material en esta línea del documento. TEXT opcional que admite NULL.';

-- ---------- ALPHA: MOVIMIENTOS ----------
-- Una recepción agrupa los artículos de una entrega y se firma una sola vez.
-- Recepcion tecnico Gamma
CREATE TABLE recepcion_material (
  id_recepcion        SERIAL PRIMARY KEY,
  id_usuario_receptor INT NOT NULL REFERENCES usuario(id_usuario),
  firma               TEXT,
  fecha_firma         TIMESTAMP,
  -- Sin firma queda pendiente; firma y fecha se completan juntas al confirmar.
  CONSTRAINT chk_firma_recepcion CHECK (
    (firma IS NULL AND fecha_firma IS NULL)
    OR (firma IS NOT NULL AND length(trim(firma)) > 0 AND fecha_firma IS NOT NULL)
  )
);

CREATE TABLE movimiento_cardex (
  id_movimiento            SERIAL PRIMARY KEY,
  id_articulo              INT NOT NULL REFERENCES articulo(id_articulo),
  id_usuario               INT NOT NULL REFERENCES usuario(id_usuario), -- Quien registra y entrega en las salidas.
  id_recepcion             INT REFERENCES recepcion_material(id_recepcion), -- Recepción del técnico, solo para USO_INTERNO.
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
  fecha_hora               TIMESTAMP NOT NULL DEFAULT now(),
  justificacion            TEXT, -- Motivo u observaciones del movimiento.
  -- Cliente y presupuesto se consultan desde la obra asociada, sin duplicarlos.
  CONSTRAINT chk_datos_egreso CHECK (
    tipo_movimiento <> 'EGRESO'
    OR (id_obra IS NOT NULL AND precio_lista_vigente IS NOT NULL)
  ),
  CONSTRAINT chk_recepcion_uso_interno CHECK (
    (tipo_movimiento = 'USO_INTERNO') = (id_recepcion IS NOT NULL)
  )
);

COMMENT ON TABLE movimiento_cardex IS
  'Historial de movimientos de artículos. El backend registra movimiento, cambios de stock y PMP y auditoría en una misma transacción; las correcciones se registran mediante nuevos movimientos de reversa, sin editar el original. Las cantidades de salidas no deben interpretarse solo por su signo: el efecto depende del tipo de movimiento.';
COMMENT ON COLUMN movimiento_cardex.id_movimiento IS
  'Identificador del movimiento. Clave primaria entera, autoincremental y no nula.';
COMMENT ON COLUMN movimiento_cardex.id_articulo IS
  'Artículo afectado por el movimiento. Entero obligatorio y clave foránea hacia articulo(id_articulo). Cada movimiento corresponde a un artículo.';
COMMENT ON COLUMN movimiento_cardex.id_usuario IS
  'Usuario que registra el movimiento, obtenido por el backend desde la identidad autenticada. Entero obligatorio y clave foránea hacia usuario(id_usuario). En las salidas directas representa también a quien entrega; es distinto del técnico receptor.';
COMMENT ON COLUMN movimiento_cardex.id_recepcion IS
  'Recepción que identifica al técnico de una asignación de uso interno. Entero y clave foránea hacia recepcion_material(id_recepcion). CHECK exige un valor para USO_INTERNO y NULL para los demás tipos. La firma posterior desde Gamma está pendiente.';
COMMENT ON COLUMN movimiento_cardex.id_obra IS
  'Obra asociada. Entero y clave foránea hacia obra(id_obra); obligatorio para EGRESO mediante CHECK y opcional para MERMA en el formulario actual. Cliente y presupuesto se obtienen desde la obra, sin duplicarlos aquí. La reversa conserva la obra del movimiento original.';
COMMENT ON COLUMN movimiento_cardex.id_movimiento_revertido IS
  'Movimiento original corregido mediante REVERSA. Entero opcional y clave foránea hacia movimiento_cardex(id_movimiento). El backend exige la referencia para reversas, verifica el artículo y saldo reversible e impide revertir otra reversa. Admite correcciones parciales sin exceder el saldo del original.';
COMMENT ON COLUMN movimiento_cardex.id_movimiento_origen IS
  'Movimiento que origina la operación. Entero opcional y clave foránea hacia movimiento_cardex(id_movimiento). El registro actual lo utiliza en DEVOLUCION_PROVEEDOR para referenciar un INGRESO respaldado por un proveedor. Su uso para consumir una asignación USO_INTERNO desde Gamma sigue pendiente; el formulario de egreso de Bodega no permite esa referencia.';
COMMENT ON COLUMN movimiento_cardex.id_detalle_documento IS
  'Línea del documento de compra a la que corresponde una recepción de materiales. Entero opcional y clave foránea hacia detalle_documento(id_detalle_documento). Permite obtener el documento y calcular recibido y pendiente. Los ingresos libres no tienen esta referencia; en devoluciones y reversas el respaldo se obtiene siguiendo el movimiento original.';
COMMENT ON COLUMN movimiento_cardex.tipo_movimiento IS
  'Tipo de operación. Texto de hasta 30 caracteres, obligatorio; CHECK admite INGRESO, EGRESO, MERMA, DEVOLUCION_PROVEEDOR, AJUSTE, USO_INTERNO o REVERSA.';
COMMENT ON COLUMN movimiento_cardex.cantidad IS
  'Cantidad del movimiento. NUMERIC(12,3), obligatorio. El backend recibe cantidades positivas salvo AJUSTE, que permite diferencias positivas o negativas distintas de cero. Guarda salidas ordinarias con cantidad positiva y determina su efecto por el tipo; en REVERSA calcula el signo contrario al efecto original, incluida la liberación de comprometido. UN exige cantidades enteras.';
COMMENT ON COLUMN movimiento_cardex.costo_unitario IS
  'Costo unitario neto en CLP aplicado al movimiento, sin IVA. NUMERIC(14,4), obligatorio y predeterminado cero. En ingresos corresponde al costo registrado o al costo de compra con descuentos; en egresos, mermas, ajustes y uso interno utiliza el PMP vigente. Devoluciones y reversas utilizan el costo del movimiento original según sus reglas.';
COMMENT ON COLUMN movimiento_cardex.precio_lista_vigente IS
  'Copia del precio de lista comercial unitario, con IVA incluido, al confirmar un EGRESO. NUMERIC(14,0), no negativo mediante CHECK y obligatorio para EGRESO mediante chk_datos_egreso; los demás tipos admiten NULL. El backend lo obtiene del catálogo, separado del costo unitario.';
COMMENT ON COLUMN movimiento_cardex.fecha_hora IS
  'Fecha y hora de referencia del movimiento. TIMESTAMP sin zona horaria, obligatorio y con valor predeterminado now(), correspondiente al inicio de la transacción si no se proporciona otro valor.';
COMMENT ON COLUMN movimiento_cardex.justificacion IS
  'Motivo u observaciones del movimiento. TEXT que admite NULL en el schema. El formulario de movimientos exige una justificación; en recepciones de compras se utiliza la observación opcional de la recepción.';

CREATE TABLE inventario_fisico (
  id_inventario         SERIAL PRIMARY KEY,
  fecha_conteo          TIMESTAMP NOT NULL DEFAULT now(),
  id_usuario            INT NOT NULL REFERENCES usuario(id_usuario),
  estado                VARCHAR(20) NOT NULL DEFAULT 'En proceso'
  CHECK (estado IN ('En proceso', 'Finalizado'))
);

COMMENT ON TABLE inventario_fisico IS
  'Cabecera de un conteo físico de materiales en bodega, excluyendo lo asignado a técnicos. El backend permite registrar y corregir cantidades mientras está En proceso. Finalizar cierra el conteo sin generar movimientos ni modificar stock o PMP; cualquier ajuste posterior requiere una operación separada. Los totales de artículos contados y con diferencia se calculan desde los detalles.';
COMMENT ON COLUMN inventario_fisico.id_inventario IS
  'Identificador del conteo físico. Clave primaria entera, autoincremental y no nula.';
COMMENT ON COLUMN inventario_fisico.fecha_conteo IS
  'Fecha y hora de creación del conteo. TIMESTAMP sin zona horaria, obligatorio y con valor predeterminado now(), correspondiente al inicio de la transacción. No representa una referencia simultánea del stock de todos los artículos: cada detalle toma su referencia al contarse por primera vez.';
COMMENT ON COLUMN inventario_fisico.id_usuario IS
  'Usuario que crea el conteo, obtenido por el backend desde la identidad autenticada. Entero obligatorio y clave foránea hacia usuario(id_usuario). Los responsables de guardados y cierre se registran en la auditoría.';
COMMENT ON COLUMN inventario_fisico.estado IS
  'Estado del conteo. Texto de hasta 20 caracteres, obligatorio y predeterminado En proceso; CHECK admite En proceso o Finalizado. El backend impide guardar o corregir detalles después de finalizar.';

CREATE TABLE detalle_inventario_fisico (
  id_detalle_inventario  SERIAL PRIMARY KEY,
  id_inventario          INT NOT NULL REFERENCES inventario_fisico(id_inventario) ON DELETE CASCADE,
  id_articulo            INT NOT NULL REFERENCES articulo(id_articulo),
  stock_sistema          NUMERIC(12,3) NOT NULL, -- Referencia de bodega: stock_actual - stock_comprometido al primer conteo.
  stock_fisico           NUMERIC(12,3) NOT NULL CHECK (stock_fisico >= 0),
  UNIQUE (id_inventario, id_articulo) -- Un detalle por artículo dentro del inventario
);

COMMENT ON TABLE detalle_inventario_fisico IS
  'Resultado del conteo de un artículo dentro de un inventario físico. La combinación de inventario y artículo es única. Conserva la referencia del sistema y la cantidad contada; la diferencia se calcula como stock_fisico menos stock_sistema, sin almacenar otra columna. Guardar o corregir este detalle no modifica existencias.';
COMMENT ON COLUMN detalle_inventario_fisico.id_detalle_inventario IS
  'Identificador del detalle contado. Clave primaria entera, autoincremental y no nula.';
COMMENT ON COLUMN detalle_inventario_fisico.id_inventario IS
  'Conteo al que pertenece el detalle. Entero obligatorio y clave foránea hacia inventario_fisico(id_inventario). ON DELETE CASCADE elimina el detalle si se elimina su cabecera; el módulo actual no ofrece eliminación de conteos. La combinación con id_articulo es única.';
COMMENT ON COLUMN detalle_inventario_fisico.id_articulo IS
  'Artículo contado. Entero obligatorio y clave foránea hacia articulo(id_articulo). No puede repetirse en el mismo inventario físico; corregir su cantidad actualiza el detalle existente.';
COMMENT ON COLUMN detalle_inventario_fisico.stock_sistema IS
  'Cantidad esperada en bodega al primer guardado del artículo en este conteo: stock_actual menos stock_comprometido. NUMERIC(12,3), obligatorio y sin valor predeterminado. El backend obtiene la referencia y la conserva al corregir stock_fisico; no se recibe desde el formulario.';
COMMENT ON COLUMN detalle_inventario_fisico.stock_fisico IS
  'Cantidad encontrada físicamente en bodega, sin incluir material asignado a técnicos. NUMERIC(12,3), obligatorio y sin valor predeterminado; CHECK admite cero o valores positivos e impide cantidades negativas. El backend exige enteros para UN.';

-- ---------- GAMMA ----------
CREATE TABLE plantilla_checklist (
  id_plantilla           SERIAL PRIMARY KEY,
  id_categoria_servicio  INT NOT NULL REFERENCES categoria_servicio(id_categoria_servicio),
  nombre_plantilla       VARCHAR(120) NOT NULL
);

CREATE TABLE item_checklist (
  id_item       SERIAL PRIMARY KEY,
  id_plantilla  INT NOT NULL REFERENCES plantilla_checklist(id_plantilla),
  pregunta      VARCHAR(255) NOT NULL
);

CREATE TABLE hoja_de_servicio (
  id_hoja_servicio      SERIAL PRIMARY KEY,
  id_obra               INT NOT NULL REFERENCES obra(id_obra),
  id_usuario            INT NOT NULL REFERENCES usuario(id_usuario),
  fecha_servicio        TIMESTAMP NOT NULL DEFAULT now(),
  horas_trabajadas      NUMERIC(5,2) NOT NULL DEFAULT 0,
  firma_cliente_base64  TEXT,
  id_operacion_offline  VARCHAR(64) NOT NULL UNIQUE
);


CREATE TABLE respuesta_checklist (
  id_respuesta      SERIAL PRIMARY KEY,
  id_hoja_servicio  INT NOT NULL REFERENCES hoja_de_servicio(id_hoja_servicio),
  id_item           INT NOT NULL REFERENCES item_checklist(id_item),
  valor_respuesta   VARCHAR(255),
  UNIQUE (id_hoja_servicio, id_item) -- Una respuesta por ítem dentro de la hoja
);

-- Material consumido en una atención, separado de las respuestas del checklist.
-- El backend debe guardar consumo, EGRESO, saldo y auditoría en una transacción.
CREATE TABLE material_utilizado (
  id_material_utilizado SERIAL PRIMARY KEY,
  id_hoja_servicio      INT NOT NULL REFERENCES hoja_de_servicio(id_hoja_servicio),
  id_movimiento_egreso  INT NOT NULL UNIQUE REFERENCES movimiento_cardex(id_movimiento),
  id_operacion_offline  VARCHAR(64) NOT NULL UNIQUE
                        CHECK (length(trim(id_operacion_offline)) > 0)
);

-- Reglas pendientes del servicio de consumo: comprobar que el movimiento de salida
-- sea EGRESO de la obra de la hoja; artículo y cantidad se obtienen de ese egreso.
-- Debe tener un único origen
-- USO_INTERNO del mismo artículo y técnico mediante id_movimiento_origen.
-- Si se utilizan dos entregas, registrar dos consumos con sus respectivos egresos.
-- Respetar los bloqueos del servicio de movimientos para no exceder el saldo asignado.
-- El identificador offline permite reconocer reintentos sin generar otro egreso.
