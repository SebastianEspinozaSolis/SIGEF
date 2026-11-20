# Guía rápida del backend

El backend recibe las peticiones del frontend, comprueba permisos y trabaja con PostgreSQL.

## Archivos y carpetas principales

| Lugar | Para qué sirve |
|---|---|
| `.env` | Guarda la configuración local: puerto, conexión a la base y secreto del JWT. No se sube a Git. |
| `.env.example` | Plantilla para crear el `.env`, sin credenciales reales. |
| `package.json` | Indica las dependencias y los comandos para iniciar el backend. |
| `package-lock.json` | Registra las versiones exactas de las dependencias instaladas. |
| `node_modules/` | Contiene las librerías instaladas con npm. No se edita manualmente. |
| `src/` | Reúne el código de la aplicación. |
| `tests/` | Contiene pruebas automáticas; no se ejecutan al iniciar el servidor. |

## Dentro de `src/`

| Lugar | Para qué sirve |
|---|---|
| `app.js` | Crea el servidor Express, conecta los módulos, aplica middlewares generales y responde a errores. |
| `config.js` | Carga el `.env` y centraliza la configuración y los nombres de roles. |
| `db.js` | Crea y comparte el pool de conexiones a PostgreSQL. |
| `middlewares/` | Controles que se ejecutan antes de una operación. |
| `middlewares/auth.js` | Verifica el JWT y el estado del usuario; también comprueba los roles permitidos. |
| `modules/` | Agrupa las funcionalidades del sistema en carpetas. |
| `utils/` | Funciones y herramientas compartidas por varios módulos. |
| `utils/contactos.js` | Valida y normaliza nombre, RUT, cargo, correo y teléfono de contactos de clientes y ejecutivos de proveedores. Las reglas de listas, identificadores y pertenencia permanecen en cada servicio. |
| `utils/decimales.js` | Convierte decimales no negativos ya validados a enteros con BigInt. Documentos de proveedor y recepciones comparten esta conversión; sus fórmulas y redondeos permanecen en cada servicio. |
| `utils/validaciones.js` | Reglas para validar y normalizar RUT, nombres, correo y contraseña. |
| `utils/ErrorHttp.js` | Permite que un servicio lance un error con estado y mensaje; `app.js` lo convierte en respuesta. |
| `scripts/crearAdmin.js` | Se ejecuta manualmente para crear el administrador inicial. |

## Módulos actuales

| Carpeta en `modules/` | Qué contiene |
|---|---|
| `auth/` | Login, consulta del usuario autenticado y cambio de su propia contraseña. |
| `usuarios/` | Listado, creación y activación/desactivación de usuarios. |
| `roles/` | Consulta de los roles disponibles. |
| `auditoria/` | Registro de acciones y consulta del historial para el Administrador General. |
| `clientes/` | Listado, alta y edición de fichas de clientes mandantes. |
| `proveedores/` | Listado, alta y edición de proveedores. |
| `categorias/` | Listado, alta y edición de categorías de artículos. |
| `articulos/` | Catálogo editable y consulta de saldos/PMP, búsqueda y stock crítico. |
| `inventario-fisico/` | Conteos por artículo, diferencias contra el stock registrado y cierre del conteo. |

Cada módulo tiene dos archivos:

- **`routes.js`:** define las URL y permisos, recibe `req` y responde con `res`. Llama al servicio.
- **`service.js`:** realiza las validaciones, consultas y operaciones. Recibe datos y devuelve resultados, sin usar `req` ni `res`.

## Cómo se conectan

```text
Frontend → app.js → routes.js → middlewares de la ruta → service.js → PostgreSQL
```

El resultado vuelve a la ruta, que lo envía al frontend. Si el servicio lanza un error, el manejador de `app.js` responde.

**Pool y client:** `pool.query()` sirve para consultas independientes. Para guardar una operación y su auditoría juntas, se obtiene un `client` del pool: `BEGIN` inicia la transacción, `COMMIT` confirma todo y `ROLLBACK` lo deshace si falla. Al terminar, `release()` devuelve la conexión al pool.

## Alpha: primera entrega

Los módulos usan `routes.js` y `service.js`. `utils/catalogos.js` reúne validaciones de texto, identificadores y paginación; reutiliza la normalización existente. No se agregan dependencias. La ampliación de proveedores descrita abajo sí actualiza su definición en `db/schema.sql`.

| Prefijo | Operaciones |
|---|---|
| `/api/clientes` | GET listado, POST alta, PUT `/:id` edición completa de campos editables |
| `/api/proveedores` | GET listado, POST alta, PUT `/:id` edición completa de campos editables |
| `/api/categorias` | GET listado, POST alta, PUT `/:id` edición del nombre |
| `/api/articulos` | GET catálogo, POST alta, PUT `/:id` edición completa de campos editables |
| `/api/articulos/:id/cardex` | GET historial paginado del artículo; no registra ni modifica movimientos |

**Permisos del backend definidos por el usuario:** clientes y proveedores permiten Administrador General y Administración. Categorías permite Administrador General y Bodega tanto para lectura como escritura. Artículos y consulta de Cardex permiten solo Bodega. Administración no accede al catálogo ni al inventario físico; su menú contiene Clientes y Proveedores, con Estadísticas y Presupuestos indicados como pendientes, sin endpoints nuevos. Todos requieren sesión activa. Las protecciones y opciones del frontend acompañan estos permisos.

Listados: `q`, `pagina` (inicia en 1), `limite` (20 por defecto, máximo 100). Respuesta `{ registros, total, pagina, limite }`. Clientes/proveedores buscan por RUT o razón social, categorías por nombre. La búsqueda por RUT usa el texto almacenado sin puntos. Artículos buscan por nombre/código interno/barras y admiten `id_categoria`, `activo=true|false` y `critico=true`; filtro vacío significa todos. Los valores van parametrizados; los comodines escritos por el usuario se buscan literalmente.

Campos requeridos de proveedor: RUT válido, razón social, dirección, región, comuna y ciudad. Del cliente: RUT, razón social, dirección, región, comuna y ciudad; giro comercial es obligatorio. Los contactos se guardan en las tablas separadas descritas abajo. Los campos opcionales vacíos se guardan como NULL. Para artículos se exige código interno, nombre, categoría, unidad y mínimo no negativo con hasta tres decimales. Barras, ubicación, bodega o sector y precio de lista son obligatorios. Las unidades se seleccionan de UN, M, M2, M3, KG y L, validadas por el backend. Se puede cambiar el indicador `activo`; no hay eliminación física de fichas.

