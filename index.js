const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    downloadContentFromMessage
} = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core');
const axios = require('axios');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

// --- SERVIDOR EXPRESS (KEEPALIVE Y PANEL QR) ---
const app = express();
const PORT = process.env.PORT || 3000;
let currentQR = null;
let isConnected = false;

app.get('/', (req, res) => {
    if (isConnected) {
        return res.send(`
            <div style="text-align:center; font-family:sans-serif; margin-top:50px;">
                <h1 style="color:green;">✅ SAMANTHA LA HACKER BOT ONLINE</h1>
                <p>El bot está activo y conectado en WhatsApp.</p>
            </div>
        `);
    }
    if (currentQR) {
        const qrImageUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(currentQR);
        return res.send(`
            <div style="text-align:center; font-family:sans-serif; margin-top:40px;">
                <h1 style="color:#075e54;">🤖 Samantha La Hacker Bot</h1>
                <p>Escanea este código QR desde WhatsApp > Dispositivos Vinculados:</p>
                <img src="${qrImageUrl}" alt="QR Code" style="border:5px solid #25D366; padding:10px; border-radius:10px;" />
                <script>setTimeout(() => location.reload(), 10000);</script>
            </div>
        `);
    }
    res.send(`<h2>⏳ Generando código QR... refresca en unos segundos.</h2><script>setTimeout(() => location.reload(), 4000);</script>`);
});

app.listen(PORT, () => console.log(`Servidor web corriendo en puerto ${PORT}`));

// --- CONFIGURACIÓN BASE ---
const BOT_NAME = 'SAMANTHA LA HACKER BOT';
const PREFIX = '.';
const usersDB = {};

const dynamicTexts = {
    stock: '📌 *STOCK DISPONIBLE*\n- Cuentas Premium: Disponibles\n- Diamantes FF: En stock',
    pago: '💳 *MÉTODOS DE PAGO 1*\n- Banco/Tarjeta: 1234-5678-9012\n- Titular: Samantha',
    pago2: '💳 *MÉTODOS DE PAGO 2*\n- USDT (TRC20): TXXXXXXXXXXXXX',
    reglas: '📜 *REGLAS DEL GRUPO*\n1. Respeto entre miembros.\n2. No Spam.'
};

function getUser(jid) {
    if (!usersDB[jid]) {
        usersDB[jid] = { exp: 64, dulces: 0, nivel: 3, banco: 100 };
    }
    return usersDB[jid];
}

async function getAdminStatus(sock, groupId, participantJid) {
    try {
        const groupMetadata = await sock.groupMetadata(groupId);
        const participant = groupMetadata.participants.find(p => p.id === participantJid);
        return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
    } catch {
        return false;
    }
}

