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
  ('Técnico')
ON CONFLICT (nombre_rol) DO NOTHING;

INSERT INTO categoria_articulo (nombre_categoria) VALUES
  ('Refrigeración'),
  ('Electricidad'),
  ('Aire acondicionado'),
  ('Repuestos'),
  ('Fitting'),
  ('Ferretería'),
  ('Herramientas'),
  ('Otros')
ON CONFLICT (nombre_categoria) DO NOTHING;

INSERT INTO categoria_servicio (nombre_servicio) VALUES
  ('Proyecto'),
  ('Mantención'),
  ('Climatización'),
  ('Proyecto eléctrico'),
  ('Emergencia'),
  ('Garantía'),
  ('Venta de repuestos'),
  ('Mejoras')
ON CONFLICT (nombre_servicio) DO NOTHING;

-- ---------- TAREAS DE SERVICIO ----------
-- Tres tareas iniciales por categoria. Precios netos ilustrativos en CLP, no tarifas reales.
-- Se pueden editar o poner en cero (por ejemplo, una atencion cubierta por garantia).
-- Al repetir el seed se conservan las tareas existentes, sus precios y su estado.
INSERT INTO tarea_servicio (id_categoria_servicio, nombre_tarea, precio_neto, activo)
SELECT c.id_categoria_servicio, t.nombre_tarea, t.precio_neto, TRUE
FROM (VALUES
  ('Proyecto', 'Visita técnica de levantamiento', 30000),
  ('Proyecto', 'Diseño de solución de refrigeración', 80000),
  ('Proyecto', 'Elaboración de planos de instalación', 120000),
  ('Mantención', 'Limpieza de filtros', 15000),
  ('Mantención', 'Limpieza de serpentín', 30000),
  ('Mantención', 'Revisión de conexiones eléctricas', 20000),
  ('Climatización', 'Instalación de equipo de aire acondicionado', 120000),
  ('Climatización', 'Limpieza de ductos de climatización', 60000),
  ('Climatización', 'Medición y ajuste de temperatura', 25000),
  ('Proyecto eléctrico', 'Diseño de circuito eléctrico', 70000),
  ('Proyecto eléctrico', 'Montaje de tablero eléctrico', 100000),
  ('Proyecto eléctrico', 'Instalación de canalizaciones', 75000),
  ('Emergencia', 'Diagnóstico de falla urgente', 35000),
  ('Emergencia', 'Detección de fuga de refrigerante', 45000),
  ('Emergencia', 'Restablecimiento de funcionamiento del equipo', 60000),
  ('Garantía', 'Inspección técnica de garantía', 15000),
  ('Garantía', 'Revisión de componente reemplazado', 20000),
  ('Garantía', 'Prueba de funcionamiento posterior a reparación', 15000),
  ('Venta de repuestos', 'Identificación técnica del repuesto', 10000),
  ('Venta de repuestos', 'Preparación del repuesto para entrega', 5000),
  ('Venta de repuestos', 'Instalación del repuesto', 25000),
  ('Mejoras', 'Evaluación de eficiencia del sistema', 30000),
  ('Mejoras', 'Actualización de controles de temperatura', 55000),
  ('Mejoras', 'Optimización del aislamiento térmico', 45000)
) AS t(categoria, nombre_tarea, precio_neto)
JOIN categoria_servicio c ON c.nombre_servicio = t.categoria
WHERE NOT EXISTS (
  SELECT 1 FROM tarea_servicio existente
  WHERE existente.id_categoria_servicio = c.id_categoria_servicio
    AND existente.nombre_tarea = t.nombre_tarea
);

