import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'
import { fileURLToPath } from 'url'

//  ═════════════════
// ║ ☢️ Owners Del Bot
//  ═════════════════
globalThis.owner = [
  ['140888466575588@lid', '𐚁ᴅᴀᴍɪᴀɴᴊs-ᴏғᴄ', true]
]

//╔════════════════
//║  🧧 INFO DEL BOT
//╚════════════════
globalThis.namebot = 'Master Clv'
globalThis.packname = 'master'
globalThis.author = '© Made with 𐚁ᴅᴀᴍɪᴀɴᴊs-ᴏғᴄ'
globalThis.tipo = 'principal'
globalThis.botName = 'MASTER-CLV'
globalThis.botName2 = 'CLOVER MULTI DEVICE'
globalThis.version = '3.2.0'
globalThis.prefix = '.'
globalThis.language = 'es'
globalThis.footer = '© MASTER CLOVER'
globalThis.authorSticker = 'Damian.js OFC'

//═════ Canales ═════
globalThis.ch = {
  ch1: '120363430325832555@newsletter',
  ch1Name: '𐚁๋࣭ L᥆ᥴ᥆s ʏ ᥲs᥆ᥴᎥᥲᑯ᥆s ',
}

//════════════════
// 💎 ECONOMY
//════════════════
globalThis.coins = {
  name: 'Diamantes',
  simbolo: '$',
  currency: '🍫',
  currencyName: 'chocolate',
  currencyPlural: 'chocolates',
  symbol: '$',
  startBalance: 100,
  dailyAmount: 500,
  dailyCooldown: 86400000,
  minBet: 10,
  maxBet: 10000
}

globalThis.banner = {
  enabled: true,
  url: '',
  source: 'tourl'
}

globalThis.channel = {
  name: '𐚁๋࣭ L᥆ᥴ᥆s ʏ ᥲs᥆ᥴᎥᥲᑯ᥆s ',
  id: '120363430325832555@newsletter',
  link: ''
}

globalThis.links = {
  github: '',
  channel: '',
  group: '',
  support: ''
}

let file = fileURLToPath(import.meta.url)
watchFile(file, () => {
  unwatchFile(file)
  console.log(chalk.redBright("Update 'config.js'"))
  import(`${file}?update=${Date.now()}`)
})
