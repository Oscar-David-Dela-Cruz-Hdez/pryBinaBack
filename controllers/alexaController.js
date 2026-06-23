const Alexa = require('ask-sdk-core');
const { ExpressAdapter } = require('ask-sdk-express-adapter');

const Pedido = require('../models/Pedido');
const Producto = require('../models/Producto');
const Familia = require('../models/Familia');
const {
    createAplDocument,
    welcomePayload,
    sectionPayload,
    goodbyePayload,
    resultPayload
} = require('./alexaAplDocuments');

function supportsAPL(handlerInput) {
    const supportedInterfaces = handlerInput.requestEnvelope.context?.System?.device?.supportedInterfaces || {};
    return !!supportedInterfaces['Alexa.Presentation.APL'];
}

function addAplDirective(handlerInput, responseBuilder, datasource, token = 'panamericana-apl') {
    if (!supportsAPL(handlerInput)) return responseBuilder;

    return responseBuilder.addDirective({
        type: 'Alexa.Presentation.APL.RenderDocument',
        token,
        document: createAplDocument(datasource)
    });
}

// Normaliza el periodo para aceptar variantes como "del mes", "mensual", etc.
function normalizarPeriodo(valor) {
    if (!valor) return null;
    const v = valor.toLowerCase().trim();
    if (v.includes('día') || v.includes('dia') || v === 'hoy' || v === 'diario' || v === 'al día') return 'día';
    if (v.includes('semana') || v === 'semanal' || v === 'esta semana') return 'semana';
    if (v.includes('mes') || v === 'mensual' || v === 'este mes') return 'mes';
    if (v.includes('personalizado') || v.includes('custom')) return 'personalizado';
    return v;
}

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
        // Limpiar sesión al iniciar
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.waitingFor = null;
        sessionAttributes.savedContext = {};
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

        const speakOutput = '¡Hola! Bienvenido al asistente de Panamericana. Puedes consultar las ventas, revisar el stock o ver el estado de los pedidos. ¿Qué deseas hacer?';
        if (supportsAPL(handlerInput)) {
            const responseBuilder = handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt('Que deseas consultar hoy?');

            return addAplDirective(handlerInput, responseBuilder, welcomePayload(), 'welcome-menu')
                .getResponse();
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('¿Qué deseas consultar hoy?')
            .getResponse();
    }
};

// Manejador para volver al menu principal por voz
const NavigateHomeIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.NavigateHomeIntent';
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.waitingFor = null;
        sessionAttributes.savedContext = {};
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

        const speakOutput = 'Claro, volvemos al menu principal. Puedes consultar ventas, stock o pedidos.';
        const responseBuilder = handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('Quieres consultar ventas, stock o pedidos?')
            .withShouldEndSession(false);

        return addAplDirective(handlerInput, responseBuilder, welcomePayload(), 'welcome-menu')
            .getResponse();
    }
};

