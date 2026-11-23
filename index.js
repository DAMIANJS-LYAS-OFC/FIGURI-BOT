import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestWaWebVersion
} from 'baileys'

import pino from 'pino'
import qrcode from 'qrcode-terminal'
import fs from 'fs'
import readline from 'readline'

import { handleMessages, loadPlugins } from './handler.js'
import config from './config.js'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = text =>
  new Promise(resolve => rl.question(text, resolve))

const SESSION = './session/principal'

// ═══ COLORES - SIN ROSA NI NARANJA ═══
const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',        // verde hacker
  neon: '\x1b[38;5;46m',    // verde neón fuerte
  lime: '\x1b[38;5;118m',   // verde lima
  cyan: '\x1b[36m',         // cyan
  blue: '\x1b[34m',         // azul
  purple: '\x1b[35m',       // morado
  white: '\x1b[97m',
  gray: '\x1b[90m',
  yellow: '\x1b[33m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
}

let currentSock = null
let reconnectTimer = null
let starting = false
let botStarted = false
let method = '1'
let phoneNumber = ''

// ══════════════ BORRAR SESIÓN PRINCIPAL ══════════════
function deletePrincipalSession() {
  try {
    if (fs.existsSync(SESSION)) {
      fs.rmSync(SESSION, { recursive: true, force: true })
      console.log(`\n${c.red || ''}☢️ Sesión principal eliminada: ./session/principal${c.reset}`)
      console.log(`${c.cyan}↻ Vuelve a vincular con QR o código.${c.reset}\n`)
    }
  } catch (e) {
    console.error(`[${c.purple}DELETE SESSION${c.reset}]`, e.message)
  }
}

function banner() {
  console.clear()

  // ═══ AUTO ARRIBA ═══
  console.log(`${c.neon}${c.bold}`)
  console.log('───────────────────────────────────────')
  console.log('───▐▀▄───────▄▀▌───▄▄▄▄▄▄▄─────────────')
  console.log('───▌▒▒▀▄▄▄▄▄▀▒▒▐▄▀▀▒██▒██▒▀▀▄──────────')
  console.log('──▐▒▒▒▒▀▒▀▒▀▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▀▄────────')
  console.log('──▌▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▄▒▒▒▒▒▒▒▒▒▒▒▒▀▄──────')
  console.log('▀█▒▒▒█▌▒▒█▒▒▐█▒▒▒▀▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▌─────')
  console.log('▀▌▒▒▒▒▒▒▀▒▀▒▒▒▒▒▒▀▀▒▒▒▒▒▒▒▒▒▒▒▒▒▒▐───▄▄')
  console.log('▐▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▌▄█▒█')
  console.log('▐▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒█▒█▀─')
  console.log('▐▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒█▀───')
  console.log('▐▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▌────')
  console.log('─▌▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▐─────')
  console.log('─▐▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▌─────')
  console.log('──▌▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▐──────')
  console.log('──▐▄▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▄▌──────')
  console.log('────▀▄▄▀▀▀▀▀▄▄▀▀▀▀▀▀▀▄▄▀▀▀▀▀▄▄▀────────')
  console.log(c.reset)

  // ═══ LETRA GIGANTE VERDE HACKER / NEON ═══
  console.log(`${c.neon}${c.bold}`)
  console.log(' ███╗   ███╗ █████╗ ███████╗████████╗███████╗██████╗')
  console.log(' ████╗ ████║██╔══██╗╚══███╔╝══██╔══╝██╔════╝██╔══██╗')
  console.log(' ██╔████╔██║███████║  ███╔╝    ██║   █████╗  ██████╔╝')
  console.log(' ██║╚██╔╝██║██╔══██║ ███╔╝     ██║   ██╔══╝  ██╔══██╗')
  console.log(' ██║ ╚═╝ ██║██║  ██║███████╗   ██║   ███████╗██║  ██║')
  console.log(c.reset)

  console.log(`${c.cyan}${c.bold}${config.botName} ${c.gray}| ${c.purple}${config.botName2}${c.reset}`)
  console.log(`${c.lime}Versión: ${c.white}${config.version}${c.reset}`)
  console.log(`${c.cyan}Desarrollador: ${c.white}${config.author}${c.reset}`)
  console.log(`${c.purple}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`)
}

