/** store — recent files, the last source set, and the upload cache. */
import fs from 'node:fs'
import path from 'node:path'
import { MAX_LAST_SET, RECENT_FILE, RECENT_LIMIT, STORE_DIR, UPLOAD_DIR, UPLOAD_GRACE_MS } from './constants.js'
import { displayNameFor } from './util.js'

const LAST_SET_FILE = path.join(STORE_DIR, 'last-set.json')
const LAST_SET_LIMIT = MAX_LAST_SET

let uploadIndex = null


/** Paths of the most recent load (files, or the folders the user chose). */
export function readLastSet() {
  try {
    const parsed = JSON.parse(fs.readFileSync(LAST_SET_FILE, 'utf8'))
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item) : []
  } catch {
    return []
  }
}


export function writeLastSet(paths) {
  try {
    fs.mkdirSync(STORE_DIR, { recursive: true })
    const unique = []
    for (const item of Array.isArray(paths) ? paths : []) {
      if (typeof item !== 'string' || !item || unique.includes(item)) continue
      unique.push(item)
      if (unique.length >= LAST_SET_LIMIT) break
    }
    fs.writeFileSync(LAST_SET_FILE, JSON.stringify(unique, null, 2))
  } catch {
    // Optional convenience store.
  }
}


/**
 * Read the recent-file list. Entries point at files under `files/` (downloads
 * through the picker) or at a path the user typed by hand.
 */
export function readRecent() {
  try {
    const parsed = JSON.parse(fs.readFileSync(RECENT_FILE, 'utf8'))
    if (!Array.isArray(parsed)) return []
    const seen = new Set()
    const entries = []
    for (const raw of parsed) {
      if (!raw || typeof raw.path !== 'string') continue
      const entry = {
        ...raw,
        // Earlier builds stored the time-prefixed upload name.
        name: path.dirname(raw.path) === UPLOAD_DIR && /^\d{10,}-/.test(String(raw.name || ''))
          ? String(raw.name).replace(/^\d{10,}-/, '')
          : raw.name,
      }
      let stat
      try {
        stat = fs.statSync(raw.path)
      } catch {
        // The file is gone: do not show a chip that can only fail.
        continue
      }
      if (!stat.isFile()) continue
      const size = stat.size
      const key = String(entry.name) + '|' + size
      if (seen.has(key)) continue
      seen.add(key)
      entries.push({ ...entry, bytes: size })
    }
    return entries.slice(0, RECENT_LIMIT)
  } catch {
    return []
  }
}


export function writeRecent(entries) {
  try {
    fs.mkdirSync(STORE_DIR, { recursive: true })
    fs.writeFileSync(RECENT_FILE, JSON.stringify(entries.slice(0, RECENT_LIMIT), null, 2))
  } catch {
    // Recent files are a convenience; a write failure must not break a load.
  }
}


/** Record an opened file or folder, newest first, deduplicated by path. */
export function touchRecent(targetPath, conversationCount) {
  const previous = readRecent().find((item) => item.path === targetPath)
  let bytes
  try {
    bytes = fs.statSync(targetPath).size
  } catch {
    // Keep the entry; a missing path reports its error when opened.
  }
  const entry = {
    path: targetPath,
    name: previous && previous.name ? previous.name : displayNameFor(targetPath),
    bytes,
    openedAt: Date.now(),
    conversations: Number.isFinite(conversationCount) ? conversationCount : undefined,
  }
  const entries = readRecent().filter((item) => item.path !== targetPath)
  entries.unshift(entry)
  writeRecent(entries)
  return entries.slice(0, RECENT_LIMIT)
}


function entryName(fileName) {
  return fileName.replace(/^\d{10,}-/, '')
}


function indexHas(index, name, size) {
  for (const item of index.get(name) || []) {
    try {
      if (item.size === size && fs.statSync(item.path).size === size) return item.path
    } catch {
      // Gone; the next rebuild drops it.
    }
  }
  return ''
}


function buildUploadIndex() {
  const index = new Map()
  try {
    for (const entry of fs.readdirSync(UPLOAD_DIR)) {
      const full = path.join(UPLOAD_DIR, entry)
      try {
        const stat = fs.statSync(full)
        if (!stat.isFile()) continue
        const name = entryName(entry)
        const list = index.get(name) || []
        list.push({ path: full, size: stat.size, mtime: stat.mtimeMs })
        index.set(name, list)
      } catch {
        // Skip unreadable entries.
      }
    }
  } catch {
    // No upload directory yet.
  }
  uploadIndex = index
  return index
}


/** Reuse an identical uploaded copy when the same file is picked again. */
export function findUploadedCopy(name, size) {
  for (const entry of readRecent()) {
    if (entry.name !== name) continue
    try {
      const stat = fs.statSync(entry.path)
      if (stat.isFile() && stat.size === size) return entry.path
    } catch {
      // Missing file — keep looking.
    }
  }
  const index = uploadIndex || buildUploadIndex()
  return indexHas(index, name, size)
}


/** Remember a freshly written upload so the next duplicate lookup is O(1). */
export function rememberUpload(filePath, name, size) {
  if (!uploadIndex) return
  const list = uploadIndex.get(name) || []
  list.push({ path: filePath, size, mtime: Date.now() })
  uploadIndex.set(name, list)
}


/**
 * Remove upload copies that are no longer needed.
 *
 * Protected: files referenced by the last set or recent list, and files younger
 * than the grace period. Everything else is pruned by age, keeping at most
 * UPLOAD_KEEP_COUNT files. Runs after a successful load and at startup, never
 * between the uploads of one selection.
 */
export function pruneUploads() {
  try {
    const protectedPaths = new Set()
    for (const item of [...readLastSet(), ...readRecent().map((entry) => entry.path)]) {
      try {
        if (path.dirname(item) === UPLOAD_DIR) protectedPaths.add(path.resolve(item))
      } catch {
        // Ignore malformed paths.
      }
    }
    const cutoff = Date.now() - UPLOAD_GRACE_MS
    const files = []
    for (const entry of fs.readdirSync(UPLOAD_DIR)) {
      const full = path.join(UPLOAD_DIR, entry)
      try {
        const stat = fs.statSync(full)
        if (!stat.isFile()) continue
        files.push({
          full,
          resolved: path.resolve(full),
          mtime: stat.mtimeMs,
          size: stat.size,
          protected: protectedPaths.has(path.resolve(full)) || stat.mtimeMs >= cutoff,
        })
      } catch {
        // Skip unreadable entries.
      }
    }
    files.sort((left, right) => right.mtime - left.mtime)
    for (const file of files) {
      if (file.protected) continue
      try {
        fs.rmSync(file.full, { force: true })
      } catch {
        // Keep going.
      }
    }
    uploadIndex = null
  } catch {
    // Pruning is best-effort.
  }
}