### Ficha ampliada de proveedores

Regiones y comunas se consultan en PostgreSQL: `region` y `comuna`. GET `/api/clientes/regiones` y `/api/proveedores/regiones` devuelven `{ id_region, nombre }`; GET `/api/clientes/comunas?id_region=...` y `/api/proveedores/comunas?id_region=...` devuelven `{ id_comuna, id_region, nombre }`. Conservan los permisos de cada ficha. `backend/src/utils/ubicaciones.js` comparte estas consultas parametrizadas; se retiró el catálogo fijo `regiones.js`. Los selectores son dependientes: cambiar región limpia la comuna, se descartan respuestas antiguas y se permite reintentar errores de carga. Solo se envía y guarda `id_comuna`; el listado obtiene `comuna`, `id_region` y `region` mediante JOIN. Ciudad sigue siendo texto libre. Las FK rechazan comunas inexistentes y la operación y auditoría siguen siendo atómicas.

`proveedor` y `cliente` guardan `id_comuna` como FK y `ciudad` como texto. La región se deriva de la comuna. `datos_bancarios_proveedor` tiene PK propia `id_datos_bancarios`, FK obligatoria `id_proveedor`, los cuatro datos bancarios obligatorios (`banco`, `tipo_cuenta`, `numero_cuenta`, `email_pagos`) y `activo BOOLEAN NOT NULL DEFAULT TRUE`. La relación es cero a muchas cuentas por proveedor. Correo se valida y pasa a minúsculas; número de cuenta es texto para conservar ceros iniciales. No se impone unicidad nueva al número de cuenta.

GET devuelve `cuentas_bancarias: []` y `ejecutivos: []`, mediante agregaciones JSON que no duplican filas del listado. POST y PUT exigen una lista explícita `cuentas_bancarias`, vacía si no se agregan cuentas y con máximo técnico de 50 entradas por petición. Cada entrada contiene los cuatro campos, `activo` booleano (predeterminado true si se omite) e `id_datos_bancarios` solo cuando ya existe. Se rechazan IDs repetidos y cuentas de otro proveedor. Las cuentas omitidas en una edición se conservan sin cambios; no existe eliminación de cuentas guardadas. Inactivar una cuenta conserva su ID y datos. Todo se guarda con la auditoría anterior/nueva en la transacción del proveedor y bajo el bloqueo de su cabecera. Los pagos no están implementados: no hay selección de cuenta para pagos ni inactivación automática al pagar. El historial bancario de cada pago se definirá con ese módulo; la cuenta actual es editable y la auditoría conserva sus cambios.

`ejecutivo_comercial` tiene FK a `proveedor`, ID propio y `nombre`, `rut`, `cargo`, `email`, `telefono`. Un proveedor puede tener cero o varios ejecutivos; si se agrega uno, sus cinco campos son obligatorios. Los RUT se normalizan y validan; no se repiten dentro del mismo proveedor, pero pueden aparecer en otros. Los correos se validan y normalizan; teléfono admite texto de hasta 30 caracteres. El límite técnico de la API es 50 ejecutivos por ficha.

POST y PUT reciben la ubicación y una lista explícita `ejecutivos` (vacía si no hay contactos). Los ejecutivos existentes conservan `id_ejecutivo`; los nuevos no lo envían. No se acepta un ID de otro proveedor. Quitar un ejecutivo de la lista lo elimina al guardar, a diferencia de las cuentas bancarias que se conservan. La auditoría conserva los valores anteriores y nuevos. Ficha, cuentas, ejecutivos y auditoría comparten la transacción. Omitir la lista produce error, evitando borrados accidentales por un payload incompleto.

El cambio a múltiples cuentas está definido en `db/schema.sql` y requiere adaptar la base instalada antes de utilizar el código nuevo. No se crearon migraciones ni se ejecutó SQL durante esta entrega, por decisión del usuario. No ejecutar `schema.sql` como actualización: elimina el esquema. Una adaptación futura deberá conservar las cuentas actuales y asignarles ID propio y estado activo. `tests/proveedores-cuentas.test.js` comprueba el contrato y las transacciones con conexiones simuladas, sin leer credenciales ni modificar PostgreSQL; ejecutar `node --test tests/proveedores-cuentas.test.js` desde backend.

### Contactos de clientes en dos tablas

`contacto_proyecto` y `contacto_finanzas` sustituyen las columnas de texto homónimas de `cliente`. Cada tabla tiene `id_contacto`, FK `id_cliente`, `nombre`, `rut`, `cargo`, `email` y `telefono`. Se permiten varios contactos por área y la misma persona en ambas. `UNIQUE (id_cliente, rut)` se aplica por separado en cada tabla, no sobre el ID del cliente solamente.

GET `/api/clientes` incluye dos listas: `contactos_proyecto` y `contactos_finanzas`. POST y PUT requieren ambas listas explícitas; pueden estar vacías, sin inventar un mínimo obligatorio por área. Cada contacto agregado exige sus cinco datos. Se validan RUT, correo y longitudes; correo en minúsculas y RUT sin puntos. El límite técnico es 50 por área. Los IDs existentes se conservan y deben pertenecer al cliente y a la tabla correspondiente; un ID de proyectos no se utiliza para modificar finanzas. Al quitar un contacto y guardar, se elimina de esa tabla y la auditoría conserva el valor anterior.

La ficha se bloquea durante la edición y ambos grupos se guardan con la misma transacción y auditoría. Un error de finanzas revierte también los cambios de proyectos y de la ficha. Se mantienen los permisos existentes. La ubicación ya presente en `schema.sql` se conecta al backend y al formulario. Esta modificación no agrega datos del representante legal: ese punto de la especificación sigue pendiente. No se generan migraciones ni se ejecuta SQL; adaptar la base instalada es un paso separado, sin reiniciarla con `schema.sql`.

Stock disponible y alerta se calculan en SQL: `stock_actual - stock_comprometido`, alerta cuando es menor o igual al mínimo (también para mínimo cero). Los saldos y PMP no son editables desde estas rutas; se rechaza su envío. `precio_lista` ya no aparece en el esquema actual y no se recibe ni se expone en el catálogo.