-- BEGIN ITEMS CHECKLIST
-- Ejemplos editables por tarea, no protocolos tecnicos obligatorios.
-- Repetir el seed no duplica ni actualiza las comprobaciones existentes.
INSERT INTO item_checklist (id_tarea,pregunta)
SELECT t.id_tarea,i.pregunta
FROM (VALUES
  ('Proyecto', 'Visita técnica de levantamiento', 'Registrar equipos y necesidad del cliente'),
  ('Proyecto', 'Visita técnica de levantamiento', 'Confirmar el alcance del trabajo solicitado'),
  ('Proyecto', 'Diseño de solución de refrigeración', 'Definir la propuesta de refrigeracion'),
  ('Proyecto', 'Diseño de solución de refrigeración', 'Revisar la propuesta con los antecedentes levantados'),
  ('Proyecto', 'Elaboración de planos de instalación', 'Registrar la distribucion de equipos'),
  ('Proyecto', 'Elaboración de planos de instalación', 'Revisar los planos antes de entregar'),
  ('Mantención', 'Limpieza de filtros', 'Revisar el estado inicial de los filtros'),
  ('Mantención', 'Limpieza de filtros', 'Realizar limpieza y comprobar el resultado'),
  ('Mantención', 'Limpieza de serpentín', 'Revisar el estado inicial del serpentin'),
  ('Mantención', 'Limpieza de serpentín', 'Realizar limpieza y comprobar el resultado'),
  ('Mantención', 'Revisión de conexiones eléctricas', 'Inspeccionar las conexiones del equipo'),
  ('Mantención', 'Revisión de conexiones eléctricas', 'Registrar y revisar las condiciones encontradas'),
  ('Climatización', 'Instalación de equipo de aire acondicionado', 'Comprobar montaje y conexiones del equipo'),
  ('Climatización', 'Instalación de equipo de aire acondicionado', 'Realizar prueba de funcionamiento'),
  ('Climatización', 'Limpieza de ductos de climatización', 'Inspeccionar el estado de los ductos'),
  ('Climatización', 'Limpieza de ductos de climatización', 'Realizar limpieza y revisar el resultado'),
  ('Climatización', 'Medición y ajuste de temperatura', 'Registrar la temperatura inicial'),
  ('Climatización', 'Medición y ajuste de temperatura', 'Comprobar temperatura despues del ajuste'),
  ('Proyecto eléctrico', 'Diseño de circuito eléctrico', 'Revisar los requerimientos del circuito'),
  ('Proyecto eléctrico', 'Diseño de circuito eléctrico', 'Comprobar el diseno antes de entregar'),
  ('Proyecto eléctrico', 'Montaje de tablero eléctrico', 'Comprobar el montaje de componentes'),
  ('Proyecto eléctrico', 'Montaje de tablero eléctrico', 'Revisar identificacion y funcionamiento del tablero'),
  ('Proyecto eléctrico', 'Instalación de canalizaciones', 'Revisar el recorrido de la canalizacion'),
  ('Proyecto eléctrico', 'Instalación de canalizaciones', 'Comprobar fijaciones y terminaciones'),
  ('Emergencia', 'Diagnóstico de falla urgente', 'Identificar la falla informada'),
  ('Emergencia', 'Diagnóstico de falla urgente', 'Registrar el diagnostico y accion propuesta'),
  ('Emergencia', 'Detección de fuga de refrigerante', 'Revisar los puntos de posible fuga'),
  ('Emergencia', 'Detección de fuga de refrigerante', 'Registrar el resultado de la deteccion'),
  ('Emergencia', 'Restablecimiento de funcionamiento del equipo', 'Aplicar la accion de restablecimiento'),
  ('Emergencia', 'Restablecimiento de funcionamiento del equipo', 'Comprobar el funcionamiento del equipo'),
  ('Garantía', 'Inspección técnica de garantía', 'Revisar antecedentes de la garantia'),
  ('Garantía', 'Inspección técnica de garantía', 'Registrar el resultado de la inspeccion'),
  ('Garantía', 'Revisión de componente reemplazado', 'Identificar el componente reemplazado'),
  ('Garantía', 'Revisión de componente reemplazado', 'Comprobar el estado y funcionamiento del componente'),
  ('Garantía', 'Prueba de funcionamiento posterior a reparación', 'Realizar prueba despues de la reparacion'),
  ('Garantía', 'Prueba de funcionamiento posterior a reparación', 'Registrar el resultado de la prueba'),
  ('Venta de repuestos', 'Identificación técnica del repuesto', 'Confirmar modelo y referencia del repuesto'),
  ('Venta de repuestos', 'Identificación técnica del repuesto', 'Verificar compatibilidad con el equipo informado'),
  ('Venta de repuestos', 'Preparación del repuesto para entrega', 'Comprobar referencia y cantidad del repuesto'),
  ('Venta de repuestos', 'Preparación del repuesto para entrega', 'Revisar el estado del repuesto antes de entregar'),
  ('Venta de repuestos', 'Instalación del repuesto', 'Comprobar la instalacion del repuesto'),
  ('Venta de repuestos', 'Instalación del repuesto', 'Realizar prueba de funcionamiento'),
  ('Mejoras', 'Evaluación de eficiencia del sistema', 'Registrar las condiciones iniciales del sistema'),
  ('Mejoras', 'Evaluación de eficiencia del sistema', 'Identificar oportunidades de mejora'),
  ('Mejoras', 'Actualización de controles de temperatura', 'Comprobar la configuracion del control'),
  ('Mejoras', 'Actualización de controles de temperatura', 'Revisar la temperatura despues del cambio'),
  ('Mejoras', 'Optimización del aislamiento térmico', 'Revisar el estado inicial del aislamiento'),
  ('Mejoras', 'Optimización del aislamiento térmico', 'Comprobar las terminaciones de la mejora')
) AS i(categoria,tarea,pregunta)
JOIN categoria_servicio c ON c.nombre_servicio=i.categoria
JOIN tarea_servicio t ON t.id_categoria_servicio=c.id_categoria_servicio AND t.nombre_tarea=i.tarea
ON CONFLICT (id_tarea,pregunta) DO NOTHING;
-- END ITEMS CHECKLIST

