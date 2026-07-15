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
const ALEXA_PUBLIC_BASE_URL = (process.env.ALEXA_PUBLIC_BASE_URL || 'https://prybinaback.onrender.com').replace(/\/$/, '');
const LOGO_IMAGE = `${ALEXA_PUBLIC_BASE_URL}/assets/images/panamericana.png`;

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
        token: item.action,
        primaryAction: [
            {
                type: 'SendEvent',
                arguments: [item.action]
            }
        ]
    }));
}

function toImageListItems(cards) {
    return cards.map((item) => ({
        primaryText: item.title,
        secondaryText: item.subtitle,
        imageSource: item.imageSource || FALLBACK_PRODUCT_IMAGE,
        token: item.action,
        primaryAction: [
            {
                type: 'SendEvent',
                arguments: [item.action]
            }
        ]
    }));
}

function backButtonProps(screen) {
    if (screen.showBackButton === false) {
        return { headerBackButton: false };
    }

    return {
        headerBackButton: true,
        headerBackButtonCommand: {
            type: 'SendEvent',
            arguments: [screen.backAction || 'menu']
        },
        headerBackButtonAccessibilityLabel: 'Volver al menu'
    };
}

function createHeadlineDocument(payload) {
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
                    type: 'AlexaHeadline',
                    id: 'panamericanaHeadline',
                    headerTitle: screen.eyebrow,
                    ...backButtonProps(screen),
                    headerAttributionImage: screen.logoUrl,
                    headerAttributionPrimacy: true,
                    primaryText: screen.title,
                    secondaryText: screen.subtitle,
                    footerHintText: screen.footer,
                    backgroundImageSource: screen.backgroundImage,
                    backgroundBlur: true,
                    backgroundColorOverlay: true
                }
            ]
        }
    };
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
                    ...backButtonProps(screen),
                    headerAttributionImage: screen.logoUrl,
                    headerAttributionPrimacy: true,
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

function createGridListDocument(payload) {
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
                    type: 'AlexaGridList',
                    id: 'panamericanaGridList',
                    headerTitle: screen.title,
                    headerSubtitle: screen.eyebrow,
                    ...backButtonProps(screen),
                    headerAttributionImage: screen.logoUrl,
                    headerAttributionPrimacy: true,
                    backgroundImageSource: screen.backgroundImage,
                    backgroundBlur: true,
                    backgroundColorOverlay: true,
                    listItems: toImageListItems(screen.cards),
                    imageAspectRatio: 'square',
                    imageScale: 'best-fill',
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
                    ...backButtonProps(screen),
                    headerAttributionImage: screen.logoUrl,
                    headerAttributionPrimacy: true,
                    backgroundImageSource: screen.backgroundImage,
                    backgroundBlur: true,
                    backgroundColorOverlay: true,
                    backgroundScale: 'best-fill',
                    backgroundAlign: 'center',
                    listItems: toImageListItems(screen.cards),
                    touchForward: true,
                    footerHintText: screen.footer
                }
            ]
        }
    };
}

function keypadButton(label, action, width = '30%', accent = false) {
    return {
        type: 'TouchWrapper',
        width,
        height: '${viewport.height < 620 ? "46dp" : "54dp"}',
        onPress: [
            {
                type: 'SendEvent',
                arguments: [action]
            }
        ],
        item: {
            type: 'Frame',
            width: '100%',
            height: '100%',
            borderRadius: '8dp',
            backgroundColor: accent ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.16)',
            borderColor: accent ? '#FFFFFF' : 'rgba(255,255,255,0.34)',
            borderWidth: accent ? '2dp' : '1dp',
            item: {
                type: 'Text',
                width: '100%',
                height: '100%',
                text: label,
                color: '#FFFFFF',
                fontSize: '${viewport.height < 620 ? "19dp" : "23dp"}',
                fontWeight: 'bold',
                textAlign: 'center',
                textAlignVertical: 'center',
                maxLines: 1
            }
        }
    };
}

function keypadRow(items) {
    return {
        type: 'Container',
        direction: 'row',
        width: '100%',
        justifyContent: 'spaceBetween',
        spacing: '${viewport.height < 620 ? "7dp" : "10dp"}',
        items
    };
}

