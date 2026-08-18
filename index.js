const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const express = require('express');

// --- VARIABLES GLOBALES Y SERVIDOR WEB ---
const app = express();
const PORT = process.env.PORT || 10000;

let currentQR = null;
let isConnected = false;

// Página web para escanear el QR desde el navegador
app.get('/', (req, res) => {
    if (isConnected) {
        return res.send(`
            <div style="text-align:center; font-family:sans-serif; margin-top:50px;">
                <h1 style="color:#25D366; font-size: 32px;">✅ BOT CONECTADO A WHATSAPP</h1>
                <p style="font-size: 18px; color: #555;">El servicio de respuestas automáticas se encuentra activo.</p>
            </div>
        `);
    }

    if (currentQR) {
        const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(currentQR)}`;
        return res.send(`
            <div style="text-align:center; font-family:sans-serif; margin-top:40px;">
                <h1 style="color:#075e54;">🤖 WhatsApp Bot Auto-Responder</h1>
                <p style="font-size: 16px;">Escanea este código QR desde tu celular (<strong>WhatsApp > Dispositivos vinculados</strong>):</p>
                <div style="margin: 20px auto; display: inline-block; padding: 15px; background: white; border: 4px solid #25D366; border-radius: 15px;">
                    <img src="${qrImageUrl}" alt="Código QR WhatsApp" style="width:300px; height:300px;" />
                </div>
                <p style="color: #888; font-size: 13px;">La página se actualizará automáticamente si cambia el código.</p>
                <script>setTimeout(() => location.reload(), 15000);</script>
            </div>
        `);
    }

    return res.send(`
        <div style="text-align:center; font-family:sans-serif; margin-top:50px;">
            <h2>⏳ Generando código QR...</h2>
            <p>Por favor espera unos segundos y refresca la página.</p>
            <script>setTimeout(() => location.reload(), 3000);</script>
        </div>
    `);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Servidor HTTP corriendo en el puerto ${PORT}`);
});

// --- GESTIÓN DE RESPUESTAS AUTOMÁTICAS ---
const RESPUESTAS_FILE = './respuestas.json';
let respuestasBot = {};

if (fs.existsSync(RESPUESTAS_FILE)) {
    try {
        respuestasBot = JSON.parse(fs.readFileSync(RESPUESTAS_FILE, 'utf-8'));
    } catch (e) {
        respuestasBot = {};
    }
} else {
    respuestasBot = {
        "hola": "¡Hola! 👋 ¿En qué te puedo ayudar hoy?",
        "precio": "El costo del servicio es de $200 MXN.",
        "horario": "Atendemos de Lunes a Viernes de 9:00 AM a 6:00 PM."
    };
    guardarRespuestas();
}

function guardarRespuestas() {
    fs.writeFileSync(RESPUESTAS_FILE, JSON.stringify(respuestasBot, null, 2));
}

const PREFIX = '.';

// --- CONEXIÓN DE WHATSAPP ---
async function iniciarBot() {
    const { state, saveCreds } = await useMultiFileAuthState('sesion_whatsapp');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            currentQR = qr;
            isConnected = false;
            console.log('📌 Nuevo código QR generado. Disponible en el sitio web.');
        }

        if (connection === 'close') {
            isConnected = false;
            const reconectar = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (reconectar) {
                console.log('🔄 Reconectando bot...');
                iniciarBot();
            } else {
                currentQR = null;
                console.log('❌ Sesión cerrada permanentemente.');
            }
        } else if (connection === 'open') {
            isConnected = true;
            currentQR = null;
            console.log('✅ Bot Conectado a WhatsApp con éxito.');
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

        // --- COMANDOS PARA TI DESDE WHATSAPP ---
        if (textoCliente.startsWith(PREFIX)) {
            const args = textoCliente.slice(PREFIX.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const contenido = args.join(' ');

            // AGREGAR: .add palabra | respuesta
            if (command === 'add' || command === 'agregar') {
                const partes = contenido.split('|');
                if (partes.length < 2) {
                    return sock.sendMessage(from, { 
                        text: `⚠️ *Formato incorrecto.*\nUsa: .add <palabra> | <respuesta>\n\n*Ejemplo:*\n.add precio | $200 MXN` 
                    }, { quoted: m });
                }

                const pregunta = partes[0].trim().toLowerCase();
                const respuesta = partes.slice(1).join('|').trim();

                respuestasBot[pregunta] = respuesta;
                guardarRespuestas();

                return sock.sendMessage(from, { 
                    text: `✅ *Guardado con éxito.*\n\n📌 *Palabra:* ${pregunta}\n💬 *Respuesta:* ${respuesta}` 
                }, { quoted: m });
            }

            // ELIMINAR: .del palabra
            if (command === 'del' || command === 'eliminar') {
                const preguntaAEliminar = contenido.trim().toLowerCase();
                if (respuestasBot[preguntaAEliminar]) {
                    delete respuestasBot[preguntaAEliminar];
                    guardarRespuestas();
                    return sock.sendMessage(from, { text: `🗑️ Se eliminó la respuesta para: "*${preguntaAEliminar}*"` }, { quoted: m });
                } else {
                    return sock.sendMessage(from, { text: `❌ No existe respuesta para "*${preguntaAEliminar}*"` }, { quoted: m });
                }
            }

            // VER TODAS: .ver
            if (command === 'ver' || command === 'respuestas') {
                const llaves = Object.keys(respuestasBot);
                if (llaves.length === 0) {
                    return sock.sendMessage(from, { text: `📂 No hay respuestas configuradas.` }, { quoted: m });
                }

                let lista = `📋 *CATÁLOGO DE RESPUESTAS AUTOMÁTICAS*\n\n`;
                llaves.forEach((p, index) => {
                    lista += `*${index + 1}. Palabra clave:* ${p}\n💬 *Respuesta:* ${respuestasBot[p]}\n\n`;
                });

                return sock.sendMessage(from, { text: lista }, { quoted: m });
            }
        }

        // --- RESPUESTA AUTOMÁTICA AL CLIENTE ---
        const mensajeEnMinusculas = textoCliente.toLowerCase();

        if (respuestasBot[mensajeEnMinusculas]) {
            return await sock.sendMessage(from, { text: respuestasBot[mensajeEnMinusculas] }, { quoted: m });
        }

        for (const clave in respuestasBot) {
            if (mensajeEnMinusculas.includes(clave)) {
                return await sock.sendMessage(from, { text: respuestasBot[clave] }, { quoted: m });
            }
        }
    });
}

iniciarBot();