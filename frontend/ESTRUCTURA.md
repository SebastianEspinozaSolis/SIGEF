# Guía rápida del frontend

El frontend muestra las pantallas, recibe lo que escribe el usuario y consulta la API del backend.

## Archivos y carpetas principales

| Lugar | Para qué sirve |
|---|---|
| `.env.development` | Define la dirección del backend para desarrollo mediante `VITE_API_URL`. Las variables `VITE_` son visibles en el navegador: no deben contener secretos. |
| `package.json` | Indica las dependencias y comandos para desarrollar, compilar y revisar el código. |
| `package-lock.json` | Registra las versiones exactas de las dependencias instaladas. |
| `node_modules/` | Contiene las librerías instaladas con npm. No se edita manualmente. |
| `index.html` | Documento HTML inicial; contiene el elemento donde React monta la aplicación. |
| `vite.config.js` | Configura Vite, que levanta el servidor de desarrollo y prepara la aplicación para publicarla. |
| `.oxlintrc.json` | Configura las reglas de revisión del código con Oxlint. |
| `public/` | Archivos estáticos, como los iconos, disponibles directamente por su URL. |
| `src/` | Reúne el código de la interfaz. |
| `dist/` | Resultado generado por `npm run build`. No se edita manualmente. |

## Dentro de `src/`

| Lugar | Para qué sirve |
|---|---|
| `main.jsx` | Inicia React y conecta el navegador de rutas, el estado de autenticación y `App`. |
| `App.jsx` | Define qué página corresponde a cada URL y cuáles comparten el layout o requieren un rol. |
| `config.js` | Obtiene y comparte la dirección de la API desde la configuración de Vite. |
| `roles.js` | Centraliza los nombres de roles usados para mostrar opciones y proteger páginas. |
| `assets/` | Guarda imágenes y otros recursos que se importan desde los componentes y que Vite procesa al compilar. |
| `assets/logo-fyag.png` | Logo de la empresa, importado por `components/Layout.jsx` para mostrarlo en la cabecera como enlace al menú principal. |
| `api/cliente.js` | Centraliza las peticiones al backend: envía JSON y el token, devuelve datos y comunica errores. |
| `context/AuthContext.jsx` | Comparte el usuario autenticado, la carga inicial y las funciones de login y logout entre componentes. |
| `components/` | Contiene piezas reutilizables de la interfaz. |
| `components/AlertasInicio.jsx` | Tarjetas del inicio con alertas de stock y facturas, según rol; incluye consulta paginada, recarga y enlaces a registros. |
| `components/Layout.jsx` | Cabecera común con SIGEF, usuario y opciones de sesión. Su `Outlet` muestra la página hija. |
| `components/RutaProtegida.jsx` | Comprueba sesión y rol antes de mostrar una página; redirige si no corresponde acceder. |
| `pages/` | Contiene las pantallas completas de la aplicación. |

## Páginas actuales

| Archivo en `pages/` | Qué muestra |
|---|---|
| `Login.jsx` | Formulario para iniciar sesión. |
| `Inicio.jsx` | Menú principal con opciones según el rol del usuario. |
| `CambiarPassword.jsx` | Formulario para cambiar la contraseña propia ingresando la actual. |
| `admin/Usuarios.jsx` | Listado, creación y activación/desactivación de usuarios. |
| `admin/Auditoria.jsx` | Historial de acciones, filtros, paginación y detalle de cambios. |
| `alpha/Fichas.jsx` | Formulario y listado compartidos de clientes, proveedores y categorías según `tipo`. |
| `alpha/Articulos.jsx` | Alta/edición del catálogo, búsqueda con sugerencias, filtros y consulta de existencias/PMP. |
| `alpha/InventarioFisico.jsx` | Lista de conteos por estado y creación de un nuevo conteo. |
| `alpha/ConteoInventario.jsx` | Selección de artículos, guardado/corrección del conteo, diferencias y finalización. |
| `alpha/Cardex.jsx` | Historial paginado de movimientos de un artículo, solo consulta. |
| `alpha/alpha.css` | Estilos limitados a las pantallas de Alpha, con tablas desplazables en pantallas pequeñas. |

## Cómo se conectan

