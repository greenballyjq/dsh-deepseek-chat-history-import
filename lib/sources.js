/** Turn a JSON, JSONL or ZIP export into canonical DeepSeek conversations. */
import fs from 'node:fs'
import path from 'node:path'
import { collectValue } from './containers.js'
import { SUPPORTED_EXPORT_VERSIONS } from './formats/index.js'
import { openZip } from './zip.js'

const ZIP_JSON = /\.(json|jsonl)$/i
const ZIP_MAGIC = 0x04034b50
const SKIP_ZIP_NAMES = new Set(['user.json', 'manifest.json', 'chat_session_index.json'])
const PROGRESS_CHUNK = 25


/** Snapshot date from an official zip name such as deepseek_data-2026-11-02.zip. */
function exportDateOf(name) {
  const match = /(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})/.exec(name)
  if (!match) return ''
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return ''
  return match[1] + '-' + match[2] + '-' + match[3]
}


function collapseSkipped(result) {
  if (result.skipped.length <= 20) return
  const grouped = new Map()
  for (const skip of result.skipped) {
    const reason = String(skip.reason || '')
    const item = grouped.get(reason)
    if (item) item.count += 1
    else grouped.set(reason, { reason, count: 1 })
  }
  result.skipped = [...grouped.values()].map((item) => ({
    reason: item.count > 1 ? item.reason + '（' + item.count + ' 项）' : item.reason,
  }))
}


function summarizeKind(items) {
  const hasOfficial = items.some((item) => item.kind === 'official')
  const hasCache = items.some((item) => item.kind === 'cache')
  if (hasOfficial && hasCache) return 'mixed'
  if (hasOfficial) return 'official'
  if (hasCache) return 'cache'
  return 'unknown'
}


function emptyResult(name, exportDate = '') {
  return { name, kind: 'unknown', items: [], skipped: [], exportDate }
}


function parseJsonlText(text, name, ctx) {
  const result = emptyResult(name)
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return
    try {
      collectValue(JSON.parse(line), 0, ctx, result)
    } catch {
      result.skipped.push({ reason: '第 ' + (index + 1) + ' 行不是 JSON' })
    }
  })
  result.kind = summarizeKind(result.items)
  return result
}


function parseJsonText(text, name, sourceName, ctx) {
  const result = emptyResult(name)
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error((sourceName || name) + '：不是标准 JSON（' + error.message + '）')
  }
  collectValue(parsed, 0, ctx, result)
  collapseSkipped(result)
  result.kind = summarizeKind(result.items)
  return result
}


/** Read the package manifest of a v3 ZIP, or null when absent/unreadable. */
function readManifest(zip) {
  if (!zip.has('manifest.json')) return null
  try {
    return JSON.parse(zip.read('manifest.json').toString('utf8').replace(/^\uFEFF/, ''))
  } catch {
    return null
  }
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


function jsonEntriesOf(zip) {
  return zip.entries.filter((entry) => (
    !SKIP_ZIP_NAMES.has(path.basename(entry.name).toLowerCase()) && ZIP_JSON.test(entry.name)
  ))
}


/** Open one ZIP and read its manifest before any entry is parsed. */
function prepareZip(filePath) {
  const zip = openZip(filePath)
  const manifest = readManifest(zip)
  const declared = manifest && Number.isFinite(Number(manifest.export_format_version))
    ? Number(manifest.export_format_version)
    : null
  if (declared !== null && !SUPPORTED_EXPORT_VERSIONS.has(declared)) {
    return { zip, entries: [], unsupportedVersion: declared }
  }
  return { zip, entries: jsonEntriesOf(zip), ctx: { manifest } }
}


function parseZipEntry(zip, entry, ctx, result) {
  try {
    const text = zip.read(entry.name).toString('utf8').replace(/^\uFEFF/, '')
    const parsed = /\.jsonl$/i.test(entry.name)
      ? parseJsonlText(text, entry.name, ctx)
      : parseJsonText(text, entry.name, entry.name, ctx)
    result.items.push(...parsed.items)
    for (const skip of parsed.skipped) result.skipped.push({ reason: entry.name + '：' + skip.reason })
  } catch (error) {
    result.skipped.push({ reason: entry.name + '：' + error.message })
  }
}


function finishZipResult(result, entryCount) {
  if (entryCount === 0) result.skipped.push({ reason: 'zip 里没有 json/jsonl 文件' })
  result.kind = summarizeKind(result.items)
  return result
}


function parseZipFile(filePath, name) {
  const result = emptyResult(name, exportDateOf(name))
  const prepared = prepareZip(filePath)
  if (prepared.unsupportedVersion != null) {
    result.skipped.push({ reason: '官方导出 v' + prepared.unsupportedVersion + ' 暂不支持，请更新插件' })
    return result
  }
  for (const entry of prepared.entries) parseZipEntry(prepared.zip, entry, prepared.ctx, result)
  return finishZipResult(result, prepared.entries.length)
}


/**
 * Parse one source file synchronously. Accepts JSON, JSONL and ZIP.
 * Returns { name, kind, items: [{ kind, formatId, conv }], skipped: [{ reason }] }.
 */
export function parseSourceFile(filePath) {
  const name = path.basename(filePath)
  if (isZipFile(filePath)) return parseZipFile(filePath, name)
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
  if (/\.jsonl$/i.test(filePath)) return parseJsonlText(text, name, {})
  return parseJsonText(text, name, name, {})
}


/** Yield to the event loop so a poll request can report progress. */
function tick() {
  return new Promise((resolve) => setImmediate(resolve))
}


/**
 * Parse one source file while reporting entry progress.
 *
 * The ZIP path yields every few entries, so the host can answer a status poll
 * during a multi-thousand-entry export. `onProgress(done, total)` is called
 * after each chunk and once when the file starts.
 */
export async function parseSourceFileAsync(filePath, onProgress) {
  const name = path.basename(filePath)
  if (!isZipFile(filePath)) {
    const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
    if (onProgress) onProgress(1, 1)
    return /\.jsonl$/i.test(filePath) ? parseJsonlText(text, name, {}) : parseJsonText(text, name, name, {})
  }
  const result = emptyResult(name, exportDateOf(name))
  const prepared = prepareZip(filePath)
  if (prepared.unsupportedVersion != null) {
    result.skipped.push({ reason: '官方导出 v' + prepared.unsupportedVersion + ' 暂不支持，请更新插件' })
    if (onProgress) onProgress(1, 1)
    return result
  }
  const total = prepared.entries.length
  if (onProgress) onProgress(0, total)
  for (let index = 0; index < total; index += 1) {
    parseZipEntry(prepared.zip, prepared.entries[index], prepared.ctx, result)
    if (index % PROGRESS_CHUNK === 0 || index === total - 1) {
      if (onProgress) onProgress(index + 1, total)
      await tick()
    }
  }
  return finishZipResult(result, total)
}


/** How many parse steps one source file reports; missing files report 0. */
export function countSourceEntries(filePath) {
  if (!isZipFile(filePath)) return 1
  return jsonEntriesOf(openZip(filePath)).length
}
