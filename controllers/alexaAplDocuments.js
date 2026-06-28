const BEAUTY_THEME = {
    background: '#FFF7FA',
    primary: '#B83280',
    secondary: '#F472B6',
    accent: '#F8B84E',
    ink: '#2D1B2F',
    muted: '#765568',
    success: '#2F9E7E'
};

function card(title, subtitle, action, color) {
    return {
        title,
        subtitle,
        action,
        color,
        compact: false,
        quiet: false
    };
}

function compactCard(title, subtitle, action, color) {
    return {
        ...card(title, subtitle, action, color),
        compact: true
    };
}

function makePayload(screen) {
    return {
        theme: BEAUTY_THEME,
        screen
    };
}

function textBlock(text, color, fontSize, extra = {}) {
    return {
        type: 'Text',
        text,
        color,
        fontSize,
        ...extra
    };
}

function cardComponent(item) {
    const titleSize = item.compact ? '22dp' : '26dp';
    const subtitleSize = item.compact ? '15dp' : '19dp';
    const verticalPadding = item.compact ? '6dp' : '12dp';
    const cardSpacing = item.compact ? '7dp' : '14dp';
    const frameHeight = item.compact ? '60dp' : undefined;
    const arrowText = item.quiet ? '' : '>';

    return {
        type: 'TouchWrapper',
        width: '100%',
        spacing: cardSpacing,
        onPress: [
            {
                type: 'SendEvent',
                arguments: [item.action]
            }
        ],
        item: {
        type: 'Frame',
        width: '100%',
        height: frameHeight,
        backgroundColor: item.color,
        borderRadius: '8dp',
        paddingLeft: '18dp',
        paddingRight: '18dp',
        paddingTop: verticalPadding,
        paddingBottom: verticalPadding,
            item: {
                type: 'Container',
                direction: 'row',
                alignItems: 'center',
                justifyContent: 'spaceBetween',
                items: [
                    {
                        type: 'Container',
                        width: '86%',
                        items: [
                            textBlock(item.title, '#FFFFFF', titleSize, {
                                fontWeight: 'bold',
                                maxLines: 1
                            }),
                            textBlock(item.subtitle, '#FFFFFF', subtitleSize, {
                                opacity: 0.82,
                                maxLines: item.compact ? 1 : 2,
                                spacing: item.compact ? '2dp' : '4dp'
                            })
                        ]
                    },
                    textBlock(arrowText, '#FFFFFF', '30dp', {
                        fontWeight: 'bold',
                        maxLines: 1
                    })
                ]
            }
        }
    };
}

function createAplDocument(payload) {
    const { theme, screen } = payload;

    return {
        type: 'APL',
        version: '1.7',
        mainTemplate: {
            parameters: ['payload'],
            item: {
                type: 'Frame',
                width: '100vw',
                height: '100vh',
                backgroundColor: theme.background,
                item: {
                    type: 'Container',
                    width: '100%',
                    height: '100%',
                    paddingLeft: '44dp',
                    paddingRight: '44dp',
                    paddingTop: '24dp',
                    paddingBottom: '18dp',
                    justifyContent: 'spaceBetween',
                    items: [
                        {
                            type: 'Container',
                            items: [
                                textBlock(screen.eyebrow, theme.primary, '22dp', {
                                    fontWeight: 'bold',
                                    maxLines: 1
                                }),
                                textBlock(screen.title, theme.ink, '38dp', {
                                    fontWeight: 'bold',
                                    maxLines: 2,
                                    spacing: '8dp'
                                }),
                                textBlock(screen.subtitle, theme.muted, '21dp', {
                                    maxLines: 2,
                                    spacing: '10dp'
                                })
                            ]
                        },
                        {
                            type: 'Container',
                            width: '100%',
                            height: '350dp',
                            items: screen.cards.map(cardComponent)
                        },
                        textBlock(screen.footer, theme.muted, '20dp', {
                            textAlign: 'center',
                            width: '100%',
                            maxLines: 2
                        })
                    ]
                }
            }
        }
    };
}

