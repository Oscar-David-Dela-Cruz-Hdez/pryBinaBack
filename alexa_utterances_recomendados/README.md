# Utterances recomendados para Panamericana

Estos archivos simplifican el modelo de interaccion para evitar que Alexa confunda ventas, inventario, pedidos, ayuda, menu y salida.

Cambios principales:

- Evitar frases demasiado cortas como `{tipoConsulta}`, `{periodoGanancia}`, `de {periodoEstado}` o `el {tipoFiltroStock}`.
- Usar frases completas y explicitas para cada intent.
- Usar "inventario" en pantalla y en voz, aunque internamente el intent siga llamandose `stockIntent`.
- Agregar frases claras para menu principal, ayuda, cancelar y salir.
- Corregir el slot `diasPersonalizados` a `diasPersonalizado`.
- Usar solamente `AMAZON.StopIntent` para salir. Elimina `SalirIntent` del
  modelo para que ambos intents no compitan por las mismas frases.

Para los rangos personalizados, el backend acepta temporalmente ambos nombres
de slot: `diasPersonalizado` y `diasPersonalizados`. Conviene conservar
`diasPersonalizado` como nombre definitivo en los intents de ventas y pedidos.

Configuracion exacta de slots:

- `ventasIntent`: `tipoConsulta` = `TIPO_CONSULTA`, `periodoGanancia` =
  `PERIODO_GANANCIA`, `diasPersonalizado` = `AMAZON.NUMBER`, `tipoMercancia` =
  `TIPO_MERCANCIA`, `nombreMercancia` = `AMAZON.SearchQuery`.
- `stockIntent`: `tipoFiltroStock` = `FILTRO_STOCK`, `nombreFiltro` =
  `AMAZON.SearchQuery`.
- `estadoIntent`: `tipoEstado` = `TIPO_ESTADO`, `periodoEstado` =
  `PERIODO_ESTADO`, `diasPersonalizado` = `AMAZON.NUMBER`.
- `AlexaTokenIntent`: `tokenAlexa` = `AMAZON.NUMBER`.

`AMAZON.SearchQuery` debe ser el unico slot presente en cada utterance donde se
utilice. Despues de crear o modificar los intents, guarda y vuelve a construir el modelo de
interaccion. Si solo se cambian los CSV locales, Alexa no recibe los cambios.

Recomendacion: reemplaza o depura los utterances actuales usando estos archivos como base. Si dejas los utterances genericos actuales, Alexa puede seguir mandando frases al intent equivocado.
