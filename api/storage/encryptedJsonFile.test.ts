import os from 'os'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { readEncryptedJsonFile, writeEncryptedJsonFile } from './encryptedJsonFile.js'

describe('encryptedJsonFile', () => {
  it('round-trips json with the same passphrase', async () => {
    const tmp = path.join(os.tmpdir(), `ttg-enc-${Date.now()}-${Math.random()}.json`)
    const value = { a: 1, b: 'x', nested: { ok: true } }
    await writeEncryptedJsonFile(tmp, 'pass', value)
    const out = await readEncryptedJsonFile<typeof value>(tmp, 'pass')
    expect(out).toEqual(value)
  })

  it('fails to decrypt with wrong passphrase', async () => {
    const tmp = path.join(os.tmpdir(), `ttg-enc-${Date.now()}-${Math.random()}.json`)
    const value = { a: 1 }
    await writeEncryptedJsonFile(tmp, 'pass', value)
    await expect(readEncryptedJsonFile(tmp, 'wrong')).rejects.toBeTruthy()
  })
})
