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
  fecha_hora            TIMESTAMPTZ NOT NULL DEFAULT now()
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
  'Fecha y hora de referencia de la auditoría. TIMESTAMPTZ, presentado en America/Santiago, obligatorio y con valor predeterminado now(), correspondiente al inicio de la transacción si no se proporciona otro valor.';

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
  'Ficha de identificación, giro comercial y ubicación de cada cliente. Sus contactos de proyectos y finanzas se registran en contacto_cliente, diferenciados por área.';
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
  'Contactos de clientes clasificados por área de Proyecto o Finanzas. Un cliente puede tener cero o varios contactos de cada área. UNIQUE impide repetir un RUT dentro de la misma área del cliente, pero permite que una persona figure en ambas áreas o en otros clientes.';
COMMENT ON COLUMN contacto_cliente.id_contacto IS
  'Identificador del contacto. Clave primaria entera, autoincremental y no nula, compartida por todas las áreas.';
COMMENT ON COLUMN contacto_cliente.id_cliente IS
  'Cliente al que pertenece el contacto. Entero obligatorio y clave foránea hacia cliente(id_cliente).';
COMMENT ON COLUMN contacto_cliente.area IS
  'Área de contacto dentro del cliente. Texto de hasta 30 caracteres, obligatorio; CHECK admite Proyecto o Finanzas. El backend establece el área según el apartado del formulario y conserva las dos listas en la API.';
COMMENT ON COLUMN contacto_cliente.nombre IS
  'Nombre del contacto. Texto de hasta 150 caracteres, obligatorio.';
COMMENT ON COLUMN contacto_cliente.rut IS
  'RUT del contacto. Texto de hasta 12 caracteres, obligatorio; el backend lo normaliza y valida. La combinación de cliente, área y RUT es única.';
COMMENT ON COLUMN contacto_cliente.cargo IS
  'Cargo del contacto en la empresa cliente. Texto de hasta 100 caracteres, obligatorio.';
COMMENT ON COLUMN contacto_cliente.email IS
  'Correo electrónico del contacto. Texto de hasta 120 caracteres, obligatorio; el backend valida su formato.';
COMMENT ON COLUMN contacto_cliente.telefono IS
  'Teléfono del contacto. Texto de hasta 30 caracteres, obligatorio; el backend valida el formato chileno con prefijo +56 y nueve dígitos nacionales.';

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
  CONSTRAINT chk_articulo_stock_actual CHECK (stock_actual >= 0),
  CONSTRAINT chk_articulo_stock_comprometido CHECK (stock_comprometido >= 0),
  CONSTRAINT chk_articulo_stock_disponible CHECK (stock_actual >= stock_comprometido)
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
  'Fecha y hora de referencia del precio de lista. TIMESTAMPTZ, presentado en America/Santiago, obligatorio y con valor predeterminado now() al crear. El backend lo actualiza cuando cambia precio_lista; no existe un trigger para hacerlo automáticamente.';
COMMENT ON COLUMN articulo.stock_minimo IS
  'Umbral mínimo de existencias. NUMERIC(12,3), obligatorio y con valor predeterminado cero. El backend exige un valor no negativo y muestra alerta cuando el disponible en bodega es menor o igual a este mínimo.';
COMMENT ON COLUMN articulo.stock_actual IS
  'Cantidad total de existencias, incluida la asignada a técnicos y todavía no consumida. NUMERIC(12,3), obligatorio y con valor predeterminado cero. CHECK impide valores negativos y exige que sea mayor o igual al stock comprometido. El backend actualiza este saldo mediante los movimientos; no se edita directamente desde la ficha.';
COMMENT ON COLUMN articulo.stock_comprometido IS
  'Cantidad asignada a técnicos mediante USO_INTERNO y todavía no consumida ni liberada. NUMERIC(12,3), obligatorio y con valor predeterminado cero. CHECK impide valores negativos y superar stock_actual. Está incluida en stock_actual y se resta para calcular el disponible en bodega.';
COMMENT ON COLUMN articulo.precio_pmp IS
  'Costo unitario promedio ponderado utilizado para valorar las existencias, sin IVA. NUMERIC(14,4), obligatorio y con valor predeterminado cero. El backend lo calcula según las reglas de los movimientos; sus cuatro decimales conservan precisión aunque los precios comerciales se expresen en pesos enteros.';
COMMENT ON COLUMN articulo.activo IS
  'Indica si el artículo está habilitado. Booleano obligatorio con valor predeterminado TRUE. El backend impide registrar nuevos movimientos cuando está inactivo, conservando el artículo y su historial.';

-- ---------- BETA ----------
CREATE TABLE categoria_servicio (
  id_categoria_servicio  SERIAL PRIMARY KEY,
  nombre_servicio        VARCHAR(80) NOT NULL UNIQUE
);

