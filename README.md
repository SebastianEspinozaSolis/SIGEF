## Estructura del repositorio
```
sigef/
  backend/     API (Express)
  frontend/    Interfaz (React)
  db/          schema.sql y seed.sql
  README.md
```

## Requisitos
- Node.js
- PostgreSQL
- GIT
- Windows si `psql` no funciona se puede usar la ruta, por ejemplo `"C:\Program Files\PostgreSQL\17\bin\psql.exe"`

## Instalación

### Clonar repositorio
```
git clone <URL_DEL_REPOSITORIO>
```

### Crear base de datos

Recomendado crear un usuario que tenga acceso a la base de datos 

Entrar a psql como administrador

```
psql -U postgres -h localhost
```

```
CREATE USER sigef_user WITH PASSWORD 'TU_CLAVE';
CREATE DATABASE sigef OWNER sigef_user;
\q
```
Cargar las tablas y los datos iniciales desde la carpeta `db`:

```
psql -U sigef_user -d sigef -h localhost -f schema.sql
psql -U sigef_user -d sigef -h localhost -f seed.sql
```
`schema.sql` empieza borrando todas las tablas y recreándolas. Sirve para reiniciar la base en desarrollo, pero elimina todos los datos.

### Configurar y levantar el backend

Dentro de `backend`:

```
npm install
```

Copiar y completar valores de `.env.example` a `.env`

```
PORT=3000
DATABASE_URL=postgresql://sigef_user:TU_CLAVE@localhost:5432/sigef
JWT_SECRET=<texto largo y aleatorio>
```

Para generar un `JWT_SECRET` seguro:
 
```
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Crear el usuario administrador (una sola vez, y de nuevo cada vez que se reinicie la base):
 
```
node src/scripts/crearAdmin.js admin@fyag.cl Admin1234
```

Para cargar cuentas ficticias de desarrollo de los demás roles (después de `seed.sql`), desde `backend`:

```powershell
node src/scripts/crearUsuariosPrueba.js
```

| Correo | Contraseña de prueba | Rol |
|---|---|---|
| administracion@fyag.cl | Administracion1234 | Administración |
| bodega@fyag.cl | Bodega1234 | Bodega/Logística |
| supervisor@fyag.cl | Supervisor1234 | Supervisor de Obras |
| tecnico@fyag.cl | Tecnico1234 | Técnico |

Incluye nombres ficticios y RUT con verificador válido. Los datos son fijos para repetir la carga sin duplicar cuentas. Si un correo o RUT ya existe, se omite sin modificar la contraseña, el rol ni los demás datos. El administrador se crea con el script anterior. Estas cuentas son solo para pruebas; el script no se ejecuta automáticamente al iniciar el servidor. Reiniciar el backend no elimina usuarios: vuelve a ejecutarlo si recreas la base.

Levantar el servidor:
 
```
npm run dev
```
 
Debe imprimir `Servidor en http://localhost:3000`. Comprobar en el navegador `http://localhost:3000/api/health`, que debe responder `{"estado":"ok","roles":5}`.

### Levantar el frontend
Desde otra consola entrar al frontend

```
npm install
npm run dev
```

## Como ejecutar 

Dos consolas abiertas a la vez:
 
```
cd backend  &&  npm run dev      → http://localhost:3000
cd frontend &&  npm run dev      → http://localhost:5173
```