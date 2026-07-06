const Alexa = require('ask-sdk-core');
const { ExpressAdapter } = require('ask-sdk-express-adapter');

const Pedido = require('../models/Pedido');
const Producto = require('../models/Producto');
const Familia = require('../models/Familia');
const Marca = require('../models/Marca');
const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');
const {
    createAplDocument,
    welcomePayload,
    menuPayload,
    sectionPayload,
    goodbyePayload,
    resultPayload,
    promptPayload,
    productListPayload
} = require('./alexaAplDocuments');

function supportsAPL(handlerInput) {
    const supportedInterfaces = handlerInput.requestEnvelope.context?.System?.device?.supportedInterfaces || {};
    const viewports = handlerInput.requestEnvelope.context?.Viewports || [];
    const hasAplViewport = viewports.some((viewport) => viewport.type === 'APL');
    return !!supportedInterfaces['Alexa.Presentation.APL'] || hasAplViewport;
}

function addAplDirective(handlerInput, responseBuilder, datasource, token = 'panamericana-apl') {
    if (!supportsAPL(handlerInput)) return responseBuilder;

    return responseBuilder.addDirective({
        type: 'Alexa.Presentation.APL.RenderDocument',
        token,
        document: createAplDocument(datasource)
    });
}

function normalizeAplAction(args) {
    const firstArg = args[0];
    if (typeof firstArg === 'string') return firstArg;
    if (firstArg?.token) return firstArg.token;
    if (firstArg?.listItem?.token) return firstArg.listItem.token;
    if (typeof args[1] === 'string') return args[1];
    return 'menu';
}

function responseWithApl(handlerInput, speakOutput, datasource, token, reprompt = 'Que deseas consultar?') {
    const responseBuilder = handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(reprompt)
        .withShouldEndSession(false);

    return addAplDirective(handlerInput, responseBuilder, datasource, token).getResponse();
}

function limpiarTokenAlexa(valor = '') {
    return String(valor).replace(/\D/g, '');
}

function extraerTokenAlexa(handlerInput) {
    const request = handlerInput.requestEnvelope.request || {};
    const slots = request.intent?.slots || {};
    const valores = Object.values(slots)
        .map((slot) => slot?.value)
        .filter(Boolean);

    if (request.intent?.name === 'AMAZON.FallbackIntent' && request.intent?.query) {
        valores.push(request.intent.query);
    }

    return limpiarTokenAlexa(valores.join(' '));
}

function respuestaSolicitarToken(handlerInput, mensaje = 'Bienvenido al asistente de Panamericana. Para continuar, dime tu token de administrador de cinco digitos.') {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    sessionAttributes.alexaAuthenticated = false;
    sessionAttributes.waitingFor = 'alexaToken';
    sessionAttributes.savedContext = {};
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    return responseWithApl(
        handlerInput,
        mensaje,
        promptPayload('Acceso administrador', mensaje, 'Di el token de 5 digitos generado en el panel.', 'Di tu token de administrador.'),
        'alexa-token',
        'Dime tu token de administrador de cinco digitos.'
    );
}

async function validarTokenAlexa(tokenPlano) {
    if (!tokenPlano || tokenPlano.length !== 5) return null;

    const admins = await Usuario.find({
        rol: 'admin',
        alexaTokenHash: { $exists: true, $ne: null }
    }).select('nombre email alexaTokenHash');

    for (const admin of admins) {
        if (await bcrypt.compare(tokenPlano, admin.alexaTokenHash)) {
            return admin;
        }
    }

    return null;
}

function sesionAlexaAutorizada(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    return sessionAttributes.alexaAuthenticated === true;
}

