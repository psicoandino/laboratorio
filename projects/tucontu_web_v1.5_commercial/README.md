# TUCONTU Web v1.5 · capa comercial interactiva

Paquete de prueba humana con **Core v1.3**.

## Cómo probar

1. Descomprime el ZIP.
2. Abre `index.html`.
3. No necesitas Terminal.

## Qué cambia

### En `Mis TuconTu`

Cada card muestra, cuando corresponde:

- costo listo para vender;
- precio guardado, o **precio sugerido** si todavía no existe;
- margen.

`Ajustar precio` transforma la misma card, sin crecer ni generar scroll.

Puedes mover:

- **Precio** → margen y ganancia cambian inmediatamente.
- **Margen** → precio y ganancia cambian inmediatamente.

La prueba no modifica la pieza hasta pulsar **Usar este precio**.

Si el costo está incompleto, la interfaz puede simular sobre el costo conocido, pero no lo llama “precio sugerido”.

### Barra económica

Mientras ajustas una card, la barra inferior refleja en vivo:

- fabricación;
- empaque;
- listo para vender;
- precio de prueba;
- ganancia;
- margen.

### Margen habitual

En `Ajustes` existe una preferencia general de margen habitual. Valor inicial:

- **50%**

Si una pieza no tiene precio y su costo está completo, TUCONTU obtiene un precio sugerido a partir de ese margen.

### Redondeo comercial

Las sugerencias pueden redondearse a:

- $1
- $10
- $100
- $500
- $1.000

Valor inicial: **$100**.

El redondeo sólo afecta la sugerencia comercial; no altera los costos.

### Reducción de duplicidad

Se eliminan las tablas estáticas de 40 / 50 / 60 / 70%.

La misma capacidad queda expresada por el control interactivo:

**Precio ↔ Margen**

## Core v1.3

Añade:

- `marginForPrice(cost, price)`
- `profitForPrice(cost, price)`
- `roundCommercialPrice(price, increment)`
- `suggestedPrice(cost, targetMargin, increment)`

También agrega:

- `defaultTargetMargin`
- `priceRounding`

La migración `1.2 → 1.3` preserva reglas de largo ya personalizadas.

## Invariantes preservadas

- cero scroll;
- dato desconocido no rompe el flujo;
- precio sugerido sólo con costo listo completo;
- costo histórico protegido;
- simulación no equivale a guardar;
- Core rico, interfaz reducida.
