import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import './config.js'

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

function logComandoExito(comando) {
  if (!comando) return
  console.log(`${c.green}🧧╔═══════════════════════════🧧${c.reset}`)
  console.log(`${c.green}🧧║Comando ${comando} ejecutado con exito${c.reset}`)
  console.log(`${c.green}🧧╚═══════════════════════════🧧${c.reset}`)
}

function getPluginFiles(dir) {
  let files = []
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    if (entry.isDirectory()) {
      files.push(...getPluginFiles(full))
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(full)
    }
  }
  return files
}

export async function loadPlugins() {
  if (!fs.existsSync(pluginDir)) {
    fs.mkdirSync(pluginDir, { recursive: true })
  }
  global.plugins = {}
  const files = getPluginFiles(pluginDir)
  for (const fullPath of files) {
    const rel = path.relative(pluginDir, fullPath).split(path.sep).join('/')
    try {
      const url = pathToFileURL(fullPath)
      url.searchParams.set('update', Date.now())
      const imported = await import(url.href)
      const plugin = imported.default
      if (typeof plugin !== 'function') continue
      global.plugins[rel] = plugin
      console.log(`👾 『PLUGIN CARGADO』➤ ${rel}`)
    } catch (e) {
      console.error(`👾 『ERROR PLUGIN』➤ ${rel} ➤ ${e.message}`)
    }
  }
  console.log(`👾 『PLUGINS』➤ ${Object.keys(global.plugins).length} 『CARGADOS』`)
  return Object.keys(global.plugins).length
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
    for (const [name, plugin] of Object.entries(plugins)) {
      if (plugin.disabled || typeof plugin.before !== 'function') continue
      try {
        await plugin.before.call(conn, m, { conn })
      } catch (e) {
        console.error(`👾 『BEFORE』➤ ${name} ➤ ${e.message}`)
      }
    }
    const prefix = globalThis.prefix || '.'
    if (!text.startsWith(prefix)) continue
    const args = text.slice(prefix.length).trim().split(/\s+/)
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
          usedPrefix: prefix,
          plugins
        })
        logComandoExito(prefix + command)
      } catch (e) {
        console.error(`👾 『ERROR』➤ ${name} ➤ ${e.message}`)
        console.error(e.stack || '')
        await m.reply('✗ 『ERROR』➤ No se pudo ejecutar el comando.')
      }
      break
    }
  }
      }
