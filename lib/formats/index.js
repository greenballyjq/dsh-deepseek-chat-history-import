/** Format registry: identification, normalization and user-facing labels. */
import { isPlainObject } from '../util.js'
import { browserRecord } from './browser-record.js'
import { officialMapping } from './official-mapping.js'
import { officialV3, SUPPORTED_VERSION } from './official-v3.js'


/** Detection order: most specific container first, then the official variants. */
const FORMATS = [browserRecord, officialMapping, officialV3]

const BY_ID = new Map(FORMATS.map((format) => [format.id, format]))

/** Official export versions this build can normalize. */
export const SUPPORTED_EXPORT_VERSIONS = new Set([SUPPORTED_VERSION])


/** First format that claims one parsed value, with the evidence it used. */
export function identify(ctx, value) {
  for (const format of FORMATS) {
    const hit = format.match(ctx || {}, value)
    if (hit) return { format, version: hit.version, source: hit.source }
  }
  return null
}


/** Normalize one parsed value, or null when no format claims it. */
export function normalizeValue(value, ctx) {
  const hit = identify(ctx, value)
  if (!hit) return null
  return {
    kind: hit.format.kind,
    formatId: hit.format.id,
    conv: hit.format.normalize(value, ctx || {}),
  }
}


/** Why one parsed value is not a DeepSeek conversation (kept user-facing). */
export function unknownReason(value) {
  if (isPlainObject(value) && isPlainObject(value.mapping)) {
    return 'mapping 中没有 DeepSeek 的 fragments，像是其它 AI 的导出'
  }
  if (isPlainObject(value) && (Array.isArray(value.messages) || Array.isArray(value.chat_messages))) {
    return '这是通用的消息数组，不是 DeepSeek 网页导出'
  }
  return '不是 DeepSeek 网页对话'
}


/** User-facing label of one format id. */
export function labelOf(formatId) {
  const format = BY_ID.get(String(formatId || ''))
  return format ? format.label : ''
}


/** Merge authority of one format id; official formats outrank browser records. */
export function rankOf(formatId) {
  const format = BY_ID.get(String(formatId || ''))
  return format ? format.rank : 0
}
