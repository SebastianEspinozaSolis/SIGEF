# Guía rápida del frontend

El frontend muestra las pantallas, recibe lo que escribe el usuario y consulta la API del backend.

Cada archivo JavaScript de `src` comienza con una explicación breve de su propósito y de cómo participa en el flujo. Sirve como punto de partida para rediseñar las pantallas: indica qué muestra o guarda y qué comportamiento se comparte con otros archivos. Los comentarios explican el funcionamiento actual; las reglas definitivas se validan en el backend.

Un **hook** es una función cuyo nombre comienza por `use` y que comparte lógica de React entre componentes. A diferencia de un componente, no muestra HTML; a diferencia de una utilidad de formato, puede manejar estado (`useState`) y consultas al cambiar datos (`useEffect`). Cada pantalla que usa el hook tiene su propio estado: no se crea una caché ni se mezclan sus resultados.

Por ejemplo, el editor consulta solo si hay un identificador:

```jsx
const { datos, error, cargando, recargar } = useRegistro(id ? `/api/articulos/${id}` : null);
```

La pantalla decide si muestra carga, error o formulario. `useListado` añade búsqueda y paginación: al buscar vuelve a la página 1, espera 250 ms antes de consultar y conserva los parámetros existentes de la ruta. Ambos permiten reintentar y descartan respuestas de consultas anteriores al cambiar de ruta, búsqueda o página, o al salir de la pantalla. La presentación, selección y formularios permanecen en cada componente. Los permisos y las reglas de negocio siguen en el backend.

## Archivos y carpetas principales

`utils/fechas.js` obtiene el día de `America/Santiago` para fechas de servicio e inicialización de formularios. Conserva los valores DATE (`AAAA-MM-DD`) sin desplazarlos y convierte los instantes ISO al día de Santiago. Las pantallas muestran las horas con zona explícita `America/Santiago`, independientemente de la configuración del dispositivo.

`components/ConformidadObra.jsx` muestra la firma del cliente en el detalle de una obra finalizada del ERP. Consulta `/api/obras/:id/firma`, descomprime los trazos con `utils/firmas.js` y usa `signature_pad` para generar una imagen de solo lectura. Maneja carga, reintento, ausencia de firma y formato inválido; no guarda la firma en IndexedDB ni modifica la captura de Gamma.

`utils/almacenamientoGamma.js` traduce los errores de cuota de IndexedDB a un aviso de espacio insuficiente. `gammaOffline.js` lo aplica a las operaciones locales: un guardado fallido no se confirma ni borra registros pendientes. El formulario conserva sus datos en memoria para reintentar; antes de cerrar o recargar hay que respaldarlos, por ejemplo en papel. Los borradores automáticos muestran el mismo aviso y lo limpian cuando una escritura posterior termina correctamente.

### Portal de terreno Gamma

Las rutas `/gamma/*` se cargan con lazy y utilizan un acceso propio `/gamma/login`, fuera del layout ERP. `pages/gamma/PortalGamma.jsx` reúne obras asignadas, recepciones, hojas, presupuestos y pendientes; `Firma.jsx` captura trazos suavizados mediante `signature_pad` y `gamma.css` contiene sus estilos. Es una primera interfaz funcional adaptable a móvil.

`utils/firmas.js` comprime puntos/opciones/dimensiones con gzip nativo (`CompressionStream`), los codifica como texto `sig:v1:gzip:<base64>` y permite recuperarlos con `DecompressionStream`. No genera imágenes para firmas nuevas. Los borradores y operaciones guardan ese mismo texto. `Firma.jsx` restaura/redimensiona el dibujo, conserva la lectura de PNG anteriores y comunica al formulario si aún está procesando o si hubo un error. El navegador debe admitir las APIs de compresión; su compatibilidad debe comprobarse junto con las pruebas en dispositivo del portal.

Pruebas específicas: `node --test tests/firmas.test.js` y `tests/gamma-firma-navegador.cjs` (requiere preview y Puppeteer del backend). Esta última captura con ancho móvil y alta densidad, recupera el borrador offline, redimensiona y valida el texto con el validador real del backend antes del envío simulado.

