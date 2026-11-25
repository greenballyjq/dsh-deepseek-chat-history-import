/** Resolve exported attachments into DSH attachment references for import. */
import fs from 'node:fs'
import path from 'node:path'
import { MAX_ATTACHMENT_BYTES } from './constants.js'
import { openZip } from './zip.js'

const ZIP_MAGIC = 0x04034b50


/** Normalize an archive-relative path; empty means the path is unsafe. */
function safeExportPath(value) {
  const text = String(value || '').replace(/\\/g, '/')
  if (!text || text.startsWith('/') || /^[A-Za-z]:/.test(text)) return ''
  const parts = text.split('/')
  if (parts.some((part) => part === '' || part === '.' || part === '..')) return ''
  return text
}


function isZipFile(filePath) {
  const fd = fs.openSync(filePath, 'r')
  try {
    const magic = Buffer.alloc(4)
    const read = fs.readSync(fd, magic, 0, 4, 0)
    return read === 4 && magic.readUInt32LE(0) === ZIP_MAGIC
  } finally {
    fs.closeSync(fd)
  }
}


function mediaTypeOf(buffer) {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png'
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.length >= 6 && buffer.toString('ascii', 0, 3) === 'GIF') return 'image/gif'
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return ''
}


/**
 * One reader for the export a conversation came from.
 *
 * A ZIP source resolves `exportPath` inside the archive; an extracted session
 * file resolves it under the export root next to `chat_sessions/`.
 */
function createReader(sourcePath) {
  if (!sourcePath || !fs.existsSync(sourcePath)) return null
  if (isZipFile(sourcePath)) {
    const zip = openZip(sourcePath)
    return {
      read(exportPath) {
        if (!zip.has(exportPath)) throw new Error('附件不在压缩包里')
        return zip.read(exportPath)
      },
    }
  }
  const roots = [path.dirname(path.dirname(sourcePath)), path.dirname(sourcePath)]
  return {
    read(exportPath) {
      for (const root of roots) {
        const target = path.resolve(root, exportPath)
        if (!target.startsWith(path.resolve(root) + path.sep)) continue
        if (!fs.existsSync(target)) continue
        const stat = fs.statSync(target)
        if (stat.isFile()) return fs.readFileSync(target)
      }
      throw new Error('附件不在导出目录里')
    },
  }
}


/**
 * Attach exported files to the user turns that reference them.
 *
 * Images become image blocks and other files become file blocks through the
 * host attachment service. Every failure is reported as a note on the turn and
 * counted, so one missing file never aborts the import. The returned turns are
 * new objects; the input turns are left untouched.
 */
export async function resolveTurnAttachments(wctx, turns, options = {}) {
  const attachments = typeof wctx.get === 'function' ? wctx.get('attachments') : undefined
  const sourcePath = options.sourcePath || ''
  const stats = { images: 0, files: 0, skipped: 0 }
  const reader = createReader(sourcePath)
  const saved = new Map()

  const saveOne = async (file, exportPath) => {
    if (!attachments) throw new Error('附件服务不可用')
    if (!reader) throw new Error('找不到导出文件')
    if (file.size > MAX_ATTACHMENT_BYTES) throw new Error('附件太大')
    const buffer = reader.read(exportPath)
    if (buffer.length > MAX_ATTACHMENT_BYTES) throw new Error('附件太大')
    const mediaType = mediaTypeOf(buffer)
    if (mediaType) {
      const ref = await attachments.saveImage({ data: buffer, mediaType, name: file.name || undefined })
      return { type: 'image', attachment: ref }
    }
    const ref = await attachments.saveFile({ data: buffer, name: file.name || undefined })
    return { type: 'file', attachment: ref }
  }

  const nextTurns = []
  for (const turn of turns) {
    const files = Array.isArray(turn.files) ? turn.files : []
    if (files.length === 0) {
      nextTurns.push(turn)
      continue
    }
    const notes = Array.isArray(turn.notes) ? [...turn.notes] : []
    const blocks = []
    for (const file of files) {
      const exportPath = safeExportPath(file.exportPath)
      const label = file.name || '附件'
      if (!exportPath) continue
      try {
        let entry = saved.get(exportPath)
        if (!entry) {
          entry = { block: await saveOne(file, exportPath) }
          saved.set(exportPath, entry)
          if (entry.block.type === 'image') stats.images += 1
          else stats.files += 1
        }
        if (!blocks.includes(entry.block)) blocks.push(entry.block)
      } catch {
        stats.skipped += 1
        notes.push('附件未导入：' + label)
      }
    }
    nextTurns.push({ ...turn, notes, attachments: blocks })
  }
  return { turns: nextTurns, stats }
}
