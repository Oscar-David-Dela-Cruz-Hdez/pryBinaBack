# Utterances recomendados para Panamericana

Estos archivos simplifican el modelo de interaccion para evitar que Alexa confunda ventas, inventario, pedidos, ayuda, menu y salida.

Cambios principales:

- Evitar frases demasiado cortas como `{tipoConsulta}`, `{periodoGanancia}`, `de {periodoEstado}` o `el {tipoFiltroStock}`.
- Usar frases completas y explicitas para cada intent.
- Usar "inventario" en pantalla y en voz, aunque internamente el intent siga llamandose `stockIntent`.
- Agregar frases claras para menu principal, ayuda, cancelar y salir.
- Corregir el slot `diasPersonalizados` a `diasPersonalizado`.

Recomendacion: reemplaza o depura los utterances actuales usando estos archivos como base. Si dejas los utterances genericos actuales, Alexa puede seguir mandando frases al intent equivocado.