function welcomePayload() {
    return makePayload({
        eyebrow: 'Distribuidora Panamericana',
        title: 'Bienvenida',
        subtitle: 'Tu asistente para ventas, inventario y pedidos de belleza.',
        cards: [
            card('Ir al menu', 'Ver ventas, stock, pedidos, ayuda y salida.', 'menu', BEAUTY_THEME.primary),
            card('Salir', 'Cerrar el asistente con una despedida.', 'salir', BEAUTY_THEME.ink)
        ],
        footer: 'Toca Ir al menu o dime que quieres consultar.'
    });
}

function menuPayload() {
    return makePayload({
        eyebrow: 'Distribuidora Panamericana',
        title: 'Menu de belleza',
        subtitle: 'Consulta ventas, inventario y pedidos desde un solo lugar.',
        cards: [
            compactCard('Ventas', 'Ganancias del dia, semana, mes o mercancia vendida.', 'ventas', BEAUTY_THEME.primary),
            compactCard('Stock', 'Stock general, por producto, familia o categoria.', 'stock', BEAUTY_THEME.secondary),
            compactCard('Pedidos', 'Pedidos por enviar, enviados o finalizados.', 'pedidos', BEAUTY_THEME.success),
            compactCard('Ayuda', 'Ver ejemplos de lo que puedes preguntar.', 'ayuda', BEAUTY_THEME.accent),
            compactCard('Salir', 'Cerrar el asistente con una despedida.', 'salir', BEAUTY_THEME.ink)
        ],
        footer: 'Toca una opcion o dime que quieres consultar.'
    });
}

function sectionPayload(section) {
    const sections = {
        ventas: {
            eyebrow: 'Consulta de ventas',
            title: 'Ventas y ganancias',
            subtitle: 'Toca una opcion para consultar al momento.',
            cards: [
                compactCard('Por dia', 'Ganancias de hoy.', 'ventas_ganancias_dia', BEAUTY_THEME.primary),
                compactCard('Por semana', 'Ganancias de la ultima semana.', 'ventas_ganancias_semana', BEAUTY_THEME.secondary),
                compactCard('Por mes', 'Ganancias del ultimo mes.', 'ventas_ganancias_mes', BEAUTY_THEME.success),
                compactCard('Personalizado', 'Di cuantos dias quieres revisar.', 'ventas_ganancias_personalizado', BEAUTY_THEME.accent),
                compactCard('Menu principal', 'Volver a las opciones principales.', 'menu', BEAUTY_THEME.ink)
            ],
            footer: 'Para mercancia especifica, dime el producto o categoria por voz.'
        },
        stock: {
            eyebrow: 'Consulta de stock',
            title: 'Inventario',
            subtitle: 'Toca una opcion para revisar inventario.',
            cards: [
                compactCard('General', 'Cuenta productos con stock bajo.', 'stock_general', BEAUTY_THEME.primary),
                compactCard('Producto', 'Di el nombre del producto.', 'stock_producto', BEAUTY_THEME.secondary),
                compactCard('Familia', 'Di el nombre de la familia.', 'stock_familia', BEAUTY_THEME.success),
                compactCard('Categoria', 'Di el nombre de la categoria.', 'stock_categoria', BEAUTY_THEME.accent),
                compactCard('Menu principal', 'Volver a las opciones principales.', 'menu', BEAUTY_THEME.ink)
            ],
            footer: 'Para producto, familia o categoria, completa el nombre por voz.'
        },
        pedidos: {
            eyebrow: 'Estado de pedidos',
            title: 'Pedidos',
            subtitle: 'Toca una opcion para consultar pedidos.',
            cards: [
                card('Por enviar', 'Cuenta pedidos pendientes o pagados.', 'pedidos_por_enviar', BEAUTY_THEME.primary),
                card('Enviados', 'Elegir rango para pedidos enviados.', 'pedidos_enviados', BEAUTY_THEME.success),
                card('Finalizados', 'Elegir rango para pedidos finalizados.', 'pedidos_finalizados', BEAUTY_THEME.secondary),
                card('Menu principal', 'Volver a las opciones principales.', 'menu', BEAUTY_THEME.ink)
            ],
            footer: 'Los enviados y finalizados se pueden filtrar por rango.'
        },
        pedidosEnviados: {
            eyebrow: 'Pedidos enviados',
            title: 'Rango de enviados',
            subtitle: 'Selecciona el periodo que quieres revisar.',
            cards: [
                compactCard('Por dia', 'Enviados de hoy.', 'pedidos_enviados_dia', BEAUTY_THEME.primary),
                compactCard('Por semana', 'Enviados de la ultima semana.', 'pedidos_enviados_semana', BEAUTY_THEME.secondary),
                compactCard('Por mes', 'Enviados del ultimo mes.', 'pedidos_enviados_mes', BEAUTY_THEME.success),
                compactCard('Personalizado', 'Di cuantos dias quieres revisar.', 'pedidos_enviados_personalizado', BEAUTY_THEME.accent),
                compactCard('Menu principal', 'Volver a las opciones principales.', 'menu', BEAUTY_THEME.ink)
            ],
            footer: 'Tambien puedes decir: pedidos enviados de la semana.'
        },
        pedidosFinalizados: {
            eyebrow: 'Pedidos finalizados',
            title: 'Rango de finalizados',
            subtitle: 'Selecciona el periodo que quieres revisar.',
            cards: [
                compactCard('Por dia', 'Finalizados de hoy.', 'pedidos_finalizados_dia', BEAUTY_THEME.primary),
                compactCard('Por semana', 'Finalizados de la ultima semana.', 'pedidos_finalizados_semana', BEAUTY_THEME.secondary),
                compactCard('Por mes', 'Finalizados del ultimo mes.', 'pedidos_finalizados_mes', BEAUTY_THEME.success),
                compactCard('Personalizado', 'Di cuantos dias quieres revisar.', 'pedidos_finalizados_personalizado', BEAUTY_THEME.accent),
                compactCard('Menu principal', 'Volver a las opciones principales.', 'menu', BEAUTY_THEME.ink)
            ],
            footer: 'Tambien puedes decir: pedidos finalizados del mes.'
        },
        ayuda: {
            eyebrow: 'Ayuda',
            title: 'Que puedes preguntar',
            subtitle: 'Usa frases naturales para moverte por el asistente.',
            cards: [
                card('Ventas', 'Checa las ganancias del mes.', 'ventas', BEAUTY_THEME.primary),
                card('Stock', 'Consulta el stock general.', 'stock', BEAUTY_THEME.secondary),
                card('Pedidos', 'Dime los pedidos por enviar.', 'pedidos', BEAUTY_THEME.success),
                card('Salir', 'Terminar la skill.', 'salir', BEAUTY_THEME.ink)
            ],
            footer: 'Tambien puedes decir: menu principal, ayuda o salir.'
        }
    };

    return makePayload(sections[section] || sections.ayuda);
}