COMMENT ON TABLE categoria_servicio IS
  'Catálogo de categorías que clasifican los servicios ofrecidos por la empresa. Agrupa las tareas del catálogo y permite seleccionar la categoría de un presupuesto; la obra la obtiene desde su presupuesto asociado.';
COMMENT ON COLUMN categoria_servicio.id_categoria_servicio IS
  'Identificador de la categoría de servicio. Clave primaria entera, autoincremental y no nula.';
COMMENT ON COLUMN categoria_servicio.nombre_servicio IS
  'Nombre de la categoría de servicio, por ejemplo Mantención o Emergencia. Texto de hasta 80 caracteres, obligatorio y único.';

-- Catalogo editable de tareas; los presupuestos conservan sus propias descripciones y precios.
CREATE TABLE tarea_servicio (
  id_tarea SERIAL PRIMARY KEY,
  id_categoria_servicio INT NOT NULL REFERENCES categoria_servicio(id_categoria_servicio),
  nombre_tarea VARCHAR(150) NOT NULL CHECK (length(trim(nombre_tarea)) > 0),
  precio_neto NUMERIC(14,0) NOT NULL CHECK (precio_neto >= 0),
  activo BOOLEAN NOT NULL DEFAULT TRUE
);
COMMENT ON TABLE tarea_servicio IS 'Tareas ofrecidas por categoria, con precio neto sugerido en CLP. Se desactivan sin borrar presupuestos anteriores.';
COMMENT ON COLUMN tarea_servicio.id_tarea IS 'Clave primaria entera autoincremental y no nula.';
COMMENT ON COLUMN tarea_servicio.id_categoria_servicio IS 'Categoria de servicio obligatoria; FK hacia categoria_servicio(id_categoria_servicio).';
COMMENT ON COLUMN tarea_servicio.nombre_tarea IS 'Nombre obligatorio de hasta 150 caracteres, sin permitir texto vacio.';
COMMENT ON COLUMN tarea_servicio.precio_neto IS 'Precio sugerido sin IVA, NUMERIC(14,0) no nulo y no negativo, expresado en pesos enteros.';
COMMENT ON COLUMN tarea_servicio.activo IS 'Disponibilidad para nuevas selecciones. Booleano obligatorio, verdadero por defecto; desactivar conserva el historial.';

-- El presupuesto puede existir antes de crear su obra.
CREATE TABLE presupuesto (
  id_presupuesto        SERIAL PRIMARY KEY,
  id_cliente            INT NOT NULL REFERENCES cliente(id_cliente),
  id_categoria_servicio INT REFERENCES categoria_servicio(id_categoria_servicio),
  fecha_emision         TIMESTAMPTZ NOT NULL DEFAULT now(),
  monto_total           NUMERIC(14,0) NOT NULL DEFAULT 0,
  estado                VARCHAR(30) NOT NULL DEFAULT 'Pendiente'
                        CHECK (estado IN ('Pendiente', 'Aprobado', 'Rechazado')),
  origen                VARCHAR(20) NOT NULL DEFAULT 'Oficina'
                        CHECK (origen IN ('Oficina', 'Terreno')),
  id_operacion_offline  VARCHAR(64) UNIQUE
);

COMMENT ON TABLE presupuesto IS
  'Propuesta económica para un cliente, creada desde oficina o terreno. Sus tareas y precios acordados se conservan en detalle_presupuesto; puede existir antes de crear una obra.';
COMMENT ON COLUMN presupuesto.id_presupuesto IS
  'Identificador del presupuesto. Clave primaria entera, autoincremental y no nula.';
COMMENT ON COLUMN presupuesto.id_cliente IS
  'Cliente al que se presenta el presupuesto. Entero obligatorio y clave foránea hacia cliente(id_cliente).';
COMMENT ON COLUMN presupuesto.id_categoria_servicio IS
  'Categoría elegida en el presupuesto detallado. Entero y clave foránea hacia categoria_servicio(id_categoria_servicio). Admite NULL para conservar presupuestos manuales anteriores; el backend exige categoría en los nuevos presupuestos detallados.';
COMMENT ON COLUMN presupuesto.fecha_emision IS
  'Fecha y hora de creación del presupuesto. TIMESTAMPTZ, presentado en America/Santiago, obligatorio y con valor predeterminado now(), correspondiente al inicio de la transacción si no se proporciona otro valor.';
COMMENT ON COLUMN presupuesto.monto_total IS
  'Importe total del presupuesto en CLP, incluido IVA del 19 %. NUMERIC(14,0), obligatorio y predeterminado cero, expresado en pesos enteros. En presupuestos detallados el backend suma las líneas netas redondeadas al peso y añade el IVA redondeado al peso; los presupuestos manuales anteriores también exigen pesos enteros, sin recalcular su importe.';
