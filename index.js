const { execSync } = require('child_process');
const fs = require('fs');

// --- 1. CONFIGURACIÓN E INSTALACIÓN AUTOMÁTICA DE DEPENDENCIAS ---
const packageJsonFile = './package.json';

if (!fs.existsSync(packageJsonFile)) {
    console.log('📦 Generando package.json...');
    const packageData = {
        name: "whatsapp-bot-autoresponder",
        version: "1.0.0",
        description: "Bot de WhatsApp auto-responder para Render",
        main: "index.js",
        scripts: {
            start: "node index.js"
        },
        dependencies: {
            "@whiskeysockets/baileys": "^6.6.0",
            "express": "^4.19.2",
            "pino": "^8.20.0",
            "qrcode-terminal": "^0.12.0"
        }
    };
    fs.writeFileSync(packageJsonFile, JSON.stringify(packageData, null, 2));
}

// Instalar librerías si aún no están descargadas
try {
    require('@whiskeysockets/baileys');
    require('express');
    require('qrcode-terminal');
    require('pino');
} catch (e) {
    console.log('⏳ Instalando dependencias necesarias...');
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencias instaladas correctamente.');
}

// --- 2. IMPORTACIÓN DE MÓDULOS ---
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const express = require('express');

// --- 3. SERVIDOR HTTP PARA MANTENER RENDER ACTIVO (SOLUCIONA "NO OPEN PORTS") ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 Bot de WhatsApp activo y ejecutándose en Render.');
});

app.listen(PORT, () => {
    console.log(`🌐 Servidor web escuchando en el puerto ${PORT}`);
});

// --- 4. GESTIÓN Y GUARDADO DE PREGUNTAS Y RESPUESTAS ---
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

// --- 5. LÓGICA Y CONEXIÓN DEL BOT DE WHATSAPP ---
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

        // Mostrar código QR en los logs de Render
        if (qr) {
            console.log('\n========================================');
            console.log('📲 ESCANEA ESTE CÓDIGO QR EN TU WHATSAPP:');
            console.log('========================================\n');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const reconectar = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (reconectar) {
                console.log('🔄 Reconectando bot...');
                iniciarBot();
            } else {
                console.log('❌ Sesión cerrada. Elimina la carpeta sesion_whatsapp y vuelve a escanear.');
            }
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

        // --- COMANDOS PARA TI DESDE WHATSAPP ---
        if (textoCliente.startsWith(PREFIX)) {
            const args = textoCliente.slice(PREFIX.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const contenido = args.join(' ');

            // AGREGAR: .add pregunta | respuesta
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

            // ELIMINAR: .del pregunta
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