`utils/sesion.js` distingue las áreas y centraliza `cerrarSesiones`, que elimina las credenciales locales del ERP y Gamma al pulsar Cerrar sesión. `AuthContext.jsx` conserva el cierre ERP por 40 minutos de inactividad; Gamma usa `gamma-token` y el vencimiento semanal del JWT. Los tokens y usuarios locales se almacenan por área; el cierre voluntario afecta a ambas en el mismo navegador y origen, y se propaga a otras pestañas mediante eventos de almacenamiento. Los vencimientos y la inactividad siguen siendo independientes. El backend sigue verificando token, usuario activo y permisos. Sin conexión solo se recupera una identidad de terreno previamente verificada, con token vigente. Cerrar sesión o vencer el token no borra borradores ni operaciones locales.

`utils/gammaOffline.js` guarda descargas, borradores y una cola en IndexedDB (`sigef-gamma`), separados por usuario. Guardar prepara la operación con UUID estable; el botón Sincronizar envía los pendientes en orden. Una respuesta confirmada queda enviada; errores de validación quedan rechazados y preservados; problemas de conexión o 401 conservan pendientes. No se puede enviar la cola de un técnico con el token de otro. Los errores rechazados se consultan, pero su corrección guiada aún está pendiente. Los datos permanecen únicamente en ese navegador/dispositivo: borrar sus datos elimina lo no sincronizado.

`gammaPwa.js` (raíz frontend) genera `gamma-sw.js` al compilar y precarga la entrada y los recursos de Gamma, sin las páginas diferidas de Alpha/Beta. `utils/gammaPwa.js` registra el service worker solo en producción al entrar a Gamma. `public/gamma.webmanifest` y `gamma-icon.svg` permiten la instalación en navegadores compatibles. Se guardan recursos estáticos; las respuestas de API y tokens no se guardan en CacheStorage. La aplicación requiere una primera apertura y descarga con conexión. Nuevas versiones del service worker esperan el cierre de las pestañas anteriores.

Para probar la reapertura offline: ejecutar `npm run build` y `npm run preview -- --host localhost --port 5182`, entrar a `/gamma/login` y descargar datos. En DevTools → Network, cambiar a Offline y recargar una ruta de Gamma; volver a conexión y sincronizar. El service worker no se activa en `npm run dev`. Fuera de localhost necesita HTTPS. Para preview con backend en otro puerto, definir `VITE_API_URL` al compilar; sin esa variable la API usa el mismo origen, que en producción debe redirigir `/api` al backend.

Verificaciones: `node --test tests/sesion.test.js`; `tests/gamma-navegador.cjs` requiere Puppeteer instalado en backend y preview en localhost:5182, y utiliza una API simulada sin tocar PostgreSQL. No sustituye una prueba en teléfono ni integración real. El contrato backend está en [GAMMA.md](../backend/GAMMA.md).

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

### Facturas de clientes

Desde el comprobante, «Registrar pago o ver abonos» abre `/beta/facturas-clientes/:id/pagos`. Reutiliza `pages/alpha/PagosDocumento.jsx` con la prop `cliente`, muestra monto recibido, fecha, observaciones e historial y comparte validación de saldo con los pagos de proveedores. `components/AlertasInicio.jsx` diferencia las tarjetas de proveedores y clientes; las de clientes abren el comprobante, muestran saldo tras abonos/NC y días restantes o vencidos. Solo Administración/Administrador General ven esas alertas. El botón Actualizar consulta el saldo en vivo.

Los totales del servidor cierran en pesos enteros por línea, descuento e IVA; el frontend no se limita a ocultar centavos. Las vistas previas de NC de proveedor/cliente redondean el IVA al peso. Las cantidades y porcentajes conservan su precisión; el costo unitario puede conservar decimales internos cuando corresponde.

