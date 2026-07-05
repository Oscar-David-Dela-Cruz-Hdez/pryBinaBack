const BEAUTY_THEME = {
    background: '#2D1B2F',
    primary: '#B83280',
    secondary: '#F472B6',
    accent: '#F8B84E',
    ink: '#2D1B2F',
    muted: '#765568',
    success: '#2F9E7E',
    light: '#FFF7FA'
};

const BACKGROUND_IMAGE = 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1600&q=80';
const FALLBACK_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80';
const LOGO_IMAGE = '';

function option(title, subtitle, action, color = BEAUTY_THEME.primary, imageSource = null) {
    return { title, subtitle, action, color, imageSource };
}

function makePayload(template, screen) {
    return {
        template,
        theme: BEAUTY_THEME,
        screen: {
            backgroundImage: BACKGROUND_IMAGE,
            logoUrl: LOGO_IMAGE,
            ...screen
        }
    };
}

function toTextListItems(cards) {
    return cards.map((item) => ({
        primaryText: item.title,
        secondaryText: item.subtitle,
        token: item.action
    }));
}

function toImageListItems(cards) {
    return cards.map((item) => ({
        primaryText: item.title,
        secondaryText: item.subtitle,
        imageSource: item.imageSource || FALLBACK_PRODUCT_IMAGE,
        token: item.action
    }));
}

function createTextListDocument(payload) {
    const { screen } = payload;

    return {
        type: 'APL',
        version: '2024.3',
        theme: 'dark',
        import: [
            {
                name: 'alexa-layouts',
                version: '1.7.0'
            }
        ],
        mainTemplate: {
            parameters: ['payload'],
            items: [
                {
                    type: 'AlexaTextList',
                    id: 'panamericanaTextList',
                    headerTitle: screen.title,
                    headerSubtitle: screen.eyebrow,
                    headerBackButton: false,
                    headerAttributionImage: screen.logoUrl,
                    backgroundImageSource: screen.backgroundImage,
                    backgroundBlur: true,
                    backgroundColorOverlay: true,
                    listItems: toTextListItems(screen.cards),
                    touchForward: true,
                    footerHintText: screen.footer
                }
            ]
        }
    };
}

function createPaginatedListDocument(payload) {
    const { screen } = payload;

    return {
        type: 'APL',
        version: '2024.3',
        theme: 'dark',
        import: [
            {
                name: 'alexa-layouts',
                version: '1.7.0'
            }
        ],
        mainTemplate: {
            parameters: ['payload'],
            items: [
                {
                    type: 'AlexaPaginatedList',
                    id: 'panamericanaPaginatedList',
                    headerTitle: screen.title,
                    headerSubtitle: screen.eyebrow,
                    headerBackButton: false,
                    headerAttributionImage: screen.logoUrl,
                    backgroundImageSource: screen.backgroundImage,
                    backgroundBlur: true,
                    backgroundColorOverlay: true,
                    backgroundScale: 'best-fill',
                    backgroundAlign: 'center',
                    listItems: toImageListItems(screen.cards),
                    footerHintText: screen.footer
                }
            ]
        }
    };
}

function cardComponent(item) {
    return {
        type: 'TouchWrapper',
        width: '${viewport.width < 900 ? "100%" : "31%"}',
        height: '${viewport.height < 620 ? "118dp" : "148dp"}',
        spacing: '14dp',
        onPress: [
            {
                type: 'SendEvent',
                arguments: [item.action]
            }
        ],
        item: {
            type: 'Frame',
            width: '100%',
            height: '100%',
            borderRadius: '8dp',
            backgroundColor: item.color,
            item: {
                type: 'Container',
                width: '100%',
                height: '100%',
                paddingLeft: '18dp',
                paddingRight: '18dp',
                paddingTop: '16dp',
                paddingBottom: '14dp',
                justifyContent: 'spaceBetween',
                items: [
                    {
                        type: 'Text',
                        text: item.title,
                        color: '#FFFFFF',
                        fontSize: '${viewport.height < 620 ? "24dp" : "28dp"}',
                        fontWeight: 'bold',
                        maxLines: 2
                    },
                    {
                        type: 'Text',
                        text: item.subtitle,
                        color: '#FFFFFF',
                        fontSize: '${viewport.height < 620 ? "15dp" : "18dp"}',
                        maxLines: 2,
                        opacity: 0.86
                    }
                ]
            }
        }
    };
}

function createCardsLayoutDocument(payload) {
    const { screen } = payload;

    return {
        type: 'APL',
        version: '2024.3',
        theme: 'dark',
        mainTemplate: {
            parameters: ['payload'],
            item: {
                type: 'Frame',
                width: '100vw',
                height: '100vh',
                backgroundColor: BEAUTY_THEME.background,
                item: {
                    type: 'Container',
                    width: '100%',
                    height: '100%',
                    items: [
                        {
                            type: 'Image',
                            source: screen.backgroundImage,
                            width: '100%',
                            height: '100%',
                            scale: 'best-fill',
                            opacity: 0.28,
                            position: 'absolute'
                        },
                        {
                            type: 'Container',
                            width: '100%',
                            height: '100%',
                            paddingLeft: '${viewport.width < 900 ? "36dp" : "64dp"}',
                            paddingRight: '${viewport.width < 900 ? "36dp" : "64dp"}',
                            paddingTop: '${viewport.height < 620 ? "28dp" : "46dp"}',
                            paddingBottom: '${viewport.height < 620 ? "24dp" : "34dp"}',
                            justifyContent: 'spaceBetween',
                            items: [
                                {
                                    type: 'Container',
                                    items: [
                                        {
                                            type: 'Text',
                                            text: screen.eyebrow,
                                            color: BEAUTY_THEME.accent,
                                            fontSize: '${viewport.height < 620 ? "18dp" : "22dp"}',
                                            fontWeight: 'bold',
                                            maxLines: 1
                                        },
                                        {
                                            type: 'Text',
                                            text: screen.title,
                                            color: '#FFFFFF',
                                            fontSize: '${viewport.height < 620 ? "38dp" : "50dp"}',
                                            fontWeight: 'bold',
                                            maxLines: 2,
                                            spacing: '8dp'
                                        },
                                        {
                                            type: 'Text',
                                            text: screen.subtitle,
                                            color: '#F8DDE9',
                                            fontSize: '${viewport.height < 620 ? "19dp" : "24dp"}',
                                            maxLines: 2,
                                            spacing: '8dp'
                                        }
                                    ]
                                },
                                {
                                    type: 'Container',
                                    direction: 'row',
                                    wrap: 'wrap',
                                    width: '100%',
                                    justifyContent: 'spaceBetween',
                                    items: screen.cards.map(cardComponent)
                                },
                                {
                                    type: 'Text',
                                    text: screen.footer,
                                    color: '#F8DDE9',
                                    fontSize: '${viewport.height < 620 ? "16dp" : "19dp"}',
                                    maxLines: 2,
                                    textAlign: 'center',
                                    width: '100%'
                                }
                            ]
                        }
                    ]
                }
            }
        }
    };
}

function createAplDocument(payload) {
    if (payload.template === 'paginatedList') return createPaginatedListDocument(payload);
    if (payload.template === 'cardsLayout') return createCardsLayoutDocument(payload);
    return createTextListDocument(payload);
}

function welcomePayload() {
    return makePayload('cardsLayout', {
        eyebrow: 'Distribuidora Panamericana',
        title: 'Bienvenida',
        subtitle: 'Asistente de ventas, inventario y pedidos.',
        cards: [
            option('Ir al menu', 'Ver las consultas disponibles.', 'menu', BEAUTY_THEME.primary),
            option('Ayuda', 'Escuchar ejemplos rapidos.', 'ayuda', BEAUTY_THEME.secondary),
            option('Salir', 'Cerrar el asistente.', 'salir', BEAUTY_THEME.ink)
        ],
        footer: 'Toca una opcion o responde por voz.'
    });
}

function menuPayload() {
    return makePayload('cardsLayout', {
        eyebrow: 'Menu principal',
        title: 'Panamericana',
        subtitle: 'Elige una consulta administrativa.',
        cards: [
            option('Ventas', 'Ganancias y mercancia.', 'ventas', BEAUTY_THEME.primary),
            option('Stock', 'Inventario por producto, marca o familia.', 'stock', BEAUTY_THEME.secondary),
            option('Pedidos', 'Por enviar, enviados y finalizados.', 'pedidos', BEAUTY_THEME.success),
            option('Ayuda', 'Frases de ejemplo.', 'ayuda', BEAUTY_THEME.accent),
            option('Salir', 'Terminar sesion.', 'salir', BEAUTY_THEME.ink)
        ],
        footer: 'Tambien puedes decir ventas, stock, pedidos, ayuda o salir.'
    });
}

