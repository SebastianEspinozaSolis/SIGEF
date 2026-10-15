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
CREATE TABLE categoria_articulo (
  id_categoria      SERIAL PRIMARY KEY,
  nombre_categoria  VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE proveedor (
  id_proveedor          SERIAL PRIMARY KEY,
  rut_proveedor         VARCHAR(12)  NOT NULL UNIQUE,
  razon_social          VARCHAR(150) NOT NULL,
  direccion             VARCHAR(200),
  contacto_comercial    VARCHAR(150),
  informacion_bancaria  VARCHAR(200)
);

CREATE TABLE cliente (
  id_cliente         SERIAL PRIMARY KEY,
  rut_cliente        VARCHAR(12)  NOT NULL UNIQUE,
  razon_social       VARCHAR(150) NOT NULL,
  giro               VARCHAR(150),
  direccion          VARCHAR(200),
  contacto_proyecto  VARCHAR(150),
  contacto_finanzas  VARCHAR(150)
);

CREATE TABLE articulo (
  id_articulo         SERIAL PRIMARY KEY,
  codigo_interno      VARCHAR(40)  NOT NULL UNIQUE,
  codigo_barras       VARCHAR(60)  UNIQUE,
  nombre              VARCHAR(150) NOT NULL,
  id_categoria        INT REFERENCES categoria_articulo(id_categoria),
  unidad_medida       VARCHAR(20)  NOT NULL,
  ubicacion_bodega    VARCHAR(80),
  stock_minimo        NUMERIC(12,3) NOT NULL DEFAULT 0,
  stock_actual        NUMERIC(12,3) NOT NULL DEFAULT 0,
  stock_comprometido  NUMERIC(12,3) NOT NULL DEFAULT 0,
  precio_lista        NUMERIC(14,2) NOT NULL DEFAULT 0,
  precio_pmp          NUMERIC(14,4) NOT NULL DEFAULT 0,
  activo              BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------- BETA ----------
CREATE TABLE categoria_servicio (
  id_categoria_servicio  SERIAL PRIMARY KEY,
  nombre_servicio        VARCHAR(80) NOT NULL UNIQUE
);

-- presupuesto.id_obra se agrega con ALTER TABLE mas abajo,
-- porque obra y presupuesto se referencian entre si.
CREATE TABLE presupuesto (
  id_presupuesto        SERIAL PRIMARY KEY,
  id_cliente            INT NOT NULL REFERENCES cliente(id_cliente),
  id_obra               INT,
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
  id_cliente             INT NOT NULL REFERENCES cliente(id_cliente),
  id_presupuesto         INT NOT NULL REFERENCES presupuesto(id_presupuesto),
  id_categoria_servicio  INT NOT NULL REFERENCES categoria_servicio(id_categoria_servicio),
  id_tecnico             INT NOT NULL REFERENCES usuario(id_usuario),
  estado                 VARCHAR(20) NOT NULL DEFAULT 'En proceso'
  CHECK (estado IN ('En proceso', 'Finalizada', 'Suspendida', 'Cancelada')),
  sin_materiales         BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_creacion         TIMESTAMP NOT NULL DEFAULT now(),
  fecha_cierre           TIMESTAMP
);

ALTER TABLE presupuesto
  ADD CONSTRAINT fk_presupuesto_obra
  FOREIGN KEY (id_obra) REFERENCES obra(id_obra);

CREATE TABLE documento_tributario (
  id_documento             SERIAL PRIMARY KEY,
  tipo_documento           VARCHAR(30) NOT NULL,   -- factura, boleta, guia_despacho, nota_credito
  folio                    VARCHAR(30) NOT NULL,
  fecha_emision            DATE NOT NULL,
  id_cliente               INT REFERENCES cliente(id_cliente),
  id_proveedor             INT REFERENCES proveedor(id_proveedor),
  id_obra                  INT REFERENCES obra(id_obra),
  id_documento_referencia  INT REFERENCES documento_tributario(id_documento),
  subtotal                 NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva                      NUMERIC(14,2) NOT NULL DEFAULT 0,
  total                    NUMERIC(14,2) NOT NULL DEFAULT 0,
  estado_pago              VARCHAR(20) NOT NULL DEFAULT 'Pendiente'
  CHECK (estado_pago IN ('Pendiente', 'Pagada')),
  -- exactamente uno: cliente o proveedor
  CONSTRAINT chk_cliente_o_proveedor
    CHECK ((id_cliente IS NOT NULL)::int + (id_proveedor IS NOT NULL)::int = 1)
);

CREATE TABLE descuento_documento (
  id_descuento          SERIAL PRIMARY KEY,
  id_documento          INT NOT NULL REFERENCES documento_tributario(id_documento),
  porcentaje_descuento  NUMERIC(5,2) NOT NULL CHECK (porcentaje_descuento >= 0 AND porcentaje_descuento <= 100),
  orden_aplicacion      INT NOT NULL
);

-- ---------- ALPHA: MOVIMIENTOS ----------
CREATE TABLE movimiento_cardex (
  id_movimiento            SERIAL PRIMARY KEY,
  id_articulo              INT NOT NULL REFERENCES articulo(id_articulo),
  id_usuario               INT NOT NULL REFERENCES usuario(id_usuario),
  id_tecnico_receptor      INT REFERENCES usuario(id_usuario),
  id_obra                  INT REFERENCES obra(id_obra),
  id_documento             INT REFERENCES documento_tributario(id_documento),
  id_movimiento_revertido  INT REFERENCES movimiento_cardex(id_movimiento),
  tipo_movimiento          VARCHAR(30) NOT NULL,   -- INGRESO, EGRESO, MERMA, DEVOLUCION_PROVEEDOR, AJUSTE, USO_INTERNO, REVERSA
  cantidad                 NUMERIC(12,3) NOT NULL,
  costo_unitario           NUMERIC(14,4) NOT NULL DEFAULT 0,
  fecha_hora               TIMESTAMP NOT NULL DEFAULT now(),
  justificacion            TEXT
);

CREATE TABLE inventario_fisico (
  id_inventario         SERIAL PRIMARY KEY,
  fecha_conteo          TIMESTAMP NOT NULL DEFAULT now(),
  id_usuario            INT NOT NULL REFERENCES usuario(id_usuario),
  estado                VARCHAR(20) NOT NULL DEFAULT 'En proceso'
  CHECK (estado IN ('En proceso', 'Finalizado')),
  total_contados        INT,
  total_con_diferencia  INT
);

CREATE TABLE detalle_inventario_fisico (
  id_detalle_inventario  SERIAL PRIMARY KEY,
  id_inventario          INT NOT NULL REFERENCES inventario_fisico(id_inventario) ON DELETE CASCADE,
  id_articulo            INT NOT NULL REFERENCES articulo(id_articulo),
  stock_sistema          NUMERIC(12,3) NOT NULL,
  stock_fisico           NUMERIC(12,3) NOT NULL,
  diferencia             NUMERIC(12,3) NOT NULL
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

CREATE TABLE evidencia_fotografica (
  id_evidencia      SERIAL PRIMARY KEY,
  id_hoja_servicio  INT NOT NULL REFERENCES hoja_de_servicio(id_hoja_servicio),
  imagen            BYTEA NOT NULL,
  mime_type         VARCHAR(50) NOT NULL,
  fecha_captura     TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE respuesta_checklist (
  id_respuesta      SERIAL PRIMARY KEY,
  id_hoja_servicio  INT NOT NULL REFERENCES hoja_de_servicio(id_hoja_servicio),
  id_item           INT NOT NULL REFERENCES item_checklist(id_item),
  valor_respuesta   VARCHAR(255)
);