// Manejador para toques en botones APL
const AplUserEventHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'Alexa.Presentation.APL.UserEvent';
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const args = handlerInput.requestEnvelope.request.arguments || [];
        const action = args[0] || 'menu';

        let speakOutput = '';
        let datasource = welcomePayload();

        if (action === 'ventas') {
            sessionAttributes.lastIntent = 'ventasIntent';
            sessionAttributes.waitingFor = 'tipoConsultaVentas';
            sessionAttributes.savedContext = {};
            speakOutput = 'Abrimos ventas. Puedes decir ganancias del mes, ganancias del dia, o ventas de una mercancia.';
            datasource = sectionPayload('ventas');
        } else if (action === 'stock') {
            sessionAttributes.lastIntent = 'stockIntent';
            sessionAttributes.waitingFor = 'tipoFiltroStock';
            sessionAttributes.savedContext = {};
            speakOutput = 'Abrimos inventario. Puedes decir stock general, por producto, por familia o por categoria.';
            datasource = sectionPayload('stock');
        } else if (action === 'pedidos') {
            sessionAttributes.lastIntent = 'estadoIntent';
            sessionAttributes.waitingFor = 'tipoEstado';
            sessionAttributes.savedContext = {};
            speakOutput = 'Abrimos pedidos. Puedes consultar pedidos por enviar, actuales, enviados o finalizados.';
            datasource = sectionPayload('pedidos');
        } else if (action === 'ayuda') {
            speakOutput = 'Estas son algunas opciones. Puedes preguntar por ventas, stock o pedidos.';
            datasource = sectionPayload('ayuda');
        } else if (action === 'salir') {
            sessionAttributes.waitingFor = null;
            sessionAttributes.savedContext = {};
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

            const responseBuilder = handlerInput.responseBuilder
                .speak('De acuerdo, cerrando el asistente de Panamericana. Hasta luego!')
                .withShouldEndSession(true);

            return addAplDirective(handlerInput, responseBuilder, goodbyePayload(), 'goodbye-screen')
                .getResponse();
        } else {
            sessionAttributes.waitingFor = null;
            sessionAttributes.savedContext = {};
            speakOutput = 'Volvemos al menu principal. Puedes consultar ventas, stock o pedidos.';
            datasource = welcomePayload();
        }

        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        const responseBuilder = handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('Que deseas consultar?')
            .withShouldEndSession(false);

        return addAplDirective(handlerInput, responseBuilder, datasource, `${action}-screen`)
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

        const slots = handlerInput.requestEnvelope.request.intent.slots || {};
        let tipoConsulta = slots.tipoConsulta?.value?.toLowerCase() || null;
        let periodo = normalizarPeriodo(slots.periodoGanancia?.value);
        let dias = slots.diasPersonalizado?.value || null;
        let tipoMercancia = slots.tipoMercancia?.value?.toLowerCase() || null;
        let nombreMercancia = slots.nombreMercancia?.value || null;

        // Restaurar contexto guardado si veníamos de una pregunta pendiente
        const ctx = sessionAttributes.savedContext || {};
        if (sessionAttributes.waitingFor === 'periodoGanancia') {
            tipoConsulta = tipoConsulta || ctx.tipoConsulta || 'ganancia';
            if (!periodo && !dias) periodo = normalizarPeriodo(tipoMercancia || nombreMercancia);
            tipoMercancia = null;
            nombreMercancia = null;
        } else if (sessionAttributes.waitingFor === 'tipoMercancia') {
            tipoConsulta = 'mercancía';
            tipoMercancia = tipoMercancia || normalizarPeriodo(slots.periodoGanancia?.value);
            nombreMercancia = ctx.nombreMercancia || nombreMercancia;
        } else if (sessionAttributes.waitingFor === 'nombreMercancia') {
            tipoConsulta = 'mercancía';
            tipoMercancia = ctx.tipoMercancia || tipoMercancia;
        } else if (sessionAttributes.waitingFor === 'diasPersonalizadoVentas') {
            tipoConsulta = ctx.tipoConsulta || 'ganancia';
            periodo = 'personalizado';
            dias = slots.diasPersonalizado?.value || slots.tipoConsulta?.value || null;
        }

        // Limpiar estado de espera
        sessionAttributes.waitingFor = null;
        sessionAttributes.savedContext = {};

        // Deducción automática
        if (!tipoConsulta) {
            if (periodo || dias) tipoConsulta = 'ganancia';
            else if (tipoMercancia || nombreMercancia) tipoConsulta = 'mercancía';
            else {
                sessionAttributes.waitingFor = 'tipoConsultaVentas';
                handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                return handlerInput.responseBuilder
                    .speak('¿Qué deseas consultar, las ganancias o la mercancía?')
                    .reprompt('¿Deseas ver ganancias o mercancía?')
                    .withShouldEndSession(false)
                    .getResponse();
            }
        }

        if (!periodo && dias) periodo = 'personalizado';

        let speakOutput = '';

        try {
            if (tipoConsulta === 'ganancia' || tipoConsulta === 'ganancias') {
                if (!periodo) {
                    sessionAttributes.waitingFor = 'periodoGanancia';
                    sessionAttributes.savedContext = { tipoConsulta: 'ganancia' };
                    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                    return handlerInput.responseBuilder
                        .speak('¿De qué periodo? Puedes decir: del día, de la semana, del mes o personalizado.')
                        .reprompt('¿Del día, de la semana, del mes o personalizado?')
                        .withShouldEndSession(false)
                        .getResponse();
                }

                if (periodo === 'personalizado' && !dias) {
                    sessionAttributes.waitingFor = 'diasPersonalizadoVentas';
                    sessionAttributes.savedContext = { tipoConsulta: 'ganancia' };
                    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                    return handlerInput.responseBuilder
                        .speak('¿De cuántos días atrás quieres revisar las ganancias?')
                        .reprompt('¿De cuántos días?')
                        .withShouldEndSession(false)
                        .getResponse();
                }

                const rangoFechas = obtenerRangoFechas(periodo, dias);
                const textoPeriodo = periodo === 'personalizado' ? `los últimos ${dias} días` : periodo;

                const pedidos = await Pedido.find({
                    fecha: { $gte: rangoFechas.inicio, $lte: rangoFechas.fin },
                    estado: { $in: ['Pagado', 'Enviado', 'Entregado'] }
                });

                const totalGanancia = pedidos.reduce((sum, p) => sum + p.total, 0);
                speakOutput = periodo === 'personalizado'
                    ? `Las ganancias de ${textoPeriodo} fueron procesadas correctamente. Entraron ${totalGanancia} pesos. `
                    : `Las ganancias consultadas por ${textoPeriodo} fueron procesadas correctamente. Entraron ${totalGanancia} pesos. `;

            } else if (tipoConsulta === 'mercancía' || tipoConsulta === 'mercancia') {
                if (!tipoMercancia && !nombreMercancia) {
                    sessionAttributes.waitingFor = 'tipoMercancia';
                    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                    return handlerInput.responseBuilder
                        .speak('¿Sobre qué deseas consultar? producto, familia o categoría.')
                        .reprompt('¿Producto, familia o categoría?')
                        .withShouldEndSession(false)
                        .getResponse();
                }
                if (!nombreMercancia) {
                    sessionAttributes.waitingFor = 'nombreMercancia';
                    sessionAttributes.savedContext = { tipoMercancia };
                    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                    return handlerInput.responseBuilder
                        .speak('¿Cuál es el nombre exacto que buscas?')
                        .reprompt('¿Cuál es el nombre?')
                        .withShouldEndSession(false)
                        .getResponse();
                }

                let totalVendido = 0;

                if (tipoMercancia === 'producto' || !tipoMercancia) {
                    const producto = await Producto.findOne({ nombre: { $regex: nombreMercancia, $options: "i" } });
                    if (producto) {
                        const pedidos = await Pedido.find({ estado: { $in: ['Pagado', 'Enviado', 'Entregado'] }, "productos.producto": producto._id });
                        for (let ped of pedidos) {
                            for (let prod of ped.productos) {
                                if (prod.producto.toString() === producto._id.toString()) totalVendido += prod.cantidad;
                            }
                        }
                        speakOutput = `La información sobre el producto ${producto.nombre} indica que hay ${totalVendido} artículos vendidos. `;
                    } else {
                        const familia = await Familia.findOne({ nombre: { $regex: nombreMercancia, $options: "i" } });
                        if (familia) {
                            const productosFamilia = await Producto.find({ familia: familia._id });
                            const idsProductos = productosFamilia.map(p => p._id);
                            const pedidos = await Pedido.find({ estado: { $in: ['Pagado', 'Enviado', 'Entregado'] }, "productos.producto": { $in: idsProductos } });
                            for (let ped of pedidos) {
                                for (let prod of ped.productos) {
                                    if (idsProductos.some(id => id.toString() === prod.producto.toString())) totalVendido += prod.cantidad;
                                }
                            }
                            speakOutput = `La familia ${familia.nombre} tiene ${totalVendido} artículos vendidos, con buen movimiento. `;
                        } else {
                            speakOutput = `No encontré ningún producto ni categoría llamada ${nombreMercancia}. `;
                        }
                    }
                } else {
                    const familia = await Familia.findOne({ nombre: { $regex: nombreMercancia, $options: "i" } });
                    if (familia) {
                        const productosFamilia = await Producto.find({ familia: familia._id });
                        const idsProductos = productosFamilia.map(p => p._id);
                        const pedidos = await Pedido.find({ estado: { $in: ['Pagado', 'Enviado', 'Entregado'] }, "productos.producto": { $in: idsProductos } });
                        for (let ped of pedidos) {
                            for (let prod of ped.productos) {
                                if (idsProductos.some(id => id.toString() === prod.producto.toString())) totalVendido += prod.cantidad;
                            }
                        }
                        speakOutput = `La familia ${familia.nombre} tiene ${totalVendido} artículos vendidos, con buen movimiento. `;
                    } else {
                        speakOutput = `No encontré ninguna familia o categoría llamada ${nombreMercancia}. `;
                    }
                }
            }
        } catch (error) {
            console.error("Error en VentasIntent:", error);
            speakOutput = 'Hubo un error al consultar la base de datos para tus ventas. ';
        }

        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        speakOutput += '¿Deseas consultar algo más de ventas o terminamos?';
        if (supportsAPL(handlerInput)) {
            const responseBuilder = handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt('¿Deseas algo más?');

            return addAplDirective(
                handlerInput,
                responseBuilder,
                resultPayload('Ventas', speakOutput),
                'ventas-result'
            ).getResponse();
        }

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

        const slots = handlerInput.requestEnvelope.request.intent.slots || {};
        let tipoFiltro = slots.tipoFiltroStock?.value?.toLowerCase() || null;
        let nombreFiltro = slots.nombreFiltro?.value || null;

        const ctx = sessionAttributes.savedContext || {};
        if (sessionAttributes.waitingFor === 'tipoFiltroStock') {
            nombreFiltro = ctx.nombreFiltro || nombreFiltro;
        } else if (sessionAttributes.waitingFor === 'nombreFiltroStock') {
            tipoFiltro = ctx.tipoFiltro || tipoFiltro;
        }

        sessionAttributes.waitingFor = null;
        sessionAttributes.savedContext = {};

        if (!tipoFiltro) {
            if (nombreFiltro) {
                sessionAttributes.waitingFor = 'tipoFiltroStock';
                sessionAttributes.savedContext = { nombreFiltro };
                handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                return handlerInput.responseBuilder
                    .speak(`¿Deseas ver el stock de ${nombreFiltro} por producto o por familia?`)
                    .reprompt('¿Por producto o familia?')
                    .withShouldEndSession(false)
                    .getResponse();
            } else {
                sessionAttributes.waitingFor = 'tipoFiltroStock';
                handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                return handlerInput.responseBuilder
                    .speak('¿Deseas ver el stock por producto, familia, categoría o general?')
                    .reprompt('¿Por producto, familia, categoría o general?')
                    .withShouldEndSession(false)
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
                    sessionAttributes.waitingFor = 'nombreFiltroStock';
                    sessionAttributes.savedContext = { tipoFiltro };
                    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                    return handlerInput.responseBuilder
                        .speak(`¿Cuál es el nombre de la ${tipoFiltro}?`)
                        .reprompt('¿Cuál es el nombre exacto?')
                        .withShouldEndSession(false)
                        .getResponse();
                }

                if (tipoFiltro === 'producto') {
                    const producto = await Producto.findOne({ nombre: { $regex: nombreFiltro, $options: "i" } });
                    if (producto) {
                        speakOutput = `Revisando el stock del producto ${producto.nombre}, nos quedan solamente ${producto.stock} unidades. `;
                    } else {
                        speakOutput = `No se encontró el producto ${nombreFiltro}. `;
                    }
                } else {
                    const familia = await Familia.findOne({ nombre: { $regex: nombreFiltro, $options: "i" } });
                    if (familia) {
                        const productosBajos = await Producto.find({ familia: familia._id, stock: { $lt: STOCK_MINIMO } });
                        if (productosBajos.length > 0) {
                            const nombres = productosBajos.map(p => p.nombre).join(', ');
                            speakOutput = `En la familia ${familia.nombre}, detecté stock bajo en: ${nombres}. `;
                        } else {
                            speakOutput = `La familia ${familia.nombre} tiene niveles de stock normales. `;
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

        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        speakOutput += '¿Deseas revisar otro stock o terminamos?';
        if (supportsAPL(handlerInput)) {
            const responseBuilder = handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt('¿Deseas revisar algo más?');

            return addAplDirective(
                handlerInput,
                responseBuilder,
                resultPayload('Stock', speakOutput),
                'stock-result'
            ).getResponse();
        }

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

        const slots = handlerInput.requestEnvelope.request.intent.slots || {};
        let tipoEstado = slots.tipoEstado?.value?.toLowerCase() || null;
        let periodo = normalizarPeriodo(slots.periodoEstado?.value);
        let dias = slots.diasPersonalizado?.value || null;

        const ctx = sessionAttributes.savedContext || {};
        if (sessionAttributes.waitingFor === 'periodoEstado') {
            tipoEstado = ctx.tipoEstado || tipoEstado;
            if (!periodo && !dias) periodo = normalizarPeriodo(slots.tipoEstado?.value);
            tipoEstado = ctx.tipoEstado;
        } else if (sessionAttributes.waitingFor === 'diasPersonalizadoEstado') {
            tipoEstado = ctx.tipoEstado;
            periodo = 'personalizado';
            dias = slots.diasPersonalizado?.value || slots.tipoEstado?.value || null;
        }

        sessionAttributes.waitingFor = null;
        sessionAttributes.savedContext = {};

        if (!periodo && dias) periodo = 'personalizado';

        if (!tipoEstado) {
            sessionAttributes.waitingFor = 'tipoEstado';
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
            return handlerInput.responseBuilder
                .speak('¿Deseas ver los pedidos por enviar, actuales, finalizados o enviados?')
                .reprompt('¿Qué estado de pedidos te interesa?')
                .withShouldEndSession(false)
                .getResponse();
        }

        let speakOutput = '';
        try {
            if (tipoEstado === 'por enviar' || tipoEstado === 'actuales') {
                const totalPorEnviar = await Pedido.countDocuments({ estado: { $in: ['Pendiente', 'Pagado'] } });
                speakOutput = `Actualmente hay ${totalPorEnviar} pedidos por enviar registrados en el sistema. `;
            } else {
                if (!periodo) {
                    sessionAttributes.waitingFor = 'periodoEstado';
                    sessionAttributes.savedContext = { tipoEstado };
                    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                    return handlerInput.responseBuilder
                        .speak('¿De qué periodo? Puedes decir: del día, de la semana, del mes o personalizado.')
                        .reprompt('¿Del día, de la semana, del mes o personalizado?')
                        .withShouldEndSession(false)
                        .getResponse();
                }

                if (periodo === 'personalizado' && !dias) {
                    sessionAttributes.waitingFor = 'diasPersonalizadoEstado';
                    sessionAttributes.savedContext = { tipoEstado };
                    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                    return handlerInput.responseBuilder
                        .speak('¿De cuántos días quieres revisar los pedidos?')
                        .reprompt('¿De cuántos días?')
                        .withShouldEndSession(false)
                        .getResponse();
                }

                const rangoFechas = obtenerRangoFechas(periodo, dias);
                const textoPeriodo = periodo === 'personalizado' ? `${dias} días` : periodo;
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

        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        speakOutput += '¿Deseas consultar otro estado o finalizamos?';
        if (supportsAPL(handlerInput)) {
            const responseBuilder = handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt('¿Deseas consultar algo más?');

            return addAplDirective(
                handlerInput,
                responseBuilder,
                resultPayload('Pedidos', speakOutput),
                'pedidos-result'
            ).getResponse();
        }

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

        // Limpiar estado de espera siempre que se cancele
        sessionAttributes.waitingFor = null;
        sessionAttributes.savedContext = {};

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

        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        const speakOutput = 'De acuerdo, cerrando el asistente de Panamericana. ¡Hasta luego!';
        if (supportsAPL(handlerInput)) {
            const responseBuilder = handlerInput.responseBuilder
                .speak(speakOutput)
                .withShouldEndSession(true);

            return addAplDirective(handlerInput, responseBuilder, goodbyePayload(), 'goodbye-screen')
                .getResponse();
        }

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
            speakOutput = 'Para consultar ventas, puedes decir "las ganancias del mes" o pedir información de mercancía como "ventas de Barbería". ¿Qué te gustaría intentar?';
        } else if (lastIntent === 'stockIntent') {
            speakOutput = 'Para revisar el inventario, puedes pedir "stock general" o "consulta el stock de Barbería". ¿Qué deseas buscar?';
        } else if (lastIntent === 'estadoIntent') {
            speakOutput = 'Para revisar los pedidos, puedes decir "pedidos por enviar" o "pedidos enviados de este mes". ¿Qué deseas consultar?';
        }

        if (supportsAPL(handlerInput)) {
            const helpSection = lastIntent === 'ventasIntent'
                ? 'ventas'
                : lastIntent === 'stockIntent'
                    ? 'stock'
                    : lastIntent === 'estadoIntent'
                        ? 'pedidos'
                        : 'ayuda';
            const responseBuilder = handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt(speakOutput);

            return addAplDirective(handlerInput, responseBuilder, sectionPayload(helpSection), 'help-screen')
                .getResponse();
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

// 7. Manejador de Fallback (Escudo contra Amazon Music)
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const waitingFor = sessionAttributes.waitingFor;

        // Si estábamos esperando algo, recordarle al usuario qué responder
        if (waitingFor === 'periodoGanancia' || waitingFor === 'periodoEstado') {
            return handlerInput.responseBuilder
                .speak('No entendí bien el periodo. Por favor di: del día, de la semana, del mes, o personalizado.')
                .reprompt('¿Del día, de la semana, del mes o personalizado?')
                .withShouldEndSession(false)
                .getResponse();
        }
        if (waitingFor === 'diasPersonalizadoVentas' || waitingFor === 'diasPersonalizadoEstado') {
            return handlerInput.responseBuilder
                .speak('No entendí el número. Por favor dime cuántos días, por ejemplo: veinte días, o quince días.')
                .reprompt('¿De cuántos días?')
                .withShouldEndSession(false)
                .getResponse();
        }
        if (waitingFor === 'nombreMercancia' || waitingFor === 'nombreFiltroStock') {
            return handlerInput.responseBuilder
                .speak('No entendí el nombre. Por favor di el nombre completo, por ejemplo: Barbería, o Styling y Peinado.')
                .reprompt('¿Cuál es el nombre exacto?')
                .withShouldEndSession(false)
                .getResponse();
        }

        // Respuesta general si no había contexto
        const speakOutput = 'Lo siento, no tengo información sobre eso en los registros de Panamericana. Solo puedo consultar ventas, stock o pedidos. ¿Qué deseas hacer?';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('¿Deseas consultar ventas, stock o pedidos?')
            .getResponse();
    }
};

// 8. Manejador para cierre de sesion
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`Sesion finalizada: ${handlerInput.requestEnvelope.request.reason}`);
        return handlerInput.responseBuilder.getResponse();
    }
};

// 8. Manejador de Errores
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
        AplUserEventHandler,
        NavigateHomeIntentHandler,
        VentasIntentHandler,
        StockIntentHandler,
        EstadoIntentHandler,
        CancelAndStopIntentHandler,
        HelpIntentHandler,
        SessionEndedRequestHandler,
        FallbackIntentHandler
    )
    .addErrorHandlers(
        ErrorHandler
    );

const skill = skillBuilder.create();
const adapter = new ExpressAdapter(skill, true, true);

module.exports = { adapter };