function sectionPayload(section) {
    const sections = {
        ventas: {
            eyebrow: 'Consulta de ventas',
            title: 'Ventas',
            subtitle: 'Selecciona el rango de ganancias.',
            cards: [
                option('Por dia', 'Ganancias de hoy.', 'ventas_ganancias_dia'),
                option('Por semana', 'Ultimos 7 dias.', 'ventas_ganancias_semana'),
                option('Por mes', 'Ultimos 30 dias.', 'ventas_ganancias_mes'),
                option('Personalizado', 'Responder rango por voz.', 'ventas_ganancias_personalizado'),
                option('Menu principal', 'Volver al inicio.', 'menu')
            ],
            footer: 'Para rango personalizado di: de hace 15 dias.'
        },
        stock: {
            eyebrow: 'Consulta de stock',
            title: 'Inventario',
            subtitle: 'Selecciona como quieres revisar el almacen.',
            cards: [
                option('General', 'Productos con stock bajo.', 'stock_general'),
                option('Producto', 'Completar nombre por voz.', 'stock_producto'),
                option('Familia', 'Completar familia por voz.', 'stock_familia'),
                option('Marca', 'Completar marca por voz.', 'stock_marca'),
                option('Menu principal', 'Volver al inicio.', 'menu')
            ],
            footer: 'Para producto, marca o familia, completa el nombre por voz.'
        },
        pedidos: {
            eyebrow: 'Estado de pedidos',
            title: 'Pedidos',
            subtitle: 'Consulta el estado operativo.',
            cards: [
                option('Por enviar', 'Pendientes o pagados.', 'pedidos_por_enviar'),
                option('Enviados', 'Elegir rango.', 'pedidos_enviados'),
                option('Finalizados', 'Elegir rango.', 'pedidos_finalizados'),
                option('Menu principal', 'Volver al inicio.', 'menu')
            ],
            footer: 'Enviados y finalizados permiten rangos.'
        },
        pedidosEnviados: {
            eyebrow: 'Pedidos enviados',
            title: 'Rango',
            subtitle: 'Selecciona el periodo que quieres revisar.',
            cards: [
                option('Por dia', 'Enviados de hoy.', 'pedidos_enviados_dia'),
                option('Por semana', 'Ultimos 7 dias.', 'pedidos_enviados_semana'),
                option('Por mes', 'Ultimos 30 dias.', 'pedidos_enviados_mes'),
                option('Personalizado', 'Responder rango por voz.', 'pedidos_enviados_personalizado'),
                option('Menu principal', 'Volver al inicio.', 'menu')
            ],
            footer: 'Ejemplo: pedidos enviados de hace 15 dias.'
        },
        pedidosFinalizados: {
            eyebrow: 'Pedidos finalizados',
            title: 'Rango',
            subtitle: 'Selecciona el periodo que quieres revisar.',
            cards: [
                option('Por dia', 'Finalizados de hoy.', 'pedidos_finalizados_dia'),
                option('Por semana', 'Ultimos 7 dias.', 'pedidos_finalizados_semana'),
                option('Por mes', 'Ultimos 30 dias.', 'pedidos_finalizados_mes'),
                option('Personalizado', 'Responder rango por voz.', 'pedidos_finalizados_personalizado'),
                option('Menu principal', 'Volver al inicio.', 'menu')
            ],
            footer: 'Ejemplo: pedidos finalizados de hace 15 dias.'
        },
        ayuda: {
            eyebrow: 'Ayuda',
            title: 'Frases utiles',
            subtitle: 'Prueba una de estas rutas.',
            cards: [
                option('Ventas', 'Checa las ganancias del mes.', 'ventas'),
                option('Stock', 'Consulta el stock de 4x4.', 'stock'),
                option('Pedidos', 'Dime los pedidos por enviar.', 'pedidos'),
                option('Menu principal', 'Volver al inicio.', 'menu')
            ],
            footer: 'Tambien puedes decir menu principal o salir.'
        }
    };

    return makePayload('textList', sections[section] || sections.ayuda);
}

function goodbyePayload() {
    return makePayload('textList', {
        eyebrow: 'Distribuidora Panamericana',
        title: 'Hasta luego',
        subtitle: 'Sesion finalizada.',
        cards: [],
        footer: 'Gracias por usar el asistente.'
    });
}

function resultPayload(title, subtitle, footer = 'Puedes pedir otra consulta o decir salir.') {
    return makePayload('textList', {
        eyebrow: 'Resultado',
        title,
        subtitle,
        cards: [
            option('Ventas', 'Consultar ganancias o mercancia.', 'ventas'),
            option('Stock', 'Revisar inventario.', 'stock'),
            option('Pedidos', 'Consultar estado de pedidos.', 'pedidos'),
            option('Menu principal', 'Volver al inicio.', 'menu')
        ],
        footer
    });
}

function promptPayload(title, subtitle, footer, examples = 'Di: de hace 15 dias, o hace cien dias.') {
    return makePayload('textList', {
        eyebrow: 'Completar por voz',
        title,
        subtitle,
        cards: [
            option('Ejemplo 1', examples, 'noop'),
            option('Menu principal', 'Cancelar y volver al menu.', 'menu')
        ],
        footer
    });
}

function productListPayload(title, subtitle, products, footer = 'Toca menu principal o pide otra consulta.') {
    const cards = products.slice(0, 12).map((product) => option(
        product.nombre,
        `Stock: ${product.stock ?? 0}${product.marca?.nombre ? ` | ${product.marca.nombre}` : ''}`,
        'noop',
        BEAUTY_THEME.primary,
        product.imagenUrl || FALLBACK_PRODUCT_IMAGE
    ));

    cards.push(option('Menu principal', 'Volver al inicio.', 'menu', BEAUTY_THEME.ink, FALLBACK_PRODUCT_IMAGE));

    return makePayload('paginatedList', {
        eyebrow: 'Inventario',
        title,
        subtitle,
        cards,
        footer
    });
}

module.exports = {
    createAplDocument,
    welcomePayload,
    menuPayload,
    sectionPayload,
    goodbyePayload,
    resultPayload,
    promptPayload,
    productListPayload
};
