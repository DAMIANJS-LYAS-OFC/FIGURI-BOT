import config from '../../config.js'

const handler = async (m, { conn }) => {
  const sender = String(m.sender || '').split('@')[0].split(':')[0]
  const owners = (config.owner || global.owner || []).map(o =>
    String(Array.isArray(o) ? o[0] : o).split('@')[0].split(':')[0]
  )

  if (!owners.includes(sender)) {
    return m.reply('✗ 『ERROR』➤ Solo el owner puede usar este comando.')
  }

  await m.reply('👾 『CARGANDO』➤ Recargando plugins...')

  const { loadPlugins } = await import('../../handler.js')
  const total = await loadPlugins()

  await m.reply(`👾 『PLUGINS』➤ ${total} 『RECARGADOS CON EXITO』`)
}

handler.help = ['cargar']
handler.alias = ['reload', 'recargar']
handler.tags = ['owner']
handler.command = /^(cargar|reload|recargar)$/i

export default handler
