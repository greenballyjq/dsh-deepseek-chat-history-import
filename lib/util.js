/** util — extracted from the original host entry. */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { UPLOAD_DIR } from './constants.js'

export function randomId() {
  return crypto.randomUUID()
}


export function stripRefs(text) {
  return String(text == null ? '' : text).replace(/\[!reference:\d+\]/g, '')
}


/** Short user-facing text for a technical failure; the raw text goes to detail. */
export function friendlyMessage(raw) {
  const text = String(raw || '')
  if (/不是合法 JSON|模型配置不完整/.test(text)) return '配置文件格式有误，摘要导入已暂停。'
  if (/缺少摘要提示词/.test(text)) return '插件安装不完整，缺少摘要提示词文件。'
  if (/插件安装不完整/.test(text)) return '插件安装不完整，缺少模型配置文件。'
  if (/没有配置/.test(text)) return text
  if (/^文件不存在：/.test(text)) return '文件不存在，请重新选择。'
  if (/会话格式|session\.v/.test(text)) return '当前 DSH 版本可能不兼容，导入可能失败。'
  return text
}


/** Display name of a stored upload: the original name without the time prefix. */
export function displayNameFor(filePath) {
  const base = path.basename(filePath)
  if (path.dirname(filePath) === UPLOAD_DIR) {
    return base.replace(/^\d{10,}-/, '')
  }
  return base
}


export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}


export function parseTime(value) {
  if (value == null) return 0
  if (typeof value === 'number') return value > 1e12 ? value : value * 1000
  const parsed = Date.parse(String(value))
  return Number.isNaN(parsed) ? 0 : parsed
}


export function deepMerge(base, override) {
  if (!override || typeof override !== 'object') return base
  const result = Array.isArray(base) ? [...base] : { ...base }
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === 'object' && !Array.isArray(value)
      && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
      result[key] = deepMerge(result[key], value)
    } else {
      result[key] = value
    }
  }
  return result
}


/** Read one JSON file, returning null when absent and reporting a parse error. */
export function readJsonFile(file) {
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(file + ' 不是合法 JSON：' + (error instanceof Error ? error.message : String(error)))
  }
}


export function clampNumber(value, fallback, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

/**
 * DeepSeek tokenizes one Chinese character as about 0.6 tokens and one Latin
 * character as about 0.3 (https://api-docs.deepseek.com/zh-cn/quick_start/token_usage/).
 * The host token meter assumes a fixed 4-chars-per-token density, which
 * undercounts Chinese by ~2.7x, so the import estimates are computed here.
 */


/** Keep small costs readable instead of rounding them to zero. */
export function roundCost(value) {
  const cost = Number(value)
  if (!Number.isFinite(cost) || cost <= 0) return 0
  if (cost < 0.01) return Math.round(cost * 10_000) / 10_000
  if (cost < 0.1) return Math.round(cost * 1_000) / 1_000
  return Math.round(cost * 100) / 100
}

