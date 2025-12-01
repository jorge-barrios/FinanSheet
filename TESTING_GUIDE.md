# 🧪 Guía de Testing para FinanSheet

Esta guía te ayudará a ejecutar tests automatizados en FinanSheet.

## 📦 Instalación de Dependencias

Primero, instala las nuevas dependencias de testing:

```bash
npm install
```

Esto instalará:
- ✅ **Vitest** - Framework de testing rápido y moderno
- ✅ **@testing-library/react** - Testing de componentes React
- ✅ **@testing-library/jest-dom** - Matchers adicionales para testing
- ✅ **jsdom** - Entorno DOM para Node.js
- ✅ **@vitest/ui** - Interfaz visual para tests

## 🚀 Ejecutar Tests

### Modo Watch (Desarrollo)
Ejecuta tests en modo watch (se re-ejecutan al hacer cambios):

```bash
npm test
```

### Ejecutar Una Vez
Ejecuta todos los tests una sola vez:

```bash
npm run test:run
```

### Interfaz Visual
Abre una interfaz web interactiva para ver y ejecutar tests:

```bash
npm run test:ui
```

Luego abre tu navegador en `http://localhost:51204` (o el puerto que indique).

### Cobertura de Código
Genera un reporte de cobertura de código:

```bash
npm run test:coverage
```

El reporte se guardará en `coverage/` y podrás ver:
- Porcentaje de líneas cubiertas
- Funciones sin tests
- Branches no probados

## 📊 Tests Actuales

### ✅ Tests de Utilidades

#### **expenseCalculations.test.ts**
Prueba las funciones críticas de cálculo de gastos:

- ✅ `getFrequencyInMonths()` - Conversión de frecuencias a meses
- ✅ `isInstallmentInMonth()` - Determina si un gasto aparece en un mes
- ✅ `getInstallmentNumber()` - Calcula el número de cuota
- ✅ `getInstallmentAmount()` - Calcula el monto por cuota

**Casos cubiertos:**
- Gastos únicos (ONCE)
- Gastos mensuales recurrentes
- Gastos trimestrales, semestrales, anuales
- Gastos recurrentes infinitos (installments = 0)
- Gastos en cuotas (INSTALLMENT)
- Límites de mes (31 de enero → febrero con 28 días)
- Transiciones de año

#### **currency.test.ts**
Prueba las funciones de conversión de moneda:

- ✅ `convertFromPaymentUnitToBase()` - USD, CLP, UF, UTM → USD
- ✅ `convertToBaseCurrency()` - Cualquier moneda → USD
- ✅ `convertToDisplayCurrency()` - USD → Cualquier moneda
- ✅ `formatCurrency()` - Formateo para display

**Casos cubiertos:**
- Conversiones USD ↔ CLP
- Conversiones con UF y UTM
- Round-trip (USD → CLP → USD sin pérdida)
- Formateo en español e inglés
- Decimales correctos (USD: 2, CLP: 0)
- Cantidades muy grandes y muy pequeñas

## 🎯 Agregar Más Tests

### Tests de Componentes

Para testear componentes React, crea archivos en `tests/components/`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoginForm } from '../../components/Auth/LoginForm';

describe('LoginForm', () => {
  it('should render email input', () => {
    render(<LoginForm onToggleMode={() => {}} />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });
});
```

### Tests de Servicios

Para testear servicios con Supabase, usa mocks:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { supabase } from '../../services/supabaseClient';

vi.mock('../../services/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: [], error: null })),
    })),
  },
}));

describe('dataService', () => {
  it('should fetch expenses', async () => {
    // Your test here
  });
});
```

### Tests de Hooks

Para testear custom hooks:

```typescript
import { renderHook } from '@testing-library/react';
import { useCurrency } from '../../hooks/useCurrency';

describe('useCurrency', () => {
  it('should return currency state', () => {
    const { result } = renderHook(() => useCurrency());
    expect(result.current.currency).toBeDefined();
  });
});
```

## 🔧 Configuración

### vitest.config.ts
Archivo de configuración principal de Vitest. Define:
- Entorno (jsdom para testing de componentes)
- Setup file (tests/setup.ts)
- Coverage settings
- Aliases de path

### tests/setup.ts
Configuración global para todos los tests:
- Importa matchers de @testing-library/jest-dom
- Configura cleanup automático después de cada test
- Mock de window.matchMedia

## 📈 Cobertura de Código Actual

| Archivo | Cobertura |
|---------|-----------|
| `utils/expenseCalculations.ts` | ✅ ~90% |
| `utils/currency.ts` | ✅ ~95% |
| `components/*` | ⚠️ 0% (pendiente) |
| `services/*` | ⚠️ 0% (pendiente) |
| `hooks/*` | ⚠️ 0% (pendiente) |

## 🎯 Roadmap de Testing

### Corto Plazo (Próximas Semanas)
- [ ] Tests de `expenseVersioning.ts`
- [ ] Tests de `categories.ts`
- [ ] Tests de `currencyService.ts`
- [ ] Tests básicos de componentes de autenticación

### Mediano Plazo (Próximo Mes)
- [ ] Tests de componentes principales (Dashboard, ExpenseForm)
- [ ] Tests de integración con Supabase (con usuario de prueba)
- [ ] Tests de hooks personalizados
- [ ] Tests de export service

### Largo Plazo
- [ ] Tests E2E con Playwright/Cypress
- [ ] Tests de performance
- [ ] Tests de accesibilidad
- [ ] CI/CD con tests automáticos

## 🐛 Debugging de Tests

### Ver output detallado
```bash
npm test -- --reporter=verbose
```

### Ejecutar un archivo específico
```bash
npm test -- expenseCalculations.test.ts
```

### Ejecutar un test específico
```bash
npm test -- -t "should handle monthly recurring expenses"
```

### Debug en VSCode
Agrega esto a `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## 📚 Recursos

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)

## ✅ Checklist de Testing

Antes de hacer un commit importante:

- [ ] Todos los tests pasan (`npm run test:run`)
- [ ] Cobertura > 70% para archivos modificados
- [ ] Tests nuevos para nuevas funcionalidades
- [ ] No hay tests skippeados sin razón
- [ ] Tests son rápidos (< 500ms cada uno)

---

¡Feliz Testing! 🎉
