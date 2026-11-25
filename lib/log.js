/** log — extracted from the original host entry. */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { CONTRACT } from './constants.js'

export function setContractStatus(next) {
  contractStatus = next
}

export let contractStatus = { checkedAt: 0, ok: true, error: '', file: '' }


/** Find the newest session logs under the sessions root, newest first. */
function newestSessionLogs(sessionsRoot, limit) {
  const found = []
  const stack = [sessionsRoot]
  while (stack.length > 0) {
    const dir = stack.pop()
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (/^session\.v\d+\.jsonl\.zstd$/.test(entry.name)) {
        try {
          const stat = fs.statSync(full)
          found.push({ file: full, name: entry.name, mtimeMs: stat.mtimeMs })
        } catch {
          // A vanished file is not a contract failure.
        }
      }
    }
  }
  found.sort((left, right) => right.mtimeMs - left.mtimeMs)
  return found.slice(0, Math.max(1, limit || 5))
}


/** Read the first events of one session log, or null when unreadable. */
function readSessionHead(file) {
  return readSessionPrefix(file, 8, 4 * 1024 * 1024)
}


export function checkContract(sessionsRoot) {
  const result = { checkedAt: Date.now(), ok: true, error: '', file: '' }
  const candidates = newestSessionLogs(sessionsRoot, 3)
  if (candidates.length === 0) return result
  const expected = 'session.v' + CONTRACT.version + '.jsonl.zstd'
  for (const candidate of candidates) {
    if (candidate.name !== expected) {
      result.ok = false
      result.error = '会话日志版本不是 ' + expected + '（发现 ' + candidate.name + '），当前 DSH 版本与插件记录的格式不一致'
      result.file = candidate.file
      return result
    }
    const events = readSessionHead(candidate.file)
    if (events === null) continue
    // The harness renders the system prompt at request time, so a stored head
    // is commonly empty; the event type is what the format guarantees.
    const head = events.find((event) => event && event.type === CONTRACT.headType)
    // A prefix without a head is inconclusive, not a format change: the file
    // may have grown past the read window or still be mid-write.
    if (!head) continue
    result.file = candidate.file
    return result
  }
  // Every candidate was mid-write; nothing conclusive to report.
  return result
}


/**
 * Read the first events of a session without loading the whole log: at most
 * `maxBytes` from the file and `maxFrames` zstd frames are touched.
 */
function readSessionPrefix(file, maxFrames, maxBytes) {
  let fd
  let buffer
  try {
    fd = fs.openSync(file, 'r')
    const size = fs.fstatSync(fd).size
    const take = Math.min(size, maxBytes || 2 * 1024 * 1024)
    buffer = Buffer.alloc(take)
    fs.readSync(fd, buffer, 0, take, 0)
  } catch {
    return null
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd) } catch { /* already closed */ }
    }
  }
  const frames = []
  let offset = 0
  while (offset + 4 <= buffer.length && frames.length < (maxFrames || 16)) {
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) break
    let next = offset + 4
    while (next + 4 <= buffer.length && buffer.readUInt32LE(next) !== ZSTD_MAGIC) next += 1
    frames.push([offset, next])
    offset = next
  }
  const events = []
  for (const [start, end] of frames) {
    let chunk
    try {
      chunk = zlib.zstdDecompressSync(buffer.subarray(start, end)).toString('utf8')
    } catch {
      // The prefix can end inside a frame; earlier frames are still usable.
      break
    }
    for (const line of chunk.split('\n')) {
      if (!line) continue
      try { events.push(JSON.parse(line)) } catch { break }
    }
  }
  return events.length > 0 ? events : null
}


const ZSTD_MAGIC = 0xfd2fb528


/** Return the byte range of every zstd frame in one session log. */
function zstdFrameOffsets(buffer) {
  const frames = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) break
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) break
    offset += 4
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 0x20) !== 0
    const hasChecksum = (descriptor & 0x04) !== 0
    const dictionaryFlag = descriptor & 0x03
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
    offset += (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    for (;;) {
      const blockHeader = buffer.readUIntLE(offset, 3)
      offset += 3
      const lastBlock = (blockHeader & 1) !== 0
      const blockType = (blockHeader >>> 1) & 0x03
      const blockSize = blockHeader >>> 3
      offset += blockType === 0x01 ? 1 : blockSize
      if (lastBlock) break
    }
    if (hasChecksum) offset += 4
    frames.push({ start, end: offset })
  }
  return frames
}


/** Decode one stored session log into its header and event list. */
function decodeSessionLog(file) {
  const buffer = fs.readFileSync(file)
  let text = ''
  for (const frame of zstdFrameOffsets(buffer)) {
    text += zlib.zstdDecompressSync(buffer.subarray(frame.start, frame.end)).toString('utf8')
  }
  const lines = text.split('\n').filter((line) => line.trim())
  return {
    header: JSON.parse(lines[0]),
    events: lines.slice(1).map((line) => JSON.parse(line)),
  }
}


/**
 * Borrow the rendered system prompt from the newest session on disk. The
 * prompt is workspace-independent, so a brand-new workspace can seed its first
 * imported session without creating a shared workspace.
 */
export function readAnyReferenceSystemPrompt(sessionsRoot) {
  const candidates = []
  const stack = [sessionsRoot]
  while (stack.length > 0) {
    const dir = stack.pop()
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
        continue
      }
      if (!entry.name.startsWith('session.') || !entry.name.endsWith('.zstd')) continue
      try {
        candidates.push({ file: full, mtime: fs.statSync(full).mtimeMs })
      } catch {
        // Deleted between listing and stat — skip it.
      }
    }
  }
  candidates.sort((left, right) => right.mtime - left.mtime)
  for (const candidate of candidates.slice(0, 10)) {
    try {
      const { events } = decodeSessionLog(candidate.file)
      for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index]
        if (event.type !== 'system/message') continue
        const blocks = event.data && event.data.message && event.data.message.content
        const text = Array.isArray(blocks) ? blocks.map((block) => String(block.text || '')).join('') : ''
        if (text.trim().length > 200) return text
      }
    } catch {
      // Unreadable log — try the next one.
    }
  }
  return ''
}

