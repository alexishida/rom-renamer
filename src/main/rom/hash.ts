import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { extname } from 'node:path'
import type { Hashes } from '@shared/types'

const CRC32_TABLE = makeCrc32Table()

export async function calculateHashes(filePath: string): Promise<Hashes> {
  const md5 = createHash('md5')
  const sha1 = createHash('sha1')
  let crc32 = 0

  for await (const chunk of normalizedChunks(filePath)) {
    md5.update(chunk)
    sha1.update(chunk)
    crc32 = updateCrc32(crc32, chunk)
  }

  return {
    crc32: crc32.toString(16).padStart(8, '0').toUpperCase(),
    md5: md5.digest('hex').toUpperCase(),
    sha1: sha1.digest('hex').toUpperCase(),
  }
}

async function* normalizedChunks(filePath: string): AsyncGenerator<Buffer> {
  const ext = extname(filePath).toLowerCase()
  const blockSize = ext === '.v64' ? 2 : ext === '.n64' ? 4 : 1
  let carry = Buffer.alloc(0)

  for await (const rawChunk of createReadStream(filePath)) {
    const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk)

    if (blockSize === 1) {
      yield chunk
      continue
    }

    const joined = carry.length ? Buffer.concat([carry, chunk]) : chunk
    const processLength = joined.length - (joined.length % blockSize)

    if (processLength > 0) {
      yield normalizeN64ByteOrder(joined.subarray(0, processLength), blockSize)
    }

    carry = joined.subarray(processLength)
  }

  if (carry.length > 0) {
    yield carry
  }
}

function normalizeN64ByteOrder(buffer: Buffer, blockSize: 2 | 4): Buffer {
  const normalized = Buffer.allocUnsafe(buffer.length)

  if (blockSize === 2) {
    for (let index = 0; index < buffer.length; index += 2) {
      normalized[index] = buffer[index + 1] ?? 0
      normalized[index + 1] = buffer[index] ?? 0
    }
    return normalized
  }

  for (let index = 0; index < buffer.length; index += 4) {
    normalized[index] = buffer[index + 3] ?? 0
    normalized[index + 1] = buffer[index + 2] ?? 0
    normalized[index + 2] = buffer[index + 1] ?? 0
    normalized[index + 3] = buffer[index] ?? 0
  }

  return normalized
}

function updateCrc32(previous: number, buffer: Buffer): number {
  let crc = previous ^ -1

  for (const byte of buffer) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff]!
  }

  return (crc ^ -1) >>> 0
}

function makeCrc32Table(): Uint32Array {
  const table = new Uint32Array(256)

  for (let index = 0; index < 256; index += 1) {
    let crc = index
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }
    table[index] = crc >>> 0
  }

  return table
}
