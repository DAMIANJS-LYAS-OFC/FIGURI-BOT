import fs from 'fs'
import path from 'path'
import '../config.js'

import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} from 'baileys'

export const botName =
  globalThis.botName ||
  globalThis.botName2 ||
  globalThis.namebot ||
  'Bot'

export const currency =
  globalThis.coins?.currency || '¢'

export const economy =
  globalThis.coins || {
    currency: '¢',
    currencyName: 'Clovers'
  }

const subbots = new Map()

const storageDir = path.join(
  process.cwd(),
  'storage',
  'subbots'
)

fs.mkdirSync(storageDir, { recursive: true })

function normalizeNumber(id) {
  return String(id || '')
    .split('@')[0]
    .split(':')[0]
    .replace(/\D/g, '')
}

export function isValidBotNumber(number) {
  return /^\d{8,15}$/.test(normalizeNumber(number))
}

function getConfigFile(numero) {
  const number = normalizeNumber(numero)

  if (!isValidBotNumber(number)) {
    throw new Error('Número de subbot inválido')
  }

  return path.join(
    storageDir,
    `subbot.config${number}.json`
  )
}

// ═══════════════════════
// ❒ CONFIGURACIONES
// ═══════════════════════

export function getSubConfig(numero) {
  const file = getConfigFile(numero)

  if (!fs.existsSync(file)) return null

  try {
    return JSON.parse(
      fs.readFileSync(file, 'utf8')
    )
  } catch (error) {
    console.error('[SUBBOT] Error leyendo configuración:', error)
    return null
  }
}

export function saveSubConfig(numero, data = {}) {
  const number = normalizeNumber(numero)
  const file = getConfigFile(number)
  const previous = getSubConfig(number) || {}

  const config = {
    ...previous,
    ...data,
    number,
    createdAt: previous.createdAt || Date.now(),
    updatedAt: Date.now()
  }

  const tempFile = `${file}.tmp`

  fs.writeFileSync(
    tempFile,
    JSON.stringify(config, null, 2)
  )

  fs.renameSync(tempFile, file)

  return config
}

