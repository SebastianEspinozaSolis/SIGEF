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