COMMENT ON COLUMN presupuesto.estado IS
  'Estado del presupuesto. Texto de hasta 30 caracteres, obligatorio y predeterminado Pendiente; CHECK admite Pendiente, Aprobado o Rechazado.';
COMMENT ON COLUMN presupuesto.origen IS
  'Lugar de creación del presupuesto. Texto de hasta 20 caracteres, obligatorio y predeterminado Oficina; CHECK admite Oficina o Terreno.';
COMMENT ON COLUMN presupuesto.id_operacion_offline IS
  'Identificador de la operación de creación desde terreno, utilizado para reconocer reintentos de sincronización y evitar duplicados. Texto de hasta 64 caracteres, único cuando tiene valor; admite NULL para presupuestos que no requieren esta identificación.';

CREATE TABLE detalle_presupuesto (
  id_detalle_presupuesto SERIAL PRIMARY KEY,
  id_presupuesto INT NOT NULL REFERENCES presupuesto(id_presupuesto),
  id_tarea INT NOT NULL REFERENCES tarea_servicio(id_tarea),
  descripcion VARCHAR(255) NOT NULL CHECK (length(trim(descripcion)) > 0),
  cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
  precio_neto_unitario NUMERIC(14,0) NOT NULL CHECK (precio_neto_unitario >= 0)
);
COMMENT ON TABLE detalle_presupuesto IS 'Lineas contratadas de un presupuesto. Conservan descripcion y precio acordados aunque cambie el catalogo. Solo se editan mientras el presupuesto esta Pendiente.';
COMMENT ON COLUMN detalle_presupuesto.id_detalle_presupuesto IS 'Clave primaria entera autoincremental y no nula.';
COMMENT ON COLUMN detalle_presupuesto.id_presupuesto IS 'Presupuesto al que pertenece la linea. Entero obligatorio y FK hacia presupuesto(id_presupuesto).';
COMMENT ON COLUMN detalle_presupuesto.id_tarea IS 'Tarea del catalogo que origina la linea. Entero obligatorio y FK hacia tarea_servicio(id_tarea).';
COMMENT ON COLUMN detalle_presupuesto.descripcion IS 'Descripcion acordada con el cliente, obligatoria de hasta 255 caracteres y no vacia; se conserva separada del nombre vigente en el catalogo.';
COMMENT ON COLUMN detalle_presupuesto.cantidad IS 'Cantidad contratada positiva y obligatoria. NUMERIC(12,3), hasta tres decimales.';
COMMENT ON COLUMN detalle_presupuesto.precio_neto_unitario IS 'Precio acordado sin IVA en pesos enteros, obligatorio y no negativo. NUMERIC(14,0); el backend controla el limite del total del presupuesto.';

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
  'Trabajo asociado a un presupuesto y asignado a un técnico. El cliente y la categoría se obtienen desde el presupuesto; las hojas de servicio documentan las tareas contratadas. El backend controla las transiciones de estado y las condiciones para finalizar.';
COMMENT ON COLUMN obra.id_obra IS
  'Identificador de la obra. Clave primaria entera, autoincremental y no nula.';
COMMENT ON COLUMN obra.nombre_obra IS
  'Nombre visible para identificar el trabajo. Texto de hasta 150 caracteres, obligatorio.';
COMMENT ON COLUMN obra.id_presupuesto IS
  'Presupuesto que respalda la obra. Entero obligatorio, único y clave foránea hacia presupuesto(id_presupuesto). Cada obra tiene un presupuesto y un presupuesto puede estar asociado como máximo a una obra; el backend exige que esté Aprobado al crearla.';
COMMENT ON COLUMN obra.id_tecnico IS
  'Técnico asignado a la obra. Entero obligatorio y clave foránea hacia usuario(id_usuario). El backend comprueba el rol y la disponibilidad del usuario para la asignación.';
COMMENT ON COLUMN obra.estado IS
  'Estado de la obra. Texto de hasta 20 caracteres, obligatorio y predeterminado En proceso; CHECK admite En proceso, Finalizada, Suspendida o Cancelada. El backend controla los cambios permitidos y sus requisitos.';
COMMENT ON COLUMN obra.sin_materiales IS
  'Declaración de que el trabajo no utiliza materiales. Booleano obligatorio y predeterminado FALSE. Al finalizar, el backend comprueba que esta declaración sea compatible con los egresos vigentes y los consumos registrados.';
COMMENT ON COLUMN obra.fecha_creacion IS
  'Fecha y hora de creación de la obra. TIMESTAMPTZ, presentado en America/Santiago, obligatorio y con valor predeterminado now(), correspondiente al inicio de la transacción si no se proporciona otro valor.';
