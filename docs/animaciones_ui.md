# Documentación de Animaciones y Transiciones UI - FinanSheet

El proyecto FinanSheet utiliza Tailwind CSS para gestionar de forma eficiente y consistente las animaciones, transiciones y estados de interacción (hover, focus, active). La estética visual se basa fuertemente en el principio de "Confianza Tranquila" y "Glassmorphism", utilizando transiciones suaves y orgánicas.

## 1. Patrones Globales de Transición

En casi todos los componentes interactivos se emplea la utilidad `transition-all` de Tailwind, combinada con duraciones específicas que otorgan una sensación de fluidez y respuesta táctil (tactility):

- **Duración estándar:** `duration-300` (Usado en inputs, tarjetas, y modales).
- **Duración lenta (para barras de progreso o cargas):** `duration-500 ease-out`.
- **Transiciones específicas:** `transition-colors` para botones donde solo cambia el fondo o texto.

## 2. Tarjetas y Contenedores Modulares (Bento Grid / Modales)

Las "Input Cards" y las tarjetas de la "Bento Grid" responden al mouse (hover) y al teclado (focus) elevándose ligeramente y aumentando su sombra para destacar en la interfaz.

**Clases utilizadas:**

```css
.card-interactive {
  @apply transition-all duration-300 
         hover:-translate-y-0.5 hover:shadow-md 
         hover:border-slate-300 dark:hover:border-slate-600;
}
```

_Efecto:_ La tarjeta sube ligeramente (`-translate-y-0.5`), la sombra se intensifica sutilmente de `shadow-sm` a `shadow-md`, dando la impresión de que el elemento se acerca al usuario.

## 3. Estados de Focus (Focus-Within)

Para los inputs, en lugar de usar un outline nativo del navegador que rompe la estética de la tarjeta, se transfiere el efecto de "enfoque" al contenedor padre utilizando `focus-within`.

**Clases utilizadas:**

```css
.input-container-focus {
  @apply focus-within:-translate-y-0.5 focus-within:shadow-md 
         focus-within:ring-2 focus-within:ring-sky-500/50 focus-within:border-sky-500;
}
```

_Efecto:_ Al hacer click dentro del input, el borde de toda la tarjeta cambia a celeste (`sky-500`), añade un anillo resplandeciente suave de desenfoque y también eleva la tarjeta.

## 4. Botones y Elementos Clickeables

Los botones mantienen una respuesta rápida puramente basada en la retroalimentación de color para no sobresaturar de movimiento la pantalla ("Confianza Tranquila").

**Modificadores Hover/Active en Botones:**

- **Botón Primario / Peligro:** Cambio de color sólido.
  ```css
  @apply transition-colors bg-rose-500 hover:bg-rose-600 focus:ring-2 focus:ring-rose-500/50 shadow-lg shadow-rose-500/20;
  ```
- **Botones Secundarios:** Fondo apenas visible que se oscurece al pasar el cursor.
  ```css
  @apply text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors;
  ```

## 5. Animaciones de Entrada (Modales y Paneles)

Para los paneles laterales (como los formularios de edición o detalles), se aplican animaciones direccionales utilizando los plugins de Tailwind UI o clases nativas para simular físicas.

**Animación Slide-In (Sheet Layout):**

```css
.sheet-content {
  @apply animate-in slide-in-from-right duration-300;
}
```

_Efecto:_ El panel modal no aparece de golpe; se desliza fluidamente desde el borde derecho de la pantalla en `300ms`, simulando la apertura de una vista superpuesta en aplicaciones nativas (como en iOS).

## 6. Skeletons y Estados de Carga

Para reducir la ansiedad del usuario frente a tiempos de carga y evitar un "brinco" de layout, se utilizan Skeletons (elementos de interfaz dibujados en gris/celeste) con la clase utilitaria `animate-pulse`.

**Clases utilizadas:**

```css
.skeleton-box {
  @apply bg-slate-200 dark:bg-slate-700 rounded animate-pulse;
}
/* Variante especial con degradado */
.skeleton-icon {
  @apply bg-gradient-to-br from-sky-500/30 to-sky-600/30 animate-pulse;
}
```

_Efecto:_ Transición infinita de opacidad (~2s por ciclo) que simula que el contenido está "respirando" mientras se obtienen los datos.

## 7. Barras de Progreso e Indicadores Visuales

Los elementos que representan llenado (como las metas o presupuestos) realizan su animación de carga basándose en transiciones de ancho (width) con `ease-out`, lo que significa que empiezan rápido y se suavizan al final.

**Clases utilizadas:**

```css
.progress-bar-fill {
  @apply h-2.5 rounded-full transition-all duration-500 ease-out;
}
```

## Resumen de Buenas Prácticas de Animación en el Proyecto

1. **No ser intrusivos**: El movimiento (translation) se restringe a micro interacciones (`-translate-y-0.5`).
2. **Retroalimentación clara**: Todos los elementos interactivos tienen un estado `hover:` y `focus:`.
3. **Consistencia en tiempós**: `duration-300` para UI, `duration-500` para datos.
4. **Performance**: Se privilegia el cambio de clases CSS que los navegadores puedan acelerar por hardware (`opacity`, `transform`) por sobre alteraciones de `margin` o `padding` al hacer hover.
