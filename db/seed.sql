-- =====================================================
-- SIGEF - seed.sql
-- Datos iniciales. Ejecutar DESPUES de schema.sql
-- =====================================================
SET client_encoding TO 'UTF8';

INSERT INTO rol (nombre_rol) VALUES
  ('Administrador General'),
  ('Administración'),
  ('Bodega/Logística'),
  ('Supervisor de Obras'),
  ('Técnico');
