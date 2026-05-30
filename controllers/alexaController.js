const Alexa = require('ask-sdk-core');
const { ExpressAdapter } = require('ask-sdk-express-adapter');

// Importación de modelos
const Pedido = require('../models/Pedido');
const Producto = require('../models/Producto');
const Familia = require('../models/Familia');
const Marca = require('../models/Marca');

// Función de utilidad para calcular fechas
function obtenerRangoFechas(periodo, diasPersonalizados = 0) {
    const inicio = new Date();
    const fin = new Date();
    inicio.setHours(0,0,0,0);
    fin.setHours(23,59,59,999);

    if (periodo === 'semana') {
        inicio.setDate(inicio.getDate() - 7);
    } else if (periodo === 'mes') {
        inicio.setMonth(inicio.getMonth() - 1);
    } else if (periodo === 'personalizado' && diasPersonalizados) {
        inicio.setDate(inicio.getDate() - parseInt(diasPersonalizados));
    }
    return { inicio, fin };
}

// 1. Manejador para LaunchRequest
const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speakOutput = '¡Hola! Bienvenido al asistente de Panamericana. Puedes consultar las ventas, revisar el stock o ver el estado de los pedidos. ¿Qué deseas hacer?';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('¿Qué deseas consultar hoy?')
            .getResponse();
    }
};

// 2. Manejador para "ventasIntent"
const VentasIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ventasIntent';
    },
    async handle(handlerInput) {
        const slots = handlerInput.requestEnvelope.request.intent.slots;
        const tipoConsulta = slots.tipoConsulta && slots.tipoConsulta.value ? slots.tipoConsulta.value.toLowerCase() : null;
        
        let speakOutput = '';

        if (!tipoConsulta) {
            return handlerInput.responseBuilder.addDelegateDirective(handlerInput.requestEnvelope.request.intent).getResponse();
        }

        try {
            if (tipoConsulta === 'ganancia' || tipoConsulta === 'ganancias') {
                const periodo = slots.periodoGanancia && slots.periodoGanancia.value ? slots.periodoGanancia.value.toLowerCase() : null;
                if (!periodo) {
                    return handlerInput.responseBuilder.addDelegateDirective(handlerInput.requestEnvelope.request.intent).getResponse();
                }
                
                let rangoFechas;
                if (periodo === 'personalizado') {
                    const dias = slots.diasPersonalizado && slots.diasPersonalizado.value ? slots.diasPersonalizado.value : null;
                    if (!dias) {
                        return handlerInput.responseBuilder.addDelegateDirective(handlerInput.requestEnvelope.request.intent).getResponse();
                    }
                    rangoFechas = obtenerRangoFechas('personalizado', dias);
                    speakOutput = `Las ganancias de los últimos ${dias} días `;
                } else {
                    rangoFechas = obtenerRangoFechas(periodo);
                    speakOutput = `Las ganancias del periodo por ${periodo} `;
                }

                // Consulta a BD
                const pedidos = await Pedido.find({
                    fecha: { $gte: rangoFechas.inicio, $lte: rangoFechas.fin },
                    estado: { $in: ['Pagado', 'Enviado', 'Entregado'] }
                });

                const totalGanancia = pedidos.reduce((sum, p) => sum + p.total, 0);
                speakOutput += `fueron de ${totalGanancia} pesos. `;

            } else if (tipoConsulta === 'mercancía' || tipoConsulta === 'mercancia') {
                const tipoMercancia = slots.tipoMercancia && slots.tipoMercancia.value ? slots.tipoMercancia.value.toLowerCase() : null;
                const nombreMercancia = slots.nombreMercancia && slots.nombreMercancia.value ? slots.nombreMercancia.value : null;
                if (!tipoMercancia || !nombreMercancia) {
                    return handlerInput.responseBuilder.addDelegateDirective(handlerInput.requestEnvelope.request.intent).getResponse();
                }

                if (tipoMercancia === 'producto') {
                    const producto = await Producto.findOne({ nombre: { $regex: nombreMercancia, $options: "i" } });
                    if (producto) {
                        speakOutput = `El producto ${producto.nombre} tiene un stock actual de ${producto.stock} unidades a un precio normal de ${producto.precioNormal || 0} pesos. `;
                    } else {
                        speakOutput = `No encontré ningún producto llamado ${nombreMercancia}. `;
                    }
                } else {
                    // Para familia o categoría
                    const familia = await Familia.findOne({ nombre: { $regex: nombreMercancia, $options: "i" } });
                    if (familia) {
                        const totalProductos = await Producto.countDocuments({ familia: familia._id });
                        speakOutput = `En la familia ${familia.nombre} tenemos un total de ${totalProductos} productos distintos en catálogo. `;
                    } else {
                        speakOutput = `No encontré ninguna familia o categoría llamada ${nombreMercancia}. `;
                    }
                }
            } else {
                speakOutput = `No entendí el tipo de consulta para ventas. `;
            }
        } catch (error) {
            console.error("Error en VentasIntent:", error);
            speakOutput = 'Hubo un error al consultar la base de datos para tus ventas. ';
        }

        speakOutput += '¿Deseas consultar algo más de ventas o terminamos?';
        return handlerInput.responseBuilder.speak(speakOutput).reprompt('¿Deseas algo más?').getResponse();
    }
};

