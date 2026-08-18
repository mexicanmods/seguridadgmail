const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

// Archivo local donde se guardan permanentemente las preguntas y respuestas
const RESPUESTAS_FILE = './respuestas.json';

// Cargar respuestas existentes o inicializar base de datos
let respuestasBot = {};

if (fs.existsSync(RESPUESTAS_FILE)) {
    try {
        respuestasBot = JSON.parse(fs.readFileSync(RESPUESTAS_FILE, 'utf-8'));
    } catch (e) {
        respuestasBot = {};
    }
} else {
    // Respuestas iniciales por defecto
    respuestasBot = {
        "hola": "¡Hola! 👋 ¿En qué te puedo ayudar hoy?",
        "precio": "El costo del servicio es de $200 MXN.",
        "horario": "Atendemos de Lunes a Viernes de 9:00 AM a 6:00 PM."
    };
    guardarRespuestas();
}

// Función para escribir en el archivo JSON
function guardarRespuestas() {
    fs.writeFileSync(RESPUESTAS_FILE, JSON.stringify(respuestasBot, null, 2));
}

const PREFIX = '.';

async function iniciarBot() {
    const { state, saveCreds } = await useMultiFileAuthState('sesion_whatsapp');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reconectar = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (reconectar) iniciarBot();
        } else if (connection === 'open') {
            console.log('✅ Bot de Auto-Respuesta Conectado Correctamente.');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const m = messages[0];
        if (!m.message || m.key.fromMe || m.key.remoteJid === 'status@broadcast') return;

        const from = m.key.remoteJid;
        const textoCliente = (m.message.conversation || 
                             m.message.extendedTextMessage?.text || '').trim();

        if (!textoCliente) return;

        // ===================================================
        // ⚙️ PANEL DE CONTROL (COMANDOS PARA TI)
        // ===================================================
        if (textoCliente.startsWith(PREFIX)) {
            const args = textoCliente.slice(PREFIX.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const contenido = args.join(' ');

            // COMANDO 1: AÑADIR O EDITAR (.add palabra | respuesta)
            if (command === 'add' || command === 'agregar') {
                const partes = contenido.split('|');
                if (partes.length < 2) {
                    return sock.sendMessage(from, { 
                        text: `⚠️ *Formato incorrecto.*\nUsa: .add <palabra o pregunta> | <respuesta>\n\n*Ejemplo:*\n.add precio | El costo es de $500` 
                    }, { quoted: m });
                }

                const pregunta = partes[0].trim().toLowerCase();
                const respuesta = partes.slice(1).join('|').trim();

                respuestasBot[pregunta] = respuesta;
                guardarRespuestas();

                return sock.sendMessage(from, { 
                    text: `✅ *Respuesta guardada exitosamente.*\n\n📌 *Palabra clave:* ${pregunta}\n💬 *Respuesta del bot:* ${respuesta}` 
                }, { quoted: m });
            }

            // COMANDO 2: ELIMINAR (.del palabra)
            if (command === 'del' || command === 'eliminar') {
                const preguntaAEliminar = contenido.trim().toLowerCase();
                if (!preguntaAEliminar) {
                    return sock.sendMessage(from, { text: `⚠️ Ingresa la palabra clave a eliminar.\nEjemplo: .del precio` }, { quoted: m });
                }

                if (respuestasBot[preguntaAEliminar]) {
                    delete respuestasBot[preguntaAEliminar];
                    guardarRespuestas();
                    return sock.sendMessage(from, { text: `🗑️ Se eliminó la respuesta para: "*${preguntaAEliminar}*"` }, { quoted: m });
                } else {
                    return sock.sendMessage(from, { text: `❌ No existe ninguna respuesta guardada con la palabra "*${preguntaAEliminar}*"` }, { quoted: m });
                }
            }

            // COMANDO 3: VER TODAS (.ver)
            if (command === 'ver' || command === 'respuestas') {
                const llaves = Object.keys(respuestasBot);
                if (llaves.length === 0) {
                    return sock.sendMessage(from, { text: `📂 No hay respuestas configuradas actualmente.` }, { quoted: m });
                }

                let lista = `📋 *CATÁLOGO DE RESPUESTAS AUTOMÁTICAS*\n\n`;
                llaves.forEach((p, index) => {
                    lista += `*${index + 1}. Palabra clave:* ${p}\n💬 *Respuesta:* ${respuestasBot[p]}\n\n`;
                });

                return sock.sendMessage(from, { text: lista }, { quoted: m });
            }
        }

        // ===================================================
        // 🤖 RESPUESTA AUTOMÁTICA AL CLIENTE
        // ===================================================
        const mensajeEnMinusculas = textoCliente.toLowerCase();

        // 1. Coincidencia exacta
        if (respuestasBot[mensajeEnMinusculas]) {
            return await sock.sendMessage(from, { text: respuestasBot[mensajeEnMinusculas] }, { quoted: m });
        }

        // 2. Coincidencia si el mensaje contiene la palabra clave
        for (const clave in respuestasBot) {
            if (mensajeEnMinusculas.includes(clave)) {
                return await sock.sendMessage(from, { text: respuestasBot[clave] }, { quoted: m });
            }
        }
    });
}

iniciarBot();