// --- CONEXIÓN DE WHATSAPP ---
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) { currentQR = qr; isConnected = false; }
        if (connection === 'close') {
            isConnected = false;
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            isConnected = true;
            currentQR = null;
            console.log(`✅ [${BOT_NAME}] Conectado correctamente a WhatsApp.`);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const from = m.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const sender = m.key.participant || m.key.remoteJid;

        const body = m.message.conversation ||
                     m.message.extendedTextMessage?.text ||
                     m.message.imageMessage?.caption ||
                     m.message.videoMessage?.caption || '';

        if (!body.startsWith(PREFIX)) return;

        const args = body.slice(PREFIX.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        const text = args.join(' ');

        // ==========================================
        // 📄 COMANDO: .curp (CONSULTA VÍA API REST / ENDPOINT)
        // ==========================================
        if (command === 'curp') {
            if (!text) {
                return sock.sendMessage(from, { 
                    text: `*[${BOT_NAME}]* Por favor ingresa la CURP de 18 caracteres.\n\n*Ejemplo:* .curp ABCD123456HDFRRX01` 
                }, { quoted: m });
            }

            const curpInput = text.trim().toUpperCase();
            const regexCURP = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;

            if (!regexCURP.test(curpInput)) {
                return sock.sendMessage(from, { 
                    text: `❌ *[${BOT_NAME}]* Formato de CURP inválido. Debe contener exactamente 18 caracteres alfanuméricos.` 
                }, { quoted: m });
            }

            await sock.sendMessage(from, { 
                text: `🔍 *[${BOT_NAME}]* Consultando RENAPO vía API REST... Descargando constancia para: *${curpInput}*` 
            }, { quoted: m });

            try {
                // Petición HTTP directa al endpoint de generación/consulta de CURP en PDF
                const response = await axios.get(`https://api.serviciosmx.net/curp/pdf/${curpInput}`, {
                    responseType: 'arraybuffer',
                    timeout: 30000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                const pdfBuffer = Buffer.from(response.data, 'binary');

                // Enviar el PDF como archivo directamente al chat de WhatsApp
                return await sock.sendMessage(from, {
                    document: pdfBuffer,
                    mimetype: 'application/pdf',
                    fileName: `CURP_${curpInput}.pdf`,
                    caption: `📄 *[${BOT_NAME}]*\nConstancia Oficial de CURP emitida para: *${curpInput}*`
                }, { quoted: m });

            } catch (err) {
                console.error('Error al consultar la API de CURP:', err.message);
                return sock.sendMessage(from, { 
                    text: `❌ *[${BOT_NAME}]* No se pudo obtener el PDF. Ocurrió un error en la conexión con la base de datos de RENAPO o el servicio externo de consulta.` 
                }, { quoted: m });
            }
        }

        // ==========================================
        // 🎵 DESCARGAS DE YOUTUBE (MP3 Y MP4 DIRECTO)
        // ==========================================
        if (['play', 'ytmp3', 'playaudio'].includes(command)) {
            if (!text) return sock.sendMessage(from, { text: `*[${BOT_NAME}]* Ingresa el nombre o enlace del audio.` }, { quoted: m });

            try {
                await sock.sendMessage(from, { text: `⏳ *[${BOT_NAME}]* Buscando y descargando audio MP3...` }, { quoted: m });
                const search = await yts(text);
                const video = search.videos[0];
                if (!video) return sock.sendMessage(from, { text: '❌ No se encontraron resultados.' }, { quoted: m });

                const stream = ytdl(video.url, { filter: 'audioonly', quality: 'highestaudio' });
                const buffers = [];

                stream.on('data', (chunk) => buffers.push(chunk));
                stream.on('end', async () => {
                    const audioBuffer = Buffer.concat(buffers);
                    await sock.sendMessage(from, {
                        audio: audioBuffer,
                        mimetype: 'audio/mp4',
                        fileName: `${video.title}.mp3`
                    }, { quoted: m });
                });
            } catch (err) {
                await sock.sendMessage(from, { text: '❌ Error al procesar el audio.' }, { quoted: m });
            }
            return;
        }

        if (['ytmp4', 'ytv', 'playvideo'].includes(command)) {
            if (!text) return sock.sendMessage(from, { text: `*[${BOT_NAME}]* Ingresa el nombre o enlace del video.` }, { quoted: m });

            try {
                await sock.sendMessage(from, { text: `⏳ *[${BOT_NAME}]* Procesando y bajando video MP4...` }, { quoted: m });
                const search = await yts(text);
                const video = search.videos[0];
                if (!video) return sock.sendMessage(from, { text: '❌ No se encontraron resultados.' }, { quoted: m });

                const stream = ytdl(video.url, { filter: 'audioandvideo', quality: 'highest' });
                const buffers = [];

                stream.on('data', (chunk) => buffers.push(chunk));
                stream.on('end', async () => {
                    const videoBuffer = Buffer.concat(buffers);
                    await sock.sendMessage(from, {
                        video: videoBuffer,
                        mimetype: 'video/mp4',
                        caption: `🎬 *${video.title}*\n⏱️ Duración: ${video.timestamp}`
                    }, { quoted: m });
                });
            } catch (err) {
                await sock.sendMessage(from, { text: '❌ Error al procesar el video.' }, { quoted: m });
            }
            return;
        }

        // ==========================================
        // ⚙️ ADMINISTRACIÓN DE GRUPO Y NEGOCIO
        // ==========================================
        if (command === 'abrir') {
            if (!isGroup) return sock.sendMessage(from, { text: 'Solo en grupos.' });
            if (!(await getAdminStatus(sock, from, sender))) return sock.sendMessage(from, { text: '⚠️ Requiere ser Admin.' });
            await sock.groupSettingUpdate(from, 'not_announcement');
            return await sock.sendMessage(from, { text: `*[${BOT_NAME}]* 🔓 El grupo ha sido **ABIERTO**.` });
        }

        if (command === 'cerrar' || command === 'close') {
            if (!isGroup) return sock.sendMessage(from, { text: 'Solo en grupos.' });
            if (!(await getAdminStatus(sock, from, sender))) return sock.sendMessage(from, { text: '⚠️ Requiere ser Admin.' });
            await sock.groupSettingUpdate(from, 'announcement');
            return await sock.sendMessage(from, { text: `*[${BOT_NAME}]* 🔒 El grupo ha sido **CERRADO**.` });
        }

        if (['stock', 'pago', 'pago2', 'reglas'].includes(command)) {
            const respuesta = dynamicTexts[command] || 'Información no configurada.';
            return await sock.sendMessage(from, { text: `*[${BOT_NAME}]*\n\n${respuesta}` }, { quoted: m });
        }

        if (['setstock', 'setpago', 'setpago2', 'setreglas'].includes(command)) {
            if (isGroup && !(await getAdminStatus(sock, from, sender))) return;
            if (!text) return sock.sendMessage(from, { text: `Uso: .${command} <nuevo texto>` });
            const key = command.replace('set', '');
            dynamicTexts[key] = text;
            return await sock.sendMessage(from, { text: `✅ Texto de *${key}* actualizado.` });
        }

        // ==========================================
        // 🎨 CREACIÓN DE STICKERS
        // ==========================================
        if (command === 'sticker' || command === 's') {
            const isImage = m.message.imageMessage || m.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
            if (!isImage) return sock.sendMessage(from, { text: 'Responde a una imagen con .sticker' });
            
            const stream = await downloadContentFromMessage(isImage, 'image');
            let buffer = Buffer.alloc(0);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            const sticker = new Sticker(buffer, {
                pack: BOT_NAME,
                author: 'Samantha La Hacker',
                type: StickerTypes.FULL
            });
            return await sock.sendMessage(from, await sticker.toMessage());
        }
    });
}

connectToWhatsApp();