Altas y ediciones guardan auditoría con el mismo client; las ediciones bloquean la fila para capturar el valor anterior real. El responsable proviene de `req.user.id_usuario`. Duplicados producen 409, datos inválidos 400 e IDs inexistentes 404. No se implementan aún compras, movimientos, cálculo de PMP, reservas, reversas, versionado de artículos o políticas automáticas de conservación. La auditoría de ediciones no equivale a versionado del catálogo.

## Inventario físico: conteo sin ajustes automáticos

Decisión expresa del usuario: el conteo solo registra evidencia y muestra diferencias para que el empleado gestione el cambio posteriormente. Sustituye el ajuste automático descrito en el informe. No modifica stock actual, comprometido, Cardex ni PMP; no implementa todavía la operación manual de ajuste. El cálculo del PMP en ingresos o reversas queda fuera de esta entrega.

Acceso en todas las rutas: Bodega/Logística y Administrador General, con sesión activa.

| Ruta | Operación |
|---|---|
| `GET /api/inventario-fisico` | Lista paginada; acepta `pagina`, `limite` y `estado` (`En proceso` o `Finalizado`). |
| `GET /api/inventario-fisico/articulos` | Selector paginado por `q` (nombre/código/barras), sin costos ni acceso a edición del catálogo. |
| `POST /api/inventario-fisico` | Abre un conteo en proceso; no necesita cuerpo. Responsable desde la sesión. |
| `GET /api/inventario-fisico/:id` | Devuelve cabecera y `detalles`, con artículo, referencia, conteo, diferencia e indicador `tiene_diferencia`. |
| `PUT /api/inventario-fisico/:id/articulos/:idArticulo` | Guarda o corrige el conteo con `{ "stock_fisico": "8.000" }`. |
| `PATCH /api/inventario-fisico/:id/finalizar` | Cierra el conteo; no necesita cuerpo. Ya no admite correcciones. |

Una fila por artículo en cada inventario; puede contarse otra vez en inventarios posteriores. Al primer registro se captura `articulo.stock_actual` (no el disponible); las correcciones conservan esa referencia. Diferencia = físico − sistema, calculada en PostgreSQL para conservar precisión: sistema 10 y físico 8 muestra −2; sistema 10 y físico 12 muestra +2. No es una comparación en vivo con futuros movimientos de stock. Se acepta cero y hasta tres decimales, sin cantidades negativas.

Cada modificación y su auditoría se guardan en una transacción. El bloqueo de la cabecera serializa conteos y cierre, y los totales cuentan artículos distintos. No hay eliminación ni reapertura. Utiliza las tablas existentes, sin ejecutar ni modificar `schema.sql`. La interfaz permite crear y abrir conteos, seleccionar artículos, guardar/corregir cantidades, consultar diferencias y finalizar. Quedan pendientes el ajuste manual y la comprobación integrada con PostgreSQL y navegador.

### Comprobación sin modificar datos

Desde `backend`:

```text
node --test tests/services.test.js tests/alpha.test.js tests/inventario-fisico.test.js
```

Las pruebas sustituyen el pool y sus conexiones: comprueban validaciones, normalización, rollback ante fallos, auditoría, campos protegidos, filtros y permisos definidos. Para las pruebas de login se necesita un `JWT_SECRET` de prueba en el entorno. No ejecutan SQL contra PostgreSQL; deben complementarse con pruebas de integración en una base aislada y recorrido del navegador. No ejecutar `schema.sql` para probar ni para actualizar una base con datos.

Para usar este cambio en una base ya creada, las tablas `cliente` y `proveedor` deben disponer de `id_comuna` en lugar de los textos `region` y `comuna`, conforme a `db/schema.sql`. Crear los catálogos y cargar `seed.sql` por sí solo no transforma las fichas existentes. No se ejecutó SQL ni se creó una migración automática; no ejecutar `schema.sql` sobre datos que deban conservarse porque elimina el esquema.

### Consulta individual para editar fichas

GET `/api/clientes/:id` y GET `/api/proveedores/:id` consultan una ficha con los mismos permisos del módulo. Los servicios exponen `obtener(id)`, que reutiliza la consulta de listado filtrando por identificador parametrizado: incluye nombres de ubicación, contactos y ficha bancaria cuando corresponda. Un identificador inválido devuelve 400 y uno inexistente devuelve 404. Las rutas de regiones y comunas se declaran antes de `/:id`. No requiere cambios del esquema ni de datos.

### Campos ampliados del artículo

`articulo` incorpora `bodega_sector` obligatorio, `descripcion` opcional (hasta 5000 caracteres en la API), `precio_lista` obligatorio en CLP enteros no negativos y `fecha_actualizacion_precio` automática. Código de barras, ubicación y categoría son obligatorios también en el esquema. El formulario y listado de `Articulos.jsx` incluyen estos datos. La fecha corresponde al precio de lista: se establece al crear y cambia al editar solo si cambia el valor numérico del precio. Stock y PMP permanecen protegidos y la operación se audita en su transacción.

`ultimo_costo_compra` se consulta, no se almacena: toma `costo_unitario` del último INGRESO con `id_documento` y sin REVERSA que lo referencie, ordenando por fecha e identificador. Sin coincidencias se muestra «Sin compras registradas». Esta asociación documental es provisional: falta concretar la clasificación de compras y el tratamiento de devoluciones parciales cuando se implemente el registro de movimientos. El stock disponible mantiene la resta actual menos comprometido; la gestión del compromiso sigue pendiente. No se implementan movimientos nuevos en este cambio.

Unidad de medida del artículo: selector de Unidad (UN), Metro (M), Metro cuadrado (M2), Metro cúbico (M3), Kilogramo (KG) y Litro (L). Se conserva la columna de texto existente y el backend rechaza otros valores. No se convierten cantidades ni se modifican registros existentes automáticamente.

Las cantidades de artículos UN deben ser enteras (se acepta 2.000 como 2, sin redondear fracciones). Stock mínimo y conteos lo validan en backend; en conteos se consulta la unidad del artículo bajo bloqueo. Los campos del frontend usan paso 1 para UN y 0.001 para las demás unidades, incluido el borrador de movimientos. El registro real de movimientos continúa pendiente. No cambia el tipo NUMERIC ni se modifican datos existentes.

