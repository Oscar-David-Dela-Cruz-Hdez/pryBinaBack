const OpenAI = require('openai');

let client;

function getClient() {
    if (!process.env.OPENAI_API_KEY) return null;

    if (!client) {
        client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            timeout: 4500,
            maxRetries: 1
        });
    }

    return client;
}

async function generarResumenAdministrativo(datos) {
    const openai = getClient();
    if (!openai) return null;

    const response = await openai.responses.create({
        model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
        instructions: [
            'Eres el asistente administrativo de Distribuidora Panamericana.',
            'Responde en espanol de Mexico y en un maximo de dos oraciones.',
            'Usa exclusivamente las cifras y nombres incluidos en los datos.',
            'No inventes datos, causas, tendencias ni recomendaciones.',
            'Menciona como maximo tres aspectos que requieren atencion.',
            'No uses markdown, listas, simbolos especiales ni encabezados.'
        ].join(' '),
        input: JSON.stringify(datos),
        max_output_tokens: 120
    });

    return response.output_text?.trim() || null;
}

module.exports = { generarResumenAdministrativo };