`pages/beta/FacturasCliente.jsx` lista documentos y permite buscar por folio, cliente u obra. `EditorFacturaCliente.jsx` selecciona una obra finalizada, solicita folio/emisión/vencimiento y descuento general, y consulta los precios calculados por el backend. Confirmar crea un documento definitivo; no guarda borradores ni envía precios o cantidades editables. `DetalleFacturaCliente.jsx` muestra el comprobante, descarga PDF y permite una NC global de monto. `components/ResumenFacturaCliente.jsx` comparte líneas y totales con CLP enteros visibles. El acceso `/beta/facturas-clientes/*` y el menú corresponden a Administración/Administrador General. Desde el detalle de obra, Administrador General puede crear/ver su factura; Administración utiliza su propio selector de obras, sin recibir acceso al mantenimiento de obras.

La prueba `tests/facturas-cliente-navegador.cjs` sirve el build y simula la API para verificar factura y NC. No modifica PostgreSQL.

`components/ResumenTrabajo.jsx` muestra tareas, estado de hojas, tiempo por tarea y total en horas/minutos y materiales consumidos. Se comparte entre el cierre de Gamma (últimas versiones locales o descargadas) y `pages/beta/DetalleObra.jsx` (datos confirmados de `/api/obras/:id`). La consulta del ERP descuenta las reversas del consumo y conserva por separado los materiales entregados. No añade columnas al modelo.

La entrega firmada desde Gamma conserva la obra En proceso: el técnico no la finaliza. El listado y detalle de obras del ERP muestran «Tareas completadas: revisar y finalizar» al completarse todas las hojas. Supervisor y Administrador General confirman el cierre mediante la acción existente. Tras confirmar la entrega, se retira la copia local y la firma; las obras con conformidad recibida no vuelven a descargarse ni aceptan operaciones nuevas de terreno.

### Descarga de informes

`api/cliente.js` conserva `api()` para JSON y añade `descargar(ruta, nombre)`. Solicita el archivo con el JWT, mantiene el tratamiento de errores/401, crea una URL temporal del Blob, inicia la descarga y libera esa URL.

`ComprobanteDocumentoProveedor.jsx` reemplaza `window.print()` por Descargar PDF: el archivo lo genera Puppeteer en el backend con formato propio, sin diálogo de impresión del navegador. `Resumen.jsx` añade Descargar PDF y Descargar Excel usando el mes efectivamente consultado, aunque el usuario esté viendo otra página de materiales. Durante la descarga deshabilita los botones y muestra los errores. Las librerías de exportación se instalan solo en backend; no se añaden al bundle del frontend.

### Resumen de gestión

`pages/beta/Resumen.jsx` presenta la ruta `/beta/resumen`, con carga diferida y acceso de Administrador General/Administración. La entrada Resumen del menú reemplaza el aviso de Estadísticas pendiente de Administración. Usa `useRegistro`, el cliente API y los estilos compartidos de Alpha, junto con `pages/beta/resumen.css` para las tarjetas y gráficos adaptables.

`components/GraficoBarras.jsx` es un componente compartido de presentación: dibuja barras CSS con etiquetas y valores visibles. Admite importes negativos y no necesita una dependencia de gráficos. Solo convierte a Number para determinar anchos; los textos conservan los valores proporcionados por la API. Se utiliza para compras de seis meses, presupuestos, movimientos y obras por estado.

La pantalla permite consultar un mes, actualizar datos y paginar la tabla de materiales. Distingue actividad mensual de saldos/alertas actuales. Ventas y cobros muestran Pendiente. Los datos de las barras también aparecen como etiquetas numéricas; las alertas incluyen texto y no dependen solo del color. El significado de cada indicador y los límites del endpoint están documentados en `backend/ESTRUCTURA.md`.

### Pagos de proveedores

`pages/alpha/PagosDocumento.jsx`, cargada con lazy en `/alpha/proveedores/:proveedor/documentos/:id/pagos`, permite registrar monto, fecha efectiva y observaciones de un abono y consultar su historial paginado. El listado de documentos muestra pagado, saldo pendiente y estado calculado, con un enlace Pagos para facturas y boletas. El editor se bloquea si existen abonos. Las alertas muestran el saldo pendiente y excluyen documentos completamente pagados. Roles permitidos: Administrador General y Administración.