El borrador de EGRESO selecciona la obra por nombre y cliente, con búsqueda y paginación, manteniendo el ID interno. GET `/api/articulos/obras` permite esa consulta de lectura bajo el permiso Bodega del módulo; devuelve solo ID, nombre y razón social, con filtros parametrizados. Incluye carga, lista vacía y reintento. No registra aún movimientos ni altera el esquema.

GET `/api/articulos/:id`, protegido para Bodega, devuelve la ficha completa del artículo para su pantalla de edición mediante `obtener(id)` en el servicio de artículos. Valida identificador, parametriza la consulta y devuelve 404 cuando no existe. No modifica datos ni cambia el esquema.

### Documentos de proveedores: primera entrega de borradores

`src/modules/documentos-proveedor/routes.js` protege todas las rutas para Administrador General y Administración. `service.js` valida cabecera y hasta 100 líneas, consulta documentos, valida proveedor y referencias y guarda documento, detalle y auditoría en una sola transacción. No implementa confirmación, eliminación, impresión ni movimientos de inventario.

Rutas bajo `/api/documentos-proveedor`: GET `/articulos` busca artículos activos con ID, código, nombre, unidad y precio de lista, sin exponer PMP; GET `/:proveedor` lista documentos paginados; GET `/:proveedor/:id` obtiene cabecera y líneas; POST `/:proveedor` crea un borrador; PUT `/:proveedor/:id` edita solo borradores. Los documentos se restringen por proveedor. Una nota de crédito en borrador exige un documento original del mismo proveedor que no sea otra nota ni ella misma. Sus efectos contables y físicos quedan pendientes.

El esquema añade a `documento_tributario`: fecha de ingreso, observaciones, estado documental separado del estado de pago, porcentajes de descuento general y pronto pago, tasa de IVA y total neto. `detalle_documento` guarda artículo, fecha, cantidad, costo neto unitario, precio de lista, tres porcentajes sucesivos y observaciones. El backend comprueba proveedor/tipo/folio antes de guardar; por decisión del usuario, el esquema ya no contiene el índice único parcial que protegía esa combinación. La tabla `descuento_documento` se retiró del esquema: los descuentos utilizados se guardan exclusivamente en la cabecera y en los tres campos de cada detalle.

El cálculo usa BigInt para aritmética decimal exacta. Subtotal suma importes brutos redondeados por línea a centésimos; el neto de líneas aplica los tres factores de descuento en orden y redondea a centésimos por línea. Después se aplican descuento general y pronto pago, redondeando en cada etapa; se calcula IVA y total. La API ignora totales enviados y recalcula. La tasa propuesta inicialmente es 19 y puede editarse; no constituye una clasificación tributaria automática. Los valores netos de costos y cantidades no se modifican en el catálogo al guardar.

El margen visible es una estimación de margen sobre venta neta, suponiendo precio de lista con IVA incluido y costo neto tras descuentos por producto. Excluye descuentos generales y pronto pago. No se almacena un porcentaje redundante. Falta validar esta convención con la empresa antes de la confirmación de ingresos.

Esta entrega modifica solo los archivos del esquema: no aplica SQL a la base instalada. Se requiere incorporar las columnas, tabla e índice antes de utilizar los endpoints. No ejecutar `schema.sql` sobre datos que deban conservarse: recrea el esquema completo. Pruebas en `tests/documentos-proveedor.test.js` simulan persistencia, rollback, unidades reales y cálculos; no son pruebas contra PostgreSQL.

### Registro de documentos y recepción física de compras (flujo vigente)

Esta sección reemplaza el comportamiento de borradores descrito en la primera entrega: Administración o Administrador General registra el documento como `Registrado`. Sus cantidades y costos quedan bloqueados; GET permite consultarlo. Los borradores anteriores pueden completarse mediante PUT y pasan a Registrado. Registrar no afecta stock, PMP ni precio de lista. No se implementa todavía la aplicación de notas de crédito a cantidades o costos; se excluyen expresamente de recepción.

`src/modules/recepciones-compra/routes.js` y `service.js` implementan GET `/api/recepciones-compra`, GET `/:id` y POST `/:id`, exclusivamente para Bodega. El listado busca por folio, proveedor o RUT y muestra si quedan materiales pendientes. El detalle calcula recibido y pendiente por línea usando movimientos INGRESO vinculados, excluyendo originales con REVERSA. No se guarda una cantidad recibida redundante en el detalle.

`movimiento_cardex.id_detalle_documento` enlaza el ingreso con la línea comprada; `id_operacion_recepcion` UUID identifica la confirmación. La pareja es única por línea. El backend serializa el UUID con bloqueo advisory transaccional, bloquea documento y artículos (estos en orden por ID), valida estado, tipo, pertenencia de líneas, cantidad pendiente, actividad y unidad del artículo. Un reintento idéntico devuelve los movimientos existentes; reutilizar UUID con otro documento, responsable, observaciones o cantidades devuelve 409. El bloqueo del documento serializa recepciones concurrentes y el de artículo protege stock y PMP entre documentos distintos.

Cada recepción genera INGRESO, actualiza stock y PMP, y registra auditoría en la misma transacción. Responsable es el usuario autenticado y fecha es la del registro efectivo. Costo neto unitario aplicado: los tres descuentos sucesivos del material, descuento general y pronto pago ya concedidos en el documento, sin IVA, redondeado a cuatro decimales. PMP nuevo = (stock anterior * PMP anterior + cantidad recibida * costo aplicado) / stock nuevo, a cuatro decimales. El precio de lista no se modifica. Los descuentos condicionados a un pago futuro no se determinan automáticamente en este flujo; los porcentajes registrados se consideran concedidos. Los totales documentales y costos unitarios tienen precisiones distintas, por lo que el detalle documental sigue siendo respaldo de los importes tributarios y no una reconstrucción por redondeo del costo unitario.

`tests/recepciones-compra.test.js` simula parcialidad, límites, costos, unidades, reintentos y rollback de auditoría. También se verificó manualmente el SQL del flujo contra tablas temporales PostgreSQL con datos sintéticos, sin tocar las tablas reales. No equivale a una prueba de navegador ni a una prueba concurrente con múltiples conexiones.

