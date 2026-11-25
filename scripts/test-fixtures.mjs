/** Shared fixture writers for the script tests. */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'


/**
 * Write one deflated ZIP archive from string or Buffer entries.
 *
 * Returns the full `.zip` path. Entry names keep their forward-slash form.
 */
export function writeZip(dir, name, entries) {
  const localParts = []
  const centralParts = []
  let offset = 0
  const names = Object.keys(entries)
  for (const entryName of names) {
    const value = entries[entryName]
    const content = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8')
    const compressed = zlib.deflateRawSync(content)
    const nameBuffer = Buffer.from(entryName, 'utf8')
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(content.length, 22)
    local.writeUInt16LE(nameBuffer.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(8, 10)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(content.length, 24)
    central.writeUInt16LE(nameBuffer.length, 28)
    central.writeUInt32LE(offset, 42)
    localParts.push(local, nameBuffer, compressed)
    centralParts.push(central, nameBuffer)
    offset += 30 + nameBuffer.length + compressed.length
  }
  const centralBuffer = Buffer.concat(centralParts)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(names.length, 8)
  eocd.writeUInt16LE(names.length, 10)
  eocd.writeUInt32LE(centralBuffer.length, 12)
  eocd.writeUInt32LE(offset, 16)
  const target = path.join(dir, name + '.zip')
  fs.writeFileSync(target, Buffer.concat([...localParts, centralBuffer, eocd]))
  return target
}