COMMENT ON COLUMN obra.fecha_cierre IS
  'Fecha y hora de finalización confirmada desde el ERP. TIMESTAMPTZ, presentado en America/Santiago que admite NULL; el backend la establece al pasar al estado Finalizada. No representa la fecha de suspensión o cancelación.';
COMMENT ON COLUMN obra.firma_conformidad IS
  'Firma de conformidad del cliente. TEXT que admite NULL, con trazos comprimidos y codificados en texto. Gamma la guarda al entregar el trabajo para revisión, conservando el estado En proceso. El supervisor o Administrador General confirma después la finalización desde el ERP y establece fecha_cierre. El trazo no se copia a auditoría ni se incluye en descargas de Gamma; se puede consultar en modo de solo lectura desde el detalle de la obra finalizada en el ERP.';

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
  'Unicidad de documentos por proveedor, tipo y folio; excluye los documentos de clientes.';

-- Búsqueda de facturas de una obra y notas de crédito de un documento original.
-- El índice único anterior ya cubre las búsquedas por id_proveedor.
CREATE INDEX idx_documento_obra ON documento_tributario (id_obra)
  WHERE id_obra IS NOT NULL;
CREATE INDEX idx_documento_referencia ON documento_tributario (id_documento_referencia)
  WHERE id_documento_referencia IS NOT NULL;

COMMENT ON TABLE documento_tributario IS
  'Documentos de un proveedor o cliente. Las NC de proveedores corrigen montos de facturas sin materiales ni movimientos de stock; reducen el saldo junto con los pagos registrados. Los totales se calculan al consultar.';
COMMENT ON COLUMN documento_tributario.monto_neto_correccion IS
  'Rebaja neta global de una nota de crédito en pesos enteros. NUMERIC(14,0), obligatorio y positivo para NC mediante CHECK; NULL para los otros tipos. IVA y total se calculan con tasa_iva, copiada de la factura original, sin duplicar columnas. El backend rechaza importes con fracciones de peso.';
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
COMMENT ON COLUMN documento_tributario.id_proveedor IS
  'Proveedor asociado al documento. Entero y clave foránea hacia proveedor(id_proveedor). Admite NULL en documentos de clientes, cuyo cliente se obtiene desde la obra y el presupuesto. El CHECK exige exactamente uno entre id_obra e id_proveedor.';
COMMENT ON COLUMN documento_tributario.id_obra IS
  'Obra asociada al documento cuando corresponda. Entero opcional y clave foránea hacia obra(id_obra). La factura de cliente exige una obra finalizada y bloquea sus datos de cobro al confirmarse. El formulario de proveedores no establece esta relación.';
COMMENT ON COLUMN documento_tributario.id_documento_referencia IS
  'Factura original que corrige una NC del mismo proveedor o cliente. FK opcional a documento_tributario; el backend exige factura con saldo suficiente, bloquea la operación concurrente y no permite editar una NC registrada.';

-- Una factura reúne guías completas; sus recepciones permanecen en cada guía.
CREATE TABLE factura_guia (
  id_factura INT NOT NULL REFERENCES documento_tributario(id_documento),
  id_guia INT NOT NULL UNIQUE REFERENCES documento_tributario(id_documento),
  PRIMARY KEY (id_factura,id_guia),
  CHECK (id_factura <> id_guia)
);
COMMENT ON TABLE factura_guia IS
  'Asocia una factura de proveedor con una o varias guías de despacho completas. Cada guía puede pertenecer como máximo a una factura. La clave primaria combina id_factura e id_guia; CHECK impide vincular un documento consigo mismo. El backend comprueba los tipos de documento y que pertenezcan al mismo proveedor; las recepciones permanecen en las guías, sin duplicar ingresos de stock.';
COMMENT ON COLUMN factura_guia.id_factura IS
  'Factura que agrupa las guías del proveedor. Entero obligatorio y clave foránea hacia documento_tributario(id_documento). Forma parte de la clave primaria compuesta y puede repetirse para asociar varias guías a una factura. El backend exige tipo factura.';
COMMENT ON COLUMN factura_guia.id_guia IS
  'Guía de despacho incluida en la factura. Entero obligatorio, único y clave foránea hacia documento_tributario(id_documento). Forma parte de la clave primaria compuesta; UNIQUE impide incluir la misma guía en otra factura. El backend exige tipo guia_despacho y el mismo proveedor de la factura.';

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
  'Abonos individuales asociados a documentos. El total pagado, saldo y estado se calculan al consultar; no se almacenan en la cabecera. Se registran pagos de facturas y boletas de proveedores y pagos recibidos de facturas de clientes.';
COMMENT ON COLUMN pago_documento.id_pago IS
  'Identificador del abono. Clave primaria entera, autoincremental y no nula.';
COMMENT ON COLUMN pago_documento.id_documento IS
  'Documento al que corresponde el abono. Entero obligatorio y FK hacia documento_tributario(id_documento); un documento admite varios pagos.';