### Pantallas temporales de Beta

`pages/beta/` contiene controles HTML sencillos dentro de React para probar el flujo antes del diseño definitivo. Conserva la autenticación, los hooks de consultas y la carga diferida existentes.

| Archivo | Responsabilidad |
|---|---|
| `pages/beta/Presupuestos.jsx` | Listado, búsqueda y filtro de presupuestos. |
| `pages/beta/EditorPresupuesto.jsx` | Crear/editar Pendiente, consultar y aprobar/rechazar lo guardado. |
| `pages/beta/TareasServicio.jsx` | Catálogo paginado de tareas, precios netos sugeridos y estado activo/inactivo. |
| `pages/beta/EditorTareaServicio.jsx` | Crear y editar una tarea asociada a una categoría de servicio. |
| `pages/beta/Obras.jsx` | Listado, búsqueda y filtro de obras. |
| `pages/beta/EditorObra.jsx` | Crear/editar obra con presupuesto aprobado, servicio y técnico. |
| `pages/beta/DetalleObra.jsx` | Ficha, suspensión/reanudación/cancelación y materiales netos de reversas. |
| `pages/beta/CategoriasServicio.jsx` | Crear y editar nombres de categorías de servicio. |
| `components/SelectorPaginado.jsx` | Selector general con búsqueda y paginación, compartido por Alpha y Beta. |

Las rutas `/beta/...` se definen en `App.jsx`, con `lazy` y autorización para Supervisor y Administrador General. El menú se encuentra en `pages/Inicio.jsx`. El contrato del backend y las limitaciones están en [BETA.md](../backend/BETA.md).

### Presupuestos con tareas

`/beta/tareas-servicio` mantiene las tareas y sus precios netos sugeridos mediante `/api/tareas-servicio`. Crear y editar tienen pantallas propias; desactivar conserva el registro. El selector de categoría reutiliza `SelectorPaginado` y el listado utiliza `useListado` y `Paginacion`.

`EditorPresupuesto.jsx` selecciona cliente y categoría; consulta tareas activas de esa categoría y permite añadirlas una sola vez. Cada línea conserva una descripción editable, cantidad con hasta tres decimales y precio neto en pesos enteros. Cambiar categoría solicita confirmación antes de quitar las líneas. La vista previa redondea cada subtotal a pesos y agrega IVA fijo de 19 %; el backend verifica y calcula los importes definitivos. Los cambios deben guardarse antes de aprobar o rechazar.

Los presupuestos requieren una categoría de servicio y al menos una tarea, tanto al crear como al editar. Se retiró el formulario antiguo de monto manual sin categoría. Cambiar el catálogo no cambia los detalles guardados del presupuesto. El checklist por tarea se documenta en la seccion de Gamma.

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
| `hooks/` | Lógica reutilizable de React: maneja estado y efectos, sin dibujar elementos de interfaz. |
| `hooks/useRegistro.js` | Consulta una ruta mediante el cliente API y devuelve datos, error, carga y recarga. Lo utilizan los editores de ficha y artículo; una ruta nula evita consultar al crear. |
| `hooks/useListado.js` | Comparte búsqueda, página, espera de 250 ms y recarga de los selectores de movimientos, compras pendientes y artículos de documentos. Utiliza useRegistro para consultar. |
| `utils/movimientos.js` | Comparte nombres de movimientos y el formato de cantidades entre el formulario y el historial, sin modificar cantidades ni reglas de inventario. |
| `utils/importes.js` | `pesos()` presenta importes CLP redondeados al peso entero en pagos, documentos, artículos, movimientos, obras, presupuestos, alertas y resumen. No cambia valores de entrada, cantidades, porcentajes ni cálculos. |
| `components/ErrorCarga.jsx` | Mensajes de carga fallida: distingue registros inexistentes (404), permite volver y ofrece reintentar errores temporales. |
| `pages/NoEncontrada.jsx` | Pantalla para URL no definidas, con acceso al inicio mediante la ruta comodín de App. |
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