Para usarlo en la base instalada faltan las ampliaciones de documentos/detalle y los dos enlaces de movimiento preparados en `db/schema.sql`; no se ejecutó ese archivo ni una migración sobre la base. No se deben asociar factura y guía de una misma entrega como dos compras independientes: su conciliación documental todavía requiere definir el enlace y evitar la doble recepción.

`src/scripts/crearUsuariosPrueba.js` carga cuatro cuentas ficticias para Administración, Bodega, Supervisor y Técnico, después del seed mínimo. Incluye datos fijos, RUT válidos y contraseñas bcrypt. Inserta en una transacción, verifica roles y omite conflictos de RUT/correo sin actualizar cuentas existentes. Se ejecuta manualmente y no modifica al administrador. Las credenciales de desarrollo están en README.md.

### Recepción desde un artículo

GET `/api/recepciones-compra/articulos/:id/pendientes` comparte la autorización de Bodega y consulta líneas del artículo activo en documentos Registrados de factura, boleta o guía, con cantidad pendiente mayor a cero. Busca por folio, proveedor o RUT y pagina los resultados. Devuelve el costo neto aplicado con descuentos, obtenido con la misma función de recepción. No añade columnas ni cambia el endpoint POST de confirmación: ambas entradas utilizan `recibir`, con los mismos bloqueos, validaciones, auditoría e idempotencia.

### Registro manual de movimientos: primera entrega del backend

`src/modules/movimientos/routes.js` y `service.js` exponen POST `/api/movimientos/:idArticulo`, solo para Bodega. Tipos implementados: INGRESO libre, EGRESO a obra, MERMA con obra opcional y AJUSTE firmado. USO_INTERNO, DEVOLUCION_PROVEEDOR y REVERSA se rechazan por ahora, pendientes de acordar asignaciones, referencias y restricciones. Esta entrega no conecta aún los formularios preliminares con la API.

Todos exigen `tipo_movimiento`, cantidad no nula, `justificacion` e `id_operacion` UUID v4. INGRESO exige costo neto unitario no negativo; EGRESO exige obra existente y `id_usuario_receptor` activo, genera recepción pendiente de firma y conserva precio de lista vigente desde el artículo. MERMA puede asociarse a obra. AJUSTE acepta diferencias positivas o negativas y conserva PMP. Cantidades de UN son enteras y las otras unidades admiten hasta tres decimales. No se admiten saldos ni PMP impuestos por el formulario; el actor siempre viene de la sesión.

EGRESO y MERMA reciben cantidades positivas y descuentan existencias disponibles al PMP actual; no consumen asignaciones en esta primera entrega. AJUSTE conserva PMP y no puede dejar existencias por debajo de las comprometidas. INGRESO aumenta existencias y pondera PMP con aritmética BigInt, redondeando a cuatro decimales. Ninguno modifica precio de lista o stock comprometido. El artículo debe estar activo y se bloquea FOR UPDATE; movimiento, saldo, recepción si corresponde y auditoría se confirman juntos.

La confirmación usa bloqueo advisory por UUID. Su UUID, solicitud canónica, movimiento y saldo se conservan dentro de `registro_auditoria.valores_nuevos` con acción REGISTRAR_MOVIMIENTO. Un reintento igual devuelve el resultado original sin nuevas escrituras; cambiar datos o actor con el mismo UUID devuelve 409. La comparación de JSONB es estructural para no depender del orden de claves. No se añadieron columnas ni se ejecutó SQL en la base instalada para esta entrega. `tests/movimientos.test.js` simula aritmética, límites, responsables, recepción, rollback e idempotencia; no verifica concurrencia real ni navegador.

### Siete tipos de movimiento y correcciones parciales (comportamiento vigente)

El servicio de movimientos admite los siete tipos existentes. Esta sección sustituye las limitaciones de la primera entrega. El esquema incorpora únicamente `movimiento_cardex.id_movimiento_origen`, FK al mismo Cardex, para enlazar un EGRESO con una entrega USO_INTERNO o una DEVOLUCION_PROVEEDOR con su INGRESO. REVERSA conserva el enlace específico `id_movimiento_revertido`. No se añaden destino ni vehículos. El receptor se obtiene siempre de `recepcion_material`, sin duplicar un ID de técnico en el movimiento.

USO_INTERNO exige un técnico activo, crea recepción pendiente de firma y aumenta comprometido sin reducir total. El EGRESO con origen USO_INTERNO exige obra y toma el receptor de esa entrega; reduce total y comprometido en la misma cantidad y usa PMP actual. El egreso directo conserva obra y receptor obligatorios y solo consume disponible en bodega. Una devolución exige INGRESO original respaldado por documento de proveedor, puede ser parcial y usa su costo original; reduce cantidad y valor y recalcula PMP del saldo restante. Los precios comerciales no se modifican.

REVERSA recibe cantidad positiva y motivo; el servidor determina el signo y conserva el original. No admite revertir una REVERSA. Se permite corregir parcialmente varias veces sin superar lo que queda reversible. INGRESO resta las reversas previas y devoluciones netas; USO_INTERNO resta reversas y consumos netos. Revertir una asignación solo libera lo no consumido. Revertir un egreso desde asignación devuelve material al total y al comprometido del técnico. Revertir AJUSTE conserva PMP; las demás correcciones de cantidad valoran el efecto inverso al costo del original. Si la valoración restante resulta negativa, se rechaza para revisión, sin producir costos negativos. Cuando la cantidad queda en cero en una operación que recalcula PMP, se establece PMP cero.

El registro bloquea primero el documento del original, cuando existe, y luego el artículo, siguiendo el orden de recepción de compras. Bajo ese bloqueo calcula los límites sobre el historial del artículo, sin sobrescribirlo; se mantienen transacción, auditoría e idempotencia. Los movimientos y las reservas no pueden dejar stock negativo ni disponible negativo. La cantidad almacenada de REVERSA refleja el signo del efecto; en USO_INTERNO refleja la liberación de comprometido. La contabilidad de recibido por compra resta cantidades de reversas parciales en lugar de excluir todo ingreso que tenga una reversa. El último costo de compra conserva un ingreso parcialmente revertido mientras tenga cantidad neta positiva.

