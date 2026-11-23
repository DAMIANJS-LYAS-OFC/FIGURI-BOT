import {
  getPairingCode,
  getSub,
  waitForSubConnection,
  isValidBotNumber
} from '../lib/subbots.js'

const handler = async (m, { conn }) => {
  try {
    if (!conn) {
      return m.reply('✗ La conexión todavía no está lista.')
    }

    const args = String(m.text || '')
      .trim()
      .split(/\s+/)
      .slice(1)

    const mentioned = m.mentionedJid?.[0]
    const quoted = m.quoted?.sender

    let target = args[0] || mentioned || quoted || m.sender

    if (String(target).endsWith('@lid')) {
      const pn = await conn.signalRepository
        ?.lidMapping
        ?.getPNForLID?.(target)

      if (pn) target = pn
    }

    const number = String(target)
      .split('@')[0]
      .split(':')[0]
      .replace(/\D/g, '')

    if (!isValidBotNumber(number)) {
      return m.reply(
        '✗ Número inválido.\n\n' +
        'Ejemplo: *.code 549XXXXXXXXXX*'
      )
    }

    const existing = getSub(number)

    if (existing?.status === 'open' && existing.sock?.user) {
      return m.reply(
        '✓ Este número ya tiene un subbot conectado.'
      )
    }

    await m.reply(
      '꒰ᐢ..ᐢ꒱ Preparando la vinculación...\n\n' +
      `Número: +${number}`
    )

    const result = await getPairingCode(number)

    if (result.status === 'connected') {
      return m.reply(
        '✓ Este número ya está conectado como subbot.'
      )
    }

    if (!result.code) {
      return m.reply(
        '✗ No se pudo obtener el código de vinculación.\n' +
        'Estado: ' + (result.status || 'desconocido')
      )
    }

    // El código se envía SOLO, en un mensaje separado.

    await conn.sendMessage(m.chat, {
      text: result.code
    })

    const connected = await waitForSubConnection(
      number,
      180000
    )

    if (connected) {
      await m.reply(
        '✓ Subbot conectado correctamente.\n\n' +
        `Número: +${number}`
      )
    } else {
      await m.reply(
        '⌁ Todavía no se confirmó la conexión.\n' +
        'Comprueba que hayas introducido el código en WhatsApp.'
      )
    }

  } catch (e) {
    console.error('[CODE]', e)

    await m.reply(
      '✗ Error al crear el subbot:\n' +
      String(e?.message || e).slice(0, 500)
    )
  }
}

handler.help = ['code <número>']
handler.alias = ['serbot', 'jadibot', 'subbot', 'masters']
handler.tags = ['tools']
handler.descrip = ['Genera un código para conectar un subbot']
handler.command = /^(?:code|serbot|jadibot|subbot|masters)$/i

export default handler
