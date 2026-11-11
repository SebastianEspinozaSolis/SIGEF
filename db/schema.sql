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

CREATE TABLE registro_auditoria (
  id_auditoria          SERIAL PRIMARY KEY,
  id_usuario            INT REFERENCES usuario(id_usuario),
  tabla_afectada        VARCHAR(60) NOT NULL,
  id_registro_afectado  INT,
  accion                VARCHAR(20) NOT NULL,
  valores_anteriores    JSONB,
  valores_nuevos        JSONB,
  fecha_hora            TIMESTAMP NOT NULL DEFAULT now()
);

-- ---------- ALPHA: CATALOGOS ----------
-- Catálogo geográfico compartido; cada comuna pertenece a una sola región.
CREATE TABLE region (
  id_region  SERIAL PRIMARY KEY,
  nombre     VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE comuna (
  id_comuna  SERIAL PRIMARY KEY,
  id_region  INT NOT NULL REFERENCES region(id_region),
  nombre     VARCHAR(100) NOT NULL,
  UNIQUE (id_region, nombre)
);

CREATE TABLE categoria_articulo (
  id_categoria      SERIAL PRIMARY KEY,
  nombre_categoria  VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE proveedor (
  id_proveedor          SERIAL PRIMARY KEY,
  rut_proveedor         VARCHAR(12)  NOT NULL UNIQUE,
  razon_social          VARCHAR(150) NOT NULL,
  direccion             VARCHAR(200) NOT NULL,
  id_comuna             INT NOT NULL REFERENCES comuna(id_comuna),
  ciudad                VARCHAR(100) NOT NULL
);

-- Cero o una ficha bancaria por proveedor; si existe, sus cuatro datos son obligatorios.
CREATE TABLE datos_bancarios_proveedor (
  id_proveedor  INT PRIMARY KEY REFERENCES proveedor(id_proveedor),
  banco         VARCHAR(100) NOT NULL,
  tipo_cuenta   VARCHAR(50) NOT NULL,
  numero_cuenta VARCHAR(50) NOT NULL,
  email_pagos   VARCHAR(120) NOT NULL
);

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

CREATE TABLE cliente (
  id_cliente         SERIAL PRIMARY KEY,
  rut_cliente        VARCHAR(12)  NOT NULL UNIQUE,
  razon_social       VARCHAR(150) NOT NULL,
  giro               VARCHAR(150) NOT NULL,
  direccion          VARCHAR(200) NOT NULL,
  id_comuna          INT NOT NULL REFERENCES comuna(id_comuna),
  ciudad             VARCHAR(100) NOT NULL
);

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
  tipo_documento           VARCHAR(30) NOT NULL,   -- factura, boleta, guia_despacho, nota_credito
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
  tipo_movimiento          VARCHAR(30) NOT NULL,   -- INGRESO, EGRESO, MERMA, DEVOLUCION_PROVEEDOR, AJUSTE, USO_INTERNO, REVERSA
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

CREATE TABLE inventario_fisico (
  id_inventario         SERIAL PRIMARY KEY,
  fecha_conteo          TIMESTAMP NOT NULL DEFAULT now(),
  id_usuario            INT NOT NULL REFERENCES usuario(id_usuario),
  estado                VARCHAR(20) NOT NULL DEFAULT 'En proceso'
  CHECK (estado IN ('En proceso', 'Finalizado'))
);

CREATE TABLE detalle_inventario_fisico (
  id_detalle_inventario  SERIAL PRIMARY KEY,
  id_inventario          INT NOT NULL REFERENCES inventario_fisico(id_inventario) ON DELETE CASCADE,
  id_articulo            INT NOT NULL REFERENCES articulo(id_articulo),
  stock_sistema          NUMERIC(12,3) NOT NULL, -- Referencia de bodega: stock_actual - stock_comprometido al primer conteo.
  stock_fisico           NUMERIC(12,3) NOT NULL,
  UNIQUE (id_inventario, id_articulo) -- Un detalle por artículo dentro del inventario
);

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