Proveedores incluye dirección, región, comuna y ciudad como campos separados. La sección «Cuentas bancarias» permite agregar varias cuentas (hasta 50 en el formulario), cada una con banco, tipo, número y correo para pagos obligatorios, además del indicador «Cuenta activa». El tipo mantiene sugerencias y permite texto libre; el número se captura como texto para conservar ceros iniciales. Cada cuenta guardada conserva `id_datos_bancarios` y una clave estable de React: se puede editar o activar/inactivar, pero no eliminar. «Quitar cuenta nueva» solo descarta entradas aún no guardadas. No agregar ninguna envía `cuentas_bancarias: []`. Las cuentas omitidas por una petición se conservan en el backend. El listado muestra todas las cuentas con su estado o «Sin cuentas bancarias».

La sección Ejecutivos comerciales permite agregar, editar y quitar contactos con nombre, RUT, cargo, correo y teléfono. Puede quedar vacía; cada ejecutivo añadido debe estar completo. Quitar uno ya guardado solicita confirmación y se aplica solo al guardar la ficha. Los ejecutivos conservan sus IDs al editar y usan claves estables en React. El listado muestra los datos de ubicación, bancarios y los ejecutivos asociados. No cambia los permisos existentes.

La versión de múltiples cuentas necesita la nueva definición de `datos_bancarios_proveedor` en la base instalada; modificar `schema.sql` no la actualiza por sí solo. El código no es compatible con la tabla anterior de una sola cuenta hasta adaptar la base. No se generaron migraciones ni se ejecutó SQL en este cambio. Los pagos y la conservación de los datos bancarios usados en cada pago quedan pendientes para su módulo; inactivar no significa pagar ni se produce automáticamente por un pago.

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

Se elimina `documento_tributario.estado_documento` del esquema y de los servicios y pantallas. `estado_pago` se devuelve actualmente como resultado calculado desde los abonos, sin columna propia. El listado permite Editar documento. Antes de cualquier recepción, se pueden editar cabecera y materiales. Después de un INGRESO asociado a sus detalles, solo se admiten cambios de folio, fecha de emisión y observaciones generales: quedan bloqueados tipo, referencia, descuentos generales, tasa de IVA y todos los datos de las líneas. El detalle de la API devuelve `tiene_recepciones`, calculado con EXISTS sobre Cardex; no es otra columna. Una reversa no borra la existencia histórica de la recepción, por lo que no desbloquea la compra.

El backend bloquea la cabecera FOR UPDATE antes de consultar sus recepciones, igual que el servicio de recepción. Valida los campos protegidos y no elimina ni reinserta detalles de documentos recibidos. Cambios de cabecera no requieren que los artículos sigan activos. Se audita la edición con EDITAR_DOCUMENTO, incluyendo valores anteriores y nuevos. El frontend refleja el bloqueo y conserva habilitados número, emisión y observaciones; el backend lo comprueba aunque se altere manualmente la solicitud. Recepción de compras ya no filtra ni exige estados documentales; sigue rechazando notas de crédito y cantidades superiores a lo pendiente.

No se alteró la base instalada. Verificación: pruebas de edición con y sin recepción, rechazo de cambios protegidos, y flujo real contra tablas temporales PostgreSQL de creación, edición, recepción y conservación de IDs y stock. Compilación del frontend y lint correctos con las tres advertencias anteriores en AuthContext y Auditoria. La aprobación/anulación documental no forma parte de este flujo.


### Fecha de vencimiento del documento de proveedor

`documento_tributario.fecha_vencimiento` es DATE opcional; vacío se guarda como NULL. Se captura en creación y edición y se devuelve en las consultas del documento. Backend y esquema impiden que sea anterior a emisión, sin impedir registrar documentos ya vencidos. Se permite editarla aunque existan recepciones, porque no cambia cantidades ni costos. El resto de los bloqueos se mantiene. La edición queda en la auditoría existente. Las alertas por vencimiento y la gestión del pago siguen pendientes; esta entrega solo guarda el dato necesario. No se alteró la base instalada ni el seed.


