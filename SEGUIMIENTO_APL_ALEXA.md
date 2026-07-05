# Seguimiento APL - Skill Distribuidora Panamericana

Este archivo resume el seguimiento del trabajo de APL para continuar desde otra laptop o desde otro hilo de Codex sin perder contexto.

## Punto De Partida

La consigna recibida fue:

> Selecciona las interfaces de usuario que requerirás en tu proyecto de bina, distribúyelas de forma equitativa entre cada integrante de la bina.
>
> Indica de cada interfaz cuál es su función.
>
> Cada integrante de la bina trabajará en tres propuestas de diseño. No se pueden repetir las plantillas.
>
> De cada APL generado, resalta en amarillo aquellas propiedades que apoyen a la responsividad de la interfaz.

A partir de esa consigna se revisó qué plantillas APL podían servir mejor para la skill de Alexa de la Distribuidora Panamericana, considerando que el backend ya permite consultar:

- Ventas y ganancias.
- Stock general.
- Stock por producto.
- Stock por marca.
- Stock por familia.
- Pedidos por enviar.
- Pedidos enviados.
- Pedidos finalizados.
- Rangos por día, semana, mes y personalizado.

## Plantillas APL Seleccionadas

Se eligieron seis plantillas importantes para el proyecto:

1. **Headline**
2. **Text List**
3. **Multiple Choice**
4. **Cards Layout**
5. **Grid List**
6. **Paginated List**

La razón general es que estas cubren las necesidades principales de la skill:

- Pantallas de bienvenida o cierre.
- Menús de navegación.
- Opciones tocables.
- Listados de productos.
- Resultados con imágenes.
- Consultas administrativas rápidas.

## Distribución Sugerida

Para la bina se planteó trabajar seis propuestas, tres por integrante:

### Integrante 1

- **Headline**
  - Función: bienvenida, cierre o pantalla de mensaje principal.
- **Text List**
  - Función: mostrar opciones simples como ventas, stock, pedidos o ayuda.
- **Multiple Choice**
  - Función: elegir entre opciones concretas como día, semana, mes o personalizado.

### Integrante 2

- **Cards Layout**
  - Función: menú visual principal con bloques tocables.
- **Grid List**
  - Función: mostrar productos, marcas o familias en una cuadrícula visual.
- **Paginated List**
  - Función: mostrar listas largas de productos o resultados con imágenes.

## Lo Que Se Analizó De Responsividad

Se revisó qué partes del código APL apoyan la responsividad de cada plantilla.

### Headline

Partes relevantes:

- `import` con `alexa-layouts`.
- `type: "AlexaHeadline"`.
- `primaryText`.
- `footerHintText`.
- `backgroundImageSource`.
- Uso de una plantilla predefinida de Alexa, que adapta el contenido al tamaño del dispositivo.

### Text List

Partes relevantes:

- `type: "AlexaTextList"`.
- `listItems`.
- `touchForward`.
- `headerTitle`.
- `headerBackButton`.
- `headerAttributionImage`.
- `backgroundImageSource`.
- La plantilla maneja automáticamente el acomodo de la lista y el desplazamiento.

### Multiple Choice

Partes relevantes:

- `height: "100vh"`.
- `width: "100vw"`.
- Condiciones `when` según tamaño o tipo de viewport.
- Cambio entre `Container` y `ScrollView`.
- Uso de `viewport.height`, `viewport.width` y `@viewportProfile`.
- Ajustes de columnas y anchos según dispositivo.

### Cards Layout

Partes relevantes:

- `height: "100vh"`.
- `width: "100vw"`.
- Tarjetas con ancho en porcentaje.
- Uso de `viewport.height`.
- `wrap: "wrap"` para que las tarjetas bajen de línea.
- Ajustes de tamaño para pantallas pequeñas.

### Grid List

Partes relevantes:

- `type: "AlexaGridList"`.
- `listItems`.
- `imageAspectRatio`.
- `imageScale`.
- `backgroundImageSource`.
- La plantilla adapta la cuadrícula al dispositivo.

### Paginated List

Partes relevantes:

- `type: "AlexaPaginatedList"`.
- `listItems`.
- `backgroundScale: "best-fill"`.
- `backgroundAlign`.
- `headerTitle`.
- `headerBackButton`.
- La plantilla divide el contenido en páginas, útil para listas largas.

## Comentarios De La Profesora

La profesora indicó que:

- Al usar los modelos predefinidos se debe incluir lo necesario: header, footer y contenido.
- La skill no debe parecer un mini sitio web.
- Debe representar lo mínimo necesario.
- Debe ser directa para el tipo de consulta administrativa que realiza Alexa.

Con base en eso se decidió reducir la interfaz visual para que no parezca página web y usar las plantillas como pantallas funcionales de skill.

## Implementación Realizada En Código

Se modificaron estos archivos:

- `controllers/alexaAplDocuments.js`
- `controllers/alexaController.js`

### `controllers/alexaAplDocuments.js`

Se reestructuró para generar documentos APL según el tipo de plantilla:

- `cardsLayout`
- `textList`
- `paginatedList`

La función principal quedó preparada para decidir qué documento crear:

```js
function createAplDocument(payload) {
    if (payload.template === 'paginatedList') return createPaginatedListDocument(payload);
    if (payload.template === 'cardsLayout') return createCardsLayoutDocument(payload);
    return createTextListDocument(payload);
}
```

