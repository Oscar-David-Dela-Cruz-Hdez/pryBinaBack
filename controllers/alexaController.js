const Alexa = require('ask-sdk-core');
const { ExpressAdapter } = require('ask-sdk-express-adapter');

const Pedido = require('../models/Pedido');
const Producto = require('../models/Producto');
const Familia = require('../models/Familia');

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
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.lastIntent = 'ventasIntent';
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

        const slots = handlerInput.requestEnvelope.request.intent.slots || {};
        let tipoConsulta = slots.tipoConsulta && slots.tipoConsulta.value ? slots.tipoConsulta.value.toLowerCase() : null;
        let periodo = slots.periodoGanancia && slots.periodoGanancia.value ? slots.periodoGanancia.value.toLowerCase() : null;
        let dias = slots.diasPersonalizado && slots.diasPersonalizado.value ? slots.diasPersonalizado.value : null;
        let tipoMercancia = slots.tipoMercancia && slots.tipoMercancia.value ? slots.tipoMercancia.value.toLowerCase() : null;
        let nombreMercancia = slots.nombreMercancia && slots.nombreMercancia.value ? slots.nombreMercancia.value : null;

        let speakOutput = '';

        // Deducción inteligente o ElicitSlot manual condicional
        if (!tipoConsulta) {
            if (periodo || dias) tipoConsulta = 'ganancia';
            else if (tipoMercancia || nombreMercancia) tipoConsulta = 'mercancía';
            else {
                return handlerInput.responseBuilder
                    .speak('¿Qué deseas consultar, las ganancias o la mercancía?')
                    .reprompt('¿Deseas ver ganancias o mercancía?')
                    .addElicitSlotDirective('tipoConsulta')
                    .getResponse();
            }
        }

        try {
            if (tipoConsulta === 'ganancia' || tipoConsulta === 'ganancias') {
                if (!periodo) {
                    return handlerInput.responseBuilder
                        .speak('¿De qué periodo? día, semana, mes o personalizado.')
                        .reprompt('¿De qué periodo?')
                        .addElicitSlotDirective('periodoGanancia')
                        .getResponse();
                }
                
                let rangoFechas;
                let textoPeriodo = '';
                
                if (periodo === 'personalizado') {
                    if (!dias) {
                        return handlerInput.responseBuilder
                            .speak('¿De cuántos días atrás quieres revisar las ganancias?')
                            .reprompt('¿De cuántos días?')
                            .addElicitSlotDirective('diasPersonalizado')
                            .getResponse();
                    }
                    rangoFechas = obtenerRangoFechas('personalizado', dias);
                    textoPeriodo = `los últimos ${dias} días`;
                } else {
                    rangoFechas = obtenerRangoFechas(periodo);
                    textoPeriodo = periodo;
                }

                const pedidos = await Pedido.find({
                    fecha: { $gte: rangoFechas.inicio, $lte: rangoFechas.fin },
                    estado: { $in: ['Pagado', 'Enviado', 'Entregado'] }
                });

                const totalGanancia = pedidos.reduce((sum, p) => sum + p.total, 0);
                
                if (periodo === 'personalizado') {
                    speakOutput = `Las ganancias de ${textoPeriodo} fueron procesadas correctamente. Entraron ${totalGanancia} pesos. `;
                } else {
                    speakOutput = `Las ganancias consultadas por ${textoPeriodo} fueron procesadas correctamente. Entraron ${totalGanancia} pesos. `;
                }

            } else if (tipoConsulta === 'mercancía' || tipoConsulta === 'mercancia') {
                if (!tipoMercancia && !nombreMercancia) {
                    return handlerInput.responseBuilder
                        .speak('¿Sobre qué deseas consultar? producto, familia o categoría.')
                        .reprompt('¿Producto, familia o categoría?')
                        .addElicitSlotDirective('tipoMercancia')
                        .getResponse();
                }
                if (!nombreMercancia) {
                    return handlerInput.responseBuilder
                        .speak(`¿Cuál es el nombre exacto que buscas?`)
                        .reprompt('¿Cuál es el nombre?')
                        .addElicitSlotDirective('nombreMercancia')
                        .getResponse();
                }

                let totalVendido = 0;

                if (tipoMercancia === 'producto' || !tipoMercancia) {
                    const producto = await Producto.findOne({ nombre: { $regex: nombreMercancia, $options: "i" } });
                    if (producto) {
                        const pedidos = await Pedido.find({ estado: { $in: ['Pagado', 'Enviado', 'Entregado'] }, "productos.producto": producto._id });
                        for(let ped of pedidos) {
                            for(let prod of ped.productos) {
                                if(prod.producto.toString() === producto._id.toString()) totalVendido += prod.cantidad;
                            }
                        }
                        speakOutput = `La información sobre la mercancía tipo producto con el nombre ${producto.nombre} indica que hay ${totalVendido} artículos vendidos. `;
                    } else if (!tipoMercancia) {
                        // Búsqueda comodín como familia si no encontró producto
                        const familia = await Familia.findOne({ nombre: { $regex: nombreMercancia, $options: "i" } });
                        if (familia) {
                            const productosFamilia = await Producto.find({ familia: familia._id });
                            const idsProductos = productosFamilia.map(p => p._id);
                            const pedidos = await Pedido.find({ estado: { $in: ['Pagado', 'Enviado', 'Entregado'] }, "productos.producto": { $in: idsProductos } });
                            for(let ped of pedidos) {
                                for(let prod of ped.productos) {
                                    if(idsProductos.some(id => id.toString() === prod.producto.toString())) totalVendido += prod.cantidad;
                                }
                            }
                            speakOutput = `La información sobre la mercancía tipo familia con el nombre ${familia.nombre} indica que se han vendido ${totalVendido} artículos, teniendo un buen movimiento. `;
                        } else {
                            speakOutput = `No encontré ningún producto ni categoría llamada ${nombreMercancia}. `;
                        }
                    } else {
                        speakOutput = `No encontré ningún producto llamado ${nombreMercancia}. `;
                    }
                } else {
                    const familia = await Familia.findOne({ nombre: { $regex: nombreMercancia, $options: "i" } });
                    if (familia) {
                        const productosFamilia = await Producto.find({ familia: familia._id });
                        const idsProductos = productosFamilia.map(p => p._id);
                        
                        const pedidos = await Pedido.find({ estado: { $in: ['Pagado', 'Enviado', 'Entregado'] }, "productos.producto": { $in: idsProductos } });
                        for(let ped of pedidos) {
                            for(let prod of ped.productos) {
                                if(idsProductos.some(id => id.toString() === prod.producto.toString())) totalVendido += prod.cantidad;
                            }
                        }
                        speakOutput = `La información sobre la mercancía tipo familia con el nombre ${familia.nombre} indica que se han vendido ${totalVendido} artículos, teniendo un buen movimiento. `;
                    } else {
                        speakOutput = `No encontré ninguna familia o categoría llamada ${nombreMercancia}. `;
                    }
                }
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
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.lastIntent = 'stockIntent';
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

        const slots = handlerInput.requestEnvelope.request.intent.slots || {};
        const tipoFiltro = slots.tipoFiltroStock && slots.tipoFiltroStock.value ? slots.tipoFiltroStock.value.toLowerCase() : null;
        const nombreFiltro = slots.nombreFiltro && slots.nombreFiltro.value ? slots.nombreFiltro.value : null;

        if (!tipoFiltro) {
            if (nombreFiltro) {
                return handlerInput.responseBuilder
                    .speak(`¿Deseas ver el stock de ${nombreFiltro} por producto o por familia?`)
                    .reprompt('¿Por producto o familia?')
                    .addElicitSlotDirective('tipoFiltroStock')
                    .getResponse();
            } else {
                return handlerInput.responseBuilder
                    .speak('¿Deseas ver el stock por producto, familia, categoría o general?')
                    .reprompt('¿Por producto, familia, categoría o general?')
                    .addElicitSlotDirective('tipoFiltroStock')
                    .getResponse();
            }
        }

        let speakOutput = '';
        try {
            const STOCK_MINIMO = 5;

            if (tipoFiltro === 'general') {
                const totalBajos = await Producto.countDocuments({ stock: { $lt: STOCK_MINIMO } });
                speakOutput = `Se han encontrado ${totalBajos} artículos con stock bajo a nivel general en el almacén. `;
            } else {
                if (!nombreFiltro) {
                    return handlerInput.responseBuilder
                        .speak(`¿Cuál es el nombre de la ${tipoFiltro}?`)
                        .reprompt('¿Cuál es el nombre exacto?')
                        .addElicitSlotDirective('nombreFiltro')
                        .getResponse();
                }
                
                if (tipoFiltro === 'producto') {
                    const producto = await Producto.findOne({ nombre: { $regex: nombreFiltro, $options: "i" } });
                    if (producto) {
                        speakOutput = `Revisando el stock bajo para el producto ${producto.nombre}, nos quedan solamente ${producto.stock} unidades. `;
                    } else {
                        speakOutput = `No se encontró el producto ${nombreFiltro}. `;
                    }
                } else {
                    const familia = await Familia.findOne({ nombre: { $regex: nombreFiltro, $options: "i" } });
                    if (familia) {
                        const productosBajos = await Producto.find({ familia: familia._id, stock: { $lt: STOCK_MINIMO } });
                        if (productosBajos.length > 0) {
                            const nombres = productosBajos.map(p => p.nombre).join(' y ');
                            speakOutput = `Revisando el stock bajo para la familia ${familia.nombre}, detecté que faltan ${nombres}. `;
                        } else {
                            speakOutput = `Revisando el stock para la familia ${familia.nombre}, todo parece estar en niveles normales. `;
                        }
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
        return handlerInput.responseBuilder.speak(speakOutput).reprompt('¿Deseas revisar algo más?').getResponse();
    }
};

// 4. Manejador para "estadoIntent"
const EstadoIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'estadoIntent';
    },
    async handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.lastIntent = 'estadoIntent';
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

        const slots = handlerInput.requestEnvelope.request.intent.slots || {};
        const tipoEstado = slots.tipoEstado && slots.tipoEstado.value ? slots.tipoEstado.value.toLowerCase() : null;

        if (!tipoEstado) {
            return handlerInput.responseBuilder
                .speak('¿Deseas ver los pedidos por enviar, actuales, finalizados o enviados?')
                .reprompt('¿Qué estado de pedidos te interesa?')
                .addElicitSlotDirective('tipoEstado')
                .getResponse();
        }

        let speakOutput = '';
        try {
            if (tipoEstado === 'por enviar' || tipoEstado === 'actuales') {
                const totalPorEnviar = await Pedido.countDocuments({ estado: { $in: ['Pendiente', 'Pagado'] } });
                speakOutput = `Actualmente hay ${totalPorEnviar} pedidos por enviar registrados en el sistema. `;
            } else {
                const periodo = slots.periodoEstado && slots.periodoEstado.value ? slots.periodoEstado.value.toLowerCase() : null;
                if (!periodo) {
                    return handlerInput.responseBuilder
                        .speak('¿De qué periodo? día, semana, mes o personalizado.')
                        .reprompt('¿Qué periodo deseas consultar?')
                        .addElicitSlotDirective('periodoEstado')
                        .getResponse();
                }
                
                let rangoFechas;
                let textoPeriodo;
                if (periodo === 'personalizado') {
                    const dias = slots.diasPersonalizado && slots.diasPersonalizado.value ? slots.diasPersonalizado.value : null;
                    if (!dias) {
                        return handlerInput.responseBuilder
                            .speak('¿De cuántos días quieres revisar los pedidos?')
                            .reprompt('¿De cuántos días?')
                            .addElicitSlotDirective('diasPersonalizado')
                            .getResponse();
                    }
                    rangoFechas = obtenerRangoFechas('personalizado', dias);
                    textoPeriodo = `${dias} días`;
                } else {
                    rangoFechas = obtenerRangoFechas(periodo);
                    textoPeriodo = periodo;
                }

                const filtroEstado = (tipoEstado === 'enviados') ? 'Enviado' : 'Entregado';
                const totalPedidos = await Pedido.countDocuments({
                    estado: filtroEstado,
                    fecha: { $gte: rangoFechas.inicio, $lte: rangoFechas.fin }
                });

                speakOutput = `Se encontraron ${totalPedidos} pedidos ${tipoEstado} en el periodo de ${textoPeriodo}. `;
            }
        } catch (error) {
            console.error("Error en EstadoIntent:", error);
            speakOutput = 'Ocurrió un error al consultar el estado de los pedidos. ';
        }

        speakOutput += '¿Deseas consultar otro estado o finalizamos?';
        return handlerInput.responseBuilder.speak(speakOutput).reprompt('¿Deseas consultar algo más?').getResponse();
    }
};

// 5. Cancelar Intermedio y Detener
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const lastIntent = sessionAttributes.lastIntent;

        if (intentName === 'AMAZON.CancelIntent' && lastIntent) {
            sessionAttributes.lastIntent = null;
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

            let speakOutput = '';
            if (lastIntent === 'ventasIntent') {
                speakOutput = 'Búsqueda cancelada. ¿Qué deseas consultar, ganancias o mercancía?';
            } else if (lastIntent === 'stockIntent') {
                speakOutput = 'Operación cancelada. ¿Deseas ver el stock por producto, familia, categoría o general?';
            } else if (lastIntent === 'estadoIntent') {
                speakOutput = 'Operación cancelada. ¿Deseas ver los pedidos por enviar, actuales, finalizados o enviados?';
            }

            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt(speakOutput)
                .getResponse();
        }

        const speakOutput = 'De acuerdo, cerrando el asistente de Panamericana. ¡Hasta luego!';
        return handlerInput.responseBuilder.speak(speakOutput).withShouldEndSession(true).getResponse();
    }
};

// 6. Manejador de Ayuda (Contextual)
const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const lastIntent = sessionAttributes.lastIntent;
        
        let speakOutput = 'Puedes preguntarme por las ventas de algún producto, revisar el stock disponible o consultar el estado de los pedidos. ¿En qué te puedo ayudar?';

        if (lastIntent === 'ventasIntent') {
            speakOutput = 'Para consultar ventas, puedes decir "las ganancias del mes" o pedir información de mercancía como "ventas de lapiceros". ¿Qué te gustaría intentar?';
        } else if (lastIntent === 'stockIntent') {
            speakOutput = 'Para revisar el inventario, puedes pedir "stock general", "stock del producto cajas" o "stock de la familia electrónica". ¿Qué deseas buscar?';
        } else if (lastIntent === 'estadoIntent') {
            speakOutput = 'Para revisar los pedidos, puedes decir "pedidos por enviar" o "pedidos enviados de la semana". ¿Qué deseas consultar?';
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

// 7. Manejador de Errores
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
        CancelAndStopIntentHandler,
        HelpIntentHandler
    )
    .addErrorHandlers(
        ErrorHandler
    );

const skill = skillBuilder.create();
const adapter = new ExpressAdapter(skill, true, true);

module.exports = { adapter };