function goodbyePayload() {
    return makePayload({
        eyebrow: 'Distribuidora Panamericana',
        title: 'Hasta luego',
        subtitle: 'Tu asistente queda listo para la siguiente consulta.',
        cards: [],
        footer: 'Gracias por usar el asistente de Panamericana.'
    });
}

function resultPayload(title, subtitle, footer = 'Puedes pedir otra consulta o decir salir.') {
    return makePayload({
        eyebrow: 'Resultado',
        title,
        subtitle,
        cards: [
            compactCard('Ventas', 'Consultar ganancias o mercancia.', 'ventas', BEAUTY_THEME.primary),
            compactCard('Stock', 'Revisar inventario.', 'stock', BEAUTY_THEME.secondary),
            compactCard('Pedidos', 'Consultar estado de pedidos.', 'pedidos', BEAUTY_THEME.success),
            compactCard('Menu principal', 'Volver a las opciones principales.', 'menu', BEAUTY_THEME.ink)
        ],
        footer
    });
}

function promptPayload(title, subtitle, footer) {
    return makePayload({
        eyebrow: 'Completar por voz',
        title,
        subtitle,
        cards: [
            {
                ...compactCard('Ejemplos', 'Di: 15 dias, treinta dias, o 100 dias.', 'noop', BEAUTY_THEME.primary),
                quiet: true
            },
            compactCard('Menu principal', 'Cancelar y volver al menu.', 'menu', BEAUTY_THEME.ink)
        ],
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
    promptPayload
};
