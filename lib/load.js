/** load — parsed export caches, source merging and turn helpers. */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { buildNodeMap, childMapOf, conversationInfo, extractConversation } from './conversation.js'
import { parseSourceFile } from './sources.js'
import { priceTurn } from './planner.js'

const fileCaches = new Map()
const setCaches = new Map()
const MAX_FILE_CACHES = 3
const MAX_SET_CACHES = 2


function remember(map, key, value, limit) {
  map.set(key, value)
  while (map.size > limit) map.delete(map.keys().next().value)
}


function sourceKey(filePath) {
  const stat = fs.statSync(filePath)
  return filePath + ':' + stat.mtimeMs + ':' + stat.size
}


function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') {
    const sorted = {}
    for (const key of Object.keys(value).sort()) sorted[key] = stable(value[key])
    return sorted
  }
  return value
}


/** Stable semantic fingerprint of a conversation, independent of JSON key order. */
function contentFingerprint(kind, conv) {
  let projected
  if (kind === 'official') {
    const nodes = Object.values(conv.mapping || {})
      .filter((node) => node && node.message)
      .map((node) => ({
        id: node.id,
        parent: node.parent,
        children: node.children,
        message: {
          model: node.message.model,
          inserted_at: node.message.inserted_at,
          fragments: node.message.fragments,
        },
      }))
      .sort((left, right) => String(left.id).localeCompare(String(right.id)))
    projected = {
      title: conv.title,
      inserted_at: conv.inserted_at,
      nodes,
    }
  } else {
    const session = (conv.data && conv.data.chat_session) || {}
    const messages = ((conv.data && conv.data.chat_messages) || []).map((message) => ({
      message_id: message.message_id,
      parent_id: message.parent_id,
      role: message.role,
      inserted_at: message.inserted_at,
      model: message.model,
      fragments: message.fragments,
    }))
    projected = {
      title: session.title,
      inserted_at: session.inserted_at,
      messages,
    }
  }
  return crypto.createHash('sha1').update(JSON.stringify(stable(projected))).digest('hex')
}


/**
 * Merge conversation versions by id.
 *
 * Same id: newer updated_at wins; equal timestamps compare content, then the
 * later export date, then the longer conversation, then keep the first and
 * report a conflict. Different ids are all kept (union).
 */
function mergeSources(sources) {
  const byId = new Map()
  const meta = new Map()
  const kinds = new Map()
  const hashes = new Map()
  const versionDates = new Map()
  const sourceSets = new Map()
  let duplicates = 0
  let updated = 0
  let conflicts = 0

  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index]
    for (const item of source.items) {
      const info = conversationInfo(item.kind, item.conv, byId.size)
      if (!info || !info.id) continue
      const id = info.id
      if (!byId.has(id)) {
        byId.set(id, item.conv)
        kinds.set(id, item.kind)
        meta.set(id, { title: info.title, messages: info.messages, updatedAt: info.updatedAt })
        versionDates.set(id, source.exportDate || '')
        sourceSets.set(id, new Set([index]))
        continue
      }

      duplicates += 1
      sourceSets.get(id).add(index)
      const previous = meta.get(id)
      const previousKind = kinds.get(id)
      if (!hashes.has(id)) hashes.set(id, contentFingerprint(previousKind, byId.get(id)))
      const nextHash = contentFingerprint(item.kind, item.conv)
      const sameContent = nextHash === hashes.get(id)
      if (!sameContent) updated += 1

      let takeNew = false
      if (info.updatedAt !== previous.updatedAt) {
        takeNew = info.updatedAt > previous.updatedAt
      } else if (!sameContent) {
        if (previousKind !== item.kind) {
          takeNew = item.kind === 'official'
        } else {
          const nextDate = source.exportDate || ''
          const previousDate = versionDates.get(id) || ''
          if (nextDate && previousDate && nextDate !== previousDate) {
            takeNew = nextDate > previousDate
          } else if (info.messages !== previous.messages) {
            takeNew = info.messages > previous.messages
          } else {
            conflicts += 1
          }
        }
      } else if (previousKind !== item.kind && item.kind === 'official') {
        takeNew = true
      }

      if (takeNew) {
        byId.set(id, item.conv)
        kinds.set(id, item.kind)
        meta.set(id, { title: info.title, messages: info.messages, updatedAt: info.updatedAt })
        versionDates.set(id, source.exportDate || '')
        hashes.set(id, nextHash)
      }
    }
  }

  const hasOfficial = [...kinds.values()].some((kind) => kind === 'official')
  const hasCache = [...kinds.values()].some((kind) => kind === 'cache')
  const kind = hasOfficial && hasCache ? 'mixed' : hasOfficial ? 'official' : hasCache ? 'cache' : 'unknown'

  let latestGroup = null
  const snapshots = sources.length >= 2
    && sources.every((source) => source.exportDate && source.kind === 'official')
  if (snapshots) {
    const maxDate = sources.reduce((latest, source) => (source.exportDate > latest ? source.exportDate : latest), '')
    if (maxDate) {
      const group = new Set()
      for (let index = 0; index < sources.length; index += 1) {
        if (sources[index].exportDate === maxDate && sources[index].items.length > 0) group.add(index)
      }
      if (group.size > 0) latestGroup = group
    }
  }

  let oldOnly = 0
  let newOnly = 0
  if (latestGroup) {
    const hasOlder = sources.some((source, index) => !latestGroup.has(index))
    for (const set of sourceSets.values()) {
      let inLatest = false
      let onlyLatest = true
      for (const index of set) {
        if (latestGroup.has(index)) inLatest = true
        else onlyLatest = false
      }
      if (hasOlder && !inLatest) oldOnly += 1
      else if (hasOlder && onlyLatest) newOnly += 1
    }
  }

  return {
    kind,
    kinds,
    byId,
    meta,
    duplicates,
    updated,
    conflicts,
    oldOnly,
    newOnly,
    latestSource: latestGroup
      ? [...latestGroup].map((index) => sources[index].name).join('、')
      : '',
  }
}