```text
main.jsx → App.jsx → RutaProtegida → Layout → página
```

El login tiene su propia ruta y no utiliza el layout de las páginas protegidas. Para mostrar una página nueva hay que declararla en `App.jsx`; agregar un enlace al menú solo permite navegar hacia su URL.

```text
Página o AuthContext → api/cliente.js → API del backend → datos o error
```

**Sesión:** el login guarda el token en `localStorage` y el usuario en `AuthContext`. El cliente envía ese token al backend. Si una petición protegida recibe `401`, elimina el token y emite `sesion-invalida`; el contexto borra el usuario y la ruta protegida redirige al login.

**Permisos:** ocultar opciones o proteger páginas ayuda a controlar la interfaz. El backend también verifica los permisos: es quien autoriza realmente cada operación.

## Alpha: fichas y catálogo

Rutas: `/alpha/clientes`, `/alpha/proveedores`, `/alpha/categorias` y `/alpha/articulos`. Comparten Layout. Clientes/proveedores: Administrador General y Administración. Categorías: Administrador General y Bodega. Artículos y su Cardex: solo Bodega, conforme al backend. Administración no accede a Artículos, Cardex, Categorías ni Inventario físico. Su menú contiene Clientes y Proveedores y muestra Estadísticas y Presupuestos como pendientes, sin enlaces ni rutas ficticias. Los permisos de Administrador General se conservan.

El inicio de Bodega presenta dos entradas: Artículos e Inventario físico. Dentro de Artículos se abre el formulario con Crear artículo o Editar en una fila; el menú Categorías permite su mantenimiento y volver a Artículos. Cada fila enlaza a `/alpha/articulos/:id/cardex`, historial real paginado sin creación ni reversas. Administrador General conserva Categorías desde Inicio porque no tiene acceso a Artículos según los permisos definidos.

Inventario físico está disponible para Bodega y Administrador General en `/alpha/inventario-fisico`. Permite filtrar conteos, crear uno y abrir `/alpha/inventario-fisico/:id`. Allí se buscan artículos por nombre/código mediante `/api/inventario-fisico/articulos`, se cuenta cada artículo y se ven referencia, cantidad física y diferencia. Se puede corregir mientras está en proceso y finalizar con confirmación. Un conteo cerrado es de consulta. Ninguna de estas acciones cambia stock, Cardex ni PMP. No se incorpora todavía el ajuste manual de diferencias.

Las fichas permiten crear y editar sin borrar el proveedor/cliente. Los campos obligatorios se marcan con asterisco; giro del cliente es opcional. `Fichas` recibe un tipo fijo y una key diferente por ruta para no mezclar formularios al navegar.

Regiones y comunas se consultan en PostgreSQL: `region` y `comuna`. GET `/api/clientes/regiones` y `/api/proveedores/regiones` devuelven `{ id_region, nombre }`; GET `/api/clientes/comunas?id_region=...` y `/api/proveedores/comunas?id_region=...` devuelven `{ id_comuna, id_region, nombre }`. Conservan los permisos de cada ficha. `backend/src/utils/ubicaciones.js` comparte estas consultas parametrizadas; se retiró el catálogo fijo `regiones.js`. Los selectores son dependientes: cambiar región limpia la comuna, se descartan respuestas antiguas y se permite reintentar errores de carga. Solo se envía y guarda `id_comuna`; el listado obtiene `comuna`, `id_region` y `region` mediante JOIN. Ciudad sigue siendo texto libre. Las FK rechazan comunas inexistentes y la operación y auditoría siguen siendo atómicas.

Clientes muestra región, comuna y ciudad y dos secciones independientes: Contactos de proyectos y Contactos de finanzas. Cada sección permite agregar, editar y quitar múltiples contactos con nombre, RUT, cargo, correo y teléfono. Las listas pueden estar vacías; cada contacto agregado debe completarse. Quitar un contacto ya guardado solicita confirmación y se aplica al guardar la ficha. Los IDs y claves de React se conservan por área; una misma persona puede figurar en ambas. El listado muestra las dos listas por separado. La API guarda ficha y ambos grupos de forma atómica. El representante legal aún no se incorpora en esta modificación.