Esto permite agregar después:

- `multipleChoice`
- `headline`
- `gridList`

sin rehacer la estructura completa.

### Pantallas Implementadas

#### Cards Layout

Se usa para:

- Bienvenida.
- Menú principal.

Función:

- Presentar las opciones principales de forma visual y directa:
  - Ventas.
  - Stock.
  - Pedidos.
  - Ayuda.
  - Salir.

#### Text List

Se usa para:

- Submenús.
- Ventas.
- Stock.
- Pedidos.
- Ayuda.
- Prompts para completar por voz.
- Resultados simples.

Función:

- Mostrar opciones administrativas claras, sin diseño excesivo.
- Mantener interacción por toque con `touchForward`.

#### Paginated List

Se usa para:

- Resultados de stock con productos.
- Stock general con productos bajos.
- Stock por producto.
- Stock por marca.
- Stock por familia.

Función:

- Mostrar resultados con imágenes usando `imagenUrl`.
- Mostrar nombre, stock y marca.
- Evitar pantallas saturadas cuando hay varios productos.

## Conexión Con El Backend

En `controllers/alexaController.js` se agregó:

```js
productListPayload
```

al import desde `alexaAplDocuments`.

También se ajustó el flujo de stock:

- Si hay productos para mostrar, se usa `productListPayload`.
- Si no hay productos, se mantiene `resultPayload`.

Ejemplos conectados:

- `stock_general`
- `stock por producto`
- `stock por marca`
- `stock por familia`

Además, cuando se consultan productos se hace `populate('marca')` para mostrar la marca en el APL.

## Lo Que Ya Funcionaba Antes

Antes de estos cambios ya funcionaban:

- Voz.
- Botones APL.
- Bienvenida.
- Menú.
- Despedida.
- Ventas por día, semana, mes y personalizado.
- Pedidos enviados/finalizados por día, semana, mes y personalizado.
- Stock por producto, marca y familia.
- Corrección de categoría a marca.
- Corrección para que los botones no salgan de la skill cuando deben volver al menú.

## Importante Sobre Los Utterances

Se aclaró que los mensajes de prueba deben respetar los utterances reales.

Por ejemplo, para rangos personalizados no basta decir:

```text
15 días
```

Sino que debe usarse una frase compatible, como:

```text
de hace 15 días
hace cien días
dime los pedidos enviados de hace 15 días
pedidos finalizados de hace 15 días
```

Esto es importante porque Alexa interpreta slots según las frases definidas en los CSV.

## Archivos CSV Revisados

Se trabajó con estos archivos de intents, utterances y slots:

- `ventasIntent-utterances.csv`
- `stockIntent-utterances.csv`
- `estadoIntent-utterances.csv`
- `TIPO_MERCANCIA-values.csv`
- `TIPO_ESTADO-values.csv`
- `TIPO_CONSULTA-values.csv`
- `PERIODO_GANANCIA-values.csv`
- `PERIODO_ESTADO-values.csv`
- `FILTRO_STOCK-values.csv`
- `AMAZON.CancelIntent-utterances.csv`
- `AMAZON.HelpIntent-utterances.csv`
- `AMAZON.StopIntent-utterances.csv`
- `AMAZON.NavigateHomeIntent-utterances.csv`

También se revisó el archivo:

- `productos_sgvi.xlsx`

De ahí se tomaron ejemplos reales de:

- Productos.
- Marcas.
- Familias.
- URLs de imagen.

## Ejemplos Reales Para Probar Stock

### Producto

```text
consulta el stock de 4x4 minoxidil
consulta el stock de 4x4 Pomada azul 100g
```

### Marca

```text
consulta el stock de 4x4
consulta el stock de Andis
```

### Familia

```text
consulta el stock de Barbería
consulta el stock de Styling y Peinado
```

## Pendiente Para Después

Después de terminar estos tres modelos:

- Text List.
- Cards Layout.
- Paginated List.

faltan por implementar:

- Multiple Choice.
- Headline.
- Grid List.

La idea sugerida es:

### Headline

Usarlo para:

- Bienvenida más limpia.
- Despedida.
- Mensajes de confirmación.

### Multiple Choice

Usarlo para:

- Elegir día, semana, mes o personalizado.
- Elegir tipo de pedido.
- Elegir tipo de consulta cuando Alexa necesita desambiguar.

### Grid List

Usarlo para:

- Catálogo visual de productos.
- Marcas más consultadas.
- Familias principales.

## Validaciones Realizadas

Se ejecutaron pruebas de sintaxis:

```bash
node --check controllers/alexaAplDocuments.js
node --check controllers/alexaController.js
```

También se validó que el controlador cargue:

```bash
node -e "require('./controllers/alexaController'); console.log('controller ok')"
```

Resultado:

```text
controller ok
```

## Recomendación Para Continuar

Al abrir el proyecto en otra laptop:

1. Revisar este archivo primero.
2. Revisar `controllers/alexaAplDocuments.js`.
3. Revisar `controllers/alexaController.js`.
4. Probar en Alexa Developer Console:
   - Abrir skill.
   - Ir al menú.
   - Tocar stock general.
   - Probar stock por producto, marca y familia.
5. Confirmar si los templates predefinidos renderizan correctamente en el dispositivo de prueba.
6. Si todo está bien, continuar con `Multiple Choice`, `Headline` y `Grid List`.