// Normaliza el periodo para aceptar variantes como "del mes", "mensual", etc.
function normalizarPeriodo(valor) {
    if (!valor) return null;
    const v = valor.toLowerCase().trim();
    if (v.includes('dia') || v.includes('día') || v === 'hoy' || v === 'diario' || v === 'al dia' || v === 'al día') return 'dia';
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

function textoPeriodoApl(periodo) {
    if (periodo === 'dia' || periodo === 'día') return 'de hoy';
    if (periodo === 'semana') return 'de la ultima semana';
    if (periodo === 'mes') return 'del ultimo mes';
    return `de los ultimos ${periodo} dias`;
}

async function consultarGanancias(periodo, dias = null) {
    const rangoFechas = obtenerRangoFechas(periodo, dias);
    const pedidos = await Pedido.find({
        fecha: { $gte: rangoFechas.inicio, $lte: rangoFechas.fin },
        estado: { $in: ['Pagado', 'Enviado', 'Entregado'] }
    });
    return pedidos.reduce((sum, pedido) => sum + pedido.total, 0);
}

async function consultarPedidosPorEstado(tipoEstado, periodo, dias = null) {
    const rangoFechas = obtenerRangoFechas(periodo, dias);
    return Pedido.countDocuments({
        estado: tipoEstado,
        fecha: { $gte: rangoFechas.inicio, $lte: rangoFechas.fin }
    });
}

function escaparRegex(valor) {
    return valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function filtroNombreExacto(nombre) {
    return { $regex: `^${escaparRegex(nombre.trim())}$`, $options: 'i' };
}

async function inferirTipoFiltroStock(nombreFiltro) {
    const nombre = nombreFiltro?.trim();
    if (!nombre) return null;

    const productoExacto = await Producto.findOne({ nombre: filtroNombreExacto(nombre) });
    if (productoExacto) return 'producto';

    const marcaExacta = await Marca.findOne({ nombre: filtroNombreExacto(nombre) });
    if (marcaExacta) return 'marca';

    const familiaExacta = await Familia.findOne({ nombre: filtroNombreExacto(nombre) });
    if (familiaExacta) return 'familia';

    const productoParcial = await Producto.findOne({ nombre: { $regex: escaparRegex(nombre), $options: 'i' } });
    if (productoParcial) return 'producto';

    const marcaParcial = await Marca.findOne({ nombre: { $regex: escaparRegex(nombre), $options: 'i' } });
    if (marcaParcial) return 'marca';

    const familiaParcial = await Familia.findOne({ nombre: { $regex: escaparRegex(nombre), $options: 'i' } });
    if (familiaParcial) return 'familia';

    return null;
}

// 1. Manejador para LaunchRequest
const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.alexaAuthenticated = false;
        sessionAttributes.waitingFor = 'alexaToken';
        sessionAttributes.savedContext = {};
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

        return respuestaSolicitarToken(handlerInput);
    }
};

const AlexaTokenIntentHandler = {
    canHandle(handlerInput) {
        const requestType = Alexa.getRequestType(handlerInput.requestEnvelope);
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        return requestType === 'IntentRequest'
            && (sessionAttributes.waitingFor === 'alexaToken' || sessionAttributes.alexaAuthenticated !== true);
    },
    async handle(handlerInput) {
        const tokenAlexa = extraerTokenAlexa(handlerInput);

        try {
            const admin = await validarTokenAlexa(tokenAlexa);
            if (!admin) {
                return respuestaSolicitarToken(handlerInput, 'Token no valido. Por favor dime el token de administrador de cinco digitos.');
            }

            const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
            sessionAttributes.alexaAuthenticated = true;
            sessionAttributes.alexaAdminId = admin._id.toString();
            sessionAttributes.waitingFor = null;
            sessionAttributes.savedContext = {};
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

            const speakOutput = `Acceso autorizado. Hola ${admin.nombre}. Puedes consultar ventas, stock o pedidos. Que deseas hacer?`;
            const responseBuilder = handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt('Quieres consultar ventas, stock o pedidos?')
                .withShouldEndSession(false);

            return addAplDirective(handlerInput, responseBuilder, welcomePayload(), 'welcome-menu')
                .getResponse();
        } catch (error) {
            console.error('Error al validar token de Alexa:', error);
            return respuestaSolicitarToken(handlerInput, 'No pude validar el token en este momento. Intenta decirlo nuevamente.');
        }
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

        return addAplDirective(handlerInput, responseBuilder, menuPayload(), 'main-menu')
            .getResponse();
    }
};