export function getAllSubConfigs() {
  return fs.readdirSync(storageDir)
    .filter(file => /^subbot\.config\d+\.json$/.test(file))
    .map(file => {
      try {
        return JSON.parse(
          fs.readFileSync(
            path.join(storageDir, file),
            'utf8'
          )
        )
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

// ═══════════════════════
// ❒ SESIONES
// ═══════════════════════

export function getSubbotPath(id) {
  const number = normalizeNumber(id)

  if (!isValidBotNumber(number)) {
    throw new Error('Identificador de subbot inválido')
  }

  const dir = path.join(
    process.cwd(),
    'jadiBots',
    number
  )

  fs.mkdirSync(dir, { recursive: true })

  return dir
}

export function getSub(id) {
  return subbots.get(normalizeNumber(id)) || null
}

function getDisconnectCode(error) {
  return (
    error?.output?.statusCode ??
    error?.data?.statusCode ??
    error?.statusCode ??
    error?.cause?.output?.statusCode ??
    null
  )
}

function resolveWaiters(record, result) {
  for (const resolve of record.waiters) {
    resolve(result)
  }

  record.waiters.clear()
}

// ═══════════════════════
// ❒ CREAR SOCKET
// ═══════════════════════

async function startSocket(record) {
  if (record.starting) return record.starting

  record.starting = (async () => {
    const sock = makeWASocket({
      version: record.version,
      auth: record.state,
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      keepAliveIntervalMs: 30000,
      mobile: false
    })

    record.sock = sock
    record.status = 'connecting'

    saveSubConfig(record.number, {
      status: 'connecting'
    })

    sock.ev.on('creds.update', async () => {
      try {
        await record.saveCreds()

        saveSubConfig(record.number, {
          registered: Boolean(record.state.creds.registered)
        })
      } catch (error) {
        console.error('[SUBBOT] Error guardando credenciales:', error)
      }
    })

    sock.ev.on('connection.update', update => {
      if (getSub(record.number) !== record) return
      if (record.sock !== sock) return

      if (update.connection === 'open') {
        record.status = 'open'
        record.restarting = false

        const user = sock.user || {}

        saveSubConfig(record.number, {
          status: 'open',
          registered: true,
          authRejected: false,
          jid: user.id || null,
          lid: user.lid || null,
          name: user.name || null,
          connectedAt: Date.now()
        })

        console.log(`[SUBBOT] ✓ Conectado: ${record.number}`)
        resolveWaiters(record, true)
      }

      if (update.connection === 'close') {
        const error = update.lastDisconnect?.error
        const statusCode = getDisconnectCode(error)

        console.log(
          `[SUBBOT] Desconectado: ${record.number} | Código: ${statusCode}`
        )

        // REINICIO 515

        if (
          statusCode === 515 ||
          statusCode === DisconnectReason.restartRequired
        ) {
          record.status = 'connecting'
          record.restarting = true

          saveSubConfig(record.number, {
            status: 'reconnecting'
          })

          setTimeout(async () => {
            if (getSub(record.number) !== record) return
            if (record.sock !== sock) return

            try {
              await startSocket(record)
              console.log(`[SUBBOT] ↻ Socket reiniciado: ${record.number}`)
            } catch (restartError) {
              record.status = 'closed'
              record.restarting = false

              saveSubConfig(record.number, {
                status: 'closed'
              })

              console.error('[SUBBOT] Error reiniciando:', restartError)
              resolveWaiters(record, false)
            }
          }, 500)

          return
        }

        // AUTENTICACIÓN RECHAZADA

        if (
          statusCode === 401 ||
          statusCode === DisconnectReason.loggedOut
        ) {
          record.status = 'loggedOut'
          record.restarting = false

          saveSubConfig(record.number, {
            status: 'loggedOut',
            registered: false,
            authRejected: true,
            lastDisconnectCode: statusCode
          })

          console.log(`[SUBBOT] ✗ Autenticación rechazada: ${record.number}`)
          resolveWaiters(record, false)
          return
        }

        record.status = 'closed'
        record.restarting = false

        saveSubConfig(record.number, {
          status: 'closed',
          lastDisconnectCode: statusCode
        })

        resolveWaiters(record, false)
      }
    })

    return sock
  })()

  try {
    return await record.starting
  } finally {
    record.starting = null
  }
}

// ═══════════════════════
// ❒ CREAR SUBBOT
// ═══════════════════════

export async function createSubbotSocket(numero) {
  const number = normalizeNumber(numero)

  if (!isValidBotNumber(number)) {
    throw new Error('Número de subbot inválido')
  }

  let record = getSub(number)

  if (record?.status === 'loggedOut') {
    throw new Error('La sesión fue rechazada. Solicita una nueva vinculación.')
  }

  if (
    record?.sock &&
    ['connecting', 'open'].includes(record.status)
  ) {
    return record.sock
  }

  if (!record) {
    const dir = getSubbotPath(number)

    const { state, saveCreds } =
      await useMultiFileAuthState(dir)

    const { version } =
      await fetchLatestBaileysVersion()

    record = {
      number,
      sock: null,
      state,
      saveCreds,
      version,
      status: 'connecting',
      waiters: new Set(),
      starting: null,
      restarting: false,
      pairingPromise: null
    }

    subbots.set(number, record)

    saveSubConfig(number, {
      status: 'connecting',
      registered: Boolean(state.creds.registered)
    })
  }

  return await startSocket(record)
}

// ═══════════════════════
// ❒ REINICIAR SESIÓN
// ═══════════════════════

export async function resetSubbotSession(numero) {
  const number = normalizeNumber(numero)

  if (!isValidBotNumber(number)) {
    throw new Error('Número inválido')
  }

  const record = getSub(number)

  if (record?.status === 'open') {
    throw new Error('El subbot está conectado.')
  }

  if (record?.sock) {
    try {
      record.sock.end(new Error('Nueva vinculación'))
    } catch {}
  }

  if (record) {
    resolveWaiters(record, false)
    subbots.delete(number)
  }

  const dir = getSubbotPath(number)

  if (fs.existsSync(dir)) {
    const backup = `${dir}.backup-${Date.now()}`
    fs.renameSync(dir, backup)

    console.log(`[SUBBOT] Copia guardada: ${backup}`)
  }

  saveSubConfig(number, {
    status: 'waitingPairing',
    registered: false,
    authRejected: false,
    jid: null,
    lid: null,
    name: null
  })

  return true
}

// ═══════════════════════
// ❒ CÓDIGO DE VINCULACIÓN
// ═══════════════════════

export async function getPairingCode(numero) {
  const number = normalizeNumber(numero)

  if (!isValidBotNumber(number)) {
    throw new Error('Número de teléfono inválido')
  }

  let record = getSub(number)
  const config = getSubConfig(number)

  if (record?.status === 'open') {
    return { status: 'connected' }
  }

  if (
    record?.status === 'loggedOut' ||
    config?.status === 'loggedOut' ||
    config?.authRejected
  ) {
    await resetSubbotSession(number)
    record = null
  }

  let sock = await createSubbotSocket(number)
  record = getSub(number)

  if (!record) {
    throw new Error('No se pudo crear el subbot')
  }

  if (record.status === 'open') {
    return { status: 'connected' }
  }

  if (record.pairingPromise) {
    return await record.pairingPromise
  }

  if (record.state.creds.registered) {
    throw new Error(
      'Esta sesión ya está registrada. Es necesario preparar una nueva vinculación.'
    )
  }

  record.pairingPromise = (async () => {
    await new Promise(resolve => setTimeout(resolve, 1500))

    if (record.status === 'open') {
      return { status: 'connected' }
    }

    if (record.status !== 'connecting' || record.sock !== sock) {
      throw new Error('El socket no está listo para solicitar el código.')
    }

    const code = await sock.requestPairingCode(number)

    saveSubConfig(number, {
      status: 'pending',
      registered: false,
      authRejected: false
    })

    return {
      status: 'pending',
      code: String(code)
    }
  })()

  try {
    return await record.pairingPromise
  } finally {
    record.pairingPromise = null
  }
}

// ═══════════════════════
// ❒ ESPERAR CONEXIÓN
// ═══════════════════════

export async function waitForSubConnection(numero, timeout = 180000) {
  const record = getSub(numero)

  if (!record) return false
  if (record.status === 'open') return true

  if (['closed', 'loggedOut'].includes(record.status)) {
    return false
  }

  return new Promise(resolve => {
    let finished = false

    const finish = result => {
      if (finished) return

      finished = true
      clearTimeout(timer)
      record.waiters.delete(finish)
      resolve(result)
    }

    const timer = setTimeout(() => finish(false), timeout)

    record.waiters.add(finish)

    if (record.status === 'open') finish(true)
    else if (['closed', 'loggedOut'].includes(record.status)) {
      finish(false)
    }
  })
}

// ═══════════════════════
// ❒ COMPATIBILIDAD
// ═══════════════════════

export const getJadiPath = getSubbotPath
export const createJadiSocket = createSubbotSocket