Proveedores incluye dirección, región, comuna y ciudad como campos separados. La opción «Registrar ficha bancaria» habilita banco, tipo de cuenta, número de cuenta y correo para pagos, todos obligatorios cuando se activa. Sin activar la opción se guarda el proveedor sin cuenta; desactivarla al editar solicita confirmación y retira la ficha bancaria al guardar. El número de cuenta se captura como texto. El listado distingue una cuenta completa de «Sin ficha bancaria».

La sección Ejecutivos comerciales permite agregar, editar y quitar contactos con nombre, RUT, cargo, correo y teléfono. Puede quedar vacía; cada ejecutivo añadido debe estar completo. Quitar uno ya guardado solicita confirmación y se aplica solo al guardar la ficha. Los ejecutivos conservan sus IDs al editar y usan claves estables en React. El listado muestra los datos de ubicación, bancarios y los ejecutivos asociados. No cambia los permisos existentes.

Esta ficha ampliada necesita que la base instalada tenga la definición correspondiente en `schema.sql`; modificar ese archivo no actualiza la base por sí solo. No se generaron migraciones ni se ejecutó SQL en este cambio.

Los listados consultan la API con paginación de 20 y búsqueda tras una espera de 250 ms; descartan respuestas de solicitudes anteriores al cambiar los filtros o salir de la pantalla. Los formularios bloquean envíos mientras guardan y muestran errores generales y por campo. Una falla al recargar el listado se muestra aparte del resultado del guardado.

Artículos muestra actual, comprometido, disponible, mínimo, costo PMP y alerta visual. No permite editar saldos o PMP; el registro de compras y movimientos pertenece a otra entrega. Los filtros son texto, categoría, estado y stock crítico. Las sugerencias usan los códigos de los resultados de la búsqueda actual. El selector carga todas las páginas de categorías; si faltan, Bodega o Administrador General deben crearlas desde su pantalla. La unidad se escribe como texto libre hasta acordar sus opciones.

Comprobar con `npm run build` y `npm run lint`. La compilación no sustituye probar formularios y API en navegador con PostgreSQL de pruebas. No se han incorporado dependencias nuevas.

Para usar este cambio en una base ya creada, las tablas `cliente` y `proveedor` deben disponer de `id_comuna` en lugar de los textos `region` y `comuna`, conforme a `db/schema.sql`. Crear los catálogos y cargar `seed.sql` por sí solo no transforma las fichas existentes. No se ejecutó SQL ni se creó una migración automática; no ejecutar `schema.sql` sobre datos que deban conservarse porque elimina el esquema.

### Listado y edición de clientes y proveedores

`src/pages/alpha/ListadoFichas.jsx` muestra los registros, búsqueda por RUT o razón social, paginación y enlaces para crear o editar. Conserva `q` y `pagina` en la URL, incluidos los enlaces de ida y vuelta. Después de guardar muestra la confirmación en el listado.

`src/pages/alpha/EditorFicha.jsx` carga la ficha mediante GET por ID, muestra carga/error y permite reintentar; funciona al recargar la URL de edición. `src/pages/alpha/Fichas.jsx` reutiliza el formulario para crear y editar; mantiene los contactos, ejecutivos, datos bancarios y selectores de ubicación. `src/pages/alpha/configuracionFichas.js` comparte los campos y etiquetas entre listado y formulario. Categorías conserva listado y formulario juntos.

Rutas protegidas con los mismos roles existentes: `/alpha/clientes`, `/alpha/clientes/nuevo`, `/alpha/clientes/:id/editar`, `/alpha/proveedores`, `/alpha/proveedores/nuevo` y `/alpha/proveedores/:id/editar`. Guardar regresa al listado; Cancelar y Volver al listado piden confirmar si hubo cambios. Se añade aviso del navegador al recargar o cerrar con cambios pendientes. El botón Atrás del navegador y otros enlaces externos al formulario no tienen bloqueo de navegación interna.

### Creación de usuarios separada