GET `/api/movimientos/receptores` entrega ID, nombre y rol de usuarios activos, con búsqueda y paginación; `tecnico=true` restringe al rol Técnico. GET `/api/movimientos/:idArticulo/referencias?tipo=...` entrega orígenes elegibles para EGRESO, DEVOLUCION_PROVEEDOR o REVERSA, cantidad restante y datos de receptor/proveedor, con paginación y búsqueda. Comparten el permiso exclusivo de Bodega. La consulta de referencias lee el historial del artículo y calcula saldos en memoria, una limitación de rendimiento a revisar si crece mucho el historial. La futura integración Gamma debe enlazar sus egresos con estas asignaciones para no llevar una segunda contabilidad de consumo independiente.

Verificación: pruebas simuladas de los siete tipos y pruebas manuales sobre tablas temporales PostgreSQL para asignar, consumir, revertir cantidades parcialmente, devolver al proveedor, rechazar exceso y comprobar rollback. Otra comprobación temporal validó que recibir 6 y revertir 2 deja recibido 4, no cero. No se probaron navegador ni concurrencia con múltiples conexiones. No se ejecutó SQL sobre las tablas reales; las ampliaciones pendientes de schema.sql siguen siendo requisito para usar este flujo.

### Fecha de registro automática del documento

`documento_tributario.fecha_ingreso` es TIMESTAMPTZ NOT NULL DEFAULT now(): el backend no acepta ni actualiza esta fecha desde el formulario. Se muestra como Fecha de registro con hora, en zona America/Santiago. Emisión sigue como DATE editable antes del registro. Se eliminó `detalle_documento.fecha_ingreso` del esquema, consultas de guardado y formulario; la recepción física conserva la fecha del movimiento. La base instalada se actualizó con ALTER TABLE, sin recrearla. Los registros anteriores conservan su día convertido a medianoche de America/Santiago porque no tenían hora original.

### Documento de respaldo del Cardex sin duplicación

`movimiento_cardex` ya no declara `id_documento` en `db/schema.sql`. Un ingreso de compra conserva `id_detalle_documento`, desde el cual se obtiene `detalle_documento.id_documento`. Una devolución sigue `id_movimiento_origen`; una reversa sigue `id_movimiento_revertido`. El servicio recorre estas referencias hasta encontrar el detalle, también al revertir una devolución, con protección contra ciclos y referencias a otro artículo. Un ingreso libre puede no tener documento.

El historial utilizado por los selectores devuelve `id_documento_respaldo` como dato calculado; no es otra columna. La recepción de compras comprueba sus reintentos mediante el detalle y guarda el ingreso sin copiar el documento. Para registrar correcciones se mantiene el bloqueo del documento antes del artículo. La consulta de último costo de compra reconoce compras mediante `id_detalle_documento`.

Esta adaptación modifica el esquema y el backend, sin alterar la base instalada. Antes de eliminar la columna en una base con datos existentes, comprobar que sus vínculos puedan recuperarse desde el detalle o las referencias; no descartar vínculos antiguos que solo estén en esa columna. Verificación: 70 pruebas automatizadas correctas y siete comprobaciones con tablas temporales PostgreSQL para resolución directa, devolución, reversa, ausencia de documento, ciclos y aislamiento por artículo.


### Recepciones sin identificador de operación (comportamiento vigente)

Por decisión del usuario se retiró `movimiento_cardex.id_operacion_recepcion` y su restricción única del esquema. Recepción de compras ya no genera UUID, conserva confirmaciones en sessionStorage ni reconoce solicitudes repetidas. Cada confirmación se procesa como una recepción nueva. Se mantienen el bloqueo del documento y de los artículos, la validación del saldo pendiente, la transacción y la auditoría. El formulario deshabilita confirmar mientras envía y vuelve a consultar el documento después de un error; no reenvía automáticamente. Si una solicitud anterior se confirmó pero no llegó su respuesta, otra confirmación puede registrar otra recepción mientras exista cantidad pendiente: revisar el historial y corregir errores mediante REVERSA. Esta decisión solo afecta las recepciones de compra; otros movimientos conservan sus mecanismos existentes. No se modificó la base instalada.


### Revisión de datos derivados del esquema

Se eliminó `descuento_documento`, sin consultas ni formularios que dependieran de ella. No se ejecutó el esquema en la base instalada.

`tasa_iva` es un porcentaje por documento, editable en el formulario y validado por el backend; 19 es su valor inicial. `iva` es el importe calculado, no el porcentaje. Se conservan ambos junto con `subtotal`, `total_neto` y `total`, que el servicio calcula al registrar el documento. Estos cuatro importes son datos derivados guardados: podrían calcularse al consultar, pero suprimirlos requiere adaptar listados, consultas, formularios y la conservación del cálculo histórico.

Otros candidatos que requieren una decisión funcional antes de simplificar:

- `detalle_inventario_fisico.diferencia`: se calcula como `stock_fisico - stock_sistema`; podría derivarse en consultas. `stock_sistema` sí conserva la referencia del conteo y no debe sustituirse por el saldo actual.
- `inventario_fisico.total_contados` y `total_con_diferencia`: se recalculan desde los detalles al guardar conteos; son resúmenes almacenados.
- El cliente de la obra se obtiene exclusivamente desde `presupuesto.id_cliente`; ya no existe `obra.id_cliente` en el esquema.
- `material_utilizado.id_articulo` y `cantidad`: también constan en el egreso vinculado. La integración Gamma pendiente deberá validar su coincidencia o elegir una única fuente; todavía no existe un servicio de consumo que lo haga.

Los saldos del artículo son proyecciones utilizadas por el servicio de movimientos; los precios guardados en documentos y egresos conservan valores históricos. No se consideran tablas sin uso equivalentes a `descuento_documento`.


### Datos derivados al consultar (comportamiento vigente)

Esta sección sustituye la revisión anterior de candidatos. `documento_tributario` ya no almacena `subtotal`, `total_neto`, `iva` ni `total`: `documentos-proveedor/service.js` los calcula al obtener y listar documentos, usando las cantidades, costos, descuentos y `tasa_iva` guardados. Se mantienen la aritmética BigInt, el redondeo por línea y etapa y la validación de límites antes de guardar. El listado carga los detalles en su misma consulta, sin una consulta adicional por documento, y devuelve los totales con los nombres anteriores. La auditoría conserva el resultado calculado de la operación. Cambiar en el futuro las reglas de redondeo también afectaría la reconstrucción de documentos anteriores y debe evaluarse expresamente.

