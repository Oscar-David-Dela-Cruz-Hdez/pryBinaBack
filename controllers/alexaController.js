const Alexa = require('ask-sdk-core');
const { ExpressAdapter } = require('ask-sdk-express-adapter');
// const Producto = require('../models/producto'); // Simulación: importar los modelos que necesites luego
// const Venta = require('../models/venta');

// 1. Manejador para cuando el usuario dice: "Alexa, abre Asistente Panamericana"
const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speakOutput = '¡Hola! Bienvenido al asistente de Panamericana. Puedes consultar las ventas, revisar el stock o ver el estado de los pedidos. ¿Qué deseas hacer?';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('¿Qué deseas consultar hoy?') // Reprompt mantiene el micrófono abierto si no responde
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
            // Delega a Alexa para que pida el tipoConsulta
            return handlerInput.responseBuilder
                .addDelegateDirective(handlerInput.requestEnvelope.request.intent)
                .getResponse();
        }

        if (tipoConsulta === 'ganancia' || tipoConsulta === 'ganancias') {
            const periodo = slots.periodoGanancia && slots.periodoGanancia.value ? slots.periodoGanancia.value : null;
            if (!periodo) {
                return handlerInput.responseBuilder.addDelegateDirective(handlerInput.requestEnvelope.request.intent).getResponse();
            }
            
            if (periodo === 'personalizado') {
                const diasPersonalizado = slots.diasPersonalizado && slots.diasPersonalizado.value ? slots.diasPersonalizado.value : null;
                if (!diasPersonalizado) {
                    return handlerInput.responseBuilder.addDelegateDirective(handlerInput.requestEnvelope.request.intent).getResponse();
                }
                // AQUÍ: Llamar a la BD (Simulado)
                speakOutput = `Las ganancias consultadas de los últimos ${diasPersonalizado} días fueron procesadas correctamente. `;
            } else {
                // AQUÍ: Llamar a la BD (Simulado)
                speakOutput = `Las ganancias consultadas por ${periodo} fueron procesadas correctamente. `;
            }
        } else if (tipoConsulta === 'mercancía' || tipoConsulta === 'mercancia') {
            const tipoMercancia = slots.tipoMercancia && slots.tipoMercancia.value ? slots.tipoMercancia.value : null;
            const nombreMercancia = slots.nombreMercancia && slots.nombreMercancia.value ? slots.nombreMercancia.value : null;
            if (!tipoMercancia || !nombreMercancia) {
                return handlerInput.responseBuilder.addDelegateDirective(handlerInput.requestEnvelope.request.intent).getResponse();
            }
            // AQUÍ: Llamar a la BD para obtener información de la mercancía (Simulado)
            speakOutput = `La información sobre la mercancía tipo ${tipoMercancia} con el nombre ${nombreMercancia} indica que hay artículos disponibles. `;
        } else {
            speakOutput = `No entendí el tipo de consulta para ventas. `;
        }

        speakOutput += '¿Deseas consultar algo más de ventas o terminamos?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('¿Deseas algo más?')
            .getResponse(); // No usamos withShouldEndSession(true) para mantener el ciclo abierto (morado)
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
        if (tipoFiltro === 'general') {
            // Simular consulta a BD de stock general bajo
            speakOutput = 'Se han encontrado 5 artículos con stock bajo a nivel general. ';
        } else {
            const nombreFiltro = slots.nombreFiltro && slots.nombreFiltro.value ? slots.nombreFiltro.value : null;
            if (!nombreFiltro) {
                return handlerInput.responseBuilder.addDelegateDirective(handlerInput.requestEnvelope.request.intent).getResponse();
            }
            // Simular consulta filtrada
            speakOutput = `Revisando el stock bajo para ${tipoFiltro} llamado ${nombreFiltro}, se encontraron algunas incidencias. `;
        }

        speakOutput += '¿Deseas revisar otro stock o terminamos?';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('¿Deseas algo más?')
            .getResponse();
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
        if (tipoEstado === 'por enviar' || tipoEstado === 'actuales') {
            // Consulta directa
            speakOutput = `Actualmente hay 3 pedidos ${tipoEstado} registrados en el sistema. `;
        } else {
            // Finalizados o enviados (requieren periodo)
            const periodo = slots.periodoEstado && slots.periodoEstado.value ? slots.periodoEstado.value : null;
            if (!periodo) {
                return handlerInput.responseBuilder.addDelegateDirective(handlerInput.requestEnvelope.request.intent).getResponse();
            }
            
            if (periodo === 'personalizado') {
                const diasPersonalizado = slots.diasPersonalizado && slots.diasPersonalizado.value ? slots.diasPersonalizado.value : null;
                if (!diasPersonalizado) {
                    return handlerInput.responseBuilder.addDelegateDirective(handlerInput.requestEnvelope.request.intent).getResponse();
                }
                speakOutput = `Se encontraron varios pedidos ${tipoEstado} en los últimos ${diasPersonalizado} días. `;
            } else {
                speakOutput = `Se encontraron varios pedidos ${tipoEstado} en el periodo de ${periodo}. `;
            }
        }

        speakOutput += '¿Deseas consultar otro estado o finalizamos?';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('¿Deseas consultar algo más?')
            .getResponse();
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
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .withShouldEndSession(true)
            .getResponse();
    }
};

// 6. Manejador de Errores (Por si algo falla)
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`~~~~ Error manejado: ${error.stack}`);
        const speakOutput = 'Hubo un error al conectar con la base de datos de Panamericana. Por favor intenta de nuevo.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

// Configurar el Skill de Alexa
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
