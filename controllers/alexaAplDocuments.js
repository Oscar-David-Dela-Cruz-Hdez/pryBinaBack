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
        color
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
    return {
        type: 'TouchWrapper',
        width: '100%',
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
            backgroundColor: item.color,
            borderRadius: '8dp',
            paddingLeft: '22dp',
            paddingRight: '22dp',
            paddingTop: '18dp',
            paddingBottom: '18dp',
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
                            textBlock(item.title, '#FFFFFF', '30dp', {
                                fontWeight: 'bold',
                                maxLines: 1
                            }),
                            textBlock(item.subtitle, '#FFFFFF', '22dp', {
                                opacity: 0.82,
                                maxLines: 2,
                                spacing: '4dp'
                            })
                        ]
                    },
                    textBlock('>', '#FFFFFF', '34dp', {
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
                    paddingLeft: '48dp',
                    paddingRight: '48dp',
                    paddingTop: '32dp',
                    paddingBottom: '28dp',
                    justifyContent: 'spaceBetween',
                    items: [
                        {
                            type: 'Container',
                            items: [
                                textBlock(screen.eyebrow, theme.primary, '24dp', {
                                    fontWeight: 'bold',
                                    maxLines: 1
                                }),
                                textBlock(screen.title, theme.ink, '48dp', {
                                    fontWeight: 'bold',
                                    maxLines: 2,
                                    spacing: '8dp'
                                }),
                                textBlock(screen.subtitle, theme.muted, '26dp', {
                                    maxLines: 2,
                                    spacing: '10dp'
                                })
                            ]
                        },
                        {
                            type: 'Container',
                            width: '100%',
                            height: '430dp',
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
        title: 'Menu de belleza',
        subtitle: 'Consulta ventas, inventario y pedidos desde un solo lugar.',
        cards: [
            card('Ventas', 'Ganancias del dia, semana, mes o mercancia vendida.', 'ventas', BEAUTY_THEME.primary),
            card('Stock', 'Stock general, por producto, familia o categoria.', 'stock', BEAUTY_THEME.secondary),
            card('Pedidos', 'Pedidos por enviar, enviados o finalizados.', 'pedidos', BEAUTY_THEME.success),
            card('Ayuda', 'Ver ejemplos de lo que puedes preguntar.', 'ayuda', BEAUTY_THEME.accent)
        ],
        footer: 'Toca una opcion o dime que quieres consultar.'
    });
}

function sectionPayload(section) {
    const sections = {
        ventas: {
            eyebrow: 'Consulta de ventas',
            title: 'Ventas y ganancias',
            subtitle: 'Puedes pedir ganancias o movimiento de mercancia.',
            cards: [
                card('Ganancias del mes', 'Di: checa las ganancias del mes.', 'ventas', BEAUTY_THEME.primary),
                card('Mercancia vendida', 'Di: cuanto se vendio de la categoria.', 'ventas', BEAUTY_THEME.secondary),
                card('Menu principal', 'Volver a las opciones principales.', 'menu', BEAUTY_THEME.ink)
            ],
            footer: 'Ejemplos: ganancias del dia, ventas de Barberia, ultimos 15 dias.'
        },
        stock: {
            eyebrow: 'Consulta de stock',
            title: 'Inventario',
            subtitle: 'Revisa faltantes y niveles bajos de almacen.',
            cards: [
                card('Stock general', 'Di: consulta el stock general.', 'stock', BEAUTY_THEME.primary),
                card('Por producto', 'Di: consulta el stock de un producto.', 'stock', BEAUTY_THEME.secondary),
                card('Menu principal', 'Volver a las opciones principales.', 'menu', BEAUTY_THEME.ink)
            ],
            footer: 'Ejemplos: stock general, stock por familia, inventario en Barberia.'
        },
        pedidos: {
            eyebrow: 'Estado de pedidos',
            title: 'Pedidos',
            subtitle: 'Consulta pendientes, enviados y finalizados.',
            cards: [
                card('Por enviar', 'Di: cuantos pedidos por enviar tenemos.', 'pedidos', BEAUTY_THEME.primary),
                card('Enviados del mes', 'Di: pedidos enviados del mes.', 'pedidos', BEAUTY_THEME.success),
                card('Menu principal', 'Volver a las opciones principales.', 'menu', BEAUTY_THEME.ink)
            ],
            footer: 'Ejemplos: pedidos actuales, pedidos enviados de la semana.'
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
        cards: [
            card('Ventas', 'Cuando vuelvas, revisamos ganancias y mercancia.', 'menu', BEAUTY_THEME.primary),
            card('Stock', 'Tambien podemos revisar inventario y pedidos.', 'menu', BEAUTY_THEME.secondary)
        ],
        footer: 'Gracias por usar el asistente de Panamericana.'
    });
}

function resultPayload(title, subtitle, footer = 'Puedes pedir otra consulta o decir salir.') {
    return makePayload({
        eyebrow: 'Resultado',
        title,
        subtitle,
        cards: [
            card('Ventas', 'Consultar ganancias o mercancia.', 'ventas', BEAUTY_THEME.primary),
            card('Stock', 'Revisar inventario.', 'stock', BEAUTY_THEME.secondary),
            card('Pedidos', 'Consultar estado de pedidos.', 'pedidos', BEAUTY_THEME.success),
            card('Menu principal', 'Volver a las opciones principales.', 'menu', BEAUTY_THEME.ink)
        ],
        footer
    });
}

module.exports = {
    createAplDocument,
    welcomePayload,
    sectionPayload,
    goodbyePayload,
    resultPayload
};