`detalle_inventario_fisico` conserva `stock_sistema` y `stock_fisico`, pero no `diferencia`. Las consultas y el retorno de guardado calculan esa diferencia; los resúmenes `total_contados` y `total_con_diferencia` se obtienen contando los detalles y tampoco se almacenan en `inventario_fisico`. Se conservan los bloqueos, el saldo de referencia del primer conteo y el cierre sin afectar existencias.

`material_utilizado` mantiene únicamente su identificador, hoja de servicio, egreso único e identificador offline. Artículo y cantidad se consultarán desde ese egreso. Su servicio Gamma sigue pendiente; deberá validar que el egreso pertenezca a la obra de la hoja y enlace una sola asignación USO_INTERNO del técnico.

La base instalada no se alteró: debe adaptarse al esquema simplificado antes de utilizar estas escrituras; las columnas antiguas obligatorias podrían impedir guardar conteos. No ejecutar schema.sql sobre datos que se deban conservar, porque elimina y recrea las tablas. Verificación: 69 pruebas automatizadas y comprobación del esquema completo en tablas temporales PostgreSQL, con creación, corrección y cierre de conteos y registro y listado de documentos. No se probaron navegador ni concurrencia real.


### Relación entre presupuesto y obra

`obra.id_presupuesto` es NOT NULL, UNIQUE y referencia `presupuesto.id_presupuesto`. Cada obra tiene un presupuesto y cada presupuesto puede tener cero o una obra. Se eliminaron `presupuesto.id_obra` y el ALTER TABLE de `fk_presupuesto_obra`, sin dependencias en el código actual. La aprobación antes de crear una obra y el bloqueo de edición del presupuesto aprobado quedan pendientes del servicio Beta; esta FK no valida estados. La base instalada no se alteró.


### Cliente de la obra y revisión de relaciones redundantes

Se retiró `obra.id_cliente`: el cliente se consulta mediante `obra.id_presupuesto → presupuesto.id_cliente`. `articulos/service.js`, en `listarObras`, aplica esos JOIN tanto al conteo paginado como a los registros del selector de obras. La API sigue devolviendo `cliente` como razón social, sin cambios de frontend. No había otras consultas de aplicación ni datos de seed dependientes de esa columna. La base instalada no se alteró.

Revisión del resto del esquema:

- `documento_tributario.id_cliente` solo se deduce de una obra cuando `id_obra` está informado. Se conserva porque el documento puede existir sin obra. Cuando se implemente la facturación de clientes, validar que ambos clientes coincidan si se vincula una obra.
- `movimiento_cardex.id_articulo` también puede obtenerse de un detalle de compra, pero este detalle es opcional y los movimientos libres lo necesitan. `cantidad` representa la cantidad realmente movida y puede diferir de la comprada por recepciones parciales. Se conservan ambos.
- `detalle_documento.precio_lista` y `movimiento_cardex.precio_lista_vigente` son copias históricas, no sustitutos del precio actual del artículo.
- `hoja_de_servicio.id_usuario`, `obra.id_tecnico`, `movimiento_cardex.id_usuario` y `recepcion_material.id_usuario_receptor` identifican responsabilidades distintas; no se deducen necesariamente unos de otros.
- `plantilla_checklist.id_categoria_servicio` clasifica una plantilla, mientras `obra.id_categoria_servicio` clasifica una obra. Son relaciones de entidades distintas.
- `ciudad` no se deriva necesariamente del nombre de comuna: el catálogo actual contiene regiones y comunas, no ciudades. No se elimina.

No se eliminaron otros campos durante esta revisión. La aprobación de presupuestos, la coherencia de documentos de cliente con obra y la integración Gamma siguen pendientes de sus respectivos servicios.


### Duplicados de documentos de proveedor

Se retiró `uq_documento_proveedor_tipo_folio` de `db/schema.sql` por decisión del usuario. Se conserva la consulta de duplicados en `documentos-proveedor/service.js`, pero dos solicitudes simultáneas pueden superar esa comprobación y guardar documentos repetidos. No se cambió la política de edición ni se implementó eliminación de documentos: el servicio actual solo permite editar borradores. La base instalada no se alteró; quitar la declaración del esquema no elimina un índice ya creado.


### Documentos sin estado documental (comportamiento vigente)

Se elimina `documento_tributario.estado_documento` del esquema y de los servicios y pantallas. `estado_pago` conserva su significado independiente. El listado permite Editar documento. Antes de cualquier recepción, se pueden editar cabecera y materiales. Después de un INGRESO asociado a sus detalles, solo se admiten cambios de folio, fecha de emisión y observaciones generales: quedan bloqueados tipo, referencia, descuentos generales, tasa de IVA y todos los datos de las líneas. El detalle de la API devuelve `tiene_recepciones`, calculado con EXISTS sobre Cardex; no es otra columna. Una reversa no borra la existencia histórica de la recepción, por lo que no desbloquea la compra.

El backend bloquea la cabecera FOR UPDATE antes de consultar sus recepciones, igual que el servicio de recepción. Valida los campos protegidos y no elimina ni reinserta detalles de documentos recibidos. Cambios de cabecera no requieren que los artículos sigan activos. Se audita la edición con EDITAR_DOCUMENTO, incluyendo valores anteriores y nuevos. El frontend refleja el bloqueo y conserva habilitados número, emisión y observaciones; el backend lo comprueba aunque se altere manualmente la solicitud. Recepción de compras ya no filtra ni exige estados documentales; sigue rechazando notas de crédito y cantidades superiores a lo pendiente.

No se alteró la base instalada. Verificación: pruebas de edición con y sin recepción, rechazo de cambios protegidos, y flujo real contra tablas temporales PostgreSQL de creación, edición, recepción y conservación de IDs y stock. Compilación del frontend y lint correctos con las tres advertencias anteriores en AuthContext y Auditoria. La aprobación/anulación documental no forma parte de este flujo.


### Fecha de vencimiento del documento de proveedor