// Manejador para toques en botones APL
const AplUserEventHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'Alexa.Presentation.APL.UserEvent';
    },
    async handle(handlerInput) {
        if (!sesionAlexaAutorizada(handlerInput)) {
            return respuestaSolicitarToken(handlerInput);
        }

        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const args = handlerInput.requestEnvelope.request.arguments || [];
        const action = normalizeAplAction(args);

        let speakOutput = '';
        let datasource = menuPayload();

        try {
            if (action === 'ventas') {
                sessionAttributes.lastIntent = 'ventasIntent';
                sessionAttributes.waitingFor = 'tipoConsultaVentas';
                sessionAttributes.savedContext = {};
                speakOutput = 'Abrimos ventas. Puedes elegir ganancias por dia, semana, mes o personalizado.';
                datasource = sectionPayload('ventas');
            } else if (action === 'stock') {
                sessionAttributes.lastIntent = 'stockIntent';
                sessionAttributes.waitingFor = 'tipoFiltroStock';
                sessionAttributes.savedContext = {};
                speakOutput = 'Abrimos inventario. Puedes elegir general, producto, marca o familia.';
                datasource = sectionPayload('stock');
            } else if (action === 'pedidos') {
                sessionAttributes.lastIntent = 'estadoIntent';
                sessionAttributes.waitingFor = 'tipoEstado';
                sessionAttributes.savedContext = {};
                speakOutput = 'Abrimos pedidos. Puedes consultar por enviar, enviados o finalizados.';
                datasource = sectionPayload('pedidos');
            } else if (action === 'ayuda') {
                speakOutput = 'Estas son algunas opciones. Puedes preguntar por ventas, stock o pedidos.';
                datasource = sectionPayload('ayuda');
            } else if (action === 'noop') {
                speakOutput = 'Responde con una frase como: de hace quince dias, o hace cien dias.';
                datasource = promptPayload('Rango personalizado', speakOutput, 'Usa una frase compatible con tus utterances.');
            } else if (action.startsWith('stock_detalle:')) {
                const productId = action.replace('stock_detalle:', '');
                const producto = await Producto.findById(productId).populate('marca');

                sessionAttributes.lastIntent = 'stockIntent';
                sessionAttributes.waitingFor = null;
                sessionAttributes.savedContext = {};

                if (producto) {
                    speakOutput = `El producto ${producto.nombre} tiene ${producto.stock} unidades disponibles.`;
                    datasource = productListPayload('Detalle de stock', speakOutput, [producto], 'Toca menu principal o pide otro stock.');
                } else {
                    speakOutput = 'No pude encontrar el producto seleccionado.';
                    datasource = resultPayload('Producto no encontrado', speakOutput, 'Puedes volver al menu principal.');
                }
            } else if (action.startsWith('ventas_ganancias_') && action !== 'ventas_ganancias_personalizado') {
                const periodo = action.replace('ventas_ganancias_', '');
                const totalGanancia = await consultarGanancias(periodo);
                speakOutput = `Las ganancias ${textoPeriodoApl(periodo)} fueron ${totalGanancia} pesos.`;
                sessionAttributes.lastIntent = 'ventasIntent';
                sessionAttributes.waitingFor = null;
                sessionAttributes.savedContext = {};
                datasource = resultPayload('Ventas', speakOutput, 'Puedes tocar otra opcion o volver al menu.');
            } else if (action === 'ventas_ganancias_personalizado') {
                sessionAttributes.lastIntent = 'ventasIntent';
                sessionAttributes.waitingFor = 'diasPersonalizadoVentas';
                sessionAttributes.savedContext = { tipoConsulta: 'ganancia' };
                speakOutput = 'Claro, dime el rango con una frase como: de hace quince dias, o hace cien dias.';
                datasource = promptPayload(
                    'Rango personalizado',
                    speakOutput,
                    'Usa: de hace 15 dias, o hace cien dias.',
                    'Di: de hace 15 dias, o hace cien dias.'
                );
            } else if (action === 'stock_general') {
                const STOCK_MINIMO = 5;
                const productosBajos = await Producto.find({ stock: { $lt: STOCK_MINIMO } })
                    .populate('marca')
                    .sort({ stock: 1, nombre: 1 })
                    .limit(12);
                const totalBajos = await Producto.countDocuments({ stock: { $lt: STOCK_MINIMO } });
                sessionAttributes.lastIntent = 'stockIntent';
                sessionAttributes.waitingFor = null;
                sessionAttributes.savedContext = {};
                speakOutput = `Se encontraron ${totalBajos} productos con stock bajo en el almacen.`;
                datasource = productosBajos.length > 0
                    ? productListPayload('Stock bajo', speakOutput, productosBajos, 'Lista paginada con los primeros productos criticos.')
                    : resultPayload('Stock general', speakOutput, 'Puedes tocar otra opcion o volver al menu.');
            } else if (action === 'stock_producto' || action === 'stock_familia' || action === 'stock_marca') {
                const tipoFiltro = action.replace('stock_', '');
                sessionAttributes.lastIntent = 'stockIntent';
                sessionAttributes.waitingFor = 'nombreFiltroStock';
                sessionAttributes.savedContext = { tipoFiltro };
                speakOutput = `Dime el nombre ${tipoFiltro === 'producto' ? 'del' : 'de la'} ${tipoFiltro} que quieres revisar.`;
                datasource = promptPayload(
                    `Stock por ${tipoFiltro}`,
                    speakOutput,
                    `Di una frase como: consulta el stock de ${tipoFiltro === 'producto' ? '4x4 Pomada azul 100g' : tipoFiltro === 'familia' ? 'Barberia' : 'Andis'}.`,
                    `Di: consulta el stock de ${tipoFiltro === 'familia' ? 'Barberia' : tipoFiltro === 'marca' ? 'Andis' : '4x4 Pomada azul 100g'}.`
                );
            } else if (action === 'pedidos_por_enviar') {
                const totalPorEnviar = await Pedido.countDocuments({ estado: { $in: ['Pendiente', 'Pagado'] } });
                sessionAttributes.lastIntent = 'estadoIntent';
                sessionAttributes.waitingFor = null;
                sessionAttributes.savedContext = {};
                speakOutput = `Actualmente hay ${totalPorEnviar} pedidos por enviar registrados en el sistema.`;
                datasource = resultPayload('Pedidos por enviar', speakOutput, 'Puedes tocar otra opcion o volver al menu.');
            } else if (action === 'pedidos_enviados') {
                sessionAttributes.lastIntent = 'estadoIntent';
                sessionAttributes.waitingFor = null;
                sessionAttributes.savedContext = {};
                speakOutput = 'Selecciona el rango para consultar pedidos enviados.';
                datasource = sectionPayload('pedidosEnviados');
            } else if (action === 'pedidos_finalizados') {
                sessionAttributes.lastIntent = 'estadoIntent';
                sessionAttributes.waitingFor = null;
                sessionAttributes.savedContext = {};
                speakOutput = 'Selecciona el rango para consultar pedidos finalizados.';
                datasource = sectionPayload('pedidosFinalizados');
            } else if (action.startsWith('pedidos_enviados_') && action !== 'pedidos_enviados_personalizado') {
                const periodo = action.replace('pedidos_enviados_', '');
                const totalPedidos = await consultarPedidosPorEstado('Enviado', periodo);
                sessionAttributes.lastIntent = 'estadoIntent';
                sessionAttributes.waitingFor = null;
                sessionAttributes.savedContext = {};
                speakOutput = `Se encontraron ${totalPedidos} pedidos enviados ${textoPeriodoApl(periodo)}.`;
                datasource = resultPayload('Pedidos enviados', speakOutput, 'Puedes tocar otra opcion o volver al menu.');
            } else if (action.startsWith('pedidos_finalizados_') && action !== 'pedidos_finalizados_personalizado') {
                const periodo = action.replace('pedidos_finalizados_', '');
                const totalPedidos = await consultarPedidosPorEstado('Entregado', periodo);
                sessionAttributes.lastIntent = 'estadoIntent';
                sessionAttributes.waitingFor = null;
                sessionAttributes.savedContext = {};
                speakOutput = `Se encontraron ${totalPedidos} pedidos finalizados ${textoPeriodoApl(periodo)}.`;
                datasource = resultPayload('Pedidos finalizados', speakOutput, 'Puedes tocar otra opcion o volver al menu.');
            } else if (action === 'pedidos_enviados_personalizado' || action === 'pedidos_finalizados_personalizado') {
                const tipoEstado = action === 'pedidos_enviados_personalizado' ? 'enviados' : 'finalizados';
                sessionAttributes.lastIntent = 'estadoIntent';
                sessionAttributes.waitingFor = 'diasPersonalizadoEstado';
                sessionAttributes.savedContext = { tipoEstado };
                speakOutput = `Dime una frase como: dime los pedidos ${tipoEstado} de hace quince dias.`;
                datasource = promptPayload(
                    'Rango personalizado',
                    speakOutput,
                    `Usa: pedidos ${tipoEstado} de hace 15 dias.`,
                    `Di: pedidos ${tipoEstado} de hace 15 dias.`
                );
            } else if (action === 'menu') {
                sessionAttributes.waitingFor = null;
                sessionAttributes.savedContext = {};
                speakOutput = 'Este es el menu principal. Puedes consultar ventas, stock, pedidos, ayuda o salir.';
                datasource = menuPayload();
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
                datasource = menuPayload();
            }
        } catch (error) {
            console.error('Error en APL UserEvent:', error);
            sessionAttributes.waitingFor = null;
            sessionAttributes.savedContext = {};
            speakOutput = 'Hubo un problema al consultar la informacion. Intenta de nuevo.';
            datasource = resultPayload('Consulta no disponible', speakOutput, 'Puedes volver al menu principal.');
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

// Version anterior preservada como referencia, ya no se registra.
const LegacyAplUserEventHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'Alexa.Presentation.APL.UserEvent';
    },
    async handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const args = handlerInput.requestEnvelope.request.arguments || [];
        const action = args[0] || 'menu';

        let speakOutput = '';
        let datasource = menuPayload();

        try {
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
        } else if (action === 'ventas_ganancias_mes' || action === 'ventas_ganancias_dia') {
            const periodo = action === 'ventas_ganancias_mes' ? 'mes' : 'dÃ­a';
            const rangoFechas = obtenerRangoFechas(periodo);
            const pedidos = await Pedido.find({
                fecha: { $gte: rangoFechas.inicio, $lte: rangoFechas.fin },
                estado: { $in: ['Pagado', 'Enviado', 'Entregado'] }
            });
            const totalGanancia = pedidos.reduce((sum, pedido) => sum + pedido.total, 0);
            const textoPeriodo = action === 'ventas_ganancias_mes' ? 'del ultimo mes' : 'de hoy';
            sessionAttributes.lastIntent = 'ventasIntent';
            sessionAttributes.waitingFor = null;
            sessionAttributes.savedContext = {};
            speakOutput = `Las ganancias ${textoPeriodo} fueron ${totalGanancia} pesos.`;
            datasource = resultPayload('Ventas', speakOutput, 'Puedes tocar otra opcion o volver al menu.');
        } else if (action === 'stock_general') {
            const STOCK_MINIMO = 5;
            const totalBajos = await Producto.countDocuments({ stock: { $lt: STOCK_MINIMO } });
            sessionAttributes.lastIntent = 'stockIntent';
            sessionAttributes.waitingFor = null;
            sessionAttributes.savedContext = {};
            speakOutput = `Se encontraron ${totalBajos} productos con stock bajo en el almacen.`;
            datasource = resultPayload('Stock general', speakOutput, 'Puedes tocar otra opcion o volver al menu.');
        } else if (action === 'stock_bajos') {
            const STOCK_MINIMO = 5;
            const productosBajos = await Producto.find({ stock: { $lt: STOCK_MINIMO } }).limit(5);
            const nombres = productosBajos.map((producto) => producto.nombre).join(', ');
            sessionAttributes.lastIntent = 'stockIntent';
            sessionAttributes.waitingFor = null;
            sessionAttributes.savedContext = {};
            speakOutput = productosBajos.length > 0
                ? `Los primeros productos con stock bajo son: ${nombres}.`
                : 'No se encontraron productos con stock bajo.';
            datasource = resultPayload('Productos bajos', speakOutput, 'Puedes tocar otra opcion o volver al menu.');
        } else if (action === 'pedidos_por_enviar') {
            const totalPorEnviar = await Pedido.countDocuments({ estado: { $in: ['Pendiente', 'Pagado'] } });
            sessionAttributes.lastIntent = 'estadoIntent';
            sessionAttributes.waitingFor = null;
            sessionAttributes.savedContext = {};
            speakOutput = `Actualmente hay ${totalPorEnviar} pedidos por enviar registrados en el sistema.`;
            datasource = resultPayload('Pedidos por enviar', speakOutput, 'Puedes tocar otra opcion o volver al menu.');
        } else if (action === 'pedidos_enviados_mes') {
            const rangoFechas = obtenerRangoFechas('mes');
            const totalPedidos = await Pedido.countDocuments({
                estado: 'Enviado',
                fecha: { $gte: rangoFechas.inicio, $lte: rangoFechas.fin }
            });
            sessionAttributes.lastIntent = 'estadoIntent';
            sessionAttributes.waitingFor = null;
            sessionAttributes.savedContext = {};
            speakOutput = `Se encontraron ${totalPedidos} pedidos enviados en el ultimo mes.`;
            datasource = resultPayload('Enviados del mes', speakOutput, 'Puedes tocar otra opcion o volver al menu.');
        } else if (action === 'menu') {
            sessionAttributes.waitingFor = null;
            sessionAttributes.savedContext = {};
            speakOutput = 'Este es el menu principal. Puedes consultar ventas, stock, pedidos, ayuda o salir.';
            datasource = menuPayload();
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
            datasource = menuPayload();
        }
        } catch (error) {
            console.error('Error en APL UserEvent:', error);
            sessionAttributes.waitingFor = null;
            sessionAttributes.savedContext = {};
            speakOutput = 'Hubo un problema al consultar la informacion. Intenta de nuevo.';
            datasource = resultPayload('Consulta no disponible', speakOutput, 'Puedes volver al menu principal.');
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
                return responseWithApl(
                    handlerInput,
                    '¿Qué deseas consultar, las ganancias o la mercancía?',
                    sectionPayload('ventas'),
                    'ventas-options',
                    '¿Deseas ver ganancias por día, semana, mes o personalizado?'
                );
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
                    return responseWithApl(
                        handlerInput,
                        '¿De qué periodo? Puedes decir: del día, de la semana, del mes o personalizado.',
                        sectionPayload('ventas'),
                        'ventas-periodo',
                        '¿Del día, de la semana, del mes o personalizado?'
                    );
                }

                if (periodo === 'personalizado' && !dias) {
                    sessionAttributes.waitingFor = 'diasPersonalizadoVentas';
                    sessionAttributes.savedContext = { tipoConsulta: 'ganancia' };
                    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                    return responseWithApl(
                        handlerInput,
                        '¿De cuántos días atrás quieres revisar las ganancias?',
                        promptPayload(
                            'Rango personalizado',
                            'Di una frase como: dime las ganancias de hace 15 días.',
                            'Usa un número de días para completar la consulta.',
                            'Di: dime las ganancias de hace 15 días.'
                        ),
                        'ventas-personalizado',
                        '¿De cuántos días?'
                    );
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
                    return responseWithApl(
                        handlerInput,
                        '¿Sobre qué deseas consultar? producto, familia o categoría.',
                        promptPayload(
                            'Ventas por mercancía',
                            'Elige si quieres consultar producto, familia o categoría.',
                            'También puedes decir: checa las ventas de Barbería.',
                            'Di: producto, familia o categoría.'
                        ),
                        'ventas-mercancia-tipo',
                        '¿Producto, familia o categoría?'
                    );
                }
                if (!nombreMercancia) {
                    sessionAttributes.waitingFor = 'nombreMercancia';
                    sessionAttributes.savedContext = { tipoMercancia };
                    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                    return responseWithApl(
                        handlerInput,
                        '¿Cuál es el nombre exacto que buscas?',
                        promptPayload(
                            'Nombre de mercancía',
                            'Di el producto, familia o categoría que quieres revisar.',
                            'Ejemplo: checa las ventas de Barbería.',
                            'Di: checa las ventas de Barbería.'
                        ),
                        'ventas-mercancia-nombre',
                        '¿Cuál es el nombre?'
                    );
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
                tipoFiltro = await inferirTipoFiltroStock(nombreFiltro);
            }

            if (!tipoFiltro && nombreFiltro) {
                sessionAttributes.waitingFor = 'tipoFiltroStock';
                sessionAttributes.savedContext = { nombreFiltro };
                handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                return responseWithApl(
                    handlerInput,
                    `Quieres ver el stock de ${nombreFiltro} por producto, marca o familia?`,
                    sectionPayload('stock'),
                    'stock-tipo-filtro',
                    'Por producto, marca o familia?'
                );
            } else {
                sessionAttributes.waitingFor = 'tipoFiltroStock';
                handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                return responseWithApl(
                    handlerInput,
                    'Quieres ver el stock por producto, marca, familia o general?',
                    sectionPayload('stock'),
                    'stock-options',
                    'Por producto, marca, familia o general?'
                );
            }
        }

        let speakOutput = '';
        let aplProducts = [];
        try {
            const STOCK_MINIMO = 5;

            if (tipoFiltro === 'general') {
                const totalBajos = await Producto.countDocuments({ stock: { $lt: STOCK_MINIMO } });
                aplProducts = await Producto.find({ stock: { $lt: STOCK_MINIMO } })
                    .populate('marca')
                    .sort({ stock: 1, nombre: 1 })
                    .limit(12);
                speakOutput = `Se han encontrado ${totalBajos} artículos con stock bajo a nivel general en el almacén. `;
            } else {
                if (!nombreFiltro) {
                    sessionAttributes.waitingFor = 'nombreFiltroStock';
                    sessionAttributes.savedContext = { tipoFiltro };
                    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                    return responseWithApl(
                        handlerInput,
                        `¿Cuál es el nombre de ${tipoFiltro === 'producto' ? 'el producto' : 'la ' + tipoFiltro}?`,
                        promptPayload(
                            `Stock por ${tipoFiltro}`,
                            'Di el nombre que quieres revisar.',
                            'Ejemplo: consulta el stock de 4x4.',
                            'Di: consulta el stock de 4x4.'
                        ),
                        'stock-nombre-filtro',
                        '¿Cuál es el nombre exacto?'
                    );
                }

                if (tipoFiltro === 'producto') {
                    const producto = await Producto.findOne({ nombre: { $regex: nombreFiltro, $options: "i" } }).populate('marca');
                    if (producto) {
                        aplProducts = [producto];
                        speakOutput = `Revisando el stock del producto ${producto.nombre}, nos quedan solamente ${producto.stock} unidades. `;
                    } else {
                        speakOutput = `No se encontró el producto ${nombreFiltro}. `;
                    }
                } else if (tipoFiltro === 'marca') {
                    const marca = await Marca.findOne({ nombre: { $regex: nombreFiltro, $options: "i" } });
                    if (marca) {
                        const productosBajos = await Producto.find({ marca: marca._id, stock: { $lt: STOCK_MINIMO } })
                            .populate('marca')
                            .sort({ stock: 1, nombre: 1 })
                            .limit(12);
                        if (productosBajos.length > 0) {
                            aplProducts = productosBajos;
                            const nombres = productosBajos.map(p => p.nombre).join(', ');
                            speakOutput = `En la marca ${marca.nombre}, detecte stock bajo en: ${nombres}. `;
                        } else {
                            speakOutput = `La marca ${marca.nombre} tiene niveles de stock normales. `;
                        }
                    } else {
                        speakOutput = `No se encontro la marca ${nombreFiltro}. `;
                    }
                } else {
                    const familia = await Familia.findOne({ nombre: { $regex: nombreFiltro, $options: "i" } });
                    if (familia) {
                        const productosBajos = await Producto.find({ familia: familia._id, stock: { $lt: STOCK_MINIMO } })
                            .populate('marca')
                            .sort({ stock: 1, nombre: 1 })
                            .limit(12);
                        if (productosBajos.length > 0) {
                            aplProducts = productosBajos;
                            const nombres = productosBajos.map(p => p.nombre).join(', ');
                            speakOutput = `En la familia ${familia.nombre}, detecté stock bajo en: ${nombres}. `;
                        } else {
                            speakOutput = `La familia ${familia.nombre} tiene niveles de stock normales. `;
                        }
                    } else {
                        speakOutput = `No se encontro la familia ${nombreFiltro}. `;
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
                aplProducts.length > 0
                    ? productListPayload('Stock', speakOutput, aplProducts)
                    : resultPayload('Stock', speakOutput),
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
            return responseWithApl(
                handlerInput,
                '¿Deseas ver los pedidos por enviar, enviados o finalizados?',
                sectionPayload('pedidos'),
                'pedidos-options',
                '¿Qué estado de pedidos te interesa?'
            );
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
                    return responseWithApl(
                        handlerInput,
                        '¿De qué periodo? Puedes decir: del día, de la semana, del mes o personalizado.',
                        sectionPayload(tipoEstado === 'enviados' ? 'pedidosEnviados' : 'pedidosFinalizados'),
                        'pedidos-periodo',
                        '¿Del día, de la semana, del mes o personalizado?'
                    );
                }

                if (periodo === 'personalizado' && !dias) {
                    sessionAttributes.waitingFor = 'diasPersonalizadoEstado';
                    sessionAttributes.savedContext = { tipoEstado };
                    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                    return responseWithApl(
                        handlerInput,
                        '¿De cuántos días quieres revisar los pedidos?',
                        promptPayload(
                            'Rango personalizado',
                            `Di una frase como: dime los pedidos ${tipoEstado} de hace 15 días.`,
                            `Usa: pedidos ${tipoEstado} de hace 15 días.`,
                            `Di: pedidos ${tipoEstado} de hace 15 días.`
                        ),
                        'pedidos-personalizado',
                        '¿De cuántos días?'
                    );
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
                .speak('No entendí el rango. Para ganancias puedes decir: de hace quince días. Para pedidos puedes decir: pedidos enviados de hace quince días.')
                .reprompt('Di una frase como: de hace quince días, o pedidos enviados de hace quince días.')
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
        AlexaTokenIntentHandler,
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
