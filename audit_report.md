# Auditoría de Arquitectura de Datos y Lógica Frontend

## 1. Estado de la Base de Datos (Supabase)

Se ha verificado la conexión con privilegios de `SERVICE_ROLE` y se ha inspeccionado el esquema actual.

### Tablas Principales
*   **`expenses`** (29 registros)
    *   Tabla maestra de gastos/ingresos.
    *   Campos clave: `id`, `user_id`, `name`, `original_amount`, `original_currency`, `type` (FIXED, VARIABLE, etc.), `payment_frequency`, `installments`.
    *   Campos de lógica avanzada: `linked_expense_id`, `link_role` (para vincular gastos, ej. arriendo vs hipoteca).
    *   Integridad: Todos los registros inspeccionados tienen `user_id` asignado correctamente.

*   **`payment_details`** (139 registros)
    *   Almacena el detalle de pagos individuales o proyecciones.
    *   Relacionado con `expenses`.

*   **`categories`** (63 registros)
    *   Catálogo de categorías.
    *   Campos: `name`, `normalized_name`, `user_id`.

## 2. Lógica del Frontend (`ExpenseForm.tsx` y `App.tsx`)

### Flujo de Creación/Edición
1.  **Captura de Datos**: `ExpenseForm.tsx` gestiona el estado local para todos los tipos de gastos (Fijo, Variable, Recurrente, Cuotas).
2.  **Cálculo de Cuotas**:
    *   Si es `ONCE` (una vez) -> 1 cuota.
    *   Si es `isOngoing` (indefinido) -> 999 cuotas.
    *   Si no, usa el input del usuario.
3.  **Vinculación (Linking)**:
    *   Permite seleccionar otro expense existente para vincularlo.
    *   Define roles: `primary` (afecta totales) o `secondary` (informativo/offset).
    *   Valida compatibilidad de frecuencias entre gastos vinculados.
4.  **Manejo de Moneda**:
    *   El formulario captura `originalAmount` y `originalCurrency`.
    *   **Nota Importante**: `ExpenseForm` envía `amountInClp: 0` y `exchangeRate: 0`. La lógica de conversión real reside en `App.tsx` (o triggers de BD), lo cual es un punto crítico a revisar si se planea mover lógica al backend.

## 3. Observaciones Clave para Migración/Lógica
*   **Centralización de Cálculos**: Actualmente, mucha lógica de negocio (como la conversión de moneda inicial o la proyección de cuotas) parece estar dividida entre el componente de UI y `App.tsx`.
*   **Virtualización**: La tabla de `payment_details` crecerá rápidamente. La virtualización en el grid es necesaria (ya identificada en tareas anteriores).
*   **Seguridad**: El uso de `user_id` es consistente, lo cual facilita la implementación de RLS (Row Level Security) robusto.

---
**Estado**: Listo para recibir el documento de sugerencias de lógica de datos.
