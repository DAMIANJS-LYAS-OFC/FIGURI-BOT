
import fs from 'node:fs/promises'
import path from 'node:path'

const ICON_DIR = path.join(process.cwd(), 'storage', 'icons')
const PRIMARY_ICON = path.join(ICON_DIR, 'primary.jpg')

// Identificar cada bot por su número
export function getBotNumber(conn) {
  const id = conn?.user?.id || conn?.user?.lid

  if (!id) throw new Error('No se pudo identificar el bot.')

  return String(id)
    .split('@')[0]
    .split(':')[0]
    .replace(/\D/g, '')
}

export async function getBotIcon(conn) {
  await fs.mkdir(ICON_DIR, { recursive: true })

  const number = getBotNumber(conn)
  const personalIcon = path.join(ICON_DIR, `${number}.jpg`)

  // 1. Primero buscar icono individual
  try {
    return await fs.readFile(personalIcon)
  } catch {}

  // 2. Si no tiene, utilizar icono principal
  try {
    return await fs.readFile(PRIMARY_ICON)
  } catch {}

  // 3. Si ninguno existe
  return null
}

export async function saveBotIcon(conn, buffer) {
  await fs.mkdir(ICON_DIR, { recursive: true })

  const number = getBotNumber(conn)
  const personalIcon = path.join(ICON_DIR, `${number}.jpg`)

  // El primer icono se convierte en el principal
  try {
    await fs.access(PRIMARY_ICON)
  } catch {
    await fs.writeFile(PRIMARY_ICON, buffer)
  }

  // Guardar icono individual
  await fs.writeFile(personalIcon, buffer)

  return {
    number,
    primary: false,
    path: personalIcon
  }
}

export async function deleteBotIcon(conn) {
  const number = getBotNumber(conn)
  const personalIcon = path.join(ICON_DIR, `${number}.jpg`)

  try {
    await fs.unlink(personalIcon)
    return true
  } catch {
    return false
  }
}

// Enviar documento TXT con icono correspondiente
export async function sendStyledDocument(conn, jid, content, options = {}) {
  const icon = await getBotIcon(conn)

  const buffer = Buffer.isBuffer(content)
    ? content
    : Buffer.from(String(content), 'utf8')

  return conn.sendMessage(jid, {
    document: buffer,
    mimetype: 'text/plain',
    fileName: options.fileName || 'master-clover.txt',
    jpegThumbnail: icon || undefined,
    caption: options.caption || undefined
  }, options.quoted ? { quoted: options.quoted } : {})
}
  
