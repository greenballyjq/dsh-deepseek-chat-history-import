/** canonical — the single conversation model every export format normalizes to. */
import { createHash } from 'node:crypto'
import { stripRefs } from '../util.js'


const REQUEST = 'REQUEST'
const RESPONSE = 'RESPONSE'
const THINK = 'THINK'


/** Concatenate the text of the fragments a message type renders as content. */
export function extractContent(fragments) {
  let user = ''
  let think = ''
  let text = ''
  for (const fragment of Array.isArray(fragments) ? fragments : []) {
    if (!fragment || typeof fragment !== 'object') continue
    if (fragment.type === REQUEST) user += (user ? '\n\n' : '') + String(fragment.content || '')
    else if (fragment.type === THINK) think += (think ? '\n\n' : '') + String(fragment.content || '')
    else if (fragment.type === RESPONSE) text += (text ? '\n\n' : '') + stripRefs(fragment.content)
  }
  return { user: user.trim(), think: think.trim(), text: text.trim() }
}


/** Role implied by extracted content, for formats that carry no explicit role. */
export function contentRole(content) {
  if (content.user) return 'user'
  if (content.think || content.text) return 'assistant'
  return null
}


/** Sort object keys so a fingerprint does not depend on JSON key order. */
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    const sorted = {}
    for (const key of Object.keys(value).sort()) sorted[key] = stableValue(value[key])
    return sorted
  }
  return value
}


/** SHA-1 of one projected conversation; formats define their own projection. */
export function fingerprintOf(projected) {
  return createHash('sha1').update(JSON.stringify(stableValue(projected))).digest('hex')
}


/**
 * One canonical message.
 *
 * `content` is already extracted, `role` is already resolved; downstream code
 * never inspects format-specific fields.
 */
export function messageOf({ id, parentId, time, role, content, status = null }) {
  return {
    id,
    parentId: parentId == null ? null : String(parentId),
    time: Number(time) || 0,
    role,
    content,
    status,
  }
}


/**
 * One canonical conversation.
 *
 * `messageCount` is the count the source reports (it can differ from
 * `messages.length` when a format stores unusable records); `fingerprint`
 * identifies the semantic content across key orders.
 */
export function conversationOf({
  formatId,
  id,
  title,
  insertedAt,
  updatedAt,
  pinned = false,
  currentMessageId = null,
  messages,
  messageCount,
  fingerprint,
}) {
  return {
    formatId,
    id: id == null ? null : String(id),
    title: String(title == null ? '' : title),
    insertedAt: Number(insertedAt) || 0,
    updatedAt: Number(updatedAt) || 0,
    pinned: Boolean(pinned),
    currentMessageId: currentMessageId == null ? null : String(currentMessageId),
    messages,
    messageCount: Number.isFinite(Number(messageCount)) ? Number(messageCount) : messages.length,
    fingerprint,
  }
}


/** Latest message time, used as the updated_at fallback every format shares. */
export function latestMessageTime(messages) {
  let latest = 0
  for (const message of messages) {
    const time = Number(message.time) || 0
    if (time > latest) latest = time
  }
  return latest
}
