/** load — parsed export caches, source merging and the import path helpers. */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { buildNodeMap, childMapOf, conversationInfo, extractConversation } from './conversation.js'
import { MAX_FILE_CACHES, MAX_SET_CACHES, MAX_SOURCE_BYTES, MAX_SOURCE_FILES } from './constants.js'
import { countSourceEntries, parseSourceFile, parseSourceFileAsync } from './sources.js'
import { rankOf } from './formats/index.js'
import { priceTurn } from './planner.js'

const fileCaches = new Map()
const setCaches = new Map()


function remember(map, key, value, limit) {
  map.set(key, value)
  while (map.size > limit) map.delete(map.keys().next().value)
}


function sourceKey(filePath) {
  const stat = fs.statSync(filePath)
  return filePath + ':' + stat.mtimeMs + ':' + stat.size
}


function dedupePaths(paths) {
  const unique = []
  for (const filePath of paths) {
    if (typeof filePath === 'string' && filePath && !unique.includes(filePath)) unique.push(filePath)
  }
  return unique
}


function emptyCache(key, failures) {
  return {
    key,
    kind: 'unknown',
    kinds: new Map(),
    formats: new Map(),
    byId: new Map(),
    meta: new Map(),
    path: '',
    items: null,
    sources: [],
    skipped: failures,
    duplicates: 0,
    updated: 0,
    conflicts: 0,
    duplicateConversations: 0,
    sameConversations: 0,
    updatedConversations: 0,
    conflictConversations: 0,
    oldOnly: 0,
    newOnly: 0,
    latestSource: '',
  }
}


/**
 * Merge conversation versions by id.
 *
 * Same id: identical semantic content keeps the first copy and is not counted
 * as an update. Different content: newer `updated_at` wins, then the later
 * export date, then the longer conversation; a remaining tie keeps the first
 * and counts as unclear. `duplicates`/`updated`/`conflicts` stay occurrence
 * counts; the *Conversations fields count distinct conversations.
 */
function mergeSources(sources) {
  const byId = new Map()
  const meta = new Map()
  const kinds = new Map()
  const formats = new Map()
  const semantics = new Map()
  const versionDates = new Map()
  const sourceSets = new Map()
  const duplicateIds = new Set()
  const replaced = new Set()
  const conflicted = new Set()
  let duplicateOccurrences = 0
  let updatedOccurrences = 0
  let conflictOccurrences = 0

  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index]
    for (const item of source.items) {
      const info = conversationInfo(item.conv)
      const id = info.id || item.kind + '-' + byId.size
      if (!byId.has(id)) {
        byId.set(id, item.conv)
        kinds.set(id, item.kind)
        formats.set(id, item.formatId)
        semantics.set(id, item.conv.semantic)
        meta.set(id, { title: info.title, messages: info.messages, updatedAt: info.updatedAt })
        versionDates.set(id, source.exportDate || '')
        sourceSets.set(id, new Set([index]))
        continue
      }

      duplicateOccurrences += 1
      duplicateIds.add(id)
      sourceSets.get(id).add(index)
      if (item.conv.semantic === semantics.get(id)) continue

      updatedOccurrences += 1
      const previous = meta.get(id)
      const previousKind = kinds.get(id)
      const previousFormat = formats.get(id)
      let takeNew = false
      if (info.updatedAt !== previous.updatedAt) {
        takeNew = info.updatedAt > previous.updatedAt
      } else if (previousKind !== item.kind) {
        takeNew = rankOf(item.formatId) > rankOf(previousFormat)
      } else if (source.exportDate && versionDates.get(id) && source.exportDate !== versionDates.get(id)) {
        takeNew = source.exportDate > versionDates.get(id)
      } else if (info.messages !== previous.messages) {
        takeNew = info.messages > previous.messages
      } else {
        conflictOccurrences += 1
        conflicted.add(id)
      }

      if (takeNew) {
        byId.set(id, item.conv)
        kinds.set(id, item.kind)
        formats.set(id, item.formatId)
        semantics.set(id, item.conv.semantic)
        meta.set(id, { title: info.title, messages: info.messages, updatedAt: info.updatedAt })
        versionDates.set(id, source.exportDate || '')
        replaced.add(id)
        conflicted.delete(id)
      }
    }
  }

  const updatedConversations = replaced.size
  const conflictConversations = [...conflicted].filter((id) => !replaced.has(id)).length
  const duplicateConversations = duplicateIds.size
  const sameConversations = Math.max(0, duplicateConversations - updatedConversations - conflictConversations)

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
    formats,
    byId,
    meta,
    duplicates: duplicateOccurrences,
    updated: updatedOccurrences,
    conflicts: conflictOccurrences,
    duplicateConversations,
    sameConversations,
    updatedConversations,
    conflictConversations,
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
  return {
    key,
    kind: merged.kind,
    kinds: merged.kinds,
    formats: merged.formats,
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
    duplicateConversations: merged.duplicateConversations,
    sameConversations: merged.sameConversations,
    updatedConversations: merged.updatedConversations,
    conflictConversations: merged.conflictConversations,
    oldOnly: 0,
    newOnly: 0,
    latestSource: '',
  }
}