-- ---------- REGIONES Y COMUNAS ----------
-- Nombres y relaciones: catálogo DPA del MOP 
-- 16 regiones y 346 comunas. Los identificadores son internos (SERIAL)
INSERT INTO region (nombre) VALUES
  ('Tarapacá'),
  ('Antofagasta'),
  ('Atacama'),
  ('Coquimbo'),
  ('Valparaíso'),
  ('Libertador General Bernardo O''Higgins'),
  ('Maule'),
  ('Biobío'),
  ('La Araucanía'),
  ('Los Lagos'),
  ('Aysén del General Carlos Ibáñez del Campo'),
  ('Magallanes y de la Antártica Chilena'),
  ('Metropolitana de Santiago'),
  ('Los Ríos'),
  ('Arica y Parinacota'),
  ('Ñuble')
ON CONFLICT (nombre) DO NOTHING;

-- Tarapacá
INSERT INTO comuna (id_region, nombre)
SELECT r.id_region, c.nombre
FROM region r
CROSS JOIN (VALUES
  ('Alto Hospicio'),
  ('Camiña'),
  ('Colchane'),
  ('Huara'),
  ('Iquique'),
  ('Pica'),
  ('Pozo Almonte')
) AS c(nombre)
WHERE r.nombre = 'Tarapacá'
ON CONFLICT (id_region, nombre) DO NOTHING;

-- Antofagasta
INSERT INTO comuna (id_region, nombre)
SELECT r.id_region, c.nombre
FROM region r
CROSS JOIN (VALUES
  ('Antofagasta'),
  ('Calama'),
  ('María Elena'),
  ('Mejillones'),
  ('Ollagüe'),
  ('San Pedro de Atacama'),
  ('Sierra Gorda'),
  ('Taltal'),
  ('Tocopilla')
) AS c(nombre)
WHERE r.nombre = 'Antofagasta'
ON CONFLICT (id_region, nombre) DO NOTHING;

-- Atacama
INSERT INTO comuna (id_region, nombre)
SELECT r.id_region, c.nombre
FROM region r
CROSS JOIN (VALUES
  ('Alto del Carmen'),
  ('Caldera'),
  ('Chañaral'),
  ('Copiapó'),
  ('Diego de Almagro'),
  ('Freirina'),
  ('Huasco'),
  ('Tierra Amarilla'),
  ('Vallenar')
) AS c(nombre)
WHERE r.nombre = 'Atacama'
ON CONFLICT (id_region, nombre) DO NOTHING;

-- Coquimbo
INSERT INTO comuna (id_region, nombre)
SELECT r.id_region, c.nombre
FROM region r
CROSS JOIN (VALUES
  ('Andacollo'),
  ('Canela'),
  ('Combarbalá'),
  ('Coquimbo'),
  ('Illapel'),
  ('La Higuera'),
  ('La Serena'),
  ('Los Vilos'),
  ('Monte Patria'),
  ('Ovalle'),
  ('Paiguano'),
  ('Punitaqui'),
  ('Río Hurtado'),
  ('Salamanca'),
  ('Vicuña')
) AS c(nombre)
WHERE r.nombre = 'Coquimbo'
ON CONFLICT (id_region, nombre) DO NOTHING;

