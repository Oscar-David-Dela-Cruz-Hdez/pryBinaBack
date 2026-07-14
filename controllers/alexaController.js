const Alexa = require('ask-sdk-core');
const { ExpressAdapter } = require('ask-sdk-express-adapter');

const Pedido = require('../models/Pedido');
const Producto = require('../models/Producto');
const Familia = require('../models/Familia');
const Marca = require('../models/Marca');
const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');
const { generarResumenAdministrativo } = require('../services/openaiService');
const {
    createAplDocument,
    welcomePayload,
    menuPayload,
    sectionPayload,
    goodbyePayload,
    resultPayload,
    promptPayload,
    authPayload,
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

function respuestaSolicitarToken(handlerInput, mensaje = 'Bienvenido al asistente de Panamericana. Para continuar, dime tu token de administrador de cinco dígitos.') {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    sessionAttributes.alexaAuthenticated = false;
    sessionAttributes.waitingFor = 'alexaToken';
    sessionAttributes.savedContext = {};
    sessionAttributes.alexaTokenInput = sessionAttributes.alexaTokenInput || '';
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    return responseWithApl(
        handlerInput,
        mensaje,
        authPayload(mensaje, sessionAttributes.alexaTokenInput),
        'alexa-token',
        'Dime tu token de administrador de cinco dígitos.'
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

function normalizarTexto(valor) {
    if (valor === undefined || valor === null) return null;

    return String(valor)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

// Normaliza el periodo para aceptar variantes como "del mes", "mensual", etc.
function normalizarPeriodo(valor) {
    if (!valor) return null;
    const v = normalizarTexto(valor);
    if (v.includes('dia') || v === 'hoy' || v === 'diario' || v === 'al dia') return 'dia';
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

function resumenAdministrativoLocal(datos) {
    const stock = datos.productosConStockBajo === 1
        ? '1 producto con stock bajo'
        : `${datos.productosConStockBajo} productos con stock bajo`;
    const pedidos = datos.pedidosPorEnviar === 1
        ? '1 pedido por enviar'
        : `${datos.pedidosPorEnviar} pedidos por enviar`;

    return `Hoy se registraron ${datos.ventasHoy} pesos en ventas. Actualmente hay ${stock} y ${pedidos}.`;
}

async function crearRespuestaResumenInteligente(handlerInput) {
    const STOCK_MINIMO = 5;
    const [ventasHoy, ventasMes, productosConStockBajo, pedidosPorEnviar, productosCriticos] = await Promise.all([
        consultarGanancias('dia'),
        consultarGanancias('mes'),
        Producto.countDocuments({ activo: true, stock: { $lt: STOCK_MINIMO } }),
        Pedido.countDocuments({ estado: { $in: ['Pendiente', 'Pagado'] } }),
        Producto.find({ activo: true, stock: { $lt: STOCK_MINIMO } })
            .select('nombre stock')
            .sort({ stock: 1, nombre: 1 })
            .limit(3)
            .lean()
    ]);

    const datos = {
        ventasHoy,
        ventasMes,
        productosConStockBajo,
        pedidosPorEnviar,
        productosCriticos: productosCriticos.map((producto) => ({
            nombre: producto.nombre,
            stock: producto.stock
        }))
    };

    let speakOutput = resumenAdministrativoLocal(datos);
    try {
        speakOutput = await generarResumenAdministrativo(datos) || speakOutput;
    } catch (error) {
        console.error('OpenAI no pudo generar el resumen:', error.message);
    }

    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    sessionAttributes.lastIntent = 'resumenIAIntent';
    sessionAttributes.waitingFor = null;
    sessionAttributes.savedContext = {};
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    const footer = 'Puedes decir menu principal, consultar otro dato o salir.';
    const responseBuilder = handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt('Puedes decir menu principal, ventas, inventario, pedidos o salir.')
        .withShouldEndSession(false);

    return addAplDirective(
        handlerInput,
        responseBuilder,
        resultPayload('Resumen inteligente', speakOutput, footer),
        'resumen-inteligente'
    ).getResponse();
}

function normalizarTipoFiltroStock(valor) {
    const texto = normalizarTexto(valor);
    if (!texto) return null;

    if (texto.includes('general')) return 'general';
    if (texto.includes('producto')) return 'producto';
    if (texto.includes('marca')) return 'marca';
    if (texto.includes('familia')) return 'familia';
    if (texto.includes('categoria')) return 'marca';

    return null;
}

function obtenerValorSlotIndividual(slot) {
    const authorities = slot?.resolutions?.resolutionsPerAuthority || [];
    for (const authority of authorities) {
        if (authority.status?.code !== 'ER_SUCCESS_MATCH') continue;
        const valorResuelto = authority.values?.[0]?.value?.name;
        if (valorResuelto) return valorResuelto;
    }

    return slot?.value ?? null;
}

function obtenerValorSlot(slots, ...nombres) {
    for (const nombre of nombres) {
        const valor = obtenerValorSlotIndividual(slots[nombre]);
        if (valor !== undefined && valor !== null && String(valor).trim() !== '') {
            return valor;
        }
    }
    return null;
}

function normalizarNombreConsultado(valor) {
    if (!valor) return valor;

    return String(valor)
        .trim()
        .replace(/\b(cuatro|4)\s+(?:por|x)\s+(cuatro|4)\b/gi, '4x4');
}

function normalizarTipoEstado(valor) {
    if (!valor) return null;
    const texto = normalizarTexto(valor);

    if (texto.includes('por enviar') || texto.includes('pendiente') || texto.includes('actual')) return 'por enviar';
    if (texto.includes('enviado')) return 'enviados';
    if (texto.includes('finalizado') || texto.includes('entregado') || texto.includes('terminado')) return 'finalizados';

    return texto;
}

function normalizarTipoMercancia(valor) {
    const texto = normalizarTexto(valor);
    if (!texto) return null;
    if (texto.includes('producto')) return 'producto';
    if (texto.includes('familia')) return 'familia';
    if (texto.includes('marca') || texto.includes('categoria')) return 'marca';
    return texto;
}

async function inferirTipoFiltroStock(nombreFiltro) {
    const nombre = normalizarNombreConsultado(nombreFiltro)?.trim();
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
        const intentName = requestType === 'IntentRequest'
            ? Alexa.getIntentName(handlerInput.requestEnvelope)
            : null;
        const esIntentSalida = intentName === 'AMAZON.StopIntent'
            || intentName === 'AMAZON.CancelIntent';

        return requestType === 'IntentRequest'
            && !esIntentSalida
            && (sessionAttributes.waitingFor === 'alexaToken' || sessionAttributes.alexaAuthenticated !== true);
    },
    async handle(handlerInput) {
        const tokenAlexa = extraerTokenAlexa(handlerInput);

        try {
            const admin = await validarTokenAlexa(tokenAlexa);
            if (!admin) {
                const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
                sessionAttributes.alexaTokenInput = '';
                handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                return respuestaSolicitarToken(handlerInput, 'Token no valido. Por favor dime el token de administrador de cinco digitos.');
            }

            const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
            sessionAttributes.alexaAuthenticated = true;
            sessionAttributes.alexaAdminId = admin._id.toString();
            sessionAttributes.waitingFor = null;
            sessionAttributes.savedContext = {};
            sessionAttributes.alexaTokenInput = '';
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

            const speakOutput = `Acceso autorizado. Hola ${admin.nombre}. Puedes consultar ventas, inventario o pedidos. Que deseas hacer?`;
            const responseBuilder = handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt('Quieres consultar ventas, inventario o pedidos?')
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
        sessionAttributes.lastIntent = null;
        sessionAttributes.waitingFor = null;
        sessionAttributes.savedContext = {};
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

        const speakOutput = 'Claro, volvemos al menu principal. Puedes consultar ventas, inventario o pedidos.';
        const responseBuilder = handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('Quieres consultar ventas, inventario o pedidos?')
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
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const args = handlerInput.requestEnvelope.request.arguments || [];
        const action = normalizeAplAction(args);

        if (!sesionAlexaAutorizada(handlerInput)) {
            if (action.startsWith('token_digit:')) {
                const digit = action.replace('token_digit:', '');
                sessionAttributes.alexaTokenInput = `${sessionAttributes.alexaTokenInput || ''}${digit}`.slice(0, 5);
                handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                return responseWithApl(
                    handlerInput,
                    `Token con ${sessionAttributes.alexaTokenInput.length} digitos.`,
                    authPayload('Toca Ingresar cuando termines los cinco dígitos.', sessionAttributes.alexaTokenInput),
                    'alexa-token',
                    'Toca Ingresar cuando termines.'
                );
            }

            if (action === 'token_submit') {
                const tokenInput = sessionAttributes.alexaTokenInput || '';
                if (tokenInput.length !== 5) {
                    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                    return responseWithApl(
                        handlerInput,
                        'El token debe tener cinco dígitos.',
                        authPayload('Completa los cinco dígitos antes de ingresar.', tokenInput),
                        'alexa-token',
                        'Completa los cinco dígitos.'
                    );
                }

                try {
                    const admin = await validarTokenAlexa(tokenInput);
                    if (admin) {
                        sessionAttributes.alexaAuthenticated = true;
                        sessionAttributes.alexaAdminId = admin._id.toString();
                        sessionAttributes.waitingFor = null;
                        sessionAttributes.savedContext = {};
                        sessionAttributes.alexaTokenInput = '';
                        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

                        return responseWithApl(
                            handlerInput,
                            `Acceso autorizado. Hola ${admin.nombre}. Puedes consultar ventas, inventario o pedidos.`,
                            menuPayload(),
                            'main-menu',
                            'Quieres consultar ventas, inventario o pedidos?'
                        );
                    }

                    sessionAttributes.alexaTokenInput = '';
                    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                    return respuestaSolicitarToken(handlerInput, 'Token no valido. Intenta ingresar nuevamente los cinco dígitos.');
                } catch (error) {
                    console.error('Error al validar token desde APL:', error);
                    sessionAttributes.alexaTokenInput = '';
                    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                    return respuestaSolicitarToken(handlerInput, 'No pude validar el token en este momento. Intenta nuevamente.');
                }
            }

            if (action === 'token_backspace') {
                sessionAttributes.alexaTokenInput = String(sessionAttributes.alexaTokenInput || '').slice(0, -1);
                handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                return responseWithApl(
                    handlerInput,
                    'Quite el ultimo dígito.',
                    authPayload('Continua tocando los dígitos del token.', sessionAttributes.alexaTokenInput),
                    'alexa-token',
                    'Continua con el siguiente dígito.'
                );
            }

            if (action === 'token_clear') {
                sessionAttributes.alexaTokenInput = '';
                handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                return responseWithApl(
                    handlerInput,
                    'Token limpiado. Ingresa nuevamente los cinco dígitos.',
                    authPayload('Ingresa nuevamente los cinco dígitos.', sessionAttributes.alexaTokenInput),
                    'alexa-token',
                    'Ingresa nuevamente el token.'
                );
            }

            if (action === 'noop') {
                handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                return responseWithApl(
                    handlerInput,
                    'Por voz puedes decir: mi token es uno dos tres cuatro cinco.',
                    authPayload('Tambien puedes decir el token por voz.', sessionAttributes.alexaTokenInput || ''),
                    'alexa-token',
                    'Di tu token de administrador de cinco dígitos.'
                );
            }

            return respuestaSolicitarToken(handlerInput);
        }

        let speakOutput = '';
        let datasource = menuPayload();

        try {
            if (action === 'ventas') {
                sessionAttributes.lastIntent = 'ventasIntent';
                sessionAttributes.waitingFor = 'periodoGanancia';
                sessionAttributes.savedContext = { tipoConsulta: 'ganancia' };
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
            } else if (action === 'resumen_ia') {
                return crearRespuestaResumenInteligente(handlerInput);
            } else if (action === 'ayuda') {
                sessionAttributes.lastIntent = null;
                sessionAttributes.waitingFor = null;
                sessionAttributes.savedContext = {};
                speakOutput = 'Estas son algunas opciones. Puedes preguntar por ventas, inventario o pedidos.';
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
                datasource = resultPayload(
                    'Resultado de ventas',
                    speakOutput,
                    'Puedes decir menu principal, abrir inventario, abrir pedidos o salir.'
                );
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
                    ? productListPayload('Inventario general', speakOutput, productosBajos, 'Puedes decir menu principal, pedir otro inventario o salir.')
                    : resultPayload('Inventario general', speakOutput, 'Puedes decir menu principal, pedir otro inventario o salir.');
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
                datasource = resultPayload(
                    'Pedidos por enviar',
                    speakOutput,
                    'Puedes decir menu principal, consultar enviados, finalizados o salir.'
                );
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
                datasource = resultPayload(
                    'Pedidos enviados',
                    speakOutput,
                    'Puedes decir menu principal, consultar otro rango o salir.'
                );
            } else if (action.startsWith('pedidos_finalizados_') && action !== 'pedidos_finalizados_personalizado') {
                const periodo = action.replace('pedidos_finalizados_', '');
                const totalPedidos = await consultarPedidosPorEstado('Entregado', periodo);
                sessionAttributes.lastIntent = 'estadoIntent';
                sessionAttributes.waitingFor = null;
                sessionAttributes.savedContext = {};
                speakOutput = `Se encontraron ${totalPedidos} pedidos finalizados ${textoPeriodoApl(periodo)}.`;
                datasource = resultPayload(
                    'Pedidos finalizados',
                    speakOutput,
                    'Puedes decir menu principal, consultar otro rango o salir.'
                );
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
                sessionAttributes.lastIntent = null;
                sessionAttributes.waitingFor = null;
                sessionAttributes.savedContext = {};
                speakOutput = 'Este es el menu principal. Puedes consultar ventas, inventario, pedidos, ayuda o salir.';
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
                sessionAttributes.lastIntent = null;
                speakOutput = 'Volvemos al menu principal. Puedes consultar ventas, inventario o pedidos.';
                datasource = menuPayload();
            }
        } catch (error) {
            console.error('Error en APL UserEvent:', error);
            sessionAttributes.waitingFor = null;
            sessionAttributes.savedContext = {};
            speakOutput = 'Hubo un problema al consultar la información. Intenta de nuevo.';
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
            speakOutput = 'Abrimos inventario. Puedes decir inventario general, por producto, por familia o por marca.';
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
            speakOutput = 'Hubo un problema al consultar la información. Intenta de nuevo.';
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

const ResumenIAIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'resumenIAIntent';
    },
    async handle(handlerInput) {
        return crearRespuestaResumenInteligente(handlerInput);
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
        let tipoConsulta = normalizarTexto(obtenerValorSlot(slots, 'tipoConsulta'));
        let periodo = normalizarPeriodo(obtenerValorSlot(slots, 'periodoGanancia'));
        let dias = obtenerValorSlot(slots, 'diasPersonalizado', 'diasPersonalizados', 'dias', 'numeroDias');
        let tipoMercancia = normalizarTipoMercancia(obtenerValorSlot(slots, 'tipoMercancia'));
        let nombreMercancia = obtenerValorSlot(slots, 'nombreMercancia');

        // Restaurar contexto guardado si veníamos de una pregunta pendiente
        const ctx = sessionAttributes.savedContext || {};
        if (sessionAttributes.waitingFor === 'periodoGanancia') {
            tipoConsulta = tipoConsulta || ctx.tipoConsulta || 'ganancia';
            if (!periodo && !dias) periodo = normalizarPeriodo(tipoMercancia || nombreMercancia);
            tipoMercancia = null;
            nombreMercancia = null;
        } else if (sessionAttributes.waitingFor === 'tipoMercancia') {
            tipoConsulta = 'mercancia';
            tipoMercancia = tipoMercancia || normalizarTipoMercancia(obtenerValorSlot(slots, 'periodoGanancia'));
            nombreMercancia = ctx.nombreMercancia || nombreMercancia;
        } else if (sessionAttributes.waitingFor === 'nombreMercancia') {
            tipoConsulta = 'mercancia';
            tipoMercancia = ctx.tipoMercancia || tipoMercancia;
        } else if (sessionAttributes.waitingFor === 'diasPersonalizadoVentas') {
            tipoConsulta = ctx.tipoConsulta || 'ganancia';
            periodo = 'personalizado';
            dias = obtenerValorSlot(slots, 'diasPersonalizado', 'diasPersonalizados', 'dias', 'numeroDias', 'tipoConsulta');
        }

        // Limpiar estado de espera
        sessionAttributes.waitingFor = null;
        sessionAttributes.savedContext = {};

        // Deducción automática
        if (!tipoConsulta) {
            if (periodo || dias) tipoConsulta = 'ganancia';
            else if (tipoMercancia || nombreMercancia) tipoConsulta = 'mercancia';
            else {
                sessionAttributes.waitingFor = 'periodoGanancia';
                sessionAttributes.savedContext = { tipoConsulta: 'ganancia' };
                handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                return responseWithApl(
                    handlerInput,
                    'Abrimos ventas. Puedes elegir ganancias por dia, semana, mes o personalizado.',
                    sectionPayload('ventas'),
                    'ventas-options',
                    'Deseas ver ganancias por dia, semana, mes o personalizado?'
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

            } else if (tipoConsulta === 'mercancia') {
                if (!tipoMercancia && !nombreMercancia) {
                    sessionAttributes.waitingFor = 'tipoMercancia';
                    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                    return responseWithApl(
                        handlerInput,
                        '¿Sobre qué deseas consultar? producto, familia o marca.',
                        promptPayload(
                            'Ventas por mercancía',
                            'Elige si quieres consultar producto, familia o marca.',
                            'También puedes decir: checa las ventas de Barbería.',
                            'Di: producto, familia o marca.'
                        ),
                        'ventas-mercancia-tipo',
                        '¿Producto, familia o marca?'
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
                            'Di el producto, familia o marca que quieres revisar.',
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
                            speakOutput = `No encontré ningún producto, familia o marca llamado ${nombreMercancia}. `;
                        }
                    }
                } else if (tipoMercancia === 'familia') {
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
                        speakOutput = `No encontré ninguna familia llamada ${nombreMercancia}. `;
                    }
                } else if (tipoMercancia === 'marca') {
                    const marca = await Marca.findOne({ nombre: { $regex: escaparRegex(nombreMercancia), $options: 'i' } });
                    if (marca) {
                        const productosMarca = await Producto.find({ marca: marca._id }).select('_id');
                        const idsProductos = productosMarca.map((producto) => producto._id);
                        const pedidos = await Pedido.find({
                            estado: { $in: ['Pagado', 'Enviado', 'Entregado'] },
                            'productos.producto': { $in: idsProductos }
                        });
                        for (const pedido of pedidos) {
                            for (const productoPedido of pedido.productos) {
                                if (idsProductos.some((id) => id.toString() === productoPedido.producto.toString())) {
                                    totalVendido += productoPedido.cantidad;
                                }
                            }
                        }
                        speakOutput = `La marca ${marca.nombre} tiene ${totalVendido} artículos vendidos. `;
                    } else {
                        speakOutput = `No encontré ninguna marca llamada ${nombreMercancia}. `;
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
                .reprompt('Puedes decir menu principal, abrir inventario, abrir pedidos o salir.')
                .withShouldEndSession(false);

            return addAplDirective(
                handlerInput,
                responseBuilder,
                resultPayload('Resultado de ventas', speakOutput, 'Puedes decir menu principal, abrir inventario, abrir pedidos o salir.'),
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
        const tipoFiltroSlot = obtenerValorSlot(slots, 'tipoFiltroStock');
        let tipoFiltro = normalizarTipoFiltroStock(tipoFiltroSlot);
        let nombreFiltro = normalizarNombreConsultado(obtenerValorSlot(slots, 'nombreFiltro'));

        const ctx = sessionAttributes.savedContext || {};
        if (sessionAttributes.waitingFor === 'tipoFiltroStock') {
            nombreFiltro = ctx.nombreFiltro || nombreFiltro;
        } else if (sessionAttributes.waitingFor === 'nombreFiltroStock') {
            tipoFiltro = normalizarTipoFiltroStock(ctx.tipoFiltro) || tipoFiltro;
            nombreFiltro = nombreFiltro || (normalizarTipoFiltroStock(tipoFiltroSlot) ? null : tipoFiltroSlot);
        } else if (!tipoFiltro && !nombreFiltro && tipoFiltroSlot) {
            nombreFiltro = tipoFiltroSlot;
        }

        nombreFiltro = normalizarNombreConsultado(nombreFiltro);

        sessionAttributes.waitingFor = null;
        sessionAttributes.savedContext = {};

        if (!tipoFiltro) {
            if (nombreFiltro) {
                tipoFiltro = await inferirTipoFiltroStock(nombreFiltro);
            }

            if (!tipoFiltro && nombreFiltro) {
                sessionAttributes.waitingFor = 'nombreFiltroStock';
                sessionAttributes.savedContext = {};
                handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                return responseWithApl(
                    handlerInput,
                    `No encontre ${nombreFiltro} como producto, marca o familia. Puedes intentar con otro nombre o decir menu principal.`,
                    promptPayload(
                        'No encontrado',
                        `No encontre ${nombreFiltro} en el inventario.`,
                        'Intenta con otro producto, marca o familia.',
                        'Di otro nombre o di menu principal.'
                    ),
                    'stock-not-found',
                    'Di otro nombre o di menu principal.'
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
                    const producto = await Producto.findOne({ nombre: { $regex: escaparRegex(nombreFiltro), $options: "i" } }).populate('marca');
                    if (producto) {
                        aplProducts = [producto];
                        speakOutput = `Revisando el stock del producto ${producto.nombre}, nos quedan solamente ${producto.stock} unidades. `;
                    } else {
                        sessionAttributes.waitingFor = 'nombreFiltroStock';
                        sessionAttributes.savedContext = { tipoFiltro: 'producto' };
                        speakOutput = `No encontre el producto ${nombreFiltro}. Puedes intentar con otro nombre de producto o decir menu principal. `;
                    }
                } else if (tipoFiltro === 'marca') {
                    const marca = await Marca.findOne({ nombre: { $regex: escaparRegex(nombreFiltro), $options: "i" } });
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
                        sessionAttributes.waitingFor = 'nombreFiltroStock';
                        sessionAttributes.savedContext = { tipoFiltro: 'marca' };
                        speakOutput = `No encontre la marca ${nombreFiltro}. Puedes intentar con otro nombre de marca o decir menu principal. `;
                    }
                } else {
                    const familia = await Familia.findOne({ nombre: { $regex: escaparRegex(nombreFiltro), $options: "i" } });
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
                        sessionAttributes.waitingFor = 'nombreFiltroStock';
                        sessionAttributes.savedContext = { tipoFiltro: 'familia' };
                        speakOutput = `No encontre la familia ${nombreFiltro}. Puedes intentar con otro nombre de familia o decir menu principal. `;
                    }
                }
            }
        } catch (error) {
            console.error("Error en StockIntent:", error);
            speakOutput = 'Hubo un problema al consultar el inventario. ';
        }

        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        if (sessionAttributes.waitingFor === 'nombreFiltroStock') {
            const retryPayload = promptPayload(
                'No encontrado',
                speakOutput,
                'Puedes intentar otro nombre o decir menu principal.',
                'Di otro nombre de producto, marca o familia.'
            );
            return addAplDirective(
                handlerInput,
                handlerInput.responseBuilder
                    .speak(speakOutput)
                    .reprompt('Di otro nombre o di menu principal.')
                    .withShouldEndSession(false),
                retryPayload,
                'stock-not-found'
            ).getResponse();
        }

        speakOutput += 'Quieres revisar otro inventario o terminamos?';
        if (supportsAPL(handlerInput)) {
            const responseBuilder = handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt('Puedes decir menu principal, pedir otro inventario o salir.')
                .withShouldEndSession(false);
            const title = tipoFiltro === 'general'
                ? 'Inventario general'
                : `Inventario por ${tipoFiltro}`;
            const datasource = aplProducts.length > 0
                ? productListPayload(title, speakOutput, aplProducts, 'Puedes decir menu principal, pedir otro inventario o salir.')
                : resultPayload(title, speakOutput, 'Puedes decir menu principal, pedir otro inventario o salir.');

            return addAplDirective(handlerInput, responseBuilder, datasource, 'stock-result')
                .getResponse();
        }

        return handlerInput.responseBuilder.speak(speakOutput).reprompt('Quieres revisar algo mas?').getResponse();
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
        let tipoEstado = normalizarTipoEstado(obtenerValorSlot(slots, 'tipoEstado'));
        let periodo = normalizarPeriodo(obtenerValorSlot(slots, 'periodoEstado'));
        let dias = obtenerValorSlot(slots, 'diasPersonalizado', 'diasPersonalizados', 'dias', 'numeroDias');

        const ctx = sessionAttributes.savedContext || {};
        if (sessionAttributes.waitingFor === 'periodoEstado') {
            tipoEstado = ctx.tipoEstado || tipoEstado;
            if (!periodo && !dias) periodo = normalizarPeriodo(obtenerValorSlot(slots, 'tipoEstado'));
            tipoEstado = ctx.tipoEstado;
        } else if (sessionAttributes.waitingFor === 'diasPersonalizadoEstado') {
            tipoEstado = ctx.tipoEstado;
            periodo = 'personalizado';
            dias = obtenerValorSlot(slots, 'diasPersonalizado', 'diasPersonalizados', 'dias', 'numeroDias', 'tipoEstado');
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
                .reprompt('Puedes decir menu principal, abrir ventas, abrir inventario o salir.')
                .withShouldEndSession(false);
            const resultTitle = tipoEstado === 'por enviar' || tipoEstado === 'actuales'
                ? 'Pedidos por enviar'
                : `Pedidos ${tipoEstado}`;

            return addAplDirective(
                handlerInput,
                responseBuilder,
                resultPayload(resultTitle, speakOutput, 'Puedes decir menu principal, consultar otro estado o salir.'),
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

        // Limpiar estado de espera siempre que se cancele
        sessionAttributes.waitingFor = null;
        sessionAttributes.savedContext = {};
        sessionAttributes.lastIntent = null;

        if (intentName === 'AMAZON.CancelIntent') {
            sessionAttributes.lastIntent = null;
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

            const cancelOutput = 'Operacion cancelada. Volvemos al menu principal. Puedes consultar ventas, inventario o pedidos.';
            const cancelResponseBuilder = handlerInput.responseBuilder
                .speak(cancelOutput)
                .reprompt('Quieres consultar ventas, inventario o pedidos?')
                .withShouldEndSession(false);

            return addAplDirective(handlerInput, cancelResponseBuilder, menuPayload(), 'main-menu')
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
        sessionAttributes.lastIntent = null;
        sessionAttributes.waitingFor = null;
        sessionAttributes.savedContext = {};
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

        const generalHelpOutput = 'Estas son algunas frases utiles. Puedes decir: checa las ganancias del mes, consulta inventario general, dime los pedidos por enviar, menu principal o salir.';
        const generalHelpResponseBuilder = handlerInput.responseBuilder
            .speak(generalHelpOutput)
            .reprompt('Puedes decir ventas, inventario, pedidos, menu principal o salir.')
            .withShouldEndSession(false);

        return addAplDirective(handlerInput, generalHelpResponseBuilder, sectionPayload('ayuda'), 'help-screen')
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
        const speakOutput = 'Lo siento, no tengo informacion sobre eso en los registros de Panamericana. Solo puedo consultar ventas, inventario o pedidos. Que deseas hacer?';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('Deseas consultar ventas, inventario o pedidos?')
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
        ResumenIAIntentHandler,
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
