# Tipografía & Tokens de Tamaño — FinanSheet

> Referencia técnica operativa para tamaños de texto, familias tipográficas y convenciones de formato numérico.
> Para filosofía y principios de diseño, ver [Identidad.md](file:///srv/repos/finansheet/docs/Identidad.md).

---

## 1. Familias Tipográficas

| Token CSS      | Tailwind     | Fuente           | Uso                                             |
| -------------- | ------------ | ---------------- | ----------------------------------------------- |
| `--font-body`  | `font-sans`  | Geist            | Cuerpo, labels, UI general                      |
| `--font-mono`  | `font-mono`  | Geist Mono       | **Montos, datos numéricos, inputs de cantidad** |
| `--font-brand` | `font-brand` | Space Grotesk    | Títulos de modales, headings principales        |
| `--font-serif` | —            | Instrument Serif | Toques editoriales, acentos                     |

---

## 2. Convenciones Numéricas

### 2.1. Regla de Oro: Montos

Todo monto financiero **DEBE** usar:

```
font-mono tabular-nums tracking-tight
```

Esto garantiza:

- Alineación vertical perfecta (columnas alineadas)
- Números de ancho fijo (`tnum`)
- Tracking compacto para números grandes

### 2.2. Placement de Sufijos de Moneda

**Convención: Sufijo a la IZQUIERDA del monto.**

```
✅  CLP 150.000
✅  UF 32,5
✅  USD 1.200,00

❌  150.000 CLP
❌  $150.000 (sin código ISO)
```

Implementación en JSX:

```tsx
<span className="text-xs font-mono text-slate-400 mr-1">{currency}</span>
<span className="font-mono tabular-nums">{formattedAmount}</span>
```

### 2.3. Formato Regional

- Separador de miles: `.` (punto) → `toLocaleString('es-CL')`
- Separador decimal: `,` (coma)
- Ejemplo: `1.234.567,89`

---

## 3. Escala Tipográfica Adaptativa

### 3.1. Principio

Todos los tamaños de texto en modales usan el patrón `base sm:responsive` de Tailwind.
El breakpoint `sm` (640px) separa mobile de desktop.

### 3.2. Escala para Modales (Sheet Lateral)

Se definen **5 niveles jerárquicos** aplicables a todos los modales:

| Nivel       | Nombre           | Mobile        | Desktop (`sm:`) | Clases Tailwind                                             | Uso                                      |
| ----------- | ---------------- | ------------- | --------------- | ----------------------------------------------------------- | ---------------------------------------- |
| **H1**      | Monto Principal  | `text-2xl`    | `text-3xl`      | `text-2xl sm:text-3xl font-mono tabular-nums font-semibold` | Input de monto, monto pagado principal   |
| **H2**      | Monto Secundario | `text-lg`     | `text-xl`       | `text-lg sm:text-xl font-mono tabular-nums font-bold`       | Esperado, Total Pagado, Diferencia       |
| **H3**      | Título           | `text-base`   | `text-lg`       | `text-base sm:text-lg font-brand font-bold`                 | Header del modal (nombre del commitment) |
| **Body**    | Texto normal     | `text-xs`     | `text-sm`       | `text-xs sm:text-sm`                                        | Subtítulos, descripciones, help text     |
| **Caption** | Label pequeño    | `text-[10px]` | `text-xs`       | `text-[10px] sm:text-xs`                                    | Labels uppercase, badges, contadores     |

### 3.3. Sufijos de Moneda

El tamaño del sufijo es **2 niveles debajo** del monto que acompaña:

| Monto →                     | Sufijo                                                      |
| --------------------------- | ----------------------------------------------------------- |
| H1 (`text-2xl sm:text-3xl`) | `text-sm sm:text-base font-mono font-medium text-slate-400` |
| H2 (`text-lg sm:text-xl`)   | `text-xs sm:text-sm font-mono font-medium text-slate-400`   |
| Caption                     | `text-[10px] sm:text-xs font-mono`                          |

### 3.4. Elementos Específicos

| Elemento                                       | Clases                                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| **Label estructural** (MONTO PAGADO, ESPERADO) | `text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500` |
| **Form label** (Fecha, Nota, etc.)             | `text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500` |
| **Input de texto**                             | `text-sm bg-transparent`                                                   |
| **Input de monto**                             | `text-2xl sm:text-3xl font-mono tabular-nums font-semibold text-right`     |
| **Badge de estado** (Pagado, Nuevo)            | `text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded-full`          |
| **Botón CTA**                                  | `text-xs sm:text-sm font-bold`                                             |
| **Mini-summary** (grid de datos)               | `text-[10px] sm:text-xs font-medium tabular-nums`                          |
| **Helper text** (caracteres restantes, tips)   | `text-[10px] text-slate-400`                                               |
| **Timestamp** (fecha de pago, vencimiento)     | `text-xs sm:text-sm font-medium`                                           |

---

## 4. Colores Tipográficos

| Uso                  | Light       | Dark        | Clases                                   |
| -------------------- | ----------- | ----------- | ---------------------------------------- |
| **Texto primario**   | slate-900   | white       | `text-slate-900 dark:text-white`         |
| **Texto secundario** | slate-500   | slate-400   | `text-slate-500 dark:text-slate-400`     |
| **Label muted**      | slate-400   | slate-500   | `text-slate-400 dark:text-slate-500`     |
| **Sufijo moneda**    | slate-400   | slate-500   | `text-slate-400 dark:text-slate-500`     |
| **Monto positivo**   | emerald-600 | emerald-400 | `text-emerald-600 dark:text-emerald-400` |
| **Monto negativo**   | rose-600    | rose-400    | `text-rose-600 dark:text-rose-400`       |
| **Link / acento**    | sky-600     | sky-400     | `text-sky-600 dark:text-sky-400`         |

---

## 5. Header de Modal

### Estilo estándar (todos los sheet modals)

```
bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl
border-b border-slate-200/60 dark:border-white/10
shadow-sm
```

Elementos del header:

- **Título**: H3 (`text-base sm:text-lg font-brand font-bold`)
- **Subtítulo**: Caption (`text-[10px] sm:text-xs text-slate-500 font-medium`)
- **Icono**: `w-5 h-5` dentro de `p-2.5 rounded-xl`
- **Botones**: `h-9 w-9 rounded-full`

---

## 6. Aplicación por Componente

### PaymentRecorder.v2.tsx

- Input monto: **H1** + sufijo a izquierda
- Esperado (inline): **Caption** con monto en `font-bold tabular-nums`
- Receipt view: monto **H1**, stats **H2**, labels **Caption**
- Header: estilo §5

### CommitmentDetailModal.tsx

- Estado actual: **H2** (`text-lg sm:text-xl`)
- Monto por período: **H2** (`text-xl sm:text-2xl`)
- Total pagado: **H2** (`text-lg sm:text-xl`)
- Labels: **Caption** (`text-[10px] sm:text-xs`)

### CommitmentForm.v2.tsx

- Input monto: **H1** escalado (`text-4xl sm:text-5xl`, excepcional por protagonismo)
- Form labels: `text-[11px] → text-[10px] sm:text-xs` (migrar)
- Sección labels: **Caption**

### TermsListView.tsx

- Labels de campo: **Caption**
- Montos de término: **H2**

---

## 7. Anti-patrones

| ❌ Evitar                                  | ✅ Usar                                            |
| ------------------------------------------ | -------------------------------------------------- |
| `text-[13px]`, `text-[12px]` (arbitrarios) | Escala estándar de Tailwind (`text-xs`, `text-sm`) |
| Tamaño fijo sin `sm:` en modales           | Siempre `base sm:responsive`                       |
| `font-bold` sin `font-mono` en montos      | `font-mono tabular-nums` obligatorio               |
| Sufijo después del monto (`150.000 CLP`)   | Sufijo antes (`CLP 150.000`)                       |
| `font-sans` para datos numéricos           | `font-mono` (Geist Mono)                           |

---

## 8. Inputs y Formularios (UI/UX)

Para mantener una interfaz táctil limpia en modales (como `PaymentRecorder`), las tarjetas de input o "Input Cards" siguen estas directrices.

### 8.1. Tarjetas contenedoras de Inputs

Se encapsulan los inputs en un `div` con bordes suaves, usando pseudoclases para manejar un focus visual alrededor de toda la "tarjeta" en vez de un simple input interno:

```
p-3 rounded-xl border transition-all duration-300 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/60
hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600
focus-within:-translate-y-0.5 focus-within:shadow-md focus-within:ring-2 focus-within:ring-sky-500/50 focus-within:border-sky-500
shadow-sm
```

### 8.2. Los inputs `<input>` elásticos

Para evitar delineadores por defecto del navegador en inputs nativos dentro del contenedor padre:

```
bg-transparent border-none outline-none shadow-none focus:outline-none focus:ring-0 p-0 m-0 w-full
```

### 8.3. Fechas Móviles (Datepicker Nativo)

- ¡Evitar librerías pesadas como `react-datepicker` si no es crítico!
- Usar `<input type="date">` de HTML para invocar controles UX nativos de iOS y Android.
- Para restablecer (resetear) un input de clase `date` controlado, se debe usar `""` (string vacío) en el setter del estado, nunca `null`.

### 8.4. Acciones Críticas / Destructivas (Ej: Eliminar)

Botones secundarios destructivos (dentro de modales) deben tener protagonismo cromático tenue para advertir sin abrumar:

```
py-3 rounded-xl text-sm font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20
```

---

_Este documento es la referencia operativa. Cualquier tamaño hardcodeado que no siga esta escala debe migrarse._
