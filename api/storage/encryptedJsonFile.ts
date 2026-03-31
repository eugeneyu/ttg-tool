import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'

type EncryptedPayload = {
  v: 1
  salt: string
  iv: string
  tag: string
  data: string
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.scryptSync(passphrase, salt, 32)
}

function toB64(buf: Buffer): string {
  return buf.toString('base64')
}

function fromB64(str: string): Buffer {
  return Buffer.from(str, 'base64')
}

export async function readEncryptedJsonFile<T>(
  filePath: string,
  passphrase: string,
): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8')
  const payload = JSON.parse(raw) as EncryptedPayload
  if (payload.v !== 1) throw new Error('Unsupported encrypted payload version')

  const salt = fromB64(payload.salt)
  const iv = fromB64(payload.iv)
  const tag = fromB64(payload.tag)
  const encrypted = fromB64(payload.data)

  const key = deriveKey(passphrase, salt)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return JSON.parse(decrypted.toString('utf8')) as T
}

export async function writeEncryptedJsonFile(
  filePath: string,
  passphrase: string,
  value: unknown,
): Promise<void> {
  const salt = crypto.randomBytes(16)
  const iv = crypto.randomBytes(12)
  const key = deriveKey(passphrase, salt)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

  const plaintext = Buffer.from(JSON.stringify(value), 'utf8')
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()

  const payload: EncryptedPayload = {
    v: 1,
    salt: toB64(salt),
    iv: toB64(iv),
    tag: toB64(tag),
    data: toB64(encrypted),
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8')
}
