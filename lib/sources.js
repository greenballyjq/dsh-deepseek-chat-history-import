/** Turn a JSON, JSONL or ZIP export into DeepSeek conversations. */
import fs from 'node:fs'
import path from 'node:path'
import { classifyValue } from './conversation.js'
import { readZipEntries } from './zip.js'

const MAX_DEPTH = 3
const ZIP_JSON = /\.(json|jsonl)$/i
const SKIP_ZIP_NAMES = new Set(['user.json'])


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


function summarizeKind(items) {  const hasOfficial = items.some((item) => item.kind === 'official')
  const hasCache = items.some((item) => item.kind === 'cache')
  if (hasOfficial && hasCache) return 'mixed'
  if (hasOfficial) return 'official'
  if (hasCache) return 'cache'
  return 'unknown'
}


function addValue(value, depth, result) {
  if (depth > MAX_DEPTH) {
    result.skipped.push({ reason: '嵌套太深，已跳过' })
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) addValue(item, depth + 1, result)
    return
  }
  if (value && typeof value === 'object') {
    if (Array.isArray(value.conversations)) { addValue(value.conversations, depth + 1, result); return }
    if (Array.isArray(value.records)) { addValue(value.records, depth + 1, result); return }
    if (Array.isArray(value.data)) { addValue(value.data, depth + 1, result); return }
    const classified = classifyValue(value)
    if (classified.kind === 'unknown') result.skipped.push({ reason: classified.reason })
    else result.items.push({ kind: classified.kind, conv: classified.conv })
    return
  }
  result.skipped.push({ reason: '不是对话对象' })
}


function parseJsonlText(text, name) {
  const result = { name, kind: 'unknown', items: [], skipped: [], exportDate: '' }
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return
    try {
      addValue(JSON.parse(line), 0, result)
    } catch {
      result.skipped.push({ reason: '第 ' + (index + 1) + ' 行不是 JSON' })
    }
  })
  result.kind = summarizeKind(result.items)
  return result
}


function parseJsonText(text, name, sourceName) {
  const result = { name, kind: 'unknown', items: [], skipped: [], exportDate: '' }
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error((sourceName || name) + '：不是标准 JSON（' + error.message + '）')
  }
  addValue(parsed, 0, result)
  collapseSkipped(result)
  result.kind = summarizeKind(result.items)
  return result
}


function parseZipBuffer(buffer, name) {
  const entries = readZipEntries(buffer)
  const result = { name, kind: 'unknown', items: [], skipped: [], exportDate: exportDateOf(name) }
  let jsonEntries = 0
  for (const entry of entries) {
    if (SKIP_ZIP_NAMES.has(path.basename(entry.name).toLowerCase())) continue
    if (!ZIP_JSON.test(entry.name)) continue
    jsonEntries += 1
    try {
      const text = entry.content.toString('utf8').replace(/^\uFEFF/, '')
      const parsed = /\.jsonl$/i.test(entry.name)
        ? parseJsonlText(text, entry.name)
        : parseJsonText(text, entry.name, entry.name)
      result.items.push(...parsed.items)
      for (const skip of parsed.skipped) result.skipped.push({ reason: entry.name + '：' + skip.reason })
    } catch (error) {
      result.skipped.push({ reason: entry.name + '：' + error.message })
    }
  }
  if (jsonEntries === 0) result.skipped.push({ reason: 'zip 里没有 json/jsonl 文件' })
  result.kind = summarizeKind(result.items)
  return result
}


/**
 * Parse one source file. Accepts JSON, JSONL and ZIP.
 * Returns { name, kind, items: [{ kind, conv }], skipped: [{ reason }] }.
 */
export function parseSourceFile(filePath) {
  const buffer = fs.readFileSync(filePath)
  const name = path.basename(filePath)
  if (buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50) {
    return parseZipBuffer(buffer, name)
  }
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '')
  if (/\.jsonl$/i.test(filePath)) return parseJsonlText(text, name)
  return parseJsonText(text, name)
}