// 3. Manejador para "stockIntent"
const StockIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'stockIntent';
    },
    async handle(handlerInput) {
        const slots = handlerInput.requestEnvelope.request.intent.slots;
        const tipoFiltro = slots.tipoFiltroStock && slots.tipoFiltroStock.value ? slots.tipoFiltroStock.value.toLowerCase() : null;

        if (!tipoFiltro) {
            return handlerInput.responseBuilder.addDelegateDirective(handlerInput.requestEnvelope.request.intent).getResponse();
        }

        let speakOutput = '';
        try {
            const STOCK_MINIMO = 5;

            if (tipoFiltro === 'general') {
                const totalBajos = await Producto.countDocuments({ stock: { $lt: STOCK_MINIMO } });
                speakOutput = `Se han encontrado ${totalBajos} artículos con stock bajo menor a ${STOCK_MINIMO} unidades en general. `;
            } else {
                const nombreFiltro = slots.nombreFiltro && slots.nombreFiltro.value ? slots.nombreFiltro.value : null;
                if (!nombreFiltro) {
                    return handlerInput.responseBuilder.addDelegateDirective(handlerInput.requestEnvelope.request.intent).getResponse();
                }
                
                if (tipoFiltro === 'producto') {
                    const producto = await Producto.findOne({ nombre: { $regex: nombreFiltro, $options: "i" } });
                    if (producto) {
                        speakOutput = `El stock del producto ${producto.nombre} es de ${producto.stock} unidades. `;
                        if (producto.stock < STOCK_MINIMO) speakOutput += "Este es un stock considerado bajo. ";
                    } else {
                        speakOutput = `No se encontró el producto ${nombreFiltro}. `;
                    }
                } else {
                    // Familia
                    const familia = await Familia.findOne({ nombre: { $regex: nombreFiltro, $options: "i" } });
                    if (familia) {
                        const bajosFamilia = await Producto.countDocuments({ familia: familia._id, stock: { $lt: STOCK_MINIMO } });
                        speakOutput = `En la familia ${familia.nombre} hay ${bajosFamilia} productos con stock bajo. `;
                    } else {
                        speakOutput = `No se encontró la categoría ${nombreFiltro}. `;
                    }
                }
            }
        } catch (error) {
            console.error("Error en StockIntent:", error);
            speakOutput = 'Hubo un problema al consultar el inventario. ';
        }

        speakOutput += '¿Deseas revisar otro stock o terminamos?';
        return handlerInput.responseBuilder.speak(speakOutput).reprompt('¿Deseas algo más?').getResponse();
    }
};

// 4. Manejador para "estadoIntent"
const EstadoIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'estadoIntent';
    },
    async handle(handlerInput) {
        const slots = handlerInput.requestEnvelope.request.intent.slots;
        const tipoEstado = slots.tipoEstado && slots.tipoEstado.value ? slots.tipoEstado.value.toLowerCase() : null;

        if (!tipoEstado) {
            return handlerInput.responseBuilder.addDelegateDirective(handlerInput.requestEnvelope.request.intent).getResponse();
        }

        let speakOutput = '';
        try {
            if (tipoEstado === 'por enviar' || tipoEstado === 'actuales') {
                const totalPorEnviar = await Pedido.countDocuments({ estado: { $in: ['Pendiente', 'Pagado'] } });
                speakOutput = `Actualmente hay ${totalPorEnviar} pedidos listos por enviar. `;
            } else {
                const periodo = slots.periodoEstado && slots.periodoEstado.value ? slots.periodoEstado.value.toLowerCase() : null;
                if (!periodo) {
                    return handlerInput.responseBuilder.addDelegateDirective(handlerInput.requestEnvelope.request.intent).getResponse();
                }
                
                let rangoFechas;
                if (periodo === 'personalizado') {
                    const dias = slots.diasPersonalizado && slots.diasPersonalizado.value ? slots.diasPersonalizado.value : null;
                    if (!dias) {
                        return handlerInput.responseBuilder.addDelegateDirective(handlerInput.requestEnvelope.request.intent).getResponse();
                    }
                    rangoFechas = obtenerRangoFechas('personalizado', dias);
                    speakOutput = `En los últimos ${dias} días, `;
                } else {
                    rangoFechas = obtenerRangoFechas(periodo);
                    speakOutput = `En el periodo por ${periodo}, `;
                }

                // Definir qué estado buscar (Enviados o Entregados/Finalizados)
                const filtroEstado = (tipoEstado === 'enviados') ? 'Enviado' : 'Entregado';
                const totalPedidos = await Pedido.countDocuments({
                    estado: filtroEstado,
                    fecha: { $gte: rangoFechas.inicio, $lte: rangoFechas.fin }
                });

                speakOutput += `se registraron ${totalPedidos} pedidos como ${filtroEstado}s. `;
            }
        } catch (error) {
            console.error("Error en EstadoIntent:", error);
            speakOutput = 'Ocurrió un error al consultar el estado de los pedidos. ';
        }

        speakOutput += '¿Deseas consultar otro estado o finalizamos?';
        return handlerInput.responseBuilder.speak(speakOutput).reprompt('¿Deseas consultar algo más?').getResponse();
    }
};

// 5. Cancelar y Detener
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'De acuerdo, cerrando el asistente de Panamericana. ¡Hasta luego!';
        return handlerInput.responseBuilder.speak(speakOutput).withShouldEndSession(true).getResponse();
    }
};

// 6. Manejador de Errores
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`~~~~ Error manejado: ${error.stack}`);
        const speakOutput = 'Hubo un error interno al procesar la intención de Alexa. Por favor intenta de nuevo.';
        return handlerInput.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse();
    }
};

// Configurar el Skill
const skillBuilder = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        VentasIntentHandler,
        StockIntentHandler,
        EstadoIntentHandler,
        CancelAndStopIntentHandler
    )
    .addErrorHandlers(
        ErrorHandler
    );

const skill = skillBuilder.create();
const adapter = new ExpressAdapter(skill, true, true);

module.exports = { adapter };
