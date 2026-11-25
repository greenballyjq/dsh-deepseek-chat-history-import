/** containers — unwrap wrappers and arrays into parsed candidate values. */
import { identify, unknownReason } from './formats/index.js'


/** Nested wrappers beyond this depth are reported instead of walked. */
const MAX_DEPTH = 3


/**
 * Walk one parsed JSON value and append every recognized conversation to
 * `result.items`; unrecognized values append their reason to `result.skipped`.
 * Containers stay format-agnostic: recognition belongs to the format registry.
 */
export function collectValue(value, depth, ctx, result) {
  if (depth > MAX_DEPTH) {
    result.skipped.push({ reason: '嵌套太深，已跳过' })
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectValue(item, depth + 1, ctx, result)
    return
  }
  if (value && typeof value === 'object') {
    if (Array.isArray(value.conversations)) { collectValue(value.conversations, depth + 1, ctx, result); return }
    if (Array.isArray(value.records)) { collectValue(value.records, depth + 1, ctx, result); return }
    if (Array.isArray(value.data)) { collectValue(value.data, depth + 1, ctx, result); return }
    const hit = identify(ctx, value)
    if (!hit) {
      result.skipped.push({ reason: unknownReason(value) })
      return
    }
    result.items.push({
      kind: hit.format.kind,
      formatId: hit.format.id,
      conv: hit.format.normalize(value, ctx),
    })
    return
  }
  result.skipped.push({ reason: '不是对话对象' })
}