// ═══ ARTE AL CONECTAR ═══
function connectedArt() {
  console.log(`${c.cyan}`)
  console.log('─────────────────────░██░▇▆▅▄▃▂')
  console.log('────────────────────░█▓▓█░▇▆▅▄▃▂')
  console.log('───────────────────░█▓▓▓█░▇▆▅▄▃▂')
  console.log('──────────────────░█▓▓▓▓▓█░▇▆▅▄▃▂')
  console.log('─────────────────░█▓▓▓▓▓█░▇▆▅▄▃▂')
  console.log('──────────░░░───░█▓▓▓▓▓▓█░▇▆▅▄▃▂')
  console.log('─────────░███░──░█▓▓▓▓▓█░▇▆▅▄▃▂')
  console.log('───────░██░░░██░█▓▓▓▓▓█░▇▆▅▄▃▂')
  console.log('──────░█░░█░░░░██▓▓▓▓▓█░▇▆▅▄▃▂')
  console.log('────░██░░█░░░░░░█▓▓▓▓█░▇▆▅▄▃▂')
  console.log('───░█░░░█░░░░░░░██▓▓▓█░▇▆▅▄▃▂')
  console.log('──░█░░░░█░░░░░░░░█▓▓▓█░▇▆▅▄▃▂')
  console.log('──░█░░░░░█░░░░░░░░█▓▓▓█░▇▆▅▄▃▂')
  console.log('──░█░░█░░░█░░░░░░░░█▓▓█░▇▆▅▄▃▂')
  console.log('─░█░░░█░░░░██░░░░░░█▓▓█░▇▆▅▄▃▂')
  console.log('─░█░░░░█░░░░░██░░░█▓▓▓█░▇▆▅▄▃▂')
  console.log('─░█░█░░░█░░░░░░███▓▓▓▓█░▇▆▅▄▃▂')
  console.log('░█░░░█░░░██░░░░░█▓▓▓▓▓█░▇▆▅▄▃▂')
  console.log('░█░░░░█░░░░█████▓▓▓▓▓█░▇▆▅▄▃▂')
  console.log('░█░░░░░█░░░░░░░█▓▓▓▓▓█░▇▆▅▄▃▂')
  console.log('░█░█░░░░██░░░░█▓▓▓▓▓█░▇▆▅▄▃▂')
  console.log('─░█░█░░░░░████▓▓▓▓██░▇▆▅▄▃▂')
  console.log('─░█░░█░░░░░░░█▓▓██▓█░▇▆▅▄▃▂')
  console.log('──░█░░██░░░██▓▓█▓▓▓█░▇▆▅▄▃▂')
  console.log('───░██░░███▓▓██▓█▓▓█░▇▆▅▄▃▂')
  console.log('────░██▓▓▓███▓▓▓█▓▓▓█░▇▆▅▄▃▂')
  console.log('──────░█▓▓▓▓▓▓▓▓█▓▓▓█░▇▆▅▄▃▂')
  console.log('──────░█▓▓▓▓▓▓▓▓▓▓▓▓▓█░▇▆▅▄▃▂')
  console.log(c.reset)
}

function normalizePhone(input) {
  return String(input || '')
    .replace(/\D/g, '')
    .replace(/^0+/, '')
}

async function selectMethod() {
  if (process.argv.includes('--qr')) return '1'
  if (process.argv.includes('--code')) {
    phoneNumber = normalizePhone(process.argv[3])
    if (phoneNumber.length >= 10 && phoneNumber.length <= 15) {
      return '2'
    }
  }
  if (fs.existsSync(`${SESSION}/creds.json`)) {
    try {
      const creds = JSON.parse(
        fs.readFileSync(`${SESSION}/creds.json`, 'utf8')
      )
      if (creds.registered) return '0'
    } catch {}
  }

  // ═══ LOOP DEL MENU, PARA QUE EL 3 VUELVA ═══
  while (true) {
    console.log(`\n${c.neon}👾 『METODOS DE VINCULACIÓN』${c.reset}`)
    console.log(`${c.cyan}『1』. ${c.white}『Código QR』${c.reset}`)
    console.log(`${c.purple}『2』. ${c.white}『Código de 8 dígitos』${c.reset}`)
    console.log(`${c.lime}『3』. ${c.white}『Volver al menu de eleccion』${c.reset}`)

    let selected = (await question(`\n${c.neon}➤ ${c.reset}`)).trim()

    while (!['1', '2', '3'].includes(selected)) {
      selected = (await question(`${c.cyan}Selecciona 1, 2 o 3: ${c.reset}`)).trim()
    }

    // 3 = Volver al menu, vuelve a mostrar todo
    if (selected === '3') {
      console.clear()
      banner()
      console.log(`\n${c.cyan}↻ Volviendo al menu de eleccion...${c.reset}`)
      continue
    }

    if (selected === '2') {
      phoneNumber = normalizePhone(
        await question(`${c.cyan}Número con código de país: ${c.reset}`)
      )
      while (phoneNumber.length < 10 || phoneNumber.length > 15) {
        if (phoneNumber === '3') {
          console.clear()
          banner()
          break
        }
        phoneNumber = normalizePhone(
          await question(`${c.yellow}Número no válido. Intenta nuevamente (3 para volver): ${c.reset}`)
        )
      }
      if (phoneNumber === '3') {
        phoneNumber = ''
        continue
      }
    }

    return selected
  }
}

