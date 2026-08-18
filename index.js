const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');

// --- SERVIDOR EXPRESS PARA RENDER Y UPTIMEROBOT ---
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

// --- TEXTO DEL MENÚ PERSONALIZADO ---
const MENU_TEXT = `╭───❀ ☁️INFO DE USUARIO☁️
│🗣️ NOMBRE: streaming samantha
│📝 EXP: 64
│🍬 DULCES: 0
│✨ NIVEL: 3
╰───❀

╭───❀ ☁️INFO DEL BOT☁️
│🤖 BOT: SAMANTHA LA HACKER BOT
│👑 CREADOR: SAMANTHA LA HACKER
│⏰ ACTIVO: 24/7 Online
│📆 FECHA: martes, 18 de agosto de 2026
╰───❀

╭───❀ *✨ANIME✨*
│🏍️ .5
│🏍️ .abrazar
│🏍️ .aburrido
│🏍️ .acurrucarse
│🏍️ .angry
│🏍️ .aplaudir
│🏍️ .asustada
│🏍️ .asustado
│🏍️ .avergonzarse
│🏍️ .bailar
│🏍️ .bath
│🏍️ .bañarse
│🏍️ .beso
│🏍️ .bite
│🏍️ .bleh
│🏍️ .blush
│🏍️ .bofetada
│🏍️ .bored
│🏍️ .borracho
│🏍️ .bully
│🏍️ .bullying
│🏍️ .cafe
│🏍️ .café
│🏍️ .caminar
│🏍️ .clap
│🏍️ .coffee
│🏍️ .comer
│🏍️ .correr
│🏍️ .cringe
│🏍️ .cry
│🏍️ .cuddle
│🏍️ .dance
│🏍️ .dormir
│🏍️ .drama
│🏍️ .dramatic
│🏍️ .drunk
│🏍️ .eat
│🏍️ .embarazar
│🏍️ .enamorada
│🏍️ .enamorado
│🏍️ .enojado
│🏍️ .escupir
│🏍️ .facepalm
│🏍️ .feliz
│🏍️ .fumar
│🏍️ .golpear
│🏍️ .guiñar
│🏍️ .handhold
│🏍️ .happy
│🏍️ .harem
│🏍️ .highfive
│🏍️ .hola
│🏍️ .hug
│🏍️ .infoanime
│🏍️ .kill
│🏍️ .kiss
│🏍️ .kisscheek
│🏍️ .lamer
│🏍️ .laugh
│🏍️ .lengua
│🏍️ .lick
│🏍️ .llorar
│🏍️ .loli
│🏍️ .love
│🏍️ .mano
│🏍️ .matar
│🏍️ .morder
│🏍️ .muak
│🏍️ .ola
│🏍️ .palmada
│🏍️ .palmadita
│🏍️ .pat
│🏍️ .pegar
│🏍️ .pensar
│🏍️ .picar
│🏍️ .pisar
│🏍️ .poke
│🏍️ .pout
│🏍️ .ppcouple
│🏍️ .preg
│🏍️ .presumir
│🏍️ .preñar
│🏍️ .pucheros
│🏍️ .punch
│🏍️ .reirse
│🏍️ .run
│🏍️ .sad
│🏍️ .scared
│🏍️ .seduce
│🏍️ .seducir
│🏍️ .shy
│🏍️ .slap
│🏍️ .sleep
│🏍️ .smile
│🏍️ .smoke
│🏍️ .smug
│🏍️ .sonreir
│🏍️ .sonrojarse
│🏍️ .spit
│🏍️ .step
│🏍️ .think
│🏍️ .timida
│🏍️ .timido
│🏍️ .triste
│🏍️ .waifu
│🏍️ .walk
│🏍️ .wave
│🏍️ .wink
╰───❀

╭───❀ *✨BUSCADOR✨*
│🏍️ .tiktoksearch <txt>
╰───❀

╭───❀ *✨DESCARGAS✨*
│🏍️ .yta2
│🏍️ .ytv2
╰───❀

╭───❀ *✨DOWNLOAD✨*
│🏍️ .animedl
│🏍️ .apkmod
│🏍️ .gitclone
│🏍️ .hentai
│🏍️ .imagen
│🏍️ .mediafire
│🏍️ .mediafire2
│🏍️ .mega
│🏍️ .pinterest
│🏍️ .playaudio
│🏍️ .playvideo
│🏍️ .soundcloud2
│🏍️ .stickerlydl <url>
│🏍️ .tiktokmp3 *<url>*
│🏍️ .twitter
│🏍️ .xnxx
│🏍️ .xvideos
│🏍️ .yta <url>
│🏍️ .ytmp3 + [texto/link]
│🏍️ .ytmp3doc + [texto/link]
│🏍️ .ytmp4 + [texto/link]
│🏍️ .ytmp4doc + [texto/link]
│🏍️ .ytv
╰───❀

╭───❀ *✨DOWNLOADER✨*
│🏍️ .facebook
│🏍️ .fb
│🏍️ .splay
│🏍️ .tiktok
│🏍️ .tt
╰───❀

╭───❀ *✨ECONOMY✨*
│🏍️ .apostar
│🏍️ .cf
│🏍️ .crimen
│🏍️ .einfo
│🏍️ .minar
│🏍️ .ruleta
│🏍️ .trabajar
╰───❀

╭───❀ *✨ECONOMÍA✨*
│🏍️ .cofre
╰───❀

╭───❀ *✨FF✨*
│🏍️ .maxeos
│🏍️ .setmaxeos <texto>
╰───❀

╭───❀ *✨FUN✨*
│🏍️ .afk
│🏍️ .chiste
│🏍️ .doxear
│🏍️ .doxeo
│🏍️ .doxxeo
│🏍️ .facto
│🏍️ .formarpareja
│🏍️ .gay
│🏍️ .lesbiana
│🏍️ .letra
│🏍️ .loli
│🏍️ .manca
│🏍️ .manco
│🏍️ .pajera
│🏍️ .pajero
│🏍️ .personalidad
│🏍️ .pokedex
│🏍️ .prostituta
│🏍️ .prostituto
│🏍️ .puta
│🏍️ .puto
│🏍️ .rata
│🏍️ .ruletamuerte
│🏍️ .ship
│🏍️ .shippear
│🏍️ .sorteo
│🏍️ .top
╰───❀

╭───❀ *✨GACHA✨*
│🏍️ .buyc
│🏍️ .claim
│🏍️ .delchar
│🏍️ .delclaimmsg
│🏍️ .delfav
│🏍️ .favtop
│🏍️ .ginfo
│🏍️ .giveallharem
│🏍️ .regalar
│🏍️ .removesale
│🏍️ .robwaifu
│🏍️ .rollwaifu
│🏍️ .rw
│🏍️ .sell
│🏍️ .serieinfo
│🏍️ .serielist
│🏍️ .setclaim
│🏍️ .setfav
│🏍️ .topwaifus
│🏍️ .trade
│🏍️ .ver
│🏍️ .vote
│🏍️ .waifuvideo
│🏍️ .wimage
│🏍️ .winfo
│🏍️ .wshop
╰───❀

╭───❀ *✨GAME✨*
│🏍️ .ppt
│🏍️ .trivia
│🏍️ .triviascore
╰───❀

╭───❀ *✨GROUP✨*
│🏍️ .abrir
│🏍️ .addwarn
│🏍️ .admins
│🏍️ .advertencia
│🏍️ .advlist
│🏍️ .boletos
│🏍️ .bot
│🏍️ .canva
│🏍️ .cerrar
│🏍️ .close
│🏍️ .combos
│🏍️ .crunchyroll
│🏍️ .delete
│🏍️ .delprimary
│🏍️ .delwarn
│🏍️ .demote
│🏍️ .diamantes
│🏍️ .disney
│🏍️ .enlace
│🏍️ .fantasmas
│🏍️ .ficha
│🏍️ .gpbanner
│🏍️ .gpdesc
│🏍️ .gpname
│🏍️ .groupdesc
│🏍️ .groupimg
│🏍️ .groupname
│🏍️ .inactivos
│🏍️ .infogrupo
│🏍️ .invite
│🏍️ .kick
│🏍️ .kickfantasmas
│🏍️ .kickinactivos
│🏍️ .libros
│🏍️ .lids
│🏍️ .link
│🏍️ .listadv
│🏍️ .lotes
│🏍️ .max
│🏍️ .metodos
│🏍️ .mute
│🏍️ .netflix
│🏍️ .open
│🏍️ .pago
│🏍️ .pago2
│🏍️ .paramunt
│🏍️ .peliculas
│🏍️ .prime
│🏍️ .promote
│🏍️ .reglas
│🏍️ .revoke
│🏍️ .robux
│🏍️ .setboletos + texto
│🏍️ .setcanva <texto>
│🏍️ .setcombos <texto>
│🏍️ .setdiamantes + texto
│🏍️ .setdisney <texto>
│🏍️ .setficha + texto
│🏍️ .setlibros + texto
│🏍️ .setlotes + texto
│🏍️ .setmax <texto>
│🏍️ .setmetodos + texto
│🏍️ .setnetflix <texto>
│🏍️ .setpago <texto>
│🏍️ .setpago2 <texto>
│🏍️ .setpago3 <texto>
│🏍️ .setparamunt
│🏍️ .setpeliculas + texto
│🏍️ .setprimary
│🏍️ .setprime <texto>
│🏍️ .setreglas + texto
│🏍️ .setrobux + texto
│🏍️ .setstock <texto>
│🏍️ .setstock2 <texto>
│🏍️ .setstock3 <texto>
│🏍️ .settramites <texto>
│🏍️ .setyoutube + texto
│🏍️ .stock
│🏍️ .stock2
│🏍️ .todos
│🏍️ .tramites
│🏍️ .unmute
│🏍️ .unwarn
│🏍️ .warn
│🏍️ .youtube
╰───❀

╭───❀ *✨GRUPO✨*
│🏍️ .hidetag
│🏍️ .kicknum
│🏍️ .listanum
│🏍️ .listnum
╰───❀

╭───❀ *✨HERRAMIENTAS✨*
│🏍️ .tts2 texto|modelo
╰───❀

╭───❀ *✨INFO✨*
│🏍️ .creador
│🏍️ .estado
│🏍️ .ping
╰───❀

╭───❀ *✨LOGO✨*
│🏍️ .1917style + texto
│🏍️ .advancedglow + texto
│🏍️ .blackpinklogo + texto
│🏍️ .blackpinkstyle + texto
│🏍️ .cartoonstyle + texto
│🏍️ .deletingtext + texto
│🏍️ .effectclouds + texto
│🏍️ .flag3dtext + texto
│🏍️ .flagtext + texto
│🏍️ .freecreate + texto
│🏍️ .galaxystyle + texto
│🏍️ .galaxywallpaper + texto
│🏍️ .glitchtext + texto
│🏍️ .glowingtext + texto
│🏍️ .gradienttext + texto
│🏍️ .lighteffects + texto
│🏍️ .logomaker + texto
│🏍️ .luxurygold + texto
│🏍️ .makingneon + texto
│🏍️ .neonglitch + texto
│🏍️ .papercutstyle + texto
│🏍️ .pixelglitch + texto
│🏍️ .royaltext + texto
│🏍️ .sandsummer + texto
│🏍️ .summerbeach + texto
│🏍️ .typographytext + texto
│🏍️ .underwatertext + texto
│🏍️ .watercolortext + texto
│🏍️ .writetext + texto
╰───❀

╭───❀ *✨MAIN✨*
│🏍️ .fixmsg
│🏍️ .invite
│🏍️ .reporte
│🏍️ .script
│🏍️ .speedtest
│🏍️ .suggest
╰───❀

╭───❀ *✨MAKER✨*
│🏍️ .1917style + texto
│🏍️ .advancedglow + texto
│🏍️ .blackpinklogo + texto
│🏍️ .blackpinkstyle + texto
│🏍️ .cartoonstyle + texto
│🏍️ .deletingtext + texto
│🏍️ .effectclouds + texto
│🏍️ .flag3dtext + texto
│🏍️ .flagtext + texto
│🏍️ .freecreate + texto
│🏍️ .galaxystyle + texto
│🏍️ .galaxywallpaper + texto
│🏍️ .glitchtext + texto
│🏍️ .glowingtext + texto
│🏍️ .gradienttext + texto
│🏍️ .lighteffects + texto
│🏍️ .logomaker + texto
│🏍️ .luxurygold + texto
│🏍️ .makingneon + texto
│🏍️ .neonglitch + texto
│🏍️ .papercutstyle + texto
│🏍️ .pixelglitch + texto
│🏍️ .royaltext + texto
│🏍️ .sandsummer + texto
│🏍️ .summerbeach + texto
│🏍️ .typographytext + texto
│🏍️ .underwatertext + texto
│🏍️ .watercolortext + texto
│🏍️ .writetext + texto
╰───❀

╭───❀ *✨MENU✨*
│🏍️ .menudescargas
│🏍️ .menugacha
│🏍️ .menulogos
╰───❀

╭───❀ *✨MODS✨*
│🏍️ .banlist
│🏍️ .banned
│🏍️ .block
│🏍️ .blocklist
│🏍️ .unban
│🏍️ .unblock
╰───❀

╭───❀ *✨MUSIC✨*
│🏍️ .play <texto>
│🏍️ .soundcloud + [texto]
╰───❀

╭───❀ *✨NABLE✨*
│🏍️ .aceptarauto
│🏍️ .antiarabe
│🏍️ .antibot
│🏍️ .antibot2
│🏍️ .antibots
│🏍️ .antifake
│🏍️ .antilink
│🏍️ .antilink2
│🏍️ .antiocultar
│🏍️ .antiprivado
│🏍️ .antiprivate
│🏍️ .antispam
│🏍️ .antispam2
│🏍️ .antisubbots
│🏍️ .antiver
│🏍️ .antivirtuales
│🏍️ .audios
│🏍️ .autoaceptar
│🏍️ .autorechazar
│🏍️ .autorespond
│🏍️ .autoresponder
│🏍️ .avisos
│🏍️ .bienvenida
│🏍️ .bye
│🏍️ .detect
│🏍️ .economia
│🏍️ .economy
│🏍️ .jadibotmd
│🏍️ .modejadibot
│🏍️ .modoadmin
│🏍️ .modohorny
│🏍️ .nsfw
│🏍️ .reaccion
│🏍️ .reaction
│🏍️ .rechazarauto
│🏍️ .restrict
│🏍️ .restringir
│🏍️ .soloadmin
│🏍️ .welcome
╰───❀

╭───❀ *✨NSFW✨*
│🏍️ .anal/culiar + <mention>
│🏍️ .blowjob/mamada + <mention>
│🏍️ .boobjob/rusa + <mention>
│🏍️ .culo
│🏍️ .cum/leche + <mention>
│🏍️ .danbooru
│🏍️ .fap/paja + <mention>
│🏍️ .follar + <mention>
│🏍️ .footjob/pies + <mention>
│🏍️ .fuck/coger + <mention>
│🏍️ .gelbooru
│🏍️ .grabboobs/agarrartetas + <mention>
│🏍️ .grop/manosear + <mention>
│🏍️ .hentai2
│🏍️ .lickpussy/coño + <mention>
│🏍️ .nsfw1
│🏍️ .nsfw2
│🏍️ .pack
│🏍️ .pack2
│🏍️ .r34
│🏍️ .sexo/sex + <mention>
│🏍️ .sixnine/69 + <mention>
│🏍️ .spank/nalgada + <mention>
│🏍️ .suckboobs/chupartetas + <mention>
│🏍️ .tetas
│🏍️ .undress/encuerar + <mention>
│🏍️ .yuri/tijeras + <mention>
╰───❀

╭───❀ *✨OWNER✨*
│🏍️ .$
│🏍️ .=> 
│🏍️ .> 
│🏍️ .addcoin
│🏍️ .addowner
│🏍️ .addprem
│🏍️ .addxp
│🏍️ .autoadmin
│🏍️ .backup
│🏍️ .cleartmp
│🏍️ .copia
│🏍️ .delai
│🏍️ .deletefile
│🏍️ .delowner
│🏍️ .delprem
│🏍️ .dsowner
│🏍️ .getplugin
│🏍️ .ip <alamat ip>
│🏍️ .listonline
│🏍️ .listprem
│🏍️ .prefix
│🏍️ .resetear
│🏍️ .resetuser
│🏍️ .restart
│🏍️ .savefile
│🏍️ .saveplugin
│🏍️ .update
│🏍️ .vaciartmp
╰───❀

╭───❀ *✨PROFILE✨*
│🏍️ .divorce
│🏍️ .marry
╰───❀

╭───❀ *✨RG✨*
│🏍️ .delbirth
│🏍️ .deldesc
│🏍️ .deldescription
│🏍️ .delgenre
│🏍️ .premium
│🏍️ .profile
│🏍️ .reg
│🏍️ .setbirth
│🏍️ .setdesc
│🏍️ .setdescription
│🏍️ .setgenero
│🏍️ .setgenre
│🏍️ .setprofile
╰───❀

╭───❀ *✨RPG✨*
│🏍️ .adventure
│🏍️ .aventura
│🏍️ .bal
│🏍️ .baltop
│🏍️ .cazar
│🏍️ .daily
│🏍️ .depositar
│🏍️ .dungeon
│🏍️ .fish
│🏍️ .heal
│🏍️ .hunt
│🏍️ .lboard
│🏍️ .levelup
│🏍️ .mazmorra
│🏍️ .mensual
│🏍️ .monthly
│🏍️ .pay
│🏍️ .pescar
│🏍️ .retirar
│🏍️ .rob
│🏍️ .semanal
│🏍️ .slot <apuesta>
│🏍️ .slut
│🏍️ .weekly
╰───❀

╭───❀ *✨SEARCH✨*
│🏍️ .applemusic
│🏍️ .applemusicsearch <canción>
│🏍️ .capcut <texto>
│🏍️ .fdroid
│🏍️ .fdroidsearch
│🏍️ .mediafiresearch <texto>
│🏍️ .playstore <texto>
│🏍️ .soundcloudsearch <texto>
│🏍️ .spotifysearch *<texto>*
│🏍️ .stickerly <texto>
│🏍️ .wagroups
│🏍️ .wgrupos
│🏍️ .wpgroups
│🏍️ .ytbuscar <texto>
│🏍️ .ytsearch2 <texto>
╰───❀

╭───❀ *✨SERBOT✨*
│🏍️ .botlist
│🏍️ .code
│🏍️ .qr
╰───❀

╭───❀ *✨SOCKET✨*
│🏍️ .join
│🏍️ .leave
│🏍️ .logout
│🏍️ .public
│🏍️ .reload
│🏍️ .salir
│🏍️ .self
│🏍️ .setbio
│🏍️ .setimage
│🏍️ .setpfp
│🏍️ .setstatus
│🏍️ .setuser
│🏍️ .setusername
╰───❀

╭───❀ *✨STALK✨*
│🏍️ .githubstalk <usuario>
│🏍️ .tiktokstalk *<usuario>*
╰───❀

╭───❀ *✨STICKER✨*
│🏍️ .brat
│🏍️ .bratv
│🏍️ .emojimix
│🏍️ .pfp
│🏍️ .qc
│🏍️ .robar
│🏍️ .sticker
│🏍️ .stickerly <texto>
│🏍️ .stickerlydl <url>
│🏍️ .take
│🏍️ .wm
╰───❀

╭───❀ *✨TOOLS✨*
│🏍️ .aivoz
│🏍️ .avisoschannel
│🏍️ .bard
│🏍️ .cal
│🏍️ .catbox
│🏍️ .chatgpt
│🏍️ .dalle
│🏍️ .delmeta
│🏍️ .eliminarfotochannel
│🏍️ .flux
│🏍️ .gemini
│🏍️ .get
│🏍️ .hd
│🏍️ .ia
│🏍️ .iavoz
│🏍️ .inspeccionar
│🏍️ .inspect
│🏍️ .lid
│🏍️ .luminai
│🏍️ .lyrics
│🏍️ .mylid
│🏍️ .noseguircanal
│🏍️ .nosilenciarcanal
│🏍️ .npmdl
│🏍️ .nuevadescchannel
│🏍️ .nuevafotochannel
│🏍️ .nuevonombrecanal
│🏍️ .openai
│🏍️ .reaccioneschannel
│🏍️ .reactioneschannel
│🏍️ .reenviar
│🏍️ .resiviravisos
│🏍️ .say
│🏍️ .seguircanal
│🏍️ .setmeta
│🏍️ .silenciarcanal
│🏍️ .ss
│🏍️ .ssweb
│🏍️ .syntax
│🏍️ .tenor
│🏍️ .toimg
│🏍️ .tourl
│🏍️ .translate
│🏍️ .upload
│🏍️ .ver
│🏍️ .vozia
│🏍️ .whatmusic <audio/video>
│🏍️ .whatmusic2
│🏍️ .wikipedia
╰───❀

╭───❀ *✨YOUTUBE✨*
│🏍️ .ytdl <búsqueda>
╰───❀`;

// --- CONEXIÓN DE WHATSAPP ---
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            currentQR = qr;
            isConnected = false;
        }

        if (connection === 'close') {
            isConnected = false;
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            isConnected = true;
            currentQR = null;
            console.log('✅ Conectado exitosamente a WhatsApp');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const from = m.key.remoteJid;
        const body = m.message.conversation ||
                     m.message.extendedTextMessage?.text || '';

        const command = body.trim().toLowerCase();

        if (command === '.menu' || command === '.help' || command === '.samantha') {
            await sock.sendMessage(from, { text: MENU_TEXT }, { quoted: m });
        }
    });
}

connectToWhatsApp();