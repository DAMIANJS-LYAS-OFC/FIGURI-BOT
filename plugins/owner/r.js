import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { exec } from 'child_process'
import { promisify } from 'util'

const execute = promisify(exec)

const handler = async (m, { conn, args }) => {
  const sender = String(m.sender || '').split('@')[0].split(':')[0]
  const owners = (globalThis.owner || []).map(o =>
    String(Array.isArray(o) ? o[0] : o).split('@')[0].split(':')[0]
  )
  if (!owners.includes(sender)) {
    return m.reply(
      '╭─〔 ACCESO DENEGADO 〕\n' +
      '│ ✗ No tienes autorización.\n' +
      '╰━━━━━━━━━━━━━━━\n' +
      '❒ Comando exclusivo de OWNER.'
    )
  }

  const chat = m.chat
  const botName = globalThis.botName || globalThis.namebot || 'Bot'
  const botNumber = String(conn.user?.id || '').split('@')[0].split(':')[0].replace(/\D/g, '')
  const iconDir = path.join(process.cwd(), 'storage', 'icons')

  // ━━━ TU TRUCO DEL DOCUMENTO ━━━
  async function sendPNJ(text) {
    try {
      const candidates = [
        globalThis.icon,
        path.join(iconDir, `${botNumber}.jpg`),
        path.join(iconDir, `${botNumber}.jpeg`),
        path.join(iconDir, `${botNumber}.png`),
        path.join(iconDir, `${botNumber}.webp`),
        path.join(iconDir, 'primary.jpg'),
        path.join(iconDir, 'primary.png'),
        path.join(iconDir, 'primary.webp')
      ]

      let icon = null
      for (const candidate of candidates) {
        if (!candidate) continue
        if (/^https?:\/\//i.test(String(candidate))) continue
        const file = path.isAbsolute(candidate) ? candidate : path.join(process.cwd(), candidate)
        if (fs.existsSync(file) && fs.statSync(file).isFile()) { icon = file; break }
      }

      if (!icon && fs.existsSync(iconDir)) {
        const files = fs.readdirSync(iconDir).filter(file => /\.(jpg|jpeg|png|webp)$/i.test(file)).sort()
        if (files.length) icon = path.join(iconDir, files[0])
      }

      if (!icon) return conn.sendMessage(chat, { text }, { quoted: m })

      const original = fs.readFileSync(icon)
      const prev = await sharp(original).rotate().resize(160, 160, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 65 }).toBuffer({ resolveWithObject: true })
      const meta = await sharp(original).metadata()
      const fmt = { jpeg: ['jpg', 'image/jpeg'], png: ['png', 'image/png'], webp: ['webp', 'image/webp'], gif: ['gif', 'image/gif'], avif: ['avif', 'image/avif'], tiff: ['tiff', 'image/tiff'] }
      const ext = fmt[meta.format] || [path.extname(icon).slice(1).toLowerCase() || 'jpg', 'image/jpeg']
      const filename = String(botName).replace(/[\\/:*?"<>|\r\n]/g, '').trim() || 'Bot'

      return conn.sendMessage(chat, {
        document: original,
        fileName: `${filename}.${ext[0]}`,
        mimetype: ext[1],
        jpegThumbnail: prev.data.toString('base64'),
        thumbnailWidth: prev.info.width,
        thumbnailHeight: prev.info.height,
        caption: text
      }, { quoted: m })

    } catch (error) {
      console.error('[PNJ R]', error)
      return conn.sendMessage(chat, { text }, { quoted: m })
    }
  }

  const input = args.join(' ').trim()

  // ━━━ MENÚ - A TU ESTILO ━━━
  if (!input) {
    return sendPNJ(
      `╭─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ╮\n` +
      `│  ✦  *『 ${botName} 』*  ✦  │\n` +
      `╰─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ╯\n\n` +
      `꒰ᐢ..ᐢ꒱ *CONSOLA ADMINISTRATIVA*\n\n` +
      `┏━━━━━━━━━━━━━━━━━━┓\n` +
      `┃ ❀ *EJEMPLOS* ┃\n` +
      `┗━━━━━━━━━━━━━━━━━━┛\n` +
      `❒ .r ls\n` +
      `❒ .r ls plugins\n` +
      `❒ .r cat config.js\n` +
      `❒ .r pwd\n` +
      `❒ .r node -v\n` +
      `❒ .r uptime\n\n` +
      `─────────────────────\n` +
      `> ₍ᐢ..ᐢ₎ Escribe tal cual lo quieres ejecutar.\n` +
      `> ₍ᐢ..ᐢ₎ Solo OWNER. 🍫`
    )
  }

  // ━━━ EJECUCIÓN TAL CUAL ━━━
  try {
    const { stdout, stderr } = await execute(input, {
      cwd: process.cwd(),
      timeout: 10000,
      maxBuffer: 1024 * 1024,
      windowsHide: true
    })

    const output = (stdout || stderr || 'Sin resultados.').slice(0, 4000)

    return sendPNJ(
      `╭─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ╮\n` +
      `│  ✦  *『 ${botName} 』*  ✦  │\n` +
      `╰─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ╯\n\n` +
      `꒰ᐢ..ᐢ꒱ *TERMINAL*\n\n` +
      `❒ Comando: ${input}\n\n` +
      '```text\n' + output + '\n```\n\n' +
      `─────────────────────\n` +
      `> ₍ᐢ..ᐢ₎ Proceso finalizado. 🍫`
    )

  } catch (error) {
    const output = ((error.stdout || '') + (error.stderr || '') + error.message).slice(0, 4000)
    return sendPNJ(
      `╭─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ╮\n` +
      `│  ✦  *『 ${botName} 』*  ✦  │\n` +
      `╰─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ╯\n\n` +
      `꒰ᐢ..ᐢ꒱ *ERROR DE EJECUCIÓN*\n\n` +
      `❒ Comando: ${input}\n\n` +
      '```text\n' + output + '\n```\n\n' +
      `─────────────────────\n` +
      `> ₍ᐢ..ᐢ₎ Proceso finalizado.`
    )
  }
}

handler.help = ['r']
handler.tags = ['owner']
handler.command = /^(r|terminal|shell)$/i

export default handler