### Vencimiento obligatorio para facturas

La fecha de vencimiento es obligatoria cuando `tipo_documento` es `factura`, tanto en creación como en edición. Se exige en el formulario, en el servicio y mediante `chk_vencimiento_factura` en schema.sql. Para boleta, guía de despacho y nota de crédito sigue siendo opcional. Toda fecha informada debe ser igual o posterior a emisión; no se impide registrar documentos vencidos. La base instalada no se alteró y las alertas siguen pendientes.


### Egreso de Bodega y consumo futuro de Gamma (comportamiento vigente)

El EGRESO de Bodega exige obra, cantidad y justificación; registra al usuario autenticado y el precio de lista vigente. No pide receptor: crea una recepción pendiente para el técnico asignado a la obra y no admite `id_movimiento_origen`. Se retiró del formulario el check de consumir asignaciones y se rechaza esa referencia también en el backend. El selector de referencias ya no ofrece EGRESO. El stock comprometido sigue protegido: el egreso directo solo consume disponible.

`id_recepcion` es obligatorio en USO_INTERNO y opcional en EGRESO mediante `chk_recepcion_material`; debe ser NULL en los demás tipos. Los nuevos egresos directos de Bodega crean una recepción para el técnico activo de la obra. Los egresos históricos sin recepción se conservan. Las reversas siguen el movimiento original y no copian su recepción.

Gamma registra el consumo de asignaciones USO_INTERNO desde las hojas de servicio: valida técnico, firma, obra y saldo, y reduce stock total y comprometido. Estos egresos no crean una segunda recepción. Los egresos directos solo se muestran para firmar su entrega; no aparecen como asignaciones consumibles.


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

Stock sigue la regla del catálogo: disponible (`stock_actual - stock_comprometido`) menor o igual al mínimo, solo activos. Por vencer incluye hoy hasta hoy+7; vencidas son anteriores a hoy. Solo facturas de proveedor con saldo pendiente mayor que cero. Las fechas se comparan según America/Santiago. No se añade ningún campo ni se alteran datos. Las tarjetas dependen del estado de pago registrado; la gestión de pagos sigue pendiente.

Verificación: 79 pruebas automatizadas del backend, casos de límites y paginación con tablas temporales PostgreSQL, compilación y lint del frontend (tres advertencias previas). No se verificó en navegador real.

## Paginación compartida

`src/components/Paginacion.jsx` muestra los botones Anterior y Siguiente, el número de página y una etiqueta accesible. Recibe `pagina`, `limite`, `total`, `setPagina` y, opcionalmente, `etiqueta`. Obras, presupuestos, categorías de servicio, pagos y resumen reutilizan la presentación; los hooks y cada pantalla conservan la carga y los filtros.

## Refresco del resumen

`pages/beta/Resumen.jsx` consulta las vistas guardadas y muestra su fecha de actualización. El botón Actualizar envía `POST /api/resumen/actualizar`; abrir la pantalla, consultar un mes y exportar solo leen. Un contador basado en los segundos enviados por el servidor deshabilita el botón durante el plazo de cinco minutos. `BotonActualizar` conserva esa presentación dentro de la propia pantalla y libera su temporizador al salir. El backend vuelve a comprobar plazo y concurrencia para todos los usuarios; el contador no reemplaza ese control. No hay polling de datos ni refresco automático de vistas. Las alertas del inicio mantienen su funcionamiento actual.

## Gráficos del resumen con Recharts

`components/GraficoBarras.jsx` adapta los datos del resumen a los componentes de Recharts: contenedor responsive, ejes, barras, línea de cero y tooltip. La librería dibuja el gráfico; este archivo comparte su presentación y el formato de los valores. `pages/beta/resumen.css` define las tarjetas y su disposición en una o dos columnas según el espacio disponible.

Los importes se convierten a `Number` únicamente para dibujar. El tooltip y la tabla desplegable «Ver datos del gráfico» utilizan el valor original y el formato CLP, conservando su precisión. Los recuentos utilizan ejes enteros; compras admite valores decimales y negativos. Los conjuntos vacíos y sin actividad muestran mensajes propios. Se habilita la capa de accesibilidad de Recharts y se desactivan las animaciones de barras y tooltips.

