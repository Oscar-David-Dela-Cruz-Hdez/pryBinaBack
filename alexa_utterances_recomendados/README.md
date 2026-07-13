# Utterances recomendados para Panamericana

Estos archivos simplifican el modelo de interaccion para evitar que Alexa confunda ventas, inventario, pedidos, ayuda, menu y salida.

Cambios principales:

- Evitar frases demasiado cortas como `{tipoConsulta}`, `{periodoGanancia}`, `de {periodoEstado}` o `el {tipoFiltroStock}`.
- Usar frases completas y explicitas para cada intent.
- Usar "inventario" en pantalla y en voz, aunque internamente el intent siga llamandose `stockIntent`.
- Agregar frases claras para menu principal, ayuda, cancelar y salir.
- Corregir el slot `diasPersonalizados` a `diasPersonalizado`.
- Crear un intent personalizado llamado `SalirIntent` con los utterances de
  `SalirIntent-utterances.csv`. El backend acepta tanto este intent como
  `AMAZON.StopIntent`, lo que evita depender de una sola interpretacion de la
  palabra "salir" en espanol de Mexico.

Para los rangos personalizados, el backend acepta temporalmente ambos nombres
de slot: `diasPersonalizado` y `diasPersonalizados`. Conviene conservar
`diasPersonalizado` como nombre definitivo en los intents de ventas y pedidos.

No repitas las frases de `SalirIntent` dentro de `AMAZON.StopIntent`. Despues de
crear o modificar los intents, guarda y vuelve a construir el modelo de
interaccion. Si solo se cambian los CSV locales, Alexa no recibe los cambios.

Recomendacion: reemplaza o depura los utterances actuales usando estos archivos como base. Si dejas los utterances genericos actuales, Alexa puede seguir mandando frases al intent equivocado.
