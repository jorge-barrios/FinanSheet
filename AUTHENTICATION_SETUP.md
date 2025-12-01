# 🔐 Guía de Configuración de Autenticación

Esta guía te ayudará a habilitar la autenticación de usuarios en FinanSheet y migrar tus datos existentes.

## 📋 Pasos de Configuración

### 1. Habilitar Autenticación de Email en Supabase

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Navega a **Authentication** → **Providers**
3. Encuentra **Email** y habilítalo
4. **IMPORTANTE**: Desactiva "Confirm email" si quieres que los usuarios puedan iniciar sesión inmediatamente
   - O déjalo activado si prefieres que confirmen su email primero
5. Guarda los cambios

### 2. Ejecutar la Migración de Base de Datos

1. Ve a **SQL Editor** en tu proyecto de Supabase
2. Abre el archivo `database/migration_add_authentication.sql`
3. Copia TODO el contenido del archivo
4. Pégalo en el SQL Editor de Supabase
5. Ejecuta la migración (pero **NO ejecutes las líneas comentadas todavía**)

### 3. Crear tu Usuario Principal

Tienes dos opciones:

#### Opción A: Crear desde la App (Recomendado)
1. Ejecuta la app localmente: `npm run dev`
2. Verás la pantalla de Login
3. Haz clic en "Sign up" (Registrarse)
4. Ingresa tu email y contraseña
5. Si tienes "Confirm email" activado, revisa tu correo y confirma
6. Inicia sesión con tus credenciales

#### Opción B: Crear desde Supabase Dashboard
1. Ve a **Authentication** → **Users**
2. Haz clic en "Add user"
3. Ingresa email y contraseña
4. Confirma el email automáticamente si quieres
5. Copia el **User ID (UUID)** - lo necesitarás para el siguiente paso

### 4. Migrar tus Datos Existentes

⚠️ **IMPORTANTE**: Este paso asignará TODOS tus datos existentes a un usuario específico.

1. Obtén tu User ID:
   - Si creaste el usuario desde la app: Ve a Supabase Dashboard → Authentication → Users → Copia el UUID
   - Si creaste desde Dashboard: Ya lo tienes del paso anterior

2. Ve al **SQL Editor** en Supabase

3. Ejecuta estos comandos reemplazando `YOUR-USER-UUID-HERE` con tu UUID real:

```sql
-- Reemplaza 'YOUR-USER-UUID-HERE' con tu UUID de usuario
UPDATE public.expenses
SET user_id = 'YOUR-USER-UUID-HERE'
WHERE user_id IS NULL;

UPDATE public.payment_details
SET user_id = 'YOUR-USER-UUID-HERE'
WHERE user_id IS NULL;

UPDATE public.categories
SET user_id = 'YOUR-USER-UUID-HERE'
WHERE user_id IS NULL;
```

4. Verifica que se migraron correctamente:

```sql
-- Verifica cuántos registros tienen tu user_id
SELECT COUNT(*) FROM expenses WHERE user_id = 'YOUR-USER-UUID-HERE';
SELECT COUNT(*) FROM payment_details WHERE user_id = 'YOUR-USER-UUID-HERE';
SELECT COUNT(*) FROM categories WHERE user_id = 'YOUR-USER-UUID-HERE';
```

### 5. Hacer user_id Obligatorio (Opcional pero Recomendado)

Una vez que todos tus datos existentes tienen un user_id, puedes hacer este campo obligatorio:

1. Ve al SQL Editor
2. Ejecuta estos comandos:

```sql
ALTER TABLE public.expenses ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.payment_details ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.categories ALTER COLUMN user_id SET NOT NULL;
```

### 6. Probar la Aplicación

1. Cierra sesión si estás logueado
2. Inicia sesión con tu usuario
3. Verifica que veas todos tus datos existentes
4. Crea un gasto de prueba
5. Cierra sesión y crea un segundo usuario de prueba
6. Verifica que el segundo usuario NO vea los datos del primero

## 🧪 Crear Usuario de Prueba para Tests

Para tests automatizados, crea un usuario dedicado:

1. Desde la app o Supabase Dashboard, crea un nuevo usuario:
   - Email: `test@finansheet.com` (o el que prefieras)
   - Password: `test123456`

2. Guarda estas credenciales en un archivo `.env.test`:

```env
VITE_TEST_USER_EMAIL=test@finansheet.com
VITE_TEST_USER_PASSWORD=test123456
```

3. Este usuario empezará con datos vacíos, perfecto para tests

## 🔒 Seguridad: Row Level Security (RLS)

Las políticas RLS ya están configuradas automáticamente. Esto significa:

✅ Cada usuario SOLO puede:
- Ver sus propios gastos
- Crear gastos asignados a su cuenta
- Editar/eliminar solo sus gastos
- Ver solo sus categorías personales

❌ Los usuarios NO pueden:
- Ver datos de otros usuarios
- Modificar datos de otros usuarios
- Acceder a gastos que no les pertenecen

## 🚨 Solución de Problemas

### No veo mis datos después de iniciar sesión
- Verifica que ejecutaste el paso 4 (migración de datos)
- Verifica que usaste el UUID correcto
- Revisa en Supabase Dashboard que los registros tienen el `user_id` correcto

### Error: "new row violates row-level security policy"
- El user_id probablemente es NULL o incorrecto
- Los triggers deberían asignarlo automáticamente, pero verifica que estén activos
- Ejecuta: `SELECT * FROM pg_trigger WHERE tgname LIKE 'set_%_user_id';`

### No puedo crear un usuario nuevo
- Verifica que Email Auth esté habilitado en Supabase
- Revisa los logs de autenticación en Supabase Dashboard
- Verifica que las variables de entorno estén configuradas

### Los datos se duplican entre usuarios
- Algo salió mal con RLS
- Verifica que las políticas estén activas: `SELECT * FROM pg_policies WHERE tablename IN ('expenses', 'payment_details', 'categories');`

## 📝 Notas Adicionales

- **Backup**: Antes de ejecutar la migración, exporta tus datos desde Supabase Dashboard
- **Testing**: Después de migrar, prueba extensivamente antes de desplegar a producción
- **Rollback**: Si algo sale mal, puedes eliminar las columnas user_id con:
  ```sql
  ALTER TABLE public.expenses DROP COLUMN user_id;
  ALTER TABLE public.payment_details DROP COLUMN user_id;
  ALTER TABLE public.categories DROP COLUMN user_id;
  ```

## ✅ Checklist de Verificación

- [ ] Email Auth habilitado en Supabase
- [ ] Migración SQL ejecutada
- [ ] Usuario principal creado
- [ ] UUID del usuario obtenido
- [ ] Datos existentes migrados
- [ ] user_id hecho NOT NULL (opcional)
- [ ] Login funciona correctamente
- [ ] Datos visibles después de login
- [ ] Segundo usuario NO ve datos del primero
- [ ] Usuario de prueba creado para tests
- [ ] Botón de logout funciona

---

¡Listo! Ahora tienes autenticación multi-usuario funcionando. 🎉