`src/pages/admin/Usuarios.jsx` conserva el listado y las acciones de activar/desactivar. Su enlace Nuevo usuario abre `/admin/usuarios/nuevo`, protegido para Administrador General. `src/pages/admin/CrearUsuario.jsx` contiene el formulario original y consulta roles, permite reintentar su carga, evita envíos repetidos mientras guarda y regresa al listado con confirmación después de crear. Se conservan la API y sus validaciones; no se incorpora edición de usuarios.

### Campos ampliados del artículo

`articulo` incorpora `bodega_sector` obligatorio, `descripcion` opcional (hasta 5000 caracteres en la API), `precio_lista` obligatorio en CLP enteros no negativos y `fecha_actualizacion_precio` automática. Código de barras, ubicación y categoría son obligatorios también en el esquema. El formulario y listado de `Articulos.jsx` incluyen estos datos. La fecha corresponde al precio de lista: se establece al crear y cambia al editar solo si cambia el valor numérico del precio. Stock y PMP permanecen protegidos y la operación se audita en su transacción.

`ultimo_costo_compra` se consulta, no se almacena: toma `costo_unitario` del último INGRESO con `id_documento` y sin REVERSA que lo referencie, ordenando por fecha e identificador. Sin coincidencias se muestra «Sin compras registradas». Esta asociación documental es provisional: falta concretar la clasificación de compras y el tratamiento de devoluciones parciales cuando se implemente el registro de movimientos. El stock disponible mantiene la resta actual menos comprometido; la gestión del compromiso sigue pendiente. No se implementan movimientos nuevos en este cambio.

Unidad de medida del artículo: selector de Unidad (UN), Metro (M), Metro cuadrado (M2), Metro cúbico (M3), Kilogramo (KG) y Litro (L). Se conserva la columna de texto existente y el backend rechaza otros valores. No se convierten cantidades ni se modifican registros existentes automáticamente.

### Acceso a movimientos por artículo

El botón Movimientos en `Articulos.jsx` abre `/alpha/articulos/:id/movimientos`, con el mismo permiso Bodega. Se conserva la URL anterior `/alpha/articulos/:id/cardex`. `Cardex.jsx` presenta el historial y un formulario preliminar con los siete tipos existentes y nombres legibles. El formulario no envía datos: registrar queda deshabilitado hasta concretar las reglas de movimientos. No modifica stock, PMP ni el modelo de datos.

Las cantidades de artículos UN deben ser enteras (se acepta 2.000 como 2, sin redondear fracciones). Stock mínimo y conteos lo validan en backend; en conteos se consulta la unidad del artículo bajo bloqueo. Los campos del frontend usan paso 1 para UN y 0.001 para las demás unidades, incluido el borrador de movimientos. El registro real de movimientos continúa pendiente. No cambia el tipo NUMERIC ni se modifican datos existentes.

El borrador de EGRESO selecciona la obra por nombre y cliente, con búsqueda y paginación, manteniendo el ID interno. GET `/api/articulos/obras` permite esa consulta de lectura bajo el permiso Bodega del módulo; devuelve solo ID, nombre y razón social, con filtros parametrizados. Incluye carga, lista vacía y reintento. No registra aún movimientos ni altera el esquema.

Crear y editar artículos usa pantallas separadas: `/alpha/articulos/nuevo` y `/alpha/articulos/:id/editar`, ambas para Bodega. `src/pages/alpha/EditorArticulo.jsx` carga la ficha de edición por ID y reutiliza el formulario de `Articulos.jsx` sin mostrar el listado. Guardar o cancelar vuelve al catálogo conservando filtros y página mediante el estado de navegación; la creación y edición muestran confirmación al volver. La recarga directa de edición consulta la API, con errores y reintento.

### Documentos desde el proveedor

`src/pages/alpha/ListadoFichas.jsx` añade Crear documento y Documentos en cada proveedor. `DocumentosProveedor.jsx` lista sus documentos paginados y permite editar borradores. `EditorDocumentoProveedor.jsx` carga proveedor/documento, muestra RUT y razón social sin reescribirlos y permite capturar cabecera y materiales, con búsqueda paginada de artículos activos, unidad autocompletada, cantidades según unidad, costo neto, precio de lista con IVA incluido, tres descuentos sucesivos y observaciones. `configuracionFichas.js` comparte los cuatro tipos documentales.