-- Valparaíso
INSERT INTO comuna (id_region, nombre)
SELECT r.id_region, c.nombre
FROM region r
CROSS JOIN (VALUES
  ('Algarrobo'),
  ('Cabildo'),
  ('Calera'),
  ('Calle Larga'),
  ('Cartagena'),
  ('Casablanca'),
  ('Catemu'),
  ('Concón'),
  ('El Quisco'),
  ('El Tabo'),
  ('Hijuelas'),
  ('Isla de Pascua'),
  ('Juan Fernández'),
  ('La Cruz'),
  ('La Ligua'),
  ('Limache'),
  ('Llaillay'),
  ('Los Andes'),
  ('Nogales'),
  ('Olmué'),
  ('Panquehue'),
  ('Papudo'),
  ('Petorca'),
  ('Puchuncaví'),
  ('Putaendo'),
  ('Quillota'),
  ('Quilpué'),
  ('Quintero'),
  ('Rinconada'),
  ('San Antonio'),
  ('San Esteban'),
  ('San Felipe'),
  ('Santa María'),
  ('Santo Domingo'),
  ('Valparaíso'),
  ('Villa Alemana'),
  ('Viña del Mar'),
  ('Zapallar')
) AS c(nombre)
WHERE r.nombre = 'Valparaíso'
ON CONFLICT (id_region, nombre) DO NOTHING;

-- Libertador General Bernardo O'Higgins
INSERT INTO comuna (id_region, nombre)
SELECT r.id_region, c.nombre
FROM region r
CROSS JOIN (VALUES
  ('Chimbarongo'),
  ('Chépica'),
  ('Codegua'),
  ('Coinco'),
  ('Coltauco'),
  ('Doñihue'),
  ('Graneros'),
  ('La Estrella'),
  ('Las Cabras'),
  ('Litueche'),
  ('Lolol'),
  ('Machalí'),
  ('Malloa'),
  ('Marchihue'),
  ('Mostazal'),
  ('Nancagua'),
  ('Navidad'),
  ('Olivar'),
  ('Palmilla'),
  ('Paredones'),
  ('Peralillo'),
  ('Peumo'),
  ('Pichidegua'),
  ('Pichilemu'),
  ('Placilla'),
  ('Pumanque'),
  ('Quinta de Tilcoco'),
  ('Rancagua'),
  ('Rengo'),
  ('Requínoa'),
  ('San Fernando'),
  ('San Vicente'),
  ('Santa Cruz')
) AS c(nombre)
WHERE r.nombre = 'Libertador General Bernardo O''Higgins'
ON CONFLICT (id_region, nombre) DO NOTHING;

-- Maule
INSERT INTO comuna (id_region, nombre)
SELECT r.id_region, c.nombre
FROM region r
CROSS JOIN (VALUES
  ('Cauquenes'),
  ('Chanco'),
  ('Colbún'),
  ('Constitución'),
  ('Curepto'),
  ('Curicó'),
  ('Empedrado'),
  ('Hualañé'),
  ('Licantén'),
  ('Linares'),
  ('Longaví'),
  ('Maule'),
  ('Molina'),
  ('Parral'),
  ('Pelarco'),
  ('Pelluhue'),
  ('Pencahue'),
  ('Rauco'),
  ('Retiro'),
  ('Romeral'),
  ('Río Claro'),
  ('Sagrada Familia'),
  ('San Clemente'),
  ('San Javier'),
  ('San Rafael'),
  ('Talca'),
  ('Teno'),
  ('Vichuquén'),
  ('Villa Alegre'),
  ('Yerbas Buenas')
) AS c(nombre)
WHERE r.nombre = 'Maule'
ON CONFLICT (id_region, nombre) DO NOTHING;

