# ⚡ Quick Start - Autenticación + Testing

## 🚀 Setup Rápido (5 minutos)

### 1. Instalar Dependencias
```bash
npm install
```

### 2. Configurar Supabase

**En Supabase Dashboard:**
1. Authentication → Providers → Habilitar **Email**
2. SQL Editor → Pegar y ejecutar `database/migration_add_authentication.sql`

### 3. Crear Usuario y Migrar Datos

**Opción A - Automático (Recomendado):**
```bash
npm run dev
```
- Registra un usuario en la pantalla de signup
- Copia el UUID del usuario de Supabase Dashboard → Authentication → Users
- En SQL Editor, ejecuta:

```sql
UPDATE public.expenses SET user_id = 'TU-UUID-AQUI' WHERE user_id IS NULL;
UPDATE public.payment_details SET user_id = 'TU-UUID-AQUI' WHERE user_id IS NULL;
UPDATE public.categories SET user_id = 'TU-UUID-AQUI' WHERE user_id IS NULL;
```

### 4. Ejecutar Tests
```bash
npm test
```

Deberías ver ✅ 35+ tests pasando.

---

## 📚 Documentación Completa

- **IMPLEMENTATION_SUMMARY.md** - Resumen completo de lo implementado
- **AUTHENTICATION_SETUP.md** - Guía detallada de autenticación
- **TESTING_GUIDE.md** - Guía completa de testing

---

## ✅ Verificación Rápida

```bash
# 1. Instalar
npm install

# 2. Ejecutar tests
npm run test:run

# 3. Ver cobertura
npm run test:coverage

# 4. Ejecutar app
npm run dev
```

Si todo funciona:
- ✅ Tests pasan (35+)
- ✅ App abre en localhost
- ✅ Ves pantalla de login
- ✅ Puedes registrarte e iniciar sesión

---

## 🎯 Lo Más Importante

1. **Migración SQL DEBE ejecutarse** antes de usar auth
2. **Migrar datos existentes** con tu UUID después de crear usuario
3. **Tests automáticos** protegen tus funciones críticas
4. **RLS policies** aseguran que cada usuario vea solo sus datos

---

¿Problemas? Lee **IMPLEMENTATION_SUMMARY.md** → Sección "Solución de Problemas"
