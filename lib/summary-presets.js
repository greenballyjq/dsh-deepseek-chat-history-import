/**
 * Local custom summary prompt presets.
 *
 * Built-in presets live in summary-prompt.js and cannot be edited or deleted.
 * This store only holds user-created presets in the plugin data directory.
 */
import fs from 'node:fs'
import path from 'node:path'
import { MAX_PRESET_NAME_CHARS, MAX_SUMMARY_PRESETS, MAX_SUMMARY_PROMPT_CHARS, STORE_DIR } from './constants.js'

const STORE_FILE = path.join(STORE_DIR, 'summary-presets.json')
const BUILTIN_IDS = new Set(['neutral', 'narrative', 'technical'])
const MAX_PRESETS = MAX_SUMMARY_PRESETS
const MAX_NAME_CHARS = MAX_PRESET_NAME_CHARS
const MAX_TEXT_CHARS = MAX_SUMMARY_PROMPT_CHARS

function readRaw() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'))
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item) => (
      item
      && typeof item.id === 'string'
      && item.id.startsWith('user-')
      && !BUILTIN_IDS.has(item.id)
      && typeof item.name === 'string'
      && typeof item.text === 'string'
    ))
  } catch {
    return []
  }
}

function writeRaw(presets) {
  fs.mkdirSync(STORE_DIR, { recursive: true })
  const temp = STORE_FILE + '.tmp-' + process.pid
  fs.writeFileSync(temp, JSON.stringify(presets, null, 2), 'utf8')
  fs.renameSync(temp, STORE_FILE)
}

function cleanName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_CHARS)
}

function cleanText(value) {
  return String(value || '').trim()
}

export function readCustomSummaryPresets() {
  return readRaw()
    .filter((item) => item.name && item.text)
    .map((item) => ({ ...item, builtin: false }))
}

export function findCustomSummaryPreset(id) {
  const key = String(id || '')
  if (!key || BUILTIN_IDS.has(key)) return null
  return readCustomSummaryPresets().find((item) => item.id === key) || null
}

export function saveCustomSummaryPreset({ name, text }) {
  const clean = cleanName(name)
  const body = cleanText(text)
  if (!clean) throw new Error('预设名称不能为空')
  if (!body) throw new Error('预设内容不能为空')
  if (body.length > MAX_TEXT_CHARS) throw new Error('预设内容不能超过 ' + MAX_TEXT_CHARS + ' 字')
  const presets = readRaw()
  if (presets.length >= MAX_PRESETS) throw new Error('最多保存 ' + MAX_PRESETS + ' 个自定义预设')
  const id = 'user-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
  const preset = {
    id,
    name: clean,
    text: body,
    createdAt: Date.now(),
    builtin: false,
  }
  writeRaw([...presets, preset])
  return preset
}

export function deleteCustomSummaryPreset(id) {
  const key = String(id || '')
  if (BUILTIN_IDS.has(key)) throw new Error('默认预设不能删除')
  const presets = readRaw()
  const next = presets.filter((item) => item.id !== key)
  if (next.length === presets.length) throw new Error('预设不存在')
  writeRaw(next)
  return { deleted: key }
}

