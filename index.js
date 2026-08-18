const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    downloadContentFromMessage
} = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const axios = require('axios');
const yts = require('yt-search');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

// --- SERVIDOR EXPRESS (RENDER / UPTIMEROBOT) ---
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

// --- BASE DE DATOS EN MEMORIA (ECONOMÍA Y CONFIGURACIÓN) ---
const BOT_NAME = 'SAMANTHA LA HACKER BOT';
const PREFIX = '.';
const usersDB = {};
const dynamicTexts = {
    stock: '📌 *STOCK DISPONIBLE*\n- Cuentas Premium: Disponibles\n- Diamantes FF: En stock',
    pago: '💳 *MÉTODOS DE PAGO 1*\n- Banco/Tarjeta: 1234-5678-9012\n- Titular: Samantha',
    pago2: '💳 *MÉTODOS DE PAGO 2*\n- USDT (TRC20): TXXXXXXXXXXXXX',
    reglas: '📜 *REGLAS DEL GRUPO*\n1. Respeto entre miembros.\n2. No Spam.\n3. Cuidar la privacidad.'
};

function getUser(jid) {
    if (!usersDB[jid]) {
        usersDB[jid] = { exp: 10, dulces: 0, nivel: 1, banco: 100, afk: -1, afkReason: '' };
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

// --- CONEXIÓN PRINCIPAL CON BAILEYS ---
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
            console.log(`✅ [${BOT_NAME}] Conectado correctamente.`);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const from = m.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const sender = m.key.participant || m.key.remoteJid;
        const user = getUser(sender);

        const body = m.message.conversation ||
                     m.message.extendedTextMessage?.text ||
                     m.message.imageMessage?.caption ||
                     m.message.videoMessage?.caption || '';

        // Ganancia de EXP por mensaje
        user.exp += 2;

        if (!body.startsWith(PREFIX)) return;

        const args = body.slice(PREFIX.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        const text = args.join(' ');

        // ROUTER DE COMANDOS
        try {
            switch (command) {
                // --- COMANDOS PRINCIPALES Y MENÚ ---
                case 'menu':
                case 'help':
                case 'samantha':
                    const menu = `╭───❀ ☁️INFO DE USUARIO☁️
│🗣️ USUARIO: @${sender.split('@')[0]}
│📝 EXP: ${user.exp} | 🍬 DULCES: ${user.dulces} | ✨ NIVEL: ${user.nivel}
╰───❀

╭───❀ ☁️INFO DEL BOT☁️
│🤖 BOT: ${BOT_NAME}
│👑 CREADOR: SAMANTHA LA HACKER
│⏰ STATUS: 24/7 Activo
╰───❀

╭───❀ *✨COMANDOS DESTACADOS✨*
│🏍️ .abrir / .cerrar
│🏍️ .stock / .setstock <texto>
│🏍️ .pago / .pago2 / .setpago <texto>
│🏍️ .sticker (Responde a una imagen)
│🏍️ .play <nombre de canción>
│🏍️ .tiktok <url> / .fb <url>
│🏍️ .trabajar / .minar / .bal
│🏍️ .hidetag <mensaje>
│🏍️ .doxear / .gay / .ship
╰───❀`;
                    await sock.sendMessage(from, { text: menu, mentions: [sender] }, { quoted: m });
                    break;

                // --- ADMINISTRACIÓN DE GRUPO ---
                case 'abrir':
                    if (!isGroup) return sock.sendMessage(from, { text: 'Solo en grupos.' });
                    if (!(await getAdminStatus(sock, from, sender))) return sock.sendMessage(from, { text: '⚠️ Requiere ser Admin.' });
                    await sock.groupSettingUpdate(from, 'not_announcement');
                    await sock.sendMessage(from, { text: `*[${BOT_NAME}]* 🔓 Grupo abierto a todos los miembros.` });
                    break;

                case 'cerrar':
                case 'close':
                    if (!isGroup) return sock.sendMessage(from, { text: 'Solo en grupos.' });
                    if (!(await getAdminStatus(sock, from, sender))) return sock.sendMessage(from, { text: '⚠️ Requiere ser Admin.' });
                    await sock.groupSettingUpdate(from, 'announcement');
                    await sock.sendMessage(from, { text: `*[${BOT_NAME}]* 🔒 Grupo cerrado (Solo admins pueden enviar mensajes).` });
                    break;

                case 'hidetag':
                case 'todos':
                    if (!isGroup) return;
                    if (!(await getAdminStatus(sock, from, sender))) return sock.sendMessage(from, { text: '⚠️ Solo Admins.' });
                    const metadata = await sock.groupMetadata(from);
                    const participants = metadata.participants.map(p => p.id);
                    await sock.sendMessage(from, { text: text || '📣 ¡Notificación a todos!', mentions: participants });
                    break;

                case 'kick':
                    if (!isGroup || !(await getAdminStatus(sock, from, sender))) return;
                    const mentioned = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                    if (mentioned) {
                        await sock.groupParticipantsUpdate(from, [mentioned], 'remove');
                        await sock.sendMessage(from, { text: '❌ Miembro eliminado.' });
                    }
                    break;

                // --- INFORMACIÓN DE GRUPO Y NEGOCIO ---
                case 'stock':
                case 'stock2':
                    await sock.sendMessage(from, { text: `*[${BOT_NAME}]*\n\n${dynamicTexts.stock}` }, { quoted: m });
                    break;

                case 'pago':
                case 'pago2':
                    await sock.sendMessage(from, { text: `*[${BOT_NAME}]*\n\n${dynamicTexts[command]}` }, { quoted: m });
                    break;

                case 'setstock':
                case 'setpago':
                case 'setpago2':
                    if (isGroup && !(await getAdminStatus(sock, from, sender))) return;
                    if (!text) return sock.sendMessage(from, { text: `Uso: .${command} <nuevo texto>` });
                    const key = command.replace('set', '');
                    dynamicTexts[key] = text;
                    await sock.sendMessage(from, { text: `✅ Texto de *${key}* actualizado.` });
                    break;

                // --- STICKERS ---
                case 'sticker':
                case 's':
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
                    await sock.sendMessage(from, await sticker.toMessage());
                    break;

                // --- BÚSQUEDA Y DESCARGAS ---
                case 'play':
                case 'ytmp3':
                    if (!text) return sock.sendMessage(from, { text: 'Ingresa el nombre de una canción o enlace de YouTube.' });
                    await sock.sendMessage(from, { text: '🔍 Buscando audio...' });
                    const search = await yts(text);
                    const video = search.videos[0];
                    if (!video) return sock.sendMessage(from, { text: 'No se encontraron resultados.' });
                    
                    await sock.sendMessage(from, { 
                        text: `🎵 *${video.title}*\n⏱️ Duración: ${video.timestamp}\n🔗 ${video.url}\n\n*Enviando audio...*` 
                    });
                    break;

                case 'tiktok':
                case 'tt':
                case 'fb':
                case 'facebook':
                    if (!text) return sock.sendMessage(from, { text: 'Ingresa una URL válida.' });
                    await sock.sendMessage(from, { text: '📥 Procesando descarga de video...' });
                    break;

                // --- ECONOMÍA Y DIVERSIÓN ---
                case 'trabajar':
                    const ganado = Math.floor(Math.random() * 200) + 50;
                    user.banco += ganado;
                    await sock.sendMessage(from, { text: `💰 Trabajaste duro y ganaste $${ganado} monedas.` }, { quoted: m });
                    break;

                case 'minar':
                    const diamantes = Math.floor(Math.random() * 5) + 1;
                    user.dulces += diamantes;
                    await sock.sendMessage(from, { text: `⛏️ Minaste y encontraste ${diamantes} dulces/gemas.` }, { quoted: m });
                    break;

                case 'bal':
                case 'einfo':
                    await sock.sendMessage(from, { text: `🏦 *Balance de @${sender.split('@')[0]}*\n💵 Banco: $${user.banco}\n🍬 Dulces: ${user.dulces}\n✨ EXP: ${user.exp}`, mentions: [sender] });
                    break;

                case 'doxear':
                case 'doxeo':
                    const fakeIp = `${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`;
                    await sock.sendMessage(from, { text: `🔍 *DOXEO EXITOSO*\n👤 Objetivo: ${text || 'Usuario'}\n🌐 IP: ${fakeIp}\n🏠 Nivel de Peligro: 99.9%` });
                    break;

                case 'gay':
                case 'pajero':
                case 'manco':
                    const porcentaje = Math.floor(Math.random() * 100);
                    await sock.sendMessage(from, { text: `📊 El nivel de *${command.toUpperCase()}* de ${text || 'este usuario'} es del *${porcentaje}%*` });
                    break;

                case 'ship':
                case 'formarpareja':
                    if (!isGroup) return;
                    const groupData = await sock.groupMetadata(from);
                    const members = groupData.participants;
                    const p1 = members[Math.floor(Math.random() * members.length)].id;
                    const p2 = members[Math.floor(Math.random() * members.length)].id;
                    await sock.sendMessage(from, { 
                        text: `💖 *NUEVA PAREJA FORMADA*\n👩‍❤️‍👨 @${p1.split('@')[0]} ❤️ @${p2.split('@')[0]}\nCompatibilidad: ${Math.floor(Math.random()*50)+50}%`,
                        mentions: [p1, p2]
                    });
                    break;

                // --- REACCIONES Y OTROS ---
                case 'kiss':
                case 'beso':
                case 'hug':
                case 'abrazar':
                case 'slap':
                case 'bofetada':
                    await sock.sendMessage(from, { text: `✨ @${sender.split('@')[0]} ejecutó la acción *${command}* en el chat.`, mentions: [sender] });
                    break;

                default:
                    break;
            }
        } catch (error) {
            console.error(`Error procesando .${command}:`, error);
        }
    });
}

connectToWhatsApp();