function createKeypadDocument(payload) {
    const { screen } = payload;
    const tokenInput = screen.tokenInput || '';

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
                            opacity: 0.22,
                            position: 'absolute'
                        },
                        {
                            type: 'Container',
                            width: '100%',
                            height: '100%',
                            alignItems: 'center',
                            paddingLeft: '${viewport.width < 900 ? "38dp" : "72dp"}',
                            paddingRight: '${viewport.width < 900 ? "38dp" : "72dp"}',
                            paddingTop: '${viewport.height < 620 ? "22dp" : "32dp"}',
                            paddingBottom: '${viewport.height < 620 ? "18dp" : "26dp"}',
                            items: [
                                {
                                    type: 'Container',
                                    direction: 'row',
                                    width: '${viewport.width < 900 ? "92%" : "620dp"}',
                                    height: '${viewport.height < 620 ? "42dp" : "54dp"}',
                                    alignItems: 'center',
                                    justifyContent: 'spaceBetween',
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
                                            type: 'Image',
                                            source: screen.logoUrl,
                                            width: '${viewport.height < 620 ? "56dp" : "72dp"}',
                                            height: '${viewport.height < 620 ? "56dp" : "72dp"}',
                                            scale: 'best-fit',
                                            accessibilityLabel: 'Logo de Distribuidora Panamericana'
                                        }
                                    ]
                                },
                                {
                                    type: 'Text',
                                    width: '${viewport.width < 900 ? "92%" : "620dp"}',
                                    text: screen.title,
                                    color: '#FFFFFF',
                                    fontSize: '${viewport.height < 620 ? "34dp" : "46dp"}',
                                    fontWeight: 'bold',
                                    spacing: '6dp',
                                    maxLines: 1
                                },
                                {
                                    type: 'Text',
                                    width: '${viewport.width < 900 ? "92%" : "620dp"}',
                                    text: screen.subtitle,
                                    color: '#F8DDE9',
                                    fontSize: '${viewport.height < 620 ? "17dp" : "21dp"}',
                                    spacing: '6dp',
                                    maxLines: 2
                                },
                                {
                                    type: 'Frame',
                                    width: '${viewport.width < 900 ? "92%" : "620dp"}',
                                    height: '${viewport.height < 620 ? "48dp" : "56dp"}',
                                    backgroundColor: 'rgba(0,0,0,0.28)',
                                    borderColor: BEAUTY_THEME.accent,
                                    borderWidth: '1dp',
                                    borderRadius: '8dp',
                                    spacing: '${viewport.height < 620 ? "10dp" : "14dp"}',
                                    item: {
                                        type: 'Text',
                                        width: '100%',
                                        height: '100%',
                                        text: tokenInput || '_____',
                                        color: '#FFFFFF',
                                        fontSize: '${viewport.height < 620 ? "32dp" : "46dp"}',
                                        fontWeight: 'bold',
                                        textAlign: 'center',
                                        textAlignVertical: 'center',
                                        maxLines: 1
                                    }
                                },
                                {
                                    type: 'Container',
                                    width: '${viewport.width < 900 ? "92%" : "620dp"}',
                                    spacing: '${viewport.height < 620 ? "7dp" : "10dp"}',
                                    items: [
                                        keypadRow([
                                            keypadButton('1', 'token_digit:1'),
                                            keypadButton('2', 'token_digit:2'),
                                            keypadButton('3', 'token_digit:3')
                                        ]),
                                        keypadRow([
                                            keypadButton('4', 'token_digit:4'),
                                            keypadButton('5', 'token_digit:5'),
                                            keypadButton('6', 'token_digit:6')
                                        ]),
                                        keypadRow([
                                            keypadButton('7', 'token_digit:7'),
                                            keypadButton('8', 'token_digit:8'),
                                            keypadButton('9', 'token_digit:9')
                                        ]),
                                        keypadRow([
                                            keypadButton('Borrar', 'token_backspace'),
                                            keypadButton('0', 'token_digit:0'),
                                            keypadButton('Limpiar', 'token_clear')
                                        ])
                                    ]
                                },
                                {
                                    type: 'Container',
                                    direction: 'row',
                                    width: '${viewport.width < 900 ? "92%" : "620dp"}',
                                    spacing: '${viewport.height < 620 ? "7dp" : "10dp"}',
                                    items: [
                                        keypadButton('Ingresar', 'token_submit', '100%', true)
                                    ]
                                },
                                {
                                    type: 'Text',
                                    width: '${viewport.width < 900 ? "92%" : "620dp"}',
                                    text: screen.footer,
                                    color: '#F8DDE9',
                                    fontSize: '${viewport.height < 620 ? "15dp" : "18dp"}',
                                    maxLines: 2,
                                    textAlign: 'center',
                                    spacing: '10dp'
                                }
                            ]
                        }
                    ]
                }
            }
        }
    };
}

