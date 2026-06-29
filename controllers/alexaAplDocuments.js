const BEAUTY_THEME = {
    background: '#F8EAF1',
    panel: '#FFFFFF',
    panelDark: '#2D1B2F',
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
    const titleSize = item.compact ? '21dp' : '24dp';
    const subtitleSize = item.compact ? '14dp' : '18dp';
    const verticalPadding = item.compact ? '7dp' : '12dp';
    const cardSpacing = item.compact ? '8dp' : '13dp';
    const frameHeight = item.compact ? '58dp' : '76dp';
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

function emptyState(theme, footer) {
    return {
        type: 'Frame',
        width: '100%',
        height: '100%',
        backgroundColor: theme.panel,
        borderRadius: '8dp',
        paddingLeft: '28dp',
        paddingRight: '28dp',
        paddingTop: '28dp',
        paddingBottom: '28dp',
        item: {
            type: 'Container',
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            items: [
                textBlock(footer, theme.muted, '24dp', {
                    textAlign: 'center',
                    maxLines: 3
                })
            ]
        }
    };
}

function createAplDocument(payload) {
    const { theme, screen } = payload;
    const hasCards = screen.cards.length > 0;

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
                    direction: 'row',
                    width: '100%',
                    height: '100%',
                    paddingLeft: '32dp',
                    paddingRight: '32dp',
                    paddingTop: '30dp',
                    paddingBottom: '30dp',
                    items: [
                        {
                            type: 'Frame',
                            width: '34%',
                            height: '100%',
                            backgroundColor: theme.panelDark,
                            borderRadius: '8dp',
                            paddingLeft: '26dp',
                            paddingRight: '26dp',
                            paddingTop: '28dp',
                            paddingBottom: '24dp',
                            item: {
                                type: 'Container',
                                height: '100%',
                                justifyContent: 'spaceBetween',
                                items: [
                                    {
                                        type: 'Container',
                                        items: [
                                            textBlock(screen.eyebrow, theme.accent, '20dp', {
                                                fontWeight: 'bold',
                                                maxLines: 2
                                            }),
                                            textBlock(screen.title, '#FFFFFF', '42dp', {
                                                fontWeight: 'bold',
                                                maxLines: 3,
                                                spacing: '12dp'
                                            }),
                                            textBlock(screen.subtitle, '#F8DDE9', '21dp', {
                                                maxLines: 4,
                                                spacing: '14dp'
                                            })
                                        ]
                                    },
                                    textBlock(screen.footer, '#F8DDE9', '18dp', {
                                        maxLines: 4
                                    })
                                ]
                            }
                        },
                        {
                            type: 'Container',
                            width: '66%',
                            height: '100%',
                            paddingLeft: '28dp',
                            justifyContent: 'center',
                            items: hasCards ? [
                                {
                                    type: 'Frame',
                                    width: '100%',
                                    backgroundColor: theme.panel,
                                    borderRadius: '8dp',
                                    paddingLeft: '26dp',
                                    paddingRight: '26dp',
                                    paddingTop: '24dp',
                                    paddingBottom: '24dp',
                                    item: {
                                        type: 'Container',
                                        width: '100%',
                                        items: screen.cards.map(cardComponent)
                                    }
                                }
                            ] : [
                                emptyState(theme, screen.footer)
                            ]
                        }
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
        subtitle: 'Tu asistente para ventas, inventario y pedidos.',
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
        title: 'Menu',
        subtitle: 'Consulta ventas, inventario y pedidos desde un solo lugar.',
        cards: [
            compactCard('Ventas', 'Ganancias del dia, semana, mes o mercancia vendida.', 'ventas', BEAUTY_THEME.primary),
            compactCard('Stock', 'Stock general, por producto, marca o familia.', 'stock', BEAUTY_THEME.secondary),
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
                compactCard('Marca', 'Di el nombre de la marca.', 'stock_marca', BEAUTY_THEME.accent),
                compactCard('Menu principal', 'Volver a las opciones principales.', 'menu', BEAUTY_THEME.ink)
            ],
            footer: 'Para producto, marca o familia, completa el nombre por voz.'
        },
        pedidos: {
            eyebrow: 'Estado de pedidos',
            title: 'Pedidos',
            subtitle: 'Toca una opcion para consultar pedidos.',
            cards: [
                compactCard('Por enviar', 'Cuenta pedidos pendientes o pagados.', 'pedidos_por_enviar', BEAUTY_THEME.primary),
                compactCard('Enviados', 'Elegir rango para pedidos enviados.', 'pedidos_enviados', BEAUTY_THEME.success),
                compactCard('Finalizados', 'Elegir rango para pedidos finalizados.', 'pedidos_finalizados', BEAUTY_THEME.secondary),
                compactCard('Menu principal', 'Volver a las opciones principales.', 'menu', BEAUTY_THEME.ink)
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
                compactCard('Ventas', 'Checa las ganancias del mes.', 'ventas', BEAUTY_THEME.primary),
                compactCard('Stock', 'Consulta el stock general.', 'stock', BEAUTY_THEME.secondary),
                compactCard('Pedidos', 'Dime los pedidos por enviar.', 'pedidos', BEAUTY_THEME.success),
                compactCard('Menu principal', 'Volver a las opciones principales.', 'menu', BEAUTY_THEME.ink)
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
        footer: 'Gracias por usar el asistente de la Distribuidora Panamericana.'
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

function promptPayload(title, subtitle, footer, examples = 'Di: de hace 15 dias, o hace cien dias.') {
    return makePayload({
        eyebrow: 'Completar por voz',
        title,
        subtitle,
        cards: [
            {
                ...compactCard('Ejemplos', examples, 'noop', BEAUTY_THEME.primary),
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
