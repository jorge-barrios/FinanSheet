# FinanSheet Component & UX Guidelines

Este documento establece los estándares de diseño y UX para componentes dentro de la aplicación, especialmente en ventanas modales y formularios.

## 1. Modales de Edición y Formularios

### Tarjetas de Input (Input Cards)

Para mantener una interfaz limpia y moderna, los inputs dentro de los modales deben encapsularse en tarjetas ("cards") con bordes sutiles y efectos de "focus" y "hover". Hemos definido dos jerarquías visuales dependiendo si el campo es de acción principal/obligatoria o si es secundario/opcional.

#### 1. Input Primario / Obligatorio (Énfasis Sky)

Se utiliza para los campos más importantes que el usuario debe llenar (ej. Monto, Fecha de Pago). Tienen fondo blanco y brillan en celeste al darles clic o hacer hover.

**Estructura Base CSS:**

```tsx
<div className="p-3 rounded-xl border transition-all duration-300 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/60 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 focus-within:-translate-y-0.5 focus-within:shadow-md focus-within:ring-2 focus-within:ring-sky-500/50 focus-within:border-sky-500 shadow-sm">
  <label className="block text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-1">
    Label del Input Primario
  </label>
  {/* Contenido del input */}
</div>
```

#### 2. Input Secundario / Opcional (Énfasis Slate)

Se utiliza para campos no mandatorios (ej. Notas) o valores predeterminados de sólo lectura que se pueden editar opcionalmente (ej. Vencimiento). Su integración visual es mucho más tenue y anclada al fondo.

**Estructura Base CSS:**

```tsx
<div className="p-3 rounded-xl border transition-all duration-300 bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-700/50 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 focus-within:-translate-y-0.5 focus-within:shadow-md focus-within:ring-2 focus-within:ring-slate-500/50 focus-within:border-slate-500 mt-3">
  <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
    Label del Input Neutro
  </label>
  {/* Contenido del input */}
</div>
```

**Puntos Clave Comunes:**

- **Padding y Forma:** `p-3` o `p-4` dependiendo de la densidad, siempre `rounded-xl`.
- **Transiciones y Hover:** `transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md` para dar un efecto de "elevación" suave al pasar el mouse por encima o tocar. (Nota: el secundario no tiene `shadow-sm` basal, solo en hover/focus).
- **Enfoque (Focus-within):** Utilizar `focus-within:ring-2 focus-within:ring-{color}` en el contenedor padre (`div`), NO en el `<input>` directamente. Esto crea un anillo de enfoque suave alrededor de toda la tarjeta en lugar de un rectángulo sucio dentro.

### Inputs Nativos (Elásticos)

Para evitar los anillos de enfoque rectangulares genéricos de los navegadores dentro de nuestras "Input Cards", el elemento `<input>` o `<textarea>` debe ser "invisible" a nivel de bordes.

**Clases CSS Defensivas para Inputs:**

```tsx
<input className="bg-transparent border-none outline-none shadow-none focus:outline-none focus:ring-0 p-0 m-0 w-full" />
```

- `bg-transparent`: Se funde con el fondo de la tarjeta.
- `border-none focus:ring-0 outline-none`: Elimina cualquier estilización nativa del navegador al hacer focus.
- El focus real lo maneja el padre con `focus-within`.

## 2. Fechas (Date Selection) en Móviles

Evitar librerías complejas como `react-datepicker` en campos estándar de modales móviles.
Mejor utilizar el input nativo HTML5, que invoca interfaces propias del sistema operativo (por ejemplo, la rueda interactiva en iOS o el calendario unificado en Android). Esto evita problemas graves de usabilidad como la apertura inoportuna del teclado alfanumérico.

**Implementación Correcta:**

```tsx
<input
  type="date"
  value={stateDateValue} // Formato "YYYY-MM-DD" estricto
  onChange={(e) => setStateDateValue(e.target.value)}
  className="bg-transparent text-base font-semibold text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer p-0 border-none transition-all w-full block"
/>
```

**Manejo de estados (Reset):**
Para limpiar un input `type="date"`, el valor debe setearse como un string vacío `""`, NO como `null`, ya que React advierte sobre componentes no controlados recibiendo `null` en el prop `value`.

```tsx
// Incorrecto
setMyDate(null);

// Correcto
setMyDate("");
```

## 3. Botones Críticos (Ej: Eliminar)

Los botones de acción destructiva secundaria (dentro de modales de edición) deben verse como botones completos, no solo como texto rojo flotante.

**Estilo Recomendado:**

```tsx
<button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-slate-100 dark:border-slate-800/0 transition-colors">
  <TrashIcon className="w-4 h-4" />
  Eliminar Registro
</button>
```

Se prefieren fondos muy tenues (`bg-rose-50`) con iconos acompañando al texto para evitar saturar agresivamente la interfaz, pero dejando clarísima la intención de la acción.