function choiceComponent(item, index) {
    return {
        type: 'TouchWrapper',
        width: '${viewport.width < 900 ? "100%" : "48%"}',
        minHeight: '${viewport.height < 620 ? "82dp" : "96dp"}',
        spacing: '12dp',
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
            borderColor: index === 0 ? BEAUTY_THEME.accent : BEAUTY_THEME.secondary,
            borderWidth: '2dp',
            backgroundColor: 'rgba(255,255,255,0.10)',
            item: {
                type: 'Container',
                direction: 'row',
                width: '100%',
                height: '100%',
                alignItems: 'center',
                paddingLeft: '${viewport.width < 900 ? "14dp" : "18dp"}',
                paddingRight: '${viewport.width < 900 ? "14dp" : "18dp"}',
                paddingTop: '12dp',
                paddingBottom: '12dp',
                items: [
                    {
                        type: 'Frame',
                        width: '${viewport.height < 620 ? "38dp" : "46dp"}',
                        height: '${viewport.height < 620 ? "38dp" : "46dp"}',
                        borderRadius: '23dp',
                        backgroundColor: index === 0 ? BEAUTY_THEME.accent : BEAUTY_THEME.primary,
                        item: {
                            type: 'Text',
                            text: `${index + 1}`,
                            color: '#FFFFFF',
                            fontSize: '${viewport.height < 620 ? "20dp" : "24dp"}',
                            fontWeight: 'bold',
                            textAlign: 'center',
                            textAlignVertical: 'center'
                        }
                    },
                    {
                        type: 'Container',
                        grow: 1,
                        spacing: '12dp',
                        items: [
                            {
                                type: 'Text',
                                text: item.title,
                                color: '#FFFFFF',
                                fontSize: '${viewport.height < 620 ? "21dp" : "26dp"}',
                                fontWeight: 'bold',
                                maxLines: 1
                            },
                            {
                                type: 'Text',
                                text: item.subtitle,
                                color: '#F8DDE9',
                                fontSize: '${viewport.height < 620 ? "15dp" : "18dp"}',
                                maxLines: 2,
                                spacing: '2dp'
                            }
                        ]
                    }
                ]
            }
        }
    };
}

function menuButtonComponent() {
    return {
        type: 'TouchWrapper',
        position: 'absolute',
        top: '${viewport.height < 620 ? "18dp" : "30dp"}',
        right: '${viewport.width < 900 ? "28dp" : "56dp"}',
        width: '${viewport.width < 900 ? "116dp" : "132dp"}',
        height: '${viewport.height < 620 ? "42dp" : "48dp"}',
        onPress: [
            {
                type: 'SendEvent',
                arguments: ['menu']
            }
        ],
        item: {
            type: 'Frame',
            width: '100%',
            height: '100%',
            borderRadius: '8dp',
            backgroundColor: BEAUTY_THEME.ink,
            borderColor: BEAUTY_THEME.accent,
            borderWidth: '2dp',
            item: {
                type: 'Text',
                text: 'Menu',
                color: '#FFFFFF',
                fontSize: '${viewport.height < 620 ? "17dp" : "19dp"}',
                fontWeight: 'bold',
                textAlign: 'center',
                textAlignVertical: 'center'
            }
        }
    };
}

function createMultipleChoiceDocument(payload) {
    const { screen } = payload;
    const items = [
        {
            type: 'Image',
            source: screen.backgroundImage,
            width: '100%',
            height: '100%',
            scale: 'best-fill',
            opacity: 0.2,
            position: 'absolute'
        },
        {
            type: 'Container',
            width: '100%',
            height: '100%',
            paddingLeft: '${viewport.width < 900 ? "32dp" : "64dp"}',
            paddingRight: '${viewport.width < 900 ? "32dp" : "64dp"}',
            paddingTop: '${viewport.height < 620 ? "24dp" : "42dp"}',
            paddingBottom: '${viewport.height < 620 ? "22dp" : "34dp"}',
            items: [
                {
                    type: 'Text',
                    text: screen.eyebrow,
                    color: BEAUTY_THEME.accent,
                    fontSize: '${viewport.height < 620 ? "17dp" : "21dp"}',
                    fontWeight: 'bold',
                    maxLines: 1
                },
                {
                    type: 'Text',
                    text: screen.title,
                    color: '#FFFFFF',
                    fontSize: '${viewport.height < 620 ? "34dp" : "46dp"}',
                    fontWeight: 'bold',
                    maxLines: 2,
                    spacing: '6dp'
                },
                {
                    type: 'Text',
                    text: screen.subtitle,
                    color: '#F8DDE9',
                    fontSize: '${viewport.height < 620 ? "18dp" : "23dp"}',
                    maxLines: 2,
                    spacing: '6dp'
                },
                {
                    type: 'ScrollView',
                    grow: 1,
                    spacing: '${viewport.height < 620 ? "16dp" : "26dp"}',
                    item: {
                        type: 'Container',
                        direction: 'row',
                        wrap: 'wrap',
                        width: '100%',
                        justifyContent: 'spaceBetween',
                        items: screen.cards.map(choiceComponent)
                    }
                },
                {
                    type: 'Text',
                    text: screen.footer,
                    color: '#F8DDE9',
                    fontSize: '${viewport.height < 620 ? "15dp" : "18dp"}',
                    maxLines: 2,
                    textAlign: 'center',
                    width: '100%',
                    spacing: '12dp'
                }
            ]
        }
    ];

    if (screen.showBackButton !== false) {
        items.push(menuButtonComponent());
    }

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
                    items
                }
            }
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
    if (payload.template === 'keypad') return createKeypadDocument(payload);
    if (payload.template === 'headline') return createHeadlineDocument(payload);
    if (payload.template === 'multipleChoice') return createMultipleChoiceDocument(payload);
    if (payload.template === 'gridList') return createGridListDocument(payload);
    if (payload.template === 'paginatedList') return createPaginatedListDocument(payload);
    if (payload.template === 'cardsLayout') return createCardsLayoutDocument(payload);
    return createTextListDocument(payload);
}

function welcomePayload() {
    return makePayload('textList', {
        eyebrow: 'Menu principal',
        title: 'Panamericana',
        subtitle: 'Toca una opcion o di una frase de ejemplo.',
        cards: [
            option('Ventas', 'Di: checa las ganancias del mes.', 'ventas'),
            option('Inventario', 'Di: consulta el inventario de 4x4.', 'stock'),
            option('Pedidos', 'Di: dime los pedidos por enviar.', 'pedidos'),
            option('Resumen inteligente', 'Di: dame un resumen del negocio.', 'resumen_ia'),
            option('Ayuda', 'Ver mas frases que Alexa entiende.', 'ayuda'),
            option('Salir', 'Di: salir, cancelar o detener.', 'salir')
        ],
        footer: 'Tambien puedes decir ventas, inventario, pedidos, ayuda o salir.',
        showBackButton: false
    });
}

function menuPayload() {
    return makePayload('textList', {
        eyebrow: 'Menu principal',
        title: 'Panamericana',
        subtitle: 'Toca una opcion o di una frase de ejemplo.',
        cards: [
            option('Ventas', 'Di: checa las ganancias del mes.', 'ventas'),
            option('Inventario', 'Di: consulta el inventario de 4x4.', 'stock'),
            option('Pedidos', 'Di: dime los pedidos por enviar.', 'pedidos'),
            option('Resumen inteligente', 'Di: que necesita atencion hoy.', 'resumen_ia'),
            option('Ayuda', 'Ver mas frases que Alexa entiende.', 'ayuda'),
            option('Salir', 'Di: salir, cancelar o detener.', 'salir')
        ],
        footer: 'Tambien puedes decir ventas, inventario, pedidos, ayuda o salir.',
        showBackButton: false
    });
}

function sectionPayload(section) {
    const sections = {
        ventas: {
            template: 'textList',
            eyebrow: 'Consulta de ventas',
            title: 'Ventas',
            subtitle: 'Elige un rango o usa una frase compatible.',
            cards: [
                option('Por dia', 'Di: checa las ganancias del dia.', 'ventas_ganancias_dia'),
                option('Por semana', 'Di: cuanto vendimos en la semana.', 'ventas_ganancias_semana'),
                option('Por mes', 'Di: checa las ganancias del mes.', 'ventas_ganancias_mes'),
                option('Personalizado', 'Di: hace 15 dias.', 'ventas_ganancias_personalizado'),
                option('Menu principal', 'Volver al inicio.', 'menu')
            ],
            footer: 'Para rango personalizado di: ganancias de los ultimos 15 dias.'
        },
        stock: {
            template: 'textList',
            eyebrow: 'Consulta de inventario',
            title: 'Inventario',
            subtitle: 'Elige como buscar o di el nombre directamente.',
            cards: [
                option('General', 'Di: consulta inventario general.', 'stock_general'),
                option('Producto', 'Di: consulta inventario de 4x4 minoxidil.', 'stock_producto'),
                option('Familia', 'Di: consulta inventario de Barberia.', 'stock_familia'),
                option('Marca', 'Di: consulta inventario de Andis.', 'stock_marca'),
                option('Menu principal', 'Volver al inicio.', 'menu')
            ],
            footer: 'Para producto, marca o familia, completa el nombre por voz.'
        },
        pedidos: {
            template: 'textList',
            eyebrow: 'Estado de pedidos',
            title: 'Pedidos',
            subtitle: 'Elige el estado que quieres consultar.',
            cards: [
                option('Por enviar', 'Di: cuantos pedidos por enviar tenemos.', 'pedidos_por_enviar'),
                option('Enviados', 'Di: pedidos enviados del mes.', 'pedidos_enviados'),
                option('Finalizados', 'Di: pedidos finalizados de la semana.', 'pedidos_finalizados'),
                option('Menu principal', 'Volver al inicio.', 'menu')
            ],
            footer: 'Enviados y finalizados permiten rangos.'
        },
        pedidosEnviados: {
            template: 'textList',
            eyebrow: 'Pedidos enviados',
            title: 'Rango',
            subtitle: 'Elige el periodo para pedidos enviados.',
            cards: [
                option('Por dia', 'Di: pedidos enviados del dia.', 'pedidos_enviados_dia'),
                option('Por semana', 'Di: pedidos enviados de la semana.', 'pedidos_enviados_semana'),
                option('Por mes', 'Di: pedidos enviados del mes.', 'pedidos_enviados_mes'),
                option('Personalizado', 'Di: pedidos enviados de los ultimos 15 dias.', 'pedidos_enviados_personalizado'),
                option('Menu principal', 'Volver al inicio.', 'menu')
            ],
            footer: 'Ejemplo: pedidos enviados de los ultimos 15 dias.'
        },
        pedidosFinalizados: {
            template: 'textList',
            eyebrow: 'Pedidos finalizados',
            title: 'Rango',
            subtitle: 'Elige el periodo para pedidos finalizados.',
            cards: [
                option('Por dia', 'Di: pedidos finalizados del dia.', 'pedidos_finalizados_dia'),
                option('Por semana', 'Di: pedidos finalizados de la semana.', 'pedidos_finalizados_semana'),
                option('Por mes', 'Di: pedidos finalizados del mes.', 'pedidos_finalizados_mes'),
                option('Personalizado', 'Di: pedidos finalizados de los ultimos 15 dias.', 'pedidos_finalizados_personalizado'),
                option('Menu principal', 'Volver al inicio.', 'menu')
            ],
            footer: 'Ejemplo: pedidos finalizados de los ultimos 15 dias.'
        },
        ayuda: {
            template: 'textList',
            eyebrow: 'Ayuda',
            title: 'Frases utiles',
            subtitle: 'Elige una ruta o usa una frase de ejemplo.',
            cards: [
                option('Ventas', 'Checa las ganancias del mes.', 'ventas'),
                option('Inventario', 'Consulta el inventario de 4x4.', 'stock'),
                option('Pedidos', 'Dime los pedidos por enviar.', 'pedidos'),
                option('Menu principal', 'Volver al inicio.', 'menu')
            ],
            footer: 'Tambien puedes decir menu principal o salir.'
        }
    };

    const selectedSection = sections[section] || sections.ayuda;
    const { template = 'textList', ...screen } = selectedSection;
    return makePayload(template, screen);
}

function goodbyePayload() {
    return makePayload('headline', {
        eyebrow: 'Distribuidora Panamericana',
        title: 'Hasta luego',
        subtitle: 'Sesion finalizada.',
        showBackButton: false,
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
            option('Inventario', 'Revisar productos, marcas o familias.', 'stock'),
            option('Pedidos', 'Consultar estado de pedidos.', 'pedidos'),
            option('Menu principal', 'Volver al inicio.', 'menu')
        ],
        footer
    });
}

function promptPayload(title, subtitle, footer, examples = 'Di: ganancias de los ultimos 15 dias.') {
    return makePayload('textList', {
        eyebrow: 'Completar por voz',
        title,
        subtitle,
        cards: [
            option('Frase compatible', examples, 'noop'),
            option('Menu principal', 'Cancelar y volver al menu.', 'menu')
        ],
        footer
    });
}

function ventasPersonalizadoPayload() {
    return makePayload('textList', {
        eyebrow: 'Consulta de ventas',
        title: 'Rango personalizado',
        subtitle: 'Selecciona cuantos dias deseas consultar.',
        backAction: 'ventas',
        cards: [
            option('Ultimos 15 dias', 'Consultar ganancias de los ultimos 15 dias.', 'ventas_ganancias_dias:15'),
            option('Ultimos 30 dias', 'Consultar ganancias de los ultimos 30 dias.', 'ventas_ganancias_dias:30'),
            option('Ultimos 60 dias', 'Consultar ganancias de los ultimos 60 dias.', 'ventas_ganancias_dias:60'),
            option('Ultimos 100 dias', 'Consultar ganancias de los ultimos 100 dias.', 'ventas_ganancias_dias:100'),
            option('Otro rango por voz', 'Di: ganancias de los ultimos 45 dias.', 'ventas_ganancias_otro_rango'),
            option('Volver a ventas', 'Regresar a los rangos de ventas.', 'ventas')
        ],
        footer: 'Toca un rango o di: ganancias de los ultimos 45 dias.'
    });
}

function ventasResultPayload(subtitle) {
    return makePayload('textList', {
        eyebrow: 'Resultado de ventas',
        title: 'Ventas',
        subtitle,
        backAction: 'ventas',
        cards: [
            option('Por dia', 'Di: checa las ganancias del dia.', 'ventas_ganancias_dia'),
            option('Por semana', 'Di: cuanto vendimos en la semana.', 'ventas_ganancias_semana'),
            option('Por mes', 'Di: checa las ganancias del mes.', 'ventas_ganancias_mes'),
            option('Personalizado', 'Di: ganancias de los ultimos 15 dias.', 'ventas_ganancias_personalizado'),
            option('Menu principal', 'Volver al inicio.', 'menu')
        ],
        footer: 'Elige otro rango o di menu principal para salir de ventas.'
    });
}

function pedidosResultPayload(title, subtitle) {
    return makePayload('textList', {
        eyebrow: 'Resultado de pedidos',
        title,
        subtitle,
        backAction: 'pedidos',
        cards: [
            option('Por enviar', 'Di: cuantos pedidos por enviar tenemos.', 'pedidos_por_enviar'),
            option('Enviados', 'Elegir otro rango de pedidos enviados.', 'pedidos_enviados'),
            option('Finalizados', 'Elegir otro rango de pedidos finalizados.', 'pedidos_finalizados'),
            option('Menu principal', 'Volver al inicio.', 'menu')
        ],
        footer: 'Elige otro estado o di menu principal para salir de pedidos.'
    });
}

function tokenMask(tokenInput = '') {
    const entered = String(tokenInput).slice(0, 5).length;
    return `${'•'.repeat(entered)}${'_'.repeat(5 - entered)}`;
}

function authPayload(message = 'Para continuar, dime tu token de administrador de cinco digitos.', tokenInput = '') {
    return makePayload('keypad', {
        eyebrow: 'Acceso administrador',
        title: 'Ingresa tu token',
        subtitle: message,
        tokenInput: tokenInput || tokenMask(''),
        cards: [],
        footer: 'Por voz di el numero completo. Ejemplo: mi token es sesenta y seis mil ciento veintitres.',
        showBackButton: false
    });
}

function productListPayload(title, subtitle, products, footer = 'Toca menu principal o pide otra consulta.') {
    const visibleProducts = products.slice(0, 12);
    const template = visibleProducts.length > 6 ? 'paginatedList' : 'gridList';
    const cards = visibleProducts.map((product) => option(
        product.nombre,
        `Stock: ${product.stock ?? 0}${product.marca?.nombre ? ` | ${product.marca.nombre}` : ''}`,
        `stock_detalle:${product._id}`,
        BEAUTY_THEME.primary,
        product.imagenUrl || FALLBACK_PRODUCT_IMAGE
    ));

    cards.push(option('Menu principal', 'Volver al inicio.', 'menu', BEAUTY_THEME.ink, FALLBACK_PRODUCT_IMAGE));

    return makePayload(template, {
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
    ventasResultPayload,
    ventasPersonalizadoPayload,
    pedidosResultPayload,
    promptPayload,
    authPayload,
    productListPayload
};
