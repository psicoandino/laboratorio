# TUCONTU · Web v1.1

Iteración centrada en continuidad de uso y profundidad de la ficha de pieza.

## Cambios principales

### 1. Permanencia

- Header sticky.
- Las acciones locales ya no fuerzan el scroll hacia arriba.
- Agregar/quitar grupos, materiales o embarrilados conserva el contexto visual.
- Sólo los cambios deliberados de etapa llevan al inicio de la nueva etapa.

### 2. Ficha completa de cada TuconTu

Cada pieza guardada muestra ahora:

- costo;
- precio;
- ganancia;
- margen;
- estado del cálculo;
- detalle de construcción;
- cordones y grosores;
- grupos / trenzas;
- largo final;
- embarrilados;
- datos pendientes;
- referencias de precio para distintos márgenes.

### 3. Edición

Desde una pieza guardada se puede:

- editar toda la pieza;
- ir directamente a precio y tiempo;
- editar construcción;
- editar embarrilado.

Al guardar una edición se reemplaza la pieza existente; no se crea un duplicado.

### 4. Estados vacíos correctos

Si todavía no existe ningún colet o cordón, la interfaz ya no muestra un selector vacío.

En su lugar muestra una acción concreta:

- `Crear mi primer colet`
- `Crear mi primer cordón`

### 5. Motor

`core.js` no fue alterado. Se conserva exactamente el Core v1 ya probado.

## Abrir

Abre `index.html`.

No requiere instalación, servidor ni dependencias.

## Principio conservado

> Un dato desconocido jamás rompe el flujo. Sólo cambia la calidad de la estimación.