-- Biobío
INSERT INTO comuna (id_region, nombre)
SELECT r.id_region, c.nombre
FROM region r
CROSS JOIN (VALUES
  ('Alto Biobío'),
  ('Antuco'),
  ('Arauco'),
  ('Cabrero'),
  ('Cañete'),
  ('Chiguayante'),
  ('Concepción'),
  ('Contulmo'),
  ('Coronel'),
  ('Curanilahue'),
  ('Florida'),
  ('Hualpén'),
  ('Hualqui'),
  ('Laja'),
  ('Lebu'),
  ('Los Alamos'),
  ('Los Angeles'),
  ('Lota'),
  ('Mulchén'),
  ('Nacimiento'),
  ('Negrete'),
  ('Penco'),
  ('Quilaco'),
  ('Quilleco'),
  ('San Pedro de la Paz'),
  ('San Rosendo'),
  ('Santa Bárbara'),
  ('Santa Juana'),
  ('Talcahuano'),
  ('Tirúa'),
  ('Tomé'),
  ('Tucapel'),
  ('Yumbel')
) AS c(nombre)
WHERE r.nombre = 'Biobío'
ON CONFLICT (id_region, nombre) DO NOTHING;

-- La Araucanía
INSERT INTO comuna (id_region, nombre)
SELECT r.id_region, c.nombre
FROM region r
CROSS JOIN (VALUES
  ('Angol'),
  ('Carahue'),
  ('Cholchol'),
  ('Collipulli'),
  ('Cunco'),
  ('Curacautín'),
  ('Curarrehue'),
  ('Ercilla'),
  ('Freire'),
  ('Galvarino'),
  ('Gorbea'),
  ('Lautaro'),
  ('Loncoche'),
  ('Lonquimay'),
  ('Los Sauces'),
  ('Lumaco'),
  ('Melipeuco'),
  ('Nueva Imperial'),
  ('Padre Las Casas'),
  ('Perquenco'),
  ('Pitrufquén'),
  ('Pucón'),
  ('Purén'),
  ('Renaico'),
  ('Saavedra'),
  ('Temuco'),
  ('Teodoro Schmidt'),
  ('Toltén'),
  ('Traiguén'),
  ('Victoria'),
  ('Vilcún'),
  ('Villarrica')
) AS c(nombre)
WHERE r.nombre = 'La Araucanía'
ON CONFLICT (id_region, nombre) DO NOTHING;

-- Los Lagos
INSERT INTO comuna (id_region, nombre)
SELECT r.id_region, c.nombre
FROM region r
CROSS JOIN (VALUES
  ('Ancud'),
  ('Calbuco'),
  ('Castro'),
  ('Chaitén'),
  ('Chonchi'),
  ('Cochamó'),
  ('Curaco de Vélez'),
  ('Dalcahue'),
  ('Fresia'),
  ('Frutillar'),
  ('Futaleufú'),
  ('Hualaihué'),
  ('Llanquihue'),
  ('Los Muermos'),
  ('Maullín'),
  ('Osorno'),
  ('Palena'),
  ('Puerto Montt'),
  ('Puerto Octay'),
  ('Puerto Varas'),
  ('Puqueldón'),
  ('Purranque'),
  ('Puyehue'),
  ('Queilén'),
  ('Quellón'),
  ('Quemchi'),
  ('Quinchao'),
  ('Río Negro'),
  ('San Juan de la Costa'),
  ('San Pablo')
) AS c(nombre)
WHERE r.nombre = 'Los Lagos'
ON CONFLICT (id_region, nombre) DO NOTHING;

-- Aysén del General Carlos Ibáñez del Campo
INSERT INTO comuna (id_region, nombre)
SELECT r.id_region, c.nombre
FROM region r
CROSS JOIN (VALUES
  ('Aisén'),
  ('Chile Chico'),
  ('Cisnes'),
  ('Cochrane'),
  ('Coihaique'),
  ('Guaitecas'),
  ('Lago Verde'),
  ('O''Higgins'),
  ('Río Ibáñez'),
  ('Tortel')
) AS c(nombre)
WHERE r.nombre = 'Aysén del General Carlos Ibáñez del Campo'
ON CONFLICT (id_region, nombre) DO NOTHING;