async function requestPairingCode(sock, state) {
  try {
    if (!phoneNumber) {
      throw new Error('No se indicó un número de teléfono')
    }
    if (state.creds.registered) return
    console.log(`\n${c.neon}👾 Solicitando código de vinculación...${c.reset}`)
    const code = await sock.requestPairingCode(phoneNumber)
    console.log(`\n${c.purple}━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`)
    console.log(`${c.cyan}❀ 『CÓDIGO』➤ ${c.white}${c.bold}${code}${c.reset}`)
    console.log(`${c.purple}━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`)
    console.log(`${c.gray}WhatsApp > Dispositivos vinculados${c.reset}`)
    console.log(`${c.gray}Vincular dispositivo > Número de teléfono${c.reset}`)
  } catch (e) {
    console.error(`\n${c.purple}[PAIRING ERROR]${c.reset}`, e.message)
    console.error(e.stack || '')
  }
}

async function startBot() {
  if (starting) return
  starting = true
  try {
    fs.mkdirSync(SESSION, { recursive: true })
    const { state, saveCreds } =
      await useMultiFileAuthState(SESSION)
    console.log(`\n${c.cyan}[WHATSAPP] Consultando versión actual...${c.reset}`)
    const { version, isLatest } =
      await fetchLatestWaWebVersion()
    console.log(
      `${c.lime}[WHATSAPP] Versión: ${c.white}${version.join('.')}${c.reset}`,
      `${c.gray}| Actualizada: ${c.cyan}${isLatest}${c.reset}`
    )
    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'warn' }),
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      keepAliveIntervalMs: 30000,
      mobile: false
    })
    currentSock = sock
    sock.ev.on('creds.update', saveCreds)
    let pairingAttempted = false

    // MENSAJES
    // El panel verde NO va acá, va en handler.js para que no mienta
    sock.ev.on('messages.upsert', async update => {
      if (currentSock !== sock) return
      try {
        await handleMessages(sock, update)
      } catch (e) {
        console.error(`[${c.purple}MESSAGES${c.reset}]`, e.message)
      }
    })

    // EVENTOS DE GRUPOS
    sock.ev.on('group-participants.update', async update => {
      if (currentSock !== sock) return
      try {
        const { handleGroupParticipants } =
          await import('./core/eventos.js')
        await handleGroupParticipants(sock, update)
      } catch (e) {
        console.error(`[${c.purple}GROUP EVENT${c.reset}]`, e.message)
      }
    })

    // CONEXIÓN
    sock.ev.on('connection.update', async update => {
      if (currentSock !== sock) return
      const { connection, qr, lastDisconnect } = update

      // QR
      if (qr && method === '1') {
        console.log(`\n${c.neon}❀ ESCANEA EL QR DE MASTER CLOVER${c.reset}\n`)
        qrcode.generate(qr, { small: true })
      }

      // CÓDIGO DE VINCULACIÓN
      if (
        qr &&
        method === '2' &&
        !state.creds.registered &&
        !pairingAttempted
      ) {
        pairingAttempted = true
        await requestPairingCode(sock, state)
      }

      if (connection === 'connecting') {
        console.log(`${c.cyan}↻ Conectando con WhatsApp...${c.reset}`)
      }

      if (connection === 'open') {
        console.log(`\n${c.neon}❀ Bot conectado${c.reset}`)
        console.log(`${c.cyan}仝 ${c.white}${config.botName}${c.reset}`)
        console.log(`${c.purple}━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`)

        // ═══ ARTE DEBAJO DE CONECTADO ═══
        connectedArt()

        if (!botStarted) {
          await loadPlugins()
          botStarted = true
        }
        console.log(`${c.lime}✓ Plugins y eventos activos.${c.reset}\n`)
        try {
          rl.close()
        } catch {}
      }

      if (connection === 'close') {
        const error = lastDisconnect?.error
        const status = error?.output?.statusCode
        console.log(`\n${c.purple}✗ CONEXIÓN CERRADA${c.reset}`)
        console.log(`${c.cyan}Código: ${c.white}${status ?? 'Desconocido'}${c.reset}`)
        console.log(`${c.cyan}Motivo: ${c.white}${error?.message || 'Desconocido'}${c.reset}`)
        if (error?.data) {
          console.log(`${c.gray}Datos:`, error.data)
        }
        currentSock = null

        // ═══ DESCONECTADO MANUALMENTE / LOGGED OUT ═══
        // 401 = te sacaron de Dispositivos vinculados
        if (status === DisconnectReason.loggedOut || status === 401) {
          console.log(`${c.purple}✗ Sesión cerrada manualmente desde WhatsApp.${c.reset}`)
          deletePrincipalSession()
          return
        }

        console.log(`${c.cyan}↻ Conexión perdida. Reconectando...${c.reset}`)
        if (reconnectTimer) {
          clearTimeout(reconnectTimer)
        }
        reconnectTimer = setTimeout(() => {
          starting = false
          startBot()
        }, 5000)
      }
    })

  } catch (e) {
    console.error(`\n${c.purple}[START BOT]${c.reset}`, e.message)
    console.error(e.stack || '')
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
    }
    reconnectTimer = setTimeout(() => {
      starting = false
      startBot()
    }, 10000)
  } finally {
    starting = false
  }
}

banner()
method = await selectMethod()
if (method === '0') {
  method = '1'
}
startBot()