Recharts es una dependencia del frontend y llega mediante la ruta lazy del resumen; no se importa desde el inicio, Layout ni otras pantallas. No cambia las consultas, las vistas materializadas ni las exportaciones PDF/Excel, que mantienen su implementación actual.

Verificacion de esta integracion: build y lint sin errores (tres advertencias previas); prueba en Chromium con API simulada, cuatro graficos y 16 barras, tooltip CLP exacto, importes negativos, estados vacios y ceros, y ancho de 390 px sin desbordamiento del resumen. No se modificaron datos de la base.

## Selector paginado compartido

`components/SelectorPaginado.jsx` reemplaza el antiguo `pages/beta/SelectorBeta.jsx` y el selector local de movimientos. `SelectorPaginado` recibe una `ruta` y usa `useListado`; comparte buscador, opciones, carga, errores y `Paginacion`. `alCambiar(id, registro)` permite que Beta conserve el ID y que Alpha conserve el objeto completo con los datos del movimiento o la obra.

El mismo archivo exporta `SelectorListado`, que muestra ese selector a partir de un `listado` ya consultado. `IngresoArticulo.jsx` lo utiliza para conservar la recarga de compras pendientes después de confirmar una recepción, sin duplicar consultas. La opción seleccionada se mantiene al buscar o cambiar de página mediante `opcionActual`; en los formularios de edición de Beta se conserva su etiqueta mediante `seleccionado`.

Lo utilizan los presupuestos y obras de Beta, las obras/técnicos/referencias de movimientos de Alpha y las compras pendientes desde un artículo. Los selectores simples y los listados en tabla conservan su presentación. Las rutas y las reglas del backend no cambian.

## Finalización de obras

`pages/beta/DetalleObra.jsx` muestra Finalizar obra únicamente en estado En proceso y solicita `PATCH /api/obras/:id/estado` con `Finalizada`. El backend valida los respaldos; la pantalla muestra los errores y la fecha de cierre cuando existe. No se agregan formularios para inventar horas o consumos: su captura mediante Gamma permanece pendiente. Las obras finalizadas o canceladas conservan la ficha de consulta, sin botones de edición ni nuevas transiciones.


### Acceso del ERP a terreno

`Inicio.jsx` prepara la sesion al pulsar **Portal de terreno** y solo muestra el enlace al rol Tecnico. `utils/sesion.js` expone `prepararSesionTerreno`: comprueba identidad local, rol y vencimiento del JWT del ERP y copia el mismo token a `gamma-token`, junto con los datos del usuario en `gamma-token-usuario`. No transmite credenciales ni tokens en la URL y no renueva el JWT. Una sesion Gamma vigente del mismo tecnico se conserva.

El contexto de Gamma vuelve a consultar `/api/auth/me` y mantiene sus comprobaciones habituales. No se importa la sesion automaticamente al abrir `/gamma/login`, por lo que cerrar sesion en terreno no vuelve a iniciar sesion por tener el ERP abierto. Cada area elimina solamente sus claves al cerrar sesion, y los registros offline de IndexedDB permanecen separados por usuario. El acceso directo de la PWA conserva su login habitual.

El mantenimiento de tareas se abre desde **Categorías de servicio → Ver tareas**. No tiene entrada directa en el menu principal; el listado conserva el filtro de categoria y omite esa columna por ser el contexto de la pantalla.

Gamma: `pages/gamma/gamma.css` define colores locales de alto contraste, controles con altura mínima de 48 px y tema oscuro mediante `prefers-color-scheme`, según la preferencia del dispositivo. La firma conserva fondo blanco y trazo oscuro. Los cambios visuales no alteran el almacenamiento offline ni la sincronización.