`documento_tributario.fecha_vencimiento` es DATE opcional; vacío se guarda como NULL. Se captura en creación y edición y se devuelve en las consultas del documento. Backend y esquema impiden que sea anterior a emisión, sin impedir registrar documentos ya vencidos. Se permite editarla aunque existan recepciones, porque no cambia cantidades ni costos. El resto de los bloqueos se mantiene. La edición queda en la auditoría existente. Las alertas por vencimiento y la gestión del pago siguen pendientes; esta entrega solo guarda el dato necesario. No se alteró la base instalada ni el seed.


### Vencimiento obligatorio para facturas

La fecha de vencimiento es obligatoria cuando `tipo_documento` es `factura`, tanto en creación como en edición. Se exige en el formulario, en el servicio y mediante `chk_vencimiento_factura` en schema.sql. Para boleta, guía de despacho y nota de crédito sigue siendo opcional. Toda fecha informada debe ser igual o posterior a emisión; no se impide registrar documentos vencidos. La base instalada no se alteró y las alertas siguen pendientes.


### Egreso de Bodega y consumo futuro de Gamma (comportamiento vigente)

El EGRESO de Bodega exige obra, cantidad y justificación; registra al usuario autenticado y el precio de lista vigente. No pide receptor, no crea recepción y no admite `id_movimiento_origen`. Se retiró del formulario el check de consumir asignaciones y se rechaza esa referencia también en el backend. El selector de referencias ya no ofrece EGRESO. El stock comprometido sigue protegido: el egreso directo solo consume disponible.

`id_recepcion` se guarda únicamente para USO_INTERNO, que exige técnico activo y mantiene su recepción para futura firma. `chk_datos_egreso` ya no exige recepción; `chk_recepcion_uso_interno` exige que solo USO_INTERNO tenga esa FK y que no le falte. Las reversas no copian esa FK: conservan el enlace al original para trazabilidad. No se eliminan recepciones antiguas ni se adapta la base instalada.

El consumo de material asignado se implementará desde Gamma al registrar materiales utilizados. La aritmética y lectura de consumos históricos se conservan, pero el endpoint de Bodega no habilita ese flujo. Gamma deberá generar el egreso con origen, validar técnico, obra y saldo, y reducir total y comprometido sin copiar `id_recepcion` al egreso. No existe aún un endpoint Gamma para hacerlo.


### Desglose del comprobante de compra

`documentos-proveedor/service.js`, en `calcular`, devuelve además `descuento_productos`, `neto_productos`, `importe_descuento_general` e `importe_descuento_pronto_pago`. Se derivan de los mismos valores intermedios y redondeos BigInt del total neto; no son columnas adicionales. Se incluyen en detalle y listado y permiten imprimir un resumen coherente sin volver a calcular descuentos con flotantes en el navegador. Los permisos de consulta y la auditoría se conservan.


### Conteo exclusivo de existencias en bodega (comportamiento vigente)

Al guardar el primer conteo de un artículo, `inventario-fisico/service.js` obtiene con FOR SHARE la referencia `stock_actual - stock_comprometido`, calculada como NUMERIC por PostgreSQL. Se guarda en el campo existente `detalle_inventario_fisico.stock_sistema`, sin nuevas columnas. Al corregir se conserva esa primera referencia; la diferencia sigue siendo stock físico menos referencia. Ejemplo: total 10, asignado 3 y contado 7 implica diferencia cero. La pantalla distingue Esperado en bodega y Contado en bodega y muestra cantidades sin ceros decimales sobrantes.

Finalizar no genera AJUSTE, no escribe Cardex ni cambia stock o PMP. Solo verifica lo contado en bodega; no acredita las cantidades que siguen en poder de los técnicos. El control y corrección de asignaciones en terreno quedan pendientes para Gamma. Los conteos antiguos conservan sus referencias anteriores: no se convierten automáticamente, porque no se dispone de un desglose histórico de reservas para reinterpretarlos. La regla nueva se aplica al primer registro de cada artículo a partir de este cambio. No se modificaron datos reales ni la base instalada.

Verificación: 10 pruebas de inventario físico, compilación del frontend y flujo PostgreSQL con tablas temporales para total 10/comprometido 3, corrección conservando referencia, fracciones y cierre sin movimientos.


### Administrador General con acceso al flujo de artículos

El menú de Administrador General reemplaza la entrada directa de Categorías por Artículos. Desde el catálogo puede acceder a Categorías, crear y editar artículos, consultar movimientos y registrar los tipos habilitados para Bodega. Las rutas de artículos y recepción de compras del frontend admiten ADMIN y BODEGA, y los routers backend de artículos, movimientos y recepción aplican la misma autorización. La recepción se amplía para que funcione también el ingreso asociado a una compra desde el artículo. El resto de roles conserva sus permisos; Administración sigue sin acceso a artículos. El menú independiente Recepción de compras sigue visible para Bodega. No hay cambios de esquema ni datos.

Verificación: pruebas simuladas de los roles permitidos y rechazados en los tres routers, compilación del frontend y lint con las tres advertencias previas. No se comprobó el flujo en navegador.


### Módulo de alertas

`src/modules/alertas/routes.js` expone GET `/api/alertas/:tipo`, registrado en `src/app.js`, con autenticación y roles ADMIN, ADMINISTRACION y BODEGA. `src/modules/alertas/service.js` valida también el tipo y permiso: Bodega solo consulta stock y recibe 403 al pedir alertas financieras. No admite otros roles.

`listar(tipo, rol, filtros)` devuelve `{registros,total,pagina,limite}` con páginas de cinco filas y paginación validada. Un CTE por consulta obtiene total y página en la misma lectura, incluyendo el total cero. No se expone PMP ni costos. Stock usa activos y disponibilidad <= mínimo. Facturas requieren proveedor, tipo factura y pago Pendiente; se separan vencidas (<hoy) y próximas (hoy..hoy+7), con hoy calculado por PostgreSQL en America/Santiago. Tipos y ordenación se eligen mediante opciones cerradas; límite y desplazamiento son parametrizados. No hay escrituras ni cambios de esquema.

`tests/alertas.test.js` comprueba autorización, validaciones, paginación y filtros. Pruebas adicionales en tablas temporales verificaron stock asignado, igualdad al mínimo, inactivos, límites hoy/día7/día8, exclusión de pagadas, documentos de cliente y guías, y páginas posteriores. La administración de pagos continúa pendiente; el filtro usa `estado_pago` existente.