Rutas para Administrador General y Administración: `/alpha/proveedores/:proveedor/documentos`, `/alpha/proveedores/:proveedor/documentos/nuevo`, `/alpha/proveedores/:proveedor/documentos/:id/editar`. Guardar vuelve al listado y no modifica inventario. Los errores mantienen el formulario para corregirlos. La referencia de nota de crédito se ingresa provisionalmente por ID del documento original; falta el selector por tipo y folio. Los totales exactos se calculan al guardar y se muestran en listado/edición como último cálculo guardado; faltan vista previa exacta, ajustes manuales de totales, confirmación, impresión y eliminación. Clientes queda fuera de esta entrega.

### Registrar documento y recepcionar materiales

La pantalla de documentos usa ahora Registrar documento y guarda `Registrado`; los documentos registrados se abren en consulta con controles deshabilitados. Los borradores antiguos se completan y registran, sin edición posterior de importes. Enlaces y permisos de Administración se conservan. Precio de lista de líneas nuevas procede del catálogo al guardar y las existentes conservan su copia, en solo lectura.

`src/pages/alpha/RecepcionesCompra.jsx` añade `/alpha/recepciones-compra` y `/alpha/recepciones-compra/:id`, protegidas para Bodega y accesibles desde Recepción de compras del menú principal. Permite buscar documentos y marcar líneas para recibir parcial o totalmente. Muestra comprado, recibido y pendiente y adapta cantidades a la unidad. Confirmar llama al backend, muestra éxito y refresca pendientes sin alterar el precio de lista.

El cuerpo de una confirmación y su UUID se conservan en sessionStorage con clave por usuario/documento antes de enviar. Mientras el resultado es incierto, se bloquea la edición de la solicitud y se ofrece reintentar la misma confirmación; al recargar puede recuperarse. Solo una respuesta de éxito o rechazo esperado libera la solicitud. La idempotencia se comprueba en el servidor, no depende solo de deshabilitar el botón. No se ha realizado aún verificación del flujo con navegador.

### Ingreso asociado a compra desde Movimientos

`src/pages/alpha/IngresoArticulo.jsx` se usa en `Cardex.jsx` al seleccionar INGRESO. La casilla Asociar a una compra pendiente abre el selector de documentos/líneas con el artículo pendiente. Muestra tipo, folio, proveedor, cantidad pendiente y costo neto aplicado; incluye búsqueda, paginación y reintentos. Reutiliza el componente `Recepcion` exportado desde `RecepcionesCompra.jsx`, filtrado a ese artículo y línea. Confirmar refresca pendientes e historial. El costo procede del documento; el ingreso sin documento no está habilitado.

La confirmación conserva su UUID y cuerpo en sessionStorage por usuario, documento, artículo y línea para reintentar sin duplicar tras una pérdida de respuesta. Desde el documento se mantiene la selección de varias líneas, y desde el artículo solo se presenta la línea elegida. El backend de recepción es el mismo para ambas vías. La base instalada aún debe contar con las ampliaciones previas de documentos/detalles/Cardex; este cambio no aplica SQL.

### Formularios de movimientos conectados

`src/pages/alpha/FormularioMovimiento.jsx` reemplaza los formularios preliminares: conecta ingreso libre, egreso, merma, ajuste, uso interno, devolución y reversa con POST `/api/movimientos/:idArticulo`. `Cardex.jsx` conserva historial y selección de tipo; muestra responsable, receptor y origen. `IngresoArticulo.jsx` mantiene las dos vías: ingreso libre y compra pendiente, que usa la recepción de compras existente.

Uso interno selecciona técnico activo, sin destino o vehículo. Egreso permite consumir una asignación mediante casilla, con obra obligatoria y receptor heredado. Merma conserva obra opcional. Devolución y reversa seleccionan el original por tipo, cantidad disponible, técnico o proveedor/documento. Reversa propone por defecto el saldo completo y permite reducirlo; no se escribe el signo. El backend decide signo, costo y límites. Receptores, obras y referencias usan búsqueda paginada con carga/error/reintento.