/** Parse, merge and remember one file under its revision key. */
function cacheForParsed(filePath, parsed) {
  const key = sourceKey(filePath)
  const cache = buildCache(key, parsed, filePath)
  remember(fileCaches, key, cache, MAX_FILE_CACHES)
  return cache
}


function finishLoad(unique, loaded, failures) {
  if (loaded.length === 0) {
    const key = 'empty:' + crypto.createHash('sha1').update(unique.join('|')).digest('hex').slice(0, 16)
    return emptyCache(key, failures)
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
    formats: merged.formats,
    byId: merged.byId,
    meta: merged.meta,
    path: setKey,
    items: null,
    sources,
    skipped,
    duplicates: merged.duplicates,
    updated: merged.updated,
    conflicts: merged.conflicts,
    duplicateConversations: merged.duplicateConversations,
    sameConversations: merged.sameConversations,
    updatedConversations: merged.updatedConversations,
    conflictConversations: merged.conflictConversations,
    oldOnly: merged.oldOnly,
    newOnly: merged.newOnly,
    latestSource: merged.latestSource,
  }
  remember(setCaches, setKey, cache, MAX_SET_CACHES)
  return cache
}


/** Whether a source path or an in-memory source set exists. */
export function sourceExists(target) {
  return setCaches.has(target) || fs.existsSync(target)
}


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
  return cacheForParsed(target, parseSourceFile(target))
}


/** Merge several files into one conversation cache. */
export function loadSources(paths) {
  const unique = dedupePaths(paths)
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
  return finishLoad(unique, loaded, failures)
}


/**
 * Merge several files while reporting parse progress.
 *
 * `onProgress({ done, total, label })` counts parsed ZIP entries (or whole
 * files for plain JSON/JSONL), so the panel can show a real number instead of
 * an indeterminate spinner.
 */
export async function loadSourcesAsync(paths, onProgress) {
  const unique = dedupePaths(paths)
  const failures = []
  const loaded = []
  const totals = unique.map((filePath) => {
    try {
      return countSourceEntries(filePath)
    } catch {
      return 0
    }
  })
  const total = totals.reduce((sum, value) => sum + value, 0)
  let base = 0
  for (let index = 0; index < unique.length; index += 1) {
    const filePath = unique[index]
    const expected = totals[index]
    try {
      const parsed = await parseSourceFileAsync(filePath, (done) => {
        if (typeof onProgress === 'function') {
          onProgress({ done: Math.min(total, base + done), total, label: path.basename(filePath) })
        }
      })
      loaded.push({ filePath, cache: cacheForParsed(filePath, parsed) })
    } catch (error) {
      const reason = error && error.code === 'ENOENT'
        ? '文件不存在'
        : (error instanceof Error ? error.message : String(error))
      failures.push({ source: path.basename(filePath), reason })
    }
    base += expected
    if (typeof onProgress === 'function') {
      onProgress({ done: Math.min(total, base), total, label: path.basename(filePath) })
    }
  }
  return finishLoad(unique, loaded, failures)
}


/** Conversation kind for one id inside a single or mixed source set. */
export function kindFor(cached, id) {
  return (cached.kinds && cached.kinds.get(id)) || cached.kind
}


/** Format id for one conversation inside a single or mixed source set. */
export function formatFor(cached, id) {
  return (cached.formats && cached.formats.get(id)) || ''
}


/** Conversation counts per format id, for the panel's format badge. */
export function formatCounts(cached) {
  const counts = new Map()
  for (const id of cached.byId.keys()) {
    const formatId = formatFor(cached, id)
    if (!formatId) continue
    counts.set(formatId, (counts.get(formatId) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((left, right) => right.count - left.count || left.id.localeCompare(right.id))
}


/** Node maps keyed by cache revision and conversation id. */
export const nodeMapCache = new Map()


export function nodeMapFor(cached, id, conv) {
  const key = cached.key + '|' + id
  let entry = nodeMapCache.get(key)
  if (!entry) {
    const map = buildNodeMap(conv)
    entry = { key, map, children: childMapOf(map.nodes) }
    nodeMapCache.set(key, entry)
    if (nodeMapCache.size > 24) nodeMapCache.delete(nodeMapCache.keys().next().value)
  }
  return entry
}


/** Turn one cached conversation into priced turn info for the chosen path. */
export function turnInfoFor(conv, pathOptions, modelId) {
  const turns = extractConversation(conv, pathOptions)
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
