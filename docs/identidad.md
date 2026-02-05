# Identidad de Diseño - FinanSheet (Ocean Teal / Premium)

Este documento define los principios de diseño, paleta de colores y componentes visuales para garantizar una interfaz cohesiva, premium y libre de ruido visual ("Christmas Tree effect").

## 1. Filosofía Visual
**"Claridad Estructurada"**: La información financiera es densa; el diseño debe ser tranquilo.
*   **Señal sobre Ruido**: El color se usa SOLO para indicar estado crítico o cambios. El resto es neutral.
*   **Materialidad Táctil**: Uso de "Card Lift", bordes sutiles (glass) y sombras difusas para dar peso a los elementos importantes.
*   **Precisión**: Tipografía monoespaciada para datos, serif para narrativa.

## 2. Paleta de Colores (Ocean Teal)

### Primarios (Identidad)
*   **Deep Teal** (`#00555A` / `teal-900`): Base, confianza, encabezados oscuros.
*   **Eucalyptus** (`#9CAF88` / `emerald-600`): Éxito, calma, ingresos. *Usar con moderación.*
*   **Coral** (`#FF6F61` / `rose-500`): Acción, alertas, gastos vencidos.

### Neutros (Estructura)
*   **Slate** (`slate-50` a `slate-950`): Usados para el 90% de la UI.
    *   Fondos: `slate-50` (Light), `slate-950` (Dark).
    *   Bordes: `slate-200` (Light), `white/5` (Dark Glass).
    *   Texto Secundario: `slate-500`.

### Reglas de Uso de Color (Anti-Christmas Tree)
1.  **Iconos**: Deben ser sutiles (`text-slate-400`) a menos que requieran atención inmediata.
2.  **Fondos**: EVITAR fondos de colores saturados en tarjetas enteras. Usar bordes sutiles o indicadores pequeños (puntos/badges).
3.  **Estados**:
    *   *Pagado*: Verde desaturado o solo el icono. No colorear todo el texto.
    *   *Pendiente*: Ámbar/Naranja solo si vence pronto (<3 días). Si no, gris.
    *   *Vencido*: Coral/Rojo, pero enfocado en el dato (fecha/monto), no en el contenedor.

## 3. Tipografía

### Familia
*   **Cuerpo**: `Geist` (Sans). Legible, moderna.
*   **Datos/Montos**: `Geist Mono`. **Obligatorio para precios y variaciones.**
*   **Narrativa/Títulos**: `Instrument Serif`. Para toques editoriales.

### Formato Numérico
Siempre usar `tabular-nums` para evitar que los números "bailen" en listas o grids.

```css
.amount {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
```

## 4. Componentes Clave

### Grid Cards (ExpenseGrid)
*   **Interacción**: `.card-lift`.
    *   Normal: Flat o borde muy sutil (`border-slate-200`).
    *   Hover: Elevación (`-translate-y-1`), sombra suave (`shadow-lg`), borde ligeramente más visible.
*   **Layout**: Balanced Corners.
    *   TL: Insights (pequeño).
    *   TR: Moneda Original (gris).
    *   BL: Cuota/Progreso (badge oscuro/compacto).
    *   BR: Fechas (jerarquía clara: Vencimiento fijo > Estado dinámico).

## 5. Micro-interacciones
*   **Hover**: Suave, 300ms ease-out. Evitar cambios bruscos de contraste.
*   **Carga**: Skeleton loaders con efecto *shimmer* sutil, no spinners agresivos.

---
*Este documento es la fuente de la verdad. Cualquier desviación en el código debe corregirse para alinearse aquí.*