-- Magallanes y de la Antártica Chilena
INSERT INTO comuna (id_region, nombre)
SELECT r.id_region, c.nombre
FROM region r
CROSS JOIN (VALUES
  ('Antártica'),
  ('Cabo de Hornos'),
  ('Laguna Blanca'),
  ('Natales'),
  ('Porvenir'),
  ('Primavera'),
  ('Punta Arenas'),
  ('Río Verde'),
  ('San Gregorio'),
  ('Timaukel'),
  ('Torres del Paine')
) AS c(nombre)
WHERE r.nombre = 'Magallanes y de la Antártica Chilena'
ON CONFLICT (id_region, nombre) DO NOTHING;

-- Metropolitana de Santiago
INSERT INTO comuna (id_region, nombre)
SELECT r.id_region, c.nombre
FROM region r
CROSS JOIN (VALUES
  ('Alhué'),
  ('Buin'),
  ('Calera de Tango'),
  ('Cerrillos'),
  ('Cerro Navia'),
  ('Colina'),
  ('Conchalí'),
  ('Curacaví'),
  ('El Bosque'),
  ('El Monte'),
  ('Estación Central'),
  ('Huechuraba'),
  ('Independencia'),
  ('Isla de Maipo'),
  ('La Cisterna'),
  ('La Florida'),
  ('La Granja'),
  ('La Pintana'),
  ('La Reina'),
  ('Lampa'),
  ('Las Condes'),
  ('Lo Barnechea'),
  ('Lo Espejo'),
  ('Lo Prado'),
  ('Macul'),
  ('Maipú'),
  ('María Pinto'),
  ('Melipilla'),
  ('Padre Hurtado'),
  ('Paine'),
  ('Pedro Aguirre Cerda'),
  ('Peñaflor'),
  ('Peñalolén'),
  ('Pirque'),
  ('Providencia'),
  ('Pudahuel'),
  ('Puente Alto'),
  ('Quilicura'),
  ('Quinta Normal'),
  ('Recoleta'),
  ('Renca'),
  ('San Bernardo'),
  ('San Joaquín'),
  ('San José de Maipo'),
  ('San Miguel'),
  ('San Pedro'),
  ('San Ramón'),
  ('Santiago'),
  ('Talagante'),
  ('Tiltil'),
  ('Vitacura'),
  ('Ñuñoa')
) AS c(nombre)
WHERE r.nombre = 'Metropolitana de Santiago'
ON CONFLICT (id_region, nombre) DO NOTHING;

-- Los Ríos
INSERT INTO comuna (id_region, nombre)
SELECT r.id_region, c.nombre
FROM region r
CROSS JOIN (VALUES
  ('Corral'),
  ('Futrono'),
  ('La Unión'),
  ('Lago Ranco'),
  ('Lanco'),
  ('Los Lagos'),
  ('Mariquina'),
  ('Máfil'),
  ('Paillaco'),
  ('Panguipulli'),
  ('Río Bueno'),
  ('Valdivia')
) AS c(nombre)
WHERE r.nombre = 'Los Ríos'
ON CONFLICT (id_region, nombre) DO NOTHING;

-- Arica y Parinacota
INSERT INTO comuna (id_region, nombre)
SELECT r.id_region, c.nombre
FROM region r
CROSS JOIN (VALUES
  ('Arica'),
  ('Camarones'),
  ('General Lagos'),
  ('Putre')
) AS c(nombre)
WHERE r.nombre = 'Arica y Parinacota'
ON CONFLICT (id_region, nombre) DO NOTHING;

-- Ñuble
INSERT INTO comuna (id_region, nombre)
SELECT r.id_region, c.nombre
FROM region r
CROSS JOIN (VALUES
  ('Bulnes'),
  ('Chillán'),
  ('Chillán Viejo'),
  ('Cobquecura'),
  ('Coelemu'),
  ('Coihueco'),
  ('El Carmen'),
  ('Ninhue'),
  ('Pemuco'),
  ('Pinto'),
  ('Portezuelo'),
  ('Quillón'),
  ('Quirihue'),
  ('Ranquil'),
  ('San Carlos'),
  ('San Fabián'),
  ('San Ignacio'),
  ('San Nicolás'),
  ('Treguaco'),
  ('Yungay'),
  ('Ñiquén')
) AS c(nombre)
WHERE r.nombre = 'Ñuble'
ON CONFLICT (id_region, nombre) DO NOTHING;
