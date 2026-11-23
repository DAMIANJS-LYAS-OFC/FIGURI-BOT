import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import config from '../../config.js'

const handler = async (m, { conn }) => {
  const sender = String(m.sender || '').split('@')[0].split(':')[0]
  const owners = (config.owner || global.owner || []).map(o =>
    String(Array.isArray(o) ? o[0] : o).split('@')[0].split(':')[0]
  )

  if (!owners.includes(sender)) {
    return m.reply('✗ 『ERROR』➤ Solo el owner puede usar este comando.')
  }

  await m.reply('❀ 『RESTART』➤ Reiniciando bot...')

  const root = path.dirname(fileURLToPath(new URL('../../index.js', import.meta.url)))
  const entry = path.join(root, 'index.js')

  const child = spawn(process.execPath, [entry, ...process.argv.slice(2)], {
    detached: true,
    stdio: 'inherit'
  })
  child.unref()
  setTimeout(() => process.exit(0), 800)
}

handler.help = ['restart']
handler.alias = ['reiniciar']
handler.tags = ['owner']
handler.command = /^(restart|reiniciar)$/i

export default handler
