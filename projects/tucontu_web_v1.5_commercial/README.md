# TUCONTU Web v1.7 · iPhone 16e production

Versión móvil de producción construida sobre la gramática PSICOANDINO de v1.6.

## Dispositivo objetivo

Diseño primario en retrato:

- viewport lógico: **390 × 844**
- DPR: **3×**
- resolución física: **1170 × 2532**
- pantalla: **6,1 pulgadas**

El Core sigue siendo `tucontu.core/1.3`.

## Cómo probar

1. Descomprime el ZIP.
2. Abre `index.html`.
3. En iPhone, pruébalo en vertical.
4. Si se publica por HTTPS, también puede abrirse desde Safari normalmente o agregarse a la pantalla de inicio.

## Cambios móviles

### Viewport real de Safari

La aplicación escucha `window.visualViewport`.

Cuando aparece el teclado:

- el lienzo se ajusta al alto realmente visible;
- la página no empieza a hacer scroll;
- se libera temporalmente el header global;
- el riel económico se compacta;
- el campo enfocado conserva el máximo espacio posible.

### Safe areas

Se contemplan:

- `safe-area-inset-top`
- `safe-area-inset-right`
- `safe-area-inset-bottom`
- `safe-area-inset-left`

Esto protege la interfaz al ejecutarse en Safari y en modo agregado a inicio.

### Geometría táctil

En teléfono:

- controles críticos: mínimo ~44 pt;
- inputs/selects: 16 px para evitar zoom automático de Safari;
- sliders comerciales: zona táctil ampliada;
- paginación: 44 × 44.

### Cero scroll

La restricción permanece:

- 1 pieza por página en Archivo;
- 1 subpanel por vez en Mesa;
- Materiales ocupa el espacio completo cuando se abre;
- la barra económica permanece abajo;
- colecciones se paginan.

### Retrato

TUCONTU está compuesto para uso vertical en teléfono. Si un teléfono se gira a paisaje, se muestra un estado explícito para volver a retrato en vez de presentar una interfaz comprimida o rota.

### Accesibilidad / producción

- `focus-visible`;
- `prefers-reduced-motion`;
- tabs con semántica ARIA;
- sin desactivar zoom del usuario;
- `telephone=no`;
- metadata para uso móvil / pantalla de inicio.

## Core

`core.js` está preservado byte por byte respecto de v1.6.

No se agregó lógica comercial ni de fabricación en esta iteración.
