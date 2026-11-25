/** Minimal ZIP reader for DeepSeek export archives. */
import zlib from 'node:zlib'
import { MAX_ZIP_ENTRIES, MAX_ZIP_ENTRY_BYTES, MAX_ZIP_TOTAL_BYTES } from './constants.js'

const EOCD = 0x06054b50
const CENTRAL = 0x02014b50
const LOCAL = 0x04034b50


function findEndOfCentralDirectory(buffer) {
  const start = Math.max(0, buffer.length - 66_000)
  for (let offset = buffer.length - 22; offset >= start; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD) return offset
  }
  return -1
}


/** Read every entry; returns [{ name, content }]. Throws a short, user-facing reason. */
export function readZipEntries(buffer) {
  const eocd = findEndOfCentralDirectory(buffer)
  if (eocd < 0) throw new Error('zip 文件不完整')
  const count = buffer.readUInt16LE(eocd + 10)
  const centralOffset = buffer.readUInt32LE(eocd + 16)
  if (count === 0) throw new Error('zip 是空的')
  if (count > MAX_ZIP_ENTRIES) throw new Error('zip 里的文件太多')
  if (centralOffset >= buffer.length) throw new Error('zip 目录损坏')
  let total = 0
  const entries = []
  let offset = centralOffset
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== CENTRAL) {
      throw new Error('zip 目录损坏')
    }
    const flags = buffer.readUInt16LE(offset + 8)
    const method = buffer.readUInt16LE(offset + 10)
    const compressed = buffer.readUInt32LE(offset + 20)
    const uncompressed = buffer.readUInt32LE(offset + 24)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localOffset = buffer.readUInt32LE(offset + 42)
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength)
    offset += 46 + nameLength + extraLength + commentLength
    if (name.endsWith('/')) continue
    if (flags & 1) throw new Error('加密的 zip 不支持')
    if (method !== 0 && method !== 8) throw new Error('zip 使用了不支持的压缩方式')
    if (compressed === 0xffffffff || uncompressed === 0xffffffff) throw new Error('zip64 暂不支持')
    if (uncompressed > MAX_ZIP_ENTRY_BYTES) throw new Error('zip 内单个文件过大')
    total += uncompressed
    if (total > MAX_ZIP_TOTAL_BYTES) throw new Error('zip 解压后过大')
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== LOCAL) {
      throw new Error('zip 条目损坏')
    }
    const localName = buffer.readUInt16LE(localOffset + 26)
    const localExtra = buffer.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localName + localExtra
    const raw = buffer.subarray(dataStart, dataStart + compressed)
    let content
    try {
      content = method === 0 ? raw : zlib.inflateRawSync(raw)
    } catch {
      throw new Error('zip 解压失败')
    }
    if (content.length !== uncompressed) throw new Error('zip 解压大小不一致')
    entries.push({ name, content })
  }
  return entries
}