Cada confirmación conserva cuerpo y UUID en sessionStorage por usuario/artículo/tipo, permite reintentar una respuesta incierta y refresca el historial al confirmar. No es verificación de idempotencia solo visual: el backend compara la solicitud con su auditoría. Se conservan cantidades enteras en UN y hasta tres decimales en las demás unidades. Esta entrega no captura firmas ni aplica notas de crédito ni ejecuta cambios de base de datos.

### Fecha de registro automática del documento

`documento_tributario.fecha_ingreso` es TIMESTAMPTZ NOT NULL DEFAULT now(): el backend no acepta ni actualiza esta fecha desde el formulario. Se muestra como Fecha de registro con hora, en zona America/Santiago. Emisión sigue como DATE editable antes del registro. Se eliminó `detalle_documento.fecha_ingreso` del esquema, consultas de guardado y formulario; la recepción física conserva la fecha del movimiento. La base instalada se actualizó con ALTER TABLE, sin recrearla. Los registros anteriores conservan su día convertido a medianoche de America/Santiago porque no tenían hora original.


### Recepciones sin identificador de operación (comportamiento vigente)

Por decisión del usuario se retiró `movimiento_cardex.id_operacion_recepcion` y su restricción única del esquema. Recepción de compras ya no genera UUID, conserva confirmaciones en sessionStorage ni reconoce solicitudes repetidas. Cada confirmación se procesa como una recepción nueva. Se mantienen el bloqueo del documento y de los artículos, la validación del saldo pendiente, la transacción y la auditoría. El formulario deshabilita confirmar mientras envía y vuelve a consultar el documento después de un error; no reenvía automáticamente. Si una solicitud anterior se confirmó pero no llegó su respuesta, otra confirmación puede registrar otra recepción mientras exista cantidad pendiente: revisar el historial y corregir errores mediante REVERSA. Esta decisión solo afecta las recepciones de compra; otros movimientos conservan sus mecanismos existentes. No se modificó la base instalada.


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


### Comprobante de documentos de proveedor

`src/pages/alpha/ComprobanteDocumentoProveedor.jsx` muestra el documento guardado mediante GET `/api/documentos-proveedor/:proveedor/:id`. La ruta `/alpha/proveedores/:proveedor/documentos/:id/comprobante` mantiene los roles Administrador General y Administración. `EditorDocumentoProveedor.jsx` navega a ella al crear o editar; `DocumentosProveedor.jsx` permite volver a verla para reimprimir.

Incluye proveedor, folio, emisión, vencimiento y registro, materiales con cantidad, unidad, costo y tres porcentajes, observaciones y desglose de subtotal, descuentos de productos, general y pronto pago, neto, IVA y total. Los importes proceden del backend. Imprimir / Guardar PDF abre el diálogo nativo del navegador; no genera ni almacena un PDF en el servidor. `src/pages/alpha/comprobante.css` define presentación e impresión: oculta acciones y cabecera de sesión (`erp-encabezado` en Layout), repite encabezados de tabla y evita partir filas. No hay cambios de base ni existencias.

Verificación: compilación y lint del frontend (tres advertencias previas ajenas a estos archivos), y pruebas de importes y redondeo en backend. La impresión y la navegación no se comprobaron en navegador real.


### Conteo exclusivo de existencias en bodega (comportamiento vigente)

Al guardar el primer conteo de un artículo, `inventario-fisico/service.js` obtiene con FOR SHARE la referencia `stock_actual - stock_comprometido`, calculada como NUMERIC por PostgreSQL. Se guarda en el campo existente `detalle_inventario_fisico.stock_sistema`, sin nuevas columnas. Al corregir se conserva esa primera referencia; la diferencia sigue siendo stock físico menos referencia. Ejemplo: total 10, asignado 3 y contado 7 implica diferencia cero. La pantalla distingue Esperado en bodega y Contado en bodega y muestra cantidades sin ceros decimales sobrantes.

Finalizar no genera AJUSTE, no escribe Cardex ni cambia stock o PMP. Solo verifica lo contado en bodega; no acredita las cantidades que siguen en poder de los técnicos. El control y corrección de asignaciones en terreno quedan pendientes para Gamma. Los conteos antiguos conservan sus referencias anteriores: no se convierten automáticamente, porque no se dispone de un desglose histórico de reservas para reinterpretarlos. La regla nueva se aplica al primer registro de cada artículo a partir de este cambio. No se modificaron datos reales ni la base instalada.

