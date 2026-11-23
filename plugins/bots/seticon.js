import fs from 'fs'
import path from 'path'
import { downloadContentFromMessage } from 'baileys'

const PLUGIN_FILE = 'seticon.js'
const ICON_DIR = path.join(process.cwd(), 'storage', 'icons')
const PRIMARY_ICON = path.join(ICON_DIR, 'primary.jpg')

if (!fs.existsSync(ICON_DIR)) {
    fs.mkdirSync(ICON_DIR, { recursive: true })
}

// Obtener número del bot
export function getBotNumber(conn) {
    return conn.user?.id
        ?.split(':')[0]
        ?.split('@')[0]
        ?.replace(/\D/g, '') || null
}

// Obtener icono
export function getBotIcon(conn) {
    const number = getBotNumber(conn)

    if (number) {
        const personal = path.join(ICON_DIR, `${number}.jpg`)
        if (fs.existsSync(personal)) return personal
    }

    if (fs.existsSync(PRIMARY_ICON)) return PRIMARY_ICON

    return null
}

// Guardar icono
export function saveBotIcon(conn, buffer) {
    const number = getBotNumber(conn)

    if (!number) throw new Error('No se identificó el bot.')
    if (!Buffer.isBuffer(buffer) || !buffer.length) {
        throw new Error('Imagen inválida.')
    }

    const personal = path.join(ICON_DIR, `${number}.jpg`)

    fs.writeFileSync(personal, buffer)

    if (!fs.existsSync(PRIMARY_ICON)) {
        fs.writeFileSync(PRIMARY_ICON, buffer)
    }

    return personal
}

// Eliminar icono personal
export function deleteBotIcon(conn) {
    const number = getBotNumber(conn)
    if (!number) return false

    const personal = path.join(ICON_DIR, `${number}.jpg`)

    if (!fs.existsSync(personal)) return false

    fs.unlinkSync(personal)
    return true
}

// Buscar imágenes dentro del mensaje
function findImage(message, depth = 0) {
    if (!message || typeof message !== 'object' || depth > 8) {
        return null
    }

    // Mensajes normales y multimedia
    for (const key of ['imageMessage']) {
        if (message[key]) {
            return {
                data: message[key],
                type: 'image'
            }
        }
    }

    // Documentos que realmente sean imágenes
    const document = message.documentMessage

    if (document?.mimetype?.startsWith('image/')) {
        return {
            data: document,
            type: 'document'
        }
    }

    // Mensajes protegidos o con vista única
    for (const key of [
        'ephemeralMessage',
        'viewOnceMessage',
        'viewOnceMessageV2',
        'viewOnceMessageV2Extension',
        'documentWithCaptionMessage'
    ]) {
        if (message[key]?.message) {
            const result = findImage(message[key].message, depth + 1)
            if (result) return result
        }
    }

    return null
}

// Buscar imagen adjunta o citada
function getMessageImage(m) {
    const direct = findImage(m.message)

    if (direct) return direct

    // Mensaje citado en el contexto de WhatsApp
    const contexts = [
        m.message?.extendedTextMessage?.contextInfo,
        m.message?.imageMessage?.contextInfo,
        m.message?.videoMessage?.contextInfo,
        m.message?.documentMessage?.contextInfo,
        m.msg?.contextInfo
    ]

    for (const context of contexts) {
        if (context?.quotedMessage) {
            const result = findImage(context.quotedMessage)
            if (result) return result
        }
    }

    // Compatibilidad con el handler normalizado
    if (m.quoted?.message) {
        const result = findImage(m.quoted.message)
        if (result) return result
    }

    if (m.quoted?.msg) {
        const result = findImage(m.quoted.msg)
        if (result) return result
    }

    return null
}

// Descargar imagen
async function downloadImage(m, media) {
    if (media) {
        const stream = await downloadContentFromMessage(
            media.data,
            media.type
        )

        const chunks = []

        for await (const chunk of stream) {
            chunks.push(chunk)
        }

        return Buffer.concat(chunks)
    }

    // Último recurso: método del mensaje citado
    if (m.quoted?.download) {
        return await m.quoted.download()
    }

    return null
}

// Comando principal
export default async function handler(m, {
    conn,
    args,
    usedPrefix
}) {
    const action = args[0]?.toLowerCase()

    // Restablecer icono
    if (action === 'reset') {
        const deleted = deleteBotIcon(conn)

        return m.reply(
            deleted
                ? '> ꒰ 🍀 ꒱ ᴍᴀsᴛᴇʀ-ᴄʟᴏᴠᴇʀ\n' +
                  '> ┊ ✦ Tu iconito personal fue eliminado ♡\n' +
                  '> ┊ ✦ Ahora se utilizará el icono principal ꒰ᐢ..ᐢ꒱'
                : '> ꒰ ⚠️ ꒱ No tienes un iconito personal configurado ♡'
        )
    }

    // Detectar imagen
    const media = getMessageImage(m)

    // Mostrar icono actual si no hay imagen
    if (!media && !m.quoted?.download) {
        const icon = getBotIcon(conn)

        if (!icon) {
            return m.reply(
                '> ꒰ 🍀 ꒱ ᴍᴀsᴛᴇʀ-ᴄʟᴏᴠᴇʀ\n' +
                '> ┊ ✦ Todavía no tengo un iconito configurado ♡\n' +
                '> ┊\n' +
                '> ꒰ 📸 ꒱ Para cambiarlo:\n' +
                '> ┊ ✦ Envía o responde a una imagen\n' +
                `> ┊ ✦ Escribe ${usedPrefix}seticon\n` +
                '> ┊\n' +
                '> ꒰ᐢ..ᐢ꒱ ¡Y listo, qué bonito!'
            )
        }

        return conn.sendMessage(m.chat, {
            image: fs.readFileSync(icon),
            caption:
                '> ꒰ 🍀 ꒱ ᴍᴀsᴛᴇʀ-ᴄʟᴏᴠᴇʀ\n' +
                '> ┊ ✦ Este es mi iconito actual ♡\n' +
                '> ┊ ꒰ᐢ..ᐢ꒱'
        }, { quoted: m })
    }

    try {
        const buffer = await downloadImage(m, media)

        if (!buffer?.length) {
            return m.reply(
                '> ꒰ ⚠️ ꒱ No pude reconocer esa imagen ♡\n' +
                '> ┊ ✦ Intenta enviarla nuevamente.'
            )
        }

        saveBotIcon(conn, buffer)

        return m.reply(
            '> ꒰ 🍀 ꒱ ᴍᴀsᴛᴇʀ-ᴄʟᴏᴠᴇʀ\n' +
            '> ━━━━━━━━━━━━━━━\n' +
            '> ♡ ¡ICONITO ACTUALIZADO! ♡\n' +
            '> ┊ ✦ Tu nueva imagen fue guardada\n' +
            '> ┊ ✦ Se asignó a este bot\n' +
            '> ┊ ✦ Ya puedes utilizarla en tus plugins\n' +
            '> ━━━━━━━━━━━━━━━\n' +
            '> ꒰ᐢ..ᐢ꒱ ¡Quedó precioso!'
        )

    } catch (error) {
        console.error(`[PLUGIN ${PLUGIN_FILE}]`, error)

        return m.reply(
            '> ꒰ ❌ ꒱ Ocurrió un error al guardar el iconito ♡\n' +
            '> ┊ ✦ Revisa que la imagen sea válida.'
        )
    }
}

handler.help = ['seticon', 'seticon reset']
handler.tags = ['owner']
handler.command = ['seticon', 'iconbot', 'boticon']
