const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const express = require('express');
const https = require('https');
const http = require('http');

// --- 1. SERVIDOR HTTP Y KEEP-ALIVE ---
const app = express();
const PORT = process.env.PORT || 10000;

let currentQR = null;
let isConnected = false;

app.get('/', (req, res) => {
    if (isConnected) {
        return res.send(`
            <div style="text-align:center; font-family:sans-serif; margin-top:50px;">
                <h1 style="color:#25D366; font-size: 32px;">✅ BOT CONECTADO A WHATSAPP</h1>
                <p style="font-size: 18px; color: #555;">El servicio de respuestas automáticas se encuentra activo 24/7.</p>
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
    
    // Auto-ping interno cada 10 minutos para mantener Render encendido 24/7
    setInterval(() => {
        const renderUrl = process.env.RENDER_EXTERNAL_URL;
        if (renderUrl) {
            const client = renderUrl.startsWith('https') ? https : http;
            client.get(renderUrl, (res) => {
                console.log(`⏰ [Keep-Alive] Ping enviado a ${renderUrl} - Estado: ${res.statusCode}`);
            }).on('error', (err) => {
                console.log(`⚠️ [Keep-Alive] Error al enviar ping: ${err.message}`);
            });
        }
    }, 10 * 60 * 1000);
});

// --- 2. GESTIÓN DE RESPUESTAS AUTOMÁTICAS ---
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
        "hola": { text: "¡Hola! 👋 ¿En qué te puedo ayudar hoy?" },
        "precio": { text: "El costo del servicio es de $200 MXN." }
    };
    guardarRespuestas();
}

function guardarRespuestas() {
    fs.writeFileSync(RESPUESTAS_FILE, JSON.stringify(respuestasBot, null, 2));
}

const PREFIX = '.';

// --- 3. CONEXIÓN Y EVENTOS DE WHATSAPP ---
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
            console.log('📌 Nuevo código QR generado. Disponible en la página web.');
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
        if (!m.message || m.key.remoteJid === 'status@broadcast') return;

        const from = m.key.remoteJid;
        const esMio = m.key.fromMe;
        const textoCliente = (m.message.conversation || 
                             m.message.extendedTextMessage?.text || '').trim();

        if (!textoCliente) return;

        // ===================================================
        // ⚙️ PANEL DE CONTROL (RESTRINGIDO SOLO PARA TI)
        // ===================================================
        if (textoCliente.startsWith(PREFIX)) {
            // Si el mensaje NO proviene de tu propio chat, se ignora
            if (!esMio) return;

            const args = textoCliente.slice(PREFIX.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const contenido = args.join(' ');

            // AGREGAR: .add palabra | respuesta texto | URL_imagen (opcional)
            if (command === 'add' || command === 'agregar') {
                const partes = contenido.split('|');
                if (partes.length < 2) {
                    return sock.sendMessage(from, { 
                        text: `⚠️ *Formato incorrecto.*\n\n*Texto solo:*\n.add palabra | respuesta\n\n*Texto con Imagen:*\n.add palabra | respuesta | https://enlace_de_la_imagen.jpg` 
                    }, { quoted: m });
                }

                const pregunta = partes[0].trim().toLowerCase();
                const respuestaTexto = partes[1].trim();
                const urlImagen = partes[2] ? partes[2].trim() : null;

                respuestasBot[pregunta] = {
                    text: respuestaTexto,
                    image: urlImagen
                };
                guardarRespuestas();

                let mensajeConfirmacion = `✅ *Guardado con éxito.*\n\n📌 *Palabra:* ${pregunta}\n💬 *Respuesta:* ${respuestaTexto}`;
                if (urlImagen) {
                    mensajeConfirmacion += `\n🖼️ *Imagen:* ${urlImagen}`;
                }

                return sock.sendMessage(from, { text: mensajeConfirmacion }, { quoted: m });
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
                    const datos = respuestasBot[p];
                    const texto = typeof datos === 'string' ? datos : datos.text;
                    const tieneImagen = typeof datos === 'object' && datos.image ? ' 🖼️ (Con Imagen)' : '';
                    lista += `*${index + 1}. Palabra clave:* ${p}${tieneImagen}\n💬 *Respuesta:* ${texto}\n\n`;
                });

                return sock.sendMessage(from, { text: lista }, { quoted: m });
            }
        }

        // ===================================================
        // 🤖 RESPUESTAS AUTOMÁTICAS A CLIENTES
        // ===================================================
        if (esMio) return; // Evita que se responda a ti mismo en conversaciones normales

        const mensajeEnMinusculas = textoCliente.toLowerCase();

        // Función para enviar respuesta (Soporta Texto o Texto + Imagen)
        const enviarRespuesta = async (clave) => {
            const data = respuestasBot[clave];
            
            // Compatibilidad si la respuesta es de texto simple antiguo
            if (typeof data === 'string') {
                return await sock.sendMessage(from, { text: data }, { quoted: m });
            }

            // Si incluye enlace de imagen
            if (data.image) {
                return await sock.sendMessage(from, {
                    image: { url: data.image },
                    caption: data.text
                }, { quoted: m });
            }

            // Si es solo texto
            return await sock.sendMessage(from, { text: data.text }, { quoted: m });
        };

        // 1. Coincidencia exacta
        if (respuestasBot[mensajeEnMinusculas]) {
            return await enviarRespuesta(mensajeEnMinusculas);
        }

        // 2. Coincidencia si la frase contiene la palabra clave
        for (const clave in respuestasBot) {
            if (mensajeEnMinusculas.includes(clave)) {
                return await enviarRespuesta(clave);
            }
        }
    });
}

iniciarBot();