COMMENT ON COLUMN pago_documento.monto IS
  'Monto del abono en CLP. NUMERIC(14,0), obligatorio y mayor que cero, con hasta catorce dígitos enteros y sin decimales. El backend rechaza fracciones de peso e impide superar el saldo mediante bloqueo del documento.';
COMMENT ON COLUMN pago_documento.fecha_pago IS
  'Fecha efectiva del pago, elegida al registrar el abono. DATE obligatorio.';
COMMENT ON COLUMN pago_documento.id_usuario IS
  'Usuario que registra el abono. Entero obligatorio y FK hacia usuario(id_usuario), obtenido de la sesión autenticada.';
COMMENT ON COLUMN pago_documento.fecha_registro IS
  'Fecha y hora de registro en SIGEF. TIMESTAMPTZ obligatorio con valor predeterminado now().';
COMMENT ON COLUMN pago_documento.observaciones IS
  'Referencia o comentario del pago. TEXT opcional.';

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
  fecha_firma         TIMESTAMPTZ,
  -- Sin firma queda pendiente; firma y fecha se completan juntas al confirmar.
  CONSTRAINT chk_firma_recepcion CHECK (
    (firma IS NULL AND fecha_firma IS NULL)
    OR (firma IS NOT NULL AND length(trim(firma)) > 0 AND fecha_firma IS NOT NULL)
  )
);

COMMENT ON TABLE recepcion_material IS
  'Constancia de recepción de materiales asignados a un técnico mediante movimientos USO_INTERNO. Los artículos y cantidades se consultan desde los movimientos asociados. La firma confirma la entrega al técnico; es distinta de la firma de conformidad del cliente en la obra. Sin firma ni fecha permanece pendiente; CHECK exige que ambas se completen juntas.';
COMMENT ON COLUMN recepcion_material.id_recepcion IS
  'Identificador de la recepción. Clave primaria entera, autoincremental y no nula. Los movimientos USO_INTERNO la referencian mediante movimiento_cardex.id_recepcion.';
COMMENT ON COLUMN recepcion_material.id_usuario_receptor IS
  'Técnico que recibe los materiales. Entero obligatorio y clave foránea hacia usuario(id_usuario). El backend valida el receptor de la asignación y permite confirmar la recepción desde Gamma únicamente al usuario correspondiente.';
COMMENT ON COLUMN recepcion_material.firma IS
  'Firma del técnico como constancia de recepción. TEXT que admite NULL mientras está pendiente; guarda trazos comprimidos y codificados en texto. CHECK impide una firma vacía o sin fecha_firma. El backend valida y guarda la firma al sincronizar la confirmación desde Gamma.';
COMMENT ON COLUMN recepcion_material.fecha_firma IS
  'Fecha y hora en que el servidor registra la firma al confirmar la recepción. TIMESTAMPTZ, presentado en America/Santiago, sin valor predeterminado y que admite NULL mientras está pendiente. El backend asigna now() junto con la firma; CHECK impide una fecha sin firma.';

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
  fecha_hora               TIMESTAMPTZ NOT NULL DEFAULT now(),
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
  'Historial de movimientos de artículos. El backend registra movimiento, cambios de stock y PMP y auditoría en una misma transacción; las correcciones se registran mediante nuevos movimientos de reversa, sin editar el original. Las cantidades de salidas no deben interpretarse solo por su signo: el efecto depende del tipo de movimiento.';
COMMENT ON COLUMN movimiento_cardex.id_movimiento IS
  'Identificador del movimiento. Clave primaria entera, autoincremental y no nula.';
COMMENT ON COLUMN movimiento_cardex.id_articulo IS
  'Artículo afectado por el movimiento. Entero obligatorio y clave foránea hacia articulo(id_articulo). Cada movimiento corresponde a un artículo.';
COMMENT ON COLUMN movimiento_cardex.id_usuario IS
  'Usuario que registra el movimiento, obtenido por el backend desde la identidad autenticada. Entero obligatorio y clave foránea hacia usuario(id_usuario). En las salidas directas representa también a quien entrega; es distinto del técnico receptor.';
COMMENT ON COLUMN movimiento_cardex.id_recepcion IS
  'Recepción que identifica al técnico de una asignación de uso interno. Entero y clave foránea hacia recepcion_material(id_recepcion). CHECK exige un valor para USO_INTERNO y NULL para los demás tipos.';
COMMENT ON COLUMN movimiento_cardex.id_obra IS
  'Obra asociada. Entero y clave foránea hacia obra(id_obra); obligatorio para EGRESO mediante CHECK y opcional para MERMA en el formulario actual. Cliente y presupuesto se obtienen desde la obra, sin duplicarlos aquí. La reversa conserva la obra del movimiento original.';
COMMENT ON COLUMN movimiento_cardex.id_movimiento_revertido IS
  'Movimiento original corregido mediante REVERSA. Entero opcional y clave foránea hacia movimiento_cardex(id_movimiento). El backend exige la referencia para reversas, verifica el artículo y saldo reversible e impide revertir otra reversa. Admite correcciones parciales sin exceder el saldo del original.';
COMMENT ON COLUMN movimiento_cardex.id_movimiento_origen IS
  'Movimiento que origina la operación. Entero opcional y clave foránea hacia movimiento_cardex(id_movimiento). En DEVOLUCION_PROVEEDOR referencia un INGRESO respaldado por un proveedor; en los consumos desde Gamma vincula el EGRESO con la asignación USO_INTERNO utilizada.';
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
  'Fecha y hora de referencia del movimiento. TIMESTAMPTZ, presentado en America/Santiago, obligatorio y con valor predeterminado now(), correspondiente al inicio de la transacción si no se proporciona otro valor.';
COMMENT ON COLUMN movimiento_cardex.justificacion IS
  'Motivo u observaciones del movimiento. TEXT que admite NULL en el schema. El formulario de movimientos exige una justificación; en recepciones de compras se utiliza la observación opcional de la recepción.';

CREATE TABLE inventario_fisico (
  id_inventario         SERIAL PRIMARY KEY,
  fecha_conteo          TIMESTAMPTZ NOT NULL DEFAULT now(),
  id_usuario            INT NOT NULL REFERENCES usuario(id_usuario),
  estado                VARCHAR(20) NOT NULL DEFAULT 'En proceso'
  CHECK (estado IN ('En proceso', 'Finalizado'))
);

COMMENT ON TABLE inventario_fisico IS
  'Cabecera de un conteo físico de materiales en bodega, excluyendo lo asignado a técnicos. El backend permite registrar y corregir cantidades mientras está En proceso. Finalizar cierra el conteo sin generar movimientos ni modificar stock o PMP; cualquier ajuste posterior requiere una operación separada. Los totales de artículos contados y con diferencia se calculan desde los detalles.';
COMMENT ON COLUMN inventario_fisico.id_inventario IS
  'Identificador del conteo físico. Clave primaria entera, autoincremental y no nula.';
COMMENT ON COLUMN inventario_fisico.fecha_conteo IS
  'Fecha y hora de creación del conteo. TIMESTAMPTZ, presentado en America/Santiago, obligatorio y con valor predeterminado now(), correspondiente al inicio de la transacción. No representa una referencia simultánea del stock de todos los artículos: cada detalle toma su referencia al contarse por primera vez.';
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
CREATE TABLE item_checklist (
  id_item       SERIAL PRIMARY KEY,
  id_tarea      INT NOT NULL REFERENCES tarea_servicio(id_tarea),
  pregunta      VARCHAR(255) NOT NULL CHECK (length(trim(pregunta)) > 0),
  UNIQUE (id_tarea, pregunta)
);
COMMENT ON TABLE item_checklist IS
  'Comprobaciones predeterminadas asociadas a una tarea del catálogo de servicios. Se copian a respuesta_checklist al registrar la hoja de servicio; modificar el catálogo no altera las comprobaciones ya guardadas en las hojas. Una tarea puede tener varios ítems, sin repetir el mismo texto dentro de esa tarea.';
COMMENT ON COLUMN item_checklist.id_item IS
  'Identificador del ítem de checklist. Clave primaria entera, autoincremental y no nula.';
COMMENT ON COLUMN item_checklist.id_tarea IS
  'Tarea del catálogo a la que pertenece la comprobación. Entero obligatorio y clave foránea hacia tarea_servicio(id_tarea). La combinación de tarea y pregunta es única.';
COMMENT ON COLUMN item_checklist.pregunta IS
  'Texto de la comprobación que realizará el técnico. Texto de hasta 255 caracteres, obligatorio; CHECK impide texto vacío o compuesto únicamente por espacios. UNIQUE impide repetir la misma pregunta dentro de la misma tarea, pero permite utilizarla en tareas distintas.';

CREATE TABLE hoja_de_servicio (
  id_hoja_servicio      SERIAL PRIMARY KEY,
  id_detalle_presupuesto INT NOT NULL UNIQUE REFERENCES detalle_presupuesto(id_detalle_presupuesto),
  id_usuario            INT NOT NULL REFERENCES usuario(id_usuario),
  fecha_servicio        TIMESTAMPTZ NOT NULL DEFAULT now(),
  horas_trabajadas      NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (horas_trabajadas >= 0 AND horas_trabajadas <> 'NaN'::numeric),
  estado                VARCHAR(20) NOT NULL DEFAULT 'Borrador' CHECK (estado IN ('Borrador', 'Completada')),
  id_operacion_offline  VARCHAR(64) NOT NULL UNIQUE
);
COMMENT ON TABLE hoja_de_servicio IS
  'Registro del trabajo realizado sobre una tarea contratada del presupuesto. Existe como máximo una hoja por línea del presupuesto; se continúa en Borrador y el backend bloquea su edición al completar. La obra y el cliente se obtienen desde el presupuesto asociado al detalle. La firma de conformidad final pertenece a obra, no a esta tabla.';
COMMENT ON COLUMN hoja_de_servicio.id_hoja_servicio IS
  'Identificador de la hoja de servicio. Clave primaria entera, autoincremental y no nula.';
COMMENT ON COLUMN hoja_de_servicio.id_detalle_presupuesto IS
  'Tarea contratada que documenta la hoja. Entero obligatorio, único y clave foránea hacia detalle_presupuesto(id_detalle_presupuesto). UNIQUE impide crear varias hojas para la misma línea; el backend comprueba que pertenezca a la obra del técnico.';
COMMENT ON COLUMN hoja_de_servicio.id_usuario IS
  'Técnico que registra la hoja, obtenido desde la identidad autenticada. Entero obligatorio y clave foránea hacia usuario(id_usuario). El backend valida que pueda trabajar en la obra y continuar esta hoja.';
COMMENT ON COLUMN hoja_de_servicio.fecha_servicio IS
  'Fecha del servicio informada desde Gamma. TIMESTAMPTZ presentado en America/Santiago, obligatorio y con valor predeterminado now() si se omite. Gamma envía un día de calendario y el backend lo convierte explícitamente a medianoche de Santiago; permite actualizarlo mientras la hoja permanece en Borrador. No equivale necesariamente al momento de sincronización.';
COMMENT ON COLUMN hoja_de_servicio.horas_trabajadas IS
  'Tiempo trabajado acumulado en la hoja, expresado en horas decimales. NUMERIC(5,2), obligatorio y predeterminado cero; CHECK impide valores negativos y NaN. La interfaz convierte horas y minutos al valor decimal, sin columnas adicionales; el backend exige tiempo mayor que cero para completar la hoja.';
COMMENT ON COLUMN hoja_de_servicio.estado IS
  'Estado de la hoja. Texto de hasta 20 caracteres, obligatorio y predeterminado Borrador; CHECK admite Borrador o Completada. El backend permite continuar un borrador y exige resolver las comprobaciones y validar las horas antes de completarlo.';
COMMENT ON COLUMN hoja_de_servicio.id_operacion_offline IS
  'UUID de la última operación confirmada para esta hoja. Texto de hasta 64 caracteres, obligatorio y único. Permite comprobar la versión al continuar desde un dispositivo y reconocer reintentos mediante auditoría; se actualiza al guardar un nuevo avance.';


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
  'Comprobaciones guardadas en una hoja de servicio y sus resultados. Conserva el texto utilizado aunque cambie el catálogo y permite comprobaciones propias del técnico sin id_item. UNIQUE impide repetir un ítem de catálogo o el mismo texto dentro de una hoja; No aplica exige una observación justificativa.';
COMMENT ON COLUMN respuesta_checklist.id_respuesta IS
  'Identificador de la respuesta. Clave primaria entera, autoincremental y no nula.';
COMMENT ON COLUMN respuesta_checklist.id_hoja_servicio IS
  'Hoja a la que pertenece la comprobación. Entero obligatorio y clave foránea hacia hoja_de_servicio(id_hoja_servicio). Una hoja puede tener varias respuestas.';
COMMENT ON COLUMN respuesta_checklist.id_item IS
  'Ítem del catálogo que originó la comprobación. Entero opcional y clave foránea hacia item_checklist(id_item). Admite NULL para comprobaciones propias del técnico; ON DELETE SET NULL conserva la respuesta y su texto si se elimina el ítem original. La combinación de hoja e ítem es única cuando id_item tiene valor.';
COMMENT ON COLUMN respuesta_checklist.pregunta IS
  'Texto de la comprobación guardado en la hoja, independiente de cambios posteriores del catálogo. Texto de hasta 255 caracteres, obligatorio; CHECK impide texto vacío o compuesto únicamente por espacios. La combinación de hoja y pregunta es única.';
COMMENT ON COLUMN respuesta_checklist.estado IS
  'Resultado de la comprobación. Texto de hasta 20 caracteres, obligatorio y predeterminado Pendiente; CHECK admite Pendiente, Completado o No aplica. El backend impide completar una hoja con comprobaciones pendientes.';
COMMENT ON COLUMN respuesta_checklist.observacion IS
  'Comentario del técnico sobre la comprobación. Texto de hasta 255 caracteres que admite NULL; CHECK exige una observación no vacía cuando el estado es No aplica para justificar por qué no corresponde realizarla.';