function buildCache(key, parsed, filePath) {
  const merged = mergeSources([{
    name: parsed.name,
    kind: parsed.kind,
    items: parsed.items,
    exportDate: parsed.exportDate || '',
  }])
  const cache = {
    key,
    kind: merged.kind,
    kinds: merged.kinds,
    byId: merged.byId,
    meta: merged.meta,
    path: filePath,
    items: parsed.items,
    sources: [{
      name: parsed.name,
      path: filePath,
      conversations: merged.byId.size,
      skipped: parsed.skipped.length,
      exportDate: parsed.exportDate || '',
    }],
    skipped: parsed.skipped.map((skip) => ({ ...skip, source: parsed.name })),
    duplicates: merged.duplicates,
    updated: merged.updated,
    conflicts: merged.conflicts,
    oldOnly: 0,
    newOnly: 0,
    latestSource: '',
  }
  return cache
}


/** Whether a source path or an in-memory source set exists. */
export function sourceExists(target) {
  return setCaches.has(target) || fs.existsSync(target)
}


const MAX_SOURCE_FILES = 10_000
const MAX_SOURCE_BYTES = 5 * 1024 * 1024 * 1024


/**
 * Validate the selected source files before parsing them.
 * Missing or non-file inputs are reported instead of aborting the selection.
 */
export function validateSourceInputs(inputs) {
  const files = []
  const failures = []
  const seen = new Set()
  let totalBytes = 0
  for (const input of inputs) {
    const resolved = path.resolve(input)
    if (seen.has(resolved)) continue
    let stat
    try {
      stat = fs.statSync(resolved)
    } catch {
      failures.push({ source: path.basename(input), reason: '文件不存在' })
      continue
    }
    if (!stat.isFile()) {
      failures.push({ source: path.basename(input), reason: '不是文件' })
      continue
    }
    if (files.length + 1 > MAX_SOURCE_FILES) {
      throw new Error('一次最多 ' + MAX_SOURCE_FILES + ' 个文件')
    }
    totalBytes += stat.size
    if (totalBytes > MAX_SOURCE_BYTES) {
      throw new Error('文件总大小超过 5GB')
    }
    seen.add(resolved)
    files.push(resolved)
  }
  return { files, failures, totalBytes }
}


/** Load one file (real path) or one previously built source set (set: id). */
export function loadFileCache(target) {
  if (setCaches.has(target)) return setCaches.get(target)
  const key = sourceKey(target)
  if (fileCaches.has(key)) return fileCaches.get(key)
  const parsed = parseSourceFile(target)
  const cache = buildCache(key, parsed, target)
  remember(fileCaches, key, cache, MAX_FILE_CACHES)
  return cache
}


