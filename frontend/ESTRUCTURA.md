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
| `api/cliente.js` | Centraliza las peticiones al backend: envía JSON y el token, devuelve datos y comunica errores. |
| `context/AuthContext.jsx` | Comparte el usuario autenticado, la carga inicial y las funciones de login y logout entre componentes. |
| `components/` | Contiene piezas reutilizables de la interfaz. |
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
