/** Minimal lazy ZIP reader for DeepSeek export archives. */
import fs from 'node:fs'
import zlib from 'node:zlib'
import { MAX_ZIP_ENTRIES, MAX_ZIP_ENTRY_BYTES, MAX_ZIP_TOTAL_BYTES } from './constants.js'

const EOCD = 0x06054b50
const CENTRAL = 0x02014b50
const LOCAL = 0x04034b50
const TAIL_BYTES = 66_000


function readRange(fd, offset, length) {
  const buffer = Buffer.alloc(length)
  let read = 0
  while (read < length) {
    const chunk = fs.readSync(fd, buffer, read, length - read, offset + read)
    if (chunk <= 0) break
    read += chunk
  }
  return read === length ? buffer : buffer.subarray(0, read)
}


function findEndOfCentralDirectory(tail) {
  for (let offset = tail.length - 22; offset >= 0; offset -= 1) {
    if (tail.readUInt32LE(offset) === EOCD) return offset
  }
  return -1
}


function readCentralDirectory(fd, size, tail) {
  const eocd = findEndOfCentralDirectory(tail)
  if (eocd < 0) throw new Error('zip 文件不完整')
  const count = tail.readUInt16LE(eocd + 10)
  const centralSize = tail.readUInt32LE(eocd + 12)
  const centralOffset = tail.readUInt32LE(eocd + 16)
  if (count === 0) throw new Error('zip 是空的')
  if (count > MAX_ZIP_ENTRIES) throw new Error('zip 里的文件太多')
  if (centralOffset >= size || centralOffset + centralSize > size) throw new Error('zip 目录损坏')
  const central = readRange(fd, centralOffset, centralSize)
  let total = 0
  const entries = []
  let offset = 0
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > central.length || central.readUInt32LE(offset) !== CENTRAL) {
      throw new Error('zip 目录损坏')
    }
    const flags = central.readUInt16LE(offset + 8)
    const method = central.readUInt16LE(offset + 10)
    const compressed = central.readUInt32LE(offset + 20)
    const uncompressed = central.readUInt32LE(offset + 24)
    const nameLength = central.readUInt16LE(offset + 28)
    const extraLength = central.readUInt16LE(offset + 30)
    const commentLength = central.readUInt16LE(offset + 32)
    const localOffset = central.readUInt32LE(offset + 42)
    const name = central.toString('utf8', offset + 46, offset + 46 + nameLength)
    offset += 46 + nameLength + extraLength + commentLength
    if (name.endsWith('/')) continue
    if (flags & 1) throw new Error('加密的 zip 不支持')
    if (method !== 0 && method !== 8) throw new Error('zip 使用了不支持的压缩方式')
    if (compressed === 0xffffffff || uncompressed === 0xffffffff) throw new Error('zip64 暂不支持')
    if (uncompressed > MAX_ZIP_ENTRY_BYTES) throw new Error('zip 内单个文件过大')
    total += uncompressed
    if (total > MAX_ZIP_TOTAL_BYTES) throw new Error('zip 解压后过大')
    entries.push({ name, method, compressed, uncompressed, localOffset })
  }
  return entries
}


function readEntry(filePath, size, entry) {
  const fd = fs.openSync(filePath, 'r')
  try {
    const header = readRange(fd, entry.localOffset, 30)
    if (header.length < 30 || header.readUInt32LE(0) !== LOCAL) throw new Error('zip 条目损坏')
    const nameLength = header.readUInt16LE(26)
    const extraLength = header.readUInt16LE(28)
    const dataStart = entry.localOffset + 30 + nameLength + extraLength
    if (dataStart + entry.compressed > size) throw new Error('zip 条目损坏')
    const raw = readRange(fd, dataStart, entry.compressed)
    let content
    try {
      content = entry.method === 0 ? raw : zlib.inflateRawSync(raw)
    } catch {
      throw new Error('zip 解压失败')
    }
    if (content.length !== entry.uncompressed) throw new Error('zip 解压大小不一致')
    return content
  } finally {
    fs.closeSync(fd)
  }
}


/**
 * Open a ZIP archive by reading only its central directory.
 *
 * Returns `{ entries, read(name) }`; `read` decompresses one entry on demand,
 * so a multi-hundred-megabyte export never has to be inflated as a whole.
 * Throws a short, user-facing reason for unsupported archives.
 */
export function openZip(filePath) {
  const fd = fs.openSync(filePath, 'r')
  let size
  let entries
  try {
    size = fs.fstatSync(fd).size
    const tailLength = Math.min(size, TAIL_BYTES)
    const tail = readRange(fd, size - tailLength, tailLength)
    entries = readCentralDirectory(fd, size, tail)
  } finally {
    fs.closeSync(fd)
  }
  const byName = new Map(entries.map((entry) => [entry.name, entry]))
  return {
    entries,
    has(name) {
      return byName.has(name)
    },
    read(name) {
      const entry = byName.get(name)
      if (!entry) throw new Error('zip 条目不存在')
      return readEntry(filePath, size, entry)
    },
  }
}