/** Merge several files into one conversation cache. */
export function loadSources(paths) {
  const unique = []
  for (const filePath of paths) {
    if (typeof filePath === 'string' && filePath && !unique.includes(filePath)) unique.push(filePath)
  }
  const failures = []
  const loaded = []
  for (const filePath of unique) {
    try {
      loaded.push({ filePath, cache: loadFileCache(filePath) })
    } catch (error) {
      const reason = error && error.code === 'ENOENT'
        ? '文件不存在'
        : (error instanceof Error ? error.message : String(error))
      failures.push({ source: path.basename(filePath), reason })
    }
  }
  if (loaded.length === 0) {
    return {
      key: 'empty:' + crypto.createHash('sha1').update(unique.join('|')).digest('hex').slice(0, 16),
      kind: 'unknown',
      kinds: new Map(),
      byId: new Map(),
      meta: new Map(),
      path: '',
      items: null,
      sources: [],
      skipped: failures,
      duplicates: 0,
      updated: 0,
      conflicts: 0,
      oldOnly: 0,
      newOnly: 0,
      latestSource: '',
    }
  }
  if (loaded.length === 1 && failures.length === 0) return loaded[0].cache
  const setKey = 'set:' + crypto.createHash('sha1')
    .update(loaded.map((item) => item.cache.key).join('|'))
    .digest('hex')
    .slice(0, 16)
  if (setCaches.has(setKey)) return setCaches.get(setKey)
  const merged = mergeSources(loaded.map((item) => ({
    name: item.cache.sources[0].name,
    kind: item.cache.kind,
    items: item.cache.items,
    exportDate: item.cache.sources[0].exportDate,
  })))
  const skipped = [...failures]
  const sources = []
  for (const item of loaded) {
    const cache = item.cache
    sources.push({
      name: cache.sources[0].name,
      path: item.filePath,
      conversations: cache.byId.size,
      skipped: cache.skipped.length,
      exportDate: cache.sources[0].exportDate,
    })
    for (const skip of cache.skipped) skipped.push({ ...skip, source: cache.sources[0].name })
  }
  const cache = {
    key: setKey,
    kind: merged.kind,
    kinds: merged.kinds,
    byId: merged.byId,
    meta: merged.meta,
    path: setKey,
    items: null,
    sources,
    skipped,
    duplicates: merged.duplicates,
    updated: merged.updated,
    conflicts: merged.conflicts,
    oldOnly: merged.oldOnly,
    newOnly: merged.newOnly,
    latestSource: merged.latestSource,
  }
  remember(setCaches, setKey, cache, MAX_SET_CACHES)
  return cache
}


/** Conversation kind for one id inside a single or mixed source set. */
export function kindFor(cached, id) {
  return (cached.kinds && cached.kinds.get(id)) || cached.kind
}


/** Node maps keyed by cache revision and conversation id. */
export const nodeMapCache = new Map()


export function nodeMapFor(cached, id, conv) {
  const key = cached.key + '|' + id
  let entry = nodeMapCache.get(key)
  if (!entry) {
    const map = buildNodeMap(kindFor(cached, id), conv)
    entry = { key, map, children: childMapOf(map.nodes) }
    nodeMapCache.set(key, entry)
    if (nodeMapCache.size > 24) nodeMapCache.delete(nodeMapCache.keys().next().value)
  }
  return entry
}


/** Turn one cached conversation into priced turn info for the chosen path. */
export function turnInfoFor(kind, conv, pathOptions, modelId) {
  const turns = extractConversation(kind, conv, pathOptions)
  const turnChars = turns.map((turn) => (turn.user ? turn.user.length : 0)
    + (turn.think ? turn.think.length : 0) + (turn.text ? turn.text.length : 0))
  const turnTokens = turns.map((turn) => priceTurn(turn, modelId))
  return {
    turns,
    turnInfo: turns.map((turn, turnIndex) => ({
      userSeq: null,
      assistantSeq: null,
      chars: turnChars[turnIndex],
      tokens: turnTokens[turnIndex].tokens,
      summaryTokens: turnTokens[turnIndex].summaryTokens,
    })),
    chars: turnChars.reduce((sum, value) => sum + value, 0),
    tokens: turnTokens.reduce((sum, value) => sum + value.tokens, 0),
  }
}


/** Normalize the path rule and custom leaf requested by the panel. */
export function normalizePathOptions(params) {
  const rule = params && typeof params.pathRule === 'string' ? params.pathRule : 'recent'
  const allowed = rule === 'longest' || rule === 'custom' ? rule : 'recent'
  const leafId = params && params.leafId ? String(params.leafId) : ''
  return { rule: allowed, leafId }
}
