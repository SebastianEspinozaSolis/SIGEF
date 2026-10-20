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

Cada módulo tiene dos archivos:

- **`routes.js`:** define las URL y permisos, recibe `req` y responde con `res`. Llama al servicio.
- **`service.js`:** realiza las validaciones, consultas y operaciones. Recibe datos y devuelve resultados, sin usar `req` ni `res`.

## Cómo se conectan

```text
Frontend → app.js → routes.js → middlewares de la ruta → service.js → PostgreSQL
```

El resultado vuelve a la ruta, que lo envía al frontend. Si el servicio lanza un error, el manejador de `app.js` responde.

**Pool y client:** `pool.query()` sirve para consultas independientes. Para guardar una operación y su auditoría juntas, se obtiene un `client` del pool: `BEGIN` inicia la transacción, `COMMIT` confirma todo y `ROLLBACK` lo deshace si falla. Al terminar, `release()` devuelve la conexión al pool.