Verificación: 10 pruebas de inventario físico, compilación del frontend y flujo PostgreSQL con tablas temporales para total 10/comprometido 3, corrección conservando referencia, fracciones y cierre sin movimientos.


### Carga de pantallas bajo demanda

`src/App.jsx` declara las pantallas de Alpha, administración y cambio de contraseña mediante `React.lazy(() => import(ruta))`, a nivel de módulo y con importaciones directas a cada archivo. Login, Inicio, Layout y RutaProtegida conservan importación directa. No se añaden archivos index de reexportación, dependencias ni nuevas rutas.

`src/components/Layout.jsx` coloca Suspense alrededor de Outlet y muestra «Cargando pantalla…» con role=status mientras se descarga el código solicitado. La cabecera permanece visible. RutaProtegida sigue evaluando sesión y rol antes de renderizar una pantalla, sin ampliar permisos. Los componentes compartidos pueden formar parte del mismo fragmento o ser descargados como dependencias de una pantalla; lazy no implica que cada fragmento contenga solo un archivo fuente. Esta optimización no afecta la autorización del backend ni altera la política offline futura de Gamma.

Comparación de compilaciones de producción de esta entrega: JavaScript inicial de 370,57 kB (108,96 kB gzip) a 287,84 kB (90,65 kB gzip), aproximadamente 22 % menos sin comprimir y 17 % menos con gzip. El código restante se reparte en fragmentos solicitados al navegar; no se elimina del sistema. No constituye una medición de tiempo de carga en dispositivos reales. Verificación: build y lint correctos, con las tres advertencias previas en AuthContext y Auditoria; no se comprobó navegación en navegador real.


### Administrador General con acceso al flujo de artículos

El menú de Administrador General reemplaza la entrada directa de Categorías por Artículos. Desde el catálogo puede acceder a Categorías, crear y editar artículos, consultar movimientos y registrar los tipos habilitados para Bodega. Las rutas de artículos y recepción de compras del frontend admiten ADMIN y BODEGA, y los routers backend de artículos, movimientos y recepción aplican la misma autorización. La recepción se amplía para que funcione también el ingreso asociado a una compra desde el artículo. El resto de roles conserva sus permisos; Administración sigue sin acceso a artículos. El menú independiente Recepción de compras sigue visible para Bodega. No hay cambios de esquema ni datos.

Verificación: pruebas simuladas de los roles permitidos y rechazados en los tres routers, compilación del frontend y lint con las tres advertencias previas. No se comprobó el flujo en navegador.


### Alertas del menú principal

`Inicio.jsx` incorpora `components/AlertasInicio.jsx`. Administrador General y Administración ven stock en mínimo o bajo, facturas por vencer y vencidas. Bodega solo ve stock; los otros roles no realizan consultas de alertas. Administración consulta datos mínimos de stock sin obtener acceso al catálogo: sus filas de artículos no tienen enlace. Los otros perfiles habilitados enlazan a movimientos del artículo. Facturas enlazan al comprobante existente.

Cada tarjeta consulta GET `/api/alertas/stock`, `/api/alertas/por-vencer` o `/api/alertas/vencidas`, muestra total y cinco registros por página, y permite Actualizar y reintentar errores. Se carga al entrar al menú; no hay polling ni notificaciones externas. Estados vacíos y de error no se confunden. Se descartan respuestas antiguas al cambiar de página o salir. Los estilos están en `pages/alpha/alpha.css`.

Stock sigue la regla del catálogo: disponible (`stock_actual - stock_comprometido`) menor o igual al mínimo, solo activos. Por vencer incluye hoy hasta hoy+7; vencidas son anteriores a hoy. Solo facturas de proveedor con estado_pago Pendiente. Las fechas se comparan según America/Santiago. No se añade ningún campo ni se alteran datos. Las tarjetas dependen del estado de pago registrado; la gestión de pagos sigue pendiente.

Verificación: 79 pruebas automatizadas del backend, casos de límites y paginación con tablas temporales PostgreSQL, compilación y lint del frontend (tres advertencias previas). No se verificó en navegador real.
