import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import config from './config.js'

const root = path.dirname(fileURLToPath(import.meta.url))
const pluginDir = path.join(root, 'plugins')

global.plugins ||= {}

const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  pink: '\x1b[38;5;218m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
}

// ══════════════ PANEL VERDE SOLO SI SALIÓ BIEN ══════════════
function logComandoExito(comando) {
  if (!comando) return
  console.log(`${c.green}🧧╔═══════════════════════════🧧${c.reset}`)
  console.log(`${c.green}🧧║Comando ${comando} ejecutado con exito${c.reset}`)
  console.log(`${c.green}🧧╚═══════════════════════════🧧${c.reset}`)
}

export async function loadPlugins() {
  if (!fs.existsSync(pluginDir)) {
    fs.mkdirSync(pluginDir, { recursive: true })
  }

  const files = fs.readdirSync(pluginDir)
    .filter(file => file.endsWith('.js'))

  for (const file of files) {
    try {
      const url = pathToFileURL(path.join(pluginDir, file))
      url.searchParams.set('update', Date.now())

      const imported = await import(url.href)
      const plugin = imported.default

      if (typeof plugin !== 'function') continue

      global.plugins[file] = plugin

      console.log(`👾 『PLUGIN CARGADO』➤ ${file}`)
    } catch (e) {
      console.error(`👾 『ERROR PLUGIN』➤ ${file} ➤ ${e.message}`)
    }
  }

  console.log(`👾 『PLUGINS』➤ ${Object.keys(global.plugins).length} 『CARGADOS』`)
}

export async function handleMessages(conn, update) {
  if (!update?.messages) return

  for (const raw of update.messages) {
    if (!raw?.message || !raw.key?.remoteJid) continue

    const chat = raw.key.remoteJid
    if (chat === 'status@broadcast') continue

    const text =
      raw.message.conversation ||
      raw.message.extendedTextMessage?.text ||
      raw.message.imageMessage?.caption ||
      raw.message.videoMessage?.caption ||
      ''

    const m = {
      ...raw,
      chat,
      sender: raw.key.participant || chat,
      fromMe: !!raw.key.fromMe,
      isGroup: chat.endsWith('@g.us'),
      pushName: raw.pushName || '',
      text,

      reply: (message, options = {}) =>
        conn.sendMessage(chat, {
          text: String(message),
          ...options
        }, { quoted: raw })
    }

    const plugins = global.plugins

    // ═══ Eventos BEFORE ═══
    for (const [name, plugin] of Object.entries(plugins)) {
      if (plugin.disabled || typeof plugin.before !== 'function') continue

      try {
        await plugin.before.call(conn, m, { conn })
      } catch (e) {
        console.error(`👾 『BEFORE』➤ ${name} ➤ ${e.message}`)
      }
    }

    if (!text.startsWith(config.prefix)) continue

    const args = text.slice(config.prefix.length).trim().split(/\s+/)
    const command = (args.shift() || '').toLowerCase()

    if (!command) continue

    for (const [name, plugin] of Object.entries(plugins)) {
      if (plugin.disabled || typeof plugin !== 'function') continue

      const aliases = [
        ...(plugin.help || []),
        ...(plugin.alias || [])
      ].map(x => String(x).toLowerCase())

      let matched = aliases.includes(command)

      if (plugin.command instanceof RegExp) {
        plugin.command.lastIndex = 0
        matched = plugin.command.test(command)
      }

      if (!matched) continue

      try {
        await plugin.call(conn, m, {
          conn,
          args,
          command,
          text: args.join(' '),
          usedPrefix: config.prefix,
          plugins
        })

        // ═══ SOLO SI NO HUBO ERROR ═══
        // Si el plugin tiró error, cae al catch y NO muestra el panel
        logComandoExito(config.prefix + command)

      } catch (e) {
        console.error(`👾 『ERROR』➤ ${name} ➤ ${e.message}`)
        console.error(e.stack || '')
        await m.reply('✗ 『ERROR』➤ No se pudo ejecutar el comando.')
      }

      break
    }
  }
      }
