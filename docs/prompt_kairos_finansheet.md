# Prompt para adaptar KairOS con principios de FinanSheet

Copia el siguiente prompt y envíaselo al agente con el que estés trabajando en el proyecto "2d brain" (KairOS).

---

**Contexto:**
Tengo un archivo de estilos base (`global.css` usando Tailwind v4) para un sistema llamado "KairOS - Cognitive OS". Quiero mejorar estos estilos integrando los mejores principios de diseño y UX de mi otro proyecto llamado "FinanSheet". FinanSheet se caracteriza por una estética de "Confianza Tranquila" (Quiet Confidence), "Claridad Estructurada" y un enfoque "Sharp Technical" (precisión técnica sin brillos difusos exagerados).

**Objetivo:**
Refactorizar y expandir el archivo CSS de KairOS aplicando las siguientes directrices extraídas de FinanSheet. Mantén la paleta de colores "Deep Ocean" (Teal/Cyan) de KairOS, pero ajusta las mecánicas visuales.

### Recomendaciones a Implementar:

1. **Estética "Sharp Technical" (Cero Glows Difusos):**
   - En FinanSheet aprendimos que el "Glow" difuso genera ruido visual y quita sensación de precisión.
   - **Acción:** Transforma la utilidad `.kairos-glow` (que actualmente usa `box-shadow` con mucho desenfoque) a un enfoque basado en anillos nítidos. Utiliza variables nativas o utilidades equivalentes a `ring-2 ring-primary/40 bg-primary/10` para destacar elementos activos, evitando sombras resplandecientes.

2. **Glassmorphism ("Liquid Glass" / L-Frame):**
   - KairOS ya tiene `.kairos-header` con `backdrop-blur(12px)`. En FinanSheet usamos un "L-Frame" con fondos translúcidos en modo oscuro para dar profundidad sin usar modo negro absoluto.
   - **Acción:** Crea una clase `.kairos-glass` que estandarice el uso de `bg-background/90` o `bg-popover/80` junto con `backdrop-blur-xl` y un borde superior/izquierdo muy tenue (`border-white/5` o `border-slate-700/50`) para dar la sensación de placas de vidrio sobrepuestas.

3. **Mecánica de Inputs y Tarjetas (Tactility & Focus-Within):**
   - Para limpiar visualmente los formularios, los inputs nativos deben ser neutros (sin bordes ni focus ring) y el contenedor padre debe manejar el foco.
   - **Acción:** Ajusta `.kairos-lift` para que sea un ascenso muy sutil (ej. `translateY(-0.5px)` como en FinanSheet). Añade utilidades o directrices para usar `focus-within:ring-2 focus-within:ring-primary/50 focus-within:-translate-y-0.5` en las tarjetas contenedoras de inputs.

4. **Clasificación de Jerarquía de Contraste (4 Niveles):**
   Adapta el sistema de densidad visual de FinanSheet a las variables de KairOS.
   - Nivel 1 (Base/Header): El fondo máximo (background actual).
   - Nivel 2 (Tarjetas/Datos): Fondo secundario ligeramente más claro o transparente.
   - Nivel 3 (Inactivo/Pasivo): Opacidad reducida.
   - Nivel 4 (Highlight): El `bg-sidebar-accent` o `bg-muted` con un anillo `ring-2` primario.
   - **Acción:** Asegúrate de que las variables en el `:root` permitan estos 4 niveles de elevación sin recurrir a sombras pesadas.

5. **Tipografía Orientada a Datos:**
   - FinanSheet depende enormemente de la organización de la información (Bento Grids).
   - **Acción:** Sugiere que la familia tipográfica principal migre a "Geist" (por su estética técnica moderna) y "Space Grotesk" para encabezados. Obligatoriamente, añade una clase de utilidad `.kairos-tabular` que aplique `font-variant-numeric: tabular-nums` para que todos los números en tablas o métricas (como Kanban stats) estén perfectamente alineados.

6. **Micro-interacciones Seguras (Quiet Confidence):**
   - **Acción:** Redefine las transiciones globales. Toda animación de estado (hover, focus) debe durar `150ms` a `300ms` (transiciones discretas). Para las barras de progreso u operaciones asíncronas, usa `500ms ease-out`.

**Instrucción Final para el Agente:**
Analiza el archivo CSS provisto de KairOS y reescríbelo aplicando rigurosamente los 6 puntos anteriores. Explícame brevemente los cambios técnicos realizados (especialmente en la sección `@layer utilities` y las variables de Tailwind v4).