Cierre Gamma: las hojas intermedias no solicitan firma. La operación CIERRE exige firma del cliente, guarda la firma en obra y aplica comprobarCierre antes de finalizar la obra, todo en una transacción auditada e idempotente. Se envía después de las operaciones anteriores y se bloquea si quedan pendientes o rechazadas para esa obra. Solo tras confirmar el servidor se eliminan los registros enviados, borradores y copia descargada de la obra; los pendientes y rechazados se conservan. Las descargas excluyen obras finalizadas y sus hojas/presupuestos, y no contienen firmas. La firma requiere `obra.firma_conformidad`, incluida en schema y base instalada.

Gamma por obra: `PortalGamma.jsx` contiene inicio con logo reutilizado de `assets/logo-fyag.png`, descarga y tres accesos (Mis obras, Recepciones y Pendientes). En Pendientes se sincroniza y actualiza la descarga. Las rutas `/gamma/obras/:idObra/*` conservan el contexto del cliente y separan borradores de hoja por tarea y los de presupuesto/cierre por obra. `PresupuestoTerreno` usa el catalogo descargado, categorias/tareas existentes, cantidades enteras, precios netos e IVA 19 %. No permite altas de catalogo. Las tareas contratadas proceden de detalle_presupuesto; las comprobaciones de cada hoja se copian de la tarea contratada. Cerrar requiere todas las hojas completadas; el cierre pide solo firma y resumen, no repetir horas/materiales. `tests/gamma-flujo-navegador.cjs` verifica navegacion movil y presupuesto local con API simulada.

Firma final de Gamma: el formulario CIERRE envia solo id_obra y firma_conformidad. El trazo sigue comprimido y se conserva en IndexedDB hasta confirmar el cierre. No se crea una hoja de servicio para firmar. Se pueden recuperar borradores antiguos con firma_cliente_base64; el servidor mantiene compatibilidad con operaciones ya encoladas.

### Hojas y checklist por tarea de Gamma
`pages/gamma/HojaTarea.jsx` muestra una hoja para cada unidad de la cantidad contratada: carga las comprobaciones de la tarea, permite marcar resultado, justificar No aplica, agregar items propios, guardar avances y completar. La hoja completada queda de lectura. `hooks/useBorradorGamma.js` conserva escrituras ordenadas en IndexedDB y se comparte con recepciones, cierre y presupuesto. `utils/hojasTerreno.js` obtiene la version efectiva desde descarga y operaciones locales, para mostrar Iniciar/Continuar/Ver hoja y habilitar el cierre solo cuando todas estan completadas. La ruta es `/gamma/obras/:idObra/tareas/:idDetalle/unidades/:unidad`.
El borrador y la hoja usan operacion_base para no sobrescribir cambios de otra version al sincronizar. Los materiales son totales acumulados: el servidor descuenta solo diferencias. Los errores y conflictos quedan conservados en Pendientes; no se descartan registros. El catalogo se edita desde `pages/beta/EditorTareaServicio.jsx`, en Checklist predeterminado. Los cambios de catalogo no modifican los textos ya copiados a las hojas.

La descarga de Gamma incluye las recepciones del técnico con tipo de movimiento y nombre de obra para egresos directos. La firma se sincroniza por FIRMA_RECEPCION, con control de propietario, auditoría sin trazos e idempotencia. Confirmar recepción no genera movimientos ni cambia stock.

Los formularios de documentos de proveedor, factura de cliente y NC de cliente usan folio textual con teclado numérico, máximo 10 caracteres y patrón de entero positivo sin ceros iniciales. Rechazan letras y símbolos al escribir o pegar, sin convertir silenciosamente un identificador alfanumérico. El backend comprueba la misma regla.

Gamma muestra «Unidad N de cantidad» y separa formularios, estado, borradores, correcciones, actividad y grupos de envíos por tarea y unidad. `utils/hojasTerreno.js` expande las cantidades para la navegación; no duplica el catálogo. `ResumenTrabajo` identifica cada unidad y suma sus horas. El cierre solo aparece cuando todas están completadas. Se conservan las claves de borrador anteriores para tareas de cantidad 1; no se redistribuyen automáticamente registros antiguos que agrupaban varias unidades.