-- Material consumido en una atención, separado de las respuestas del checklist.
CREATE TABLE material_utilizado (
  id_material_utilizado SERIAL PRIMARY KEY,
  id_hoja_servicio      INT NOT NULL REFERENCES hoja_de_servicio(id_hoja_servicio),
  id_movimiento_egreso  INT NOT NULL UNIQUE REFERENCES movimiento_cardex(id_movimiento),
  id_operacion_offline  VARCHAR(64) NOT NULL UNIQUE
                        CHECK (length(trim(id_operacion_offline)) > 0)
);

COMMENT ON TABLE material_utilizado IS
  'Vincula los consumos registrados desde Gamma con la hoja de servicio correspondiente y su movimiento de egreso en el Cardex. El artículo, la cantidad, el costo y la asignación utilizada se obtienen desde el movimiento, sin duplicarlos en esta tabla. El backend guarda consumo, egreso, actualización de existencias y auditoría en una misma transacción.';
COMMENT ON COLUMN material_utilizado.id_material_utilizado IS
  'Identificador del registro de material utilizado. Clave primaria entera, autoincremental y no nula.';
COMMENT ON COLUMN material_utilizado.id_hoja_servicio IS
  'Hoja de servicio en la que se utilizó el material. Entero obligatorio y clave foránea hacia hoja_de_servicio(id_hoja_servicio). Una hoja puede tener varios registros de consumo; la tarea y la obra se obtienen desde el detalle del presupuesto asociado a la hoja.';
COMMENT ON COLUMN material_utilizado.id_movimiento_egreso IS
  'Movimiento del Cardex que descuenta el material utilizado. Entero obligatorio, único y clave foránea hacia movimiento_cardex(id_movimiento). UNIQUE impide asociar el mismo movimiento a varios registros de consumo; el backend genera un EGRESO para la obra correspondiente y lo vincula a la asignación USO_INTERNO consumida.';
COMMENT ON COLUMN material_utilizado.id_operacion_offline IS
  'Identificador del consumo dentro de una operación de sincronización. Texto de hasta 64 caracteres, obligatorio y único; CHECK impide texto vacío o compuesto únicamente por espacios. El backend lo construye con el UUID de la operación y el índice del material para distinguir los consumos y evitar duplicados.';

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
    WHEN EXISTS(SELECT 1 FROM factura_guia fg WHERE fg.id_factura=d.id_documento)
    THEN (SELECT COALESCE(SUM((SELECT CASE WHEN g.tipo_documento='boleta' THEN importe ELSE importe + ROUND(importe * g.tasa_iva / 100,0) END
        FROM (SELECT general - ROUND(general * g.descuento_pronto_pago / 100,0) AS importe
            FROM (SELECT subtotal - ROUND(subtotal * g.descuento_general / 100,0) AS general
                FROM (SELECT COALESCE(SUM(p3.valor),0) AS subtotal FROM detalle_documento l
                    CROSS JOIN LATERAL (SELECT ROUND(l.cantidad * (CASE WHEN g.tipo_documento='boleta'
                        THEN ROUND(l.costo_neto * (1+g.tasa_iva/100),0) ELSE l.costo_neto END),0) AS valor) b
                    CROSS JOIN LATERAL (SELECT b.valor-ROUND(b.valor*l.descuento_1/100,0) AS valor) p1
                    CROSS JOIN LATERAL (SELECT p1.valor-ROUND(p1.valor*l.descuento_2/100,0) AS valor) p2
                    CROSS JOIN LATERAL (SELECT p2.valor-ROUND(p2.valor*l.descuento_3/100,0) AS valor) p3
                    WHERE l.id_documento=g.id_documento) lineas) generales) importes)),0) FROM factura_guia fg
        JOIN documento_tributario g ON g.id_documento=fg.id_guia WHERE fg.id_factura=d.id_documento)
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
COMMENT ON MATERIALIZED VIEW mv_resumen_stock IS 'Artículos activos en mínimo o bajo, según disponibilidad al refrescar.';

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
COMMENT ON MATERIALIZED VIEW mv_resumen_obras IS 'Obras por estado y mes de cierre; 0001-01-01 representa ausencia de cierre.';

-- Guarda una sola fila con la fecha y hora del refresco del conjunto.
-- El backend la consulta para informar la última actualización y habilitar otra tras cinco minutos.
-- No es un temporizador: cumplir el plazo no refresca las vistas sin pulsar Actualizar.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_resumen_control AS
SELECT 1 AS id, clock_timestamp() AS actualizado_en;
CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_resumen_control ON mv_resumen_control (id);
COMMENT ON MATERIALIZED VIEW mv_resumen_control IS
  'Fecha del conjunto materializado, incluso vacío. El refresco manual exige cinco minutos y es transaccional.';
-- END VISTAS RESUMEN
