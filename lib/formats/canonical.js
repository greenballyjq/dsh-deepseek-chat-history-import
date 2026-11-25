/** canonical — the single conversation model every export format normalizes to. */
import { createHash } from 'node:crypto'
import { stripRefs } from '../util.js'


const REQUEST = 'REQUEST'
const RESPONSE = 'RESPONSE'
const TEMPLATE_RESPONSE = 'TEMPLATE_RESPONSE'
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
    else if (fragment.type === RESPONSE || fragment.type === TEMPLATE_RESPONSE) {
      text += (text ? '\n\n' : '') + stripRefs(fragment.content)
    }
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


/** Citation markers differ between exports; ignore them when comparing chats. */
function semanticText(value) {
  return stripRefs(value)
    .replace(/【\d+†[^】]*】/g, '')
    .replace(/\[\d+†[^\]]*\]/g, '')
}


/**
 * Semantic fingerprint: only what the user wrote or read (title, roles, times,
 * user text, reasoning, reply text), never format-specific fields or message
 * ids. Messages without any text are dropped, the role is derived from the
 * content, and citation markers are ignored, so an export that stores
 * tool-only nodes or strips citations does not change the result. Two exports
 * of the same chat produce the same value.
 */
export function semanticFingerprint(title, messages) {
  const projected = messages
    .map((message) => {
      const content = message.content
      const user = semanticText(content.user)
      const think = semanticText(content.think)
      const text = semanticText(content.text)
      if (!user && !think && !text) return null
      return {
        role: user ? 'user' : 'assistant',
        time: message.time,
        user,
        think,
        text,
      }
    })
    .filter(Boolean)
    .sort((left, right) => (left.time - right.time)
      || String(left.role).localeCompare(String(right.role))
      || String(left.user + left.think + left.text).localeCompare(String(right.user + right.think + right.text)))
  return fingerprintOf({ title: String(title == null ? '' : title), messages: projected })
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
  const resolvedTitle = String(title == null ? '' : title)
  return {
    formatId,
    id: id == null ? null : String(id),
    title: resolvedTitle,
    insertedAt: Number(insertedAt) || 0,
    updatedAt: Number(updatedAt) || 0,
    pinned: Boolean(pinned),
    currentMessageId: currentMessageId == null ? null : String(currentMessageId),
    messages,
    messageCount: Number.isFinite(Number(messageCount)) ? Number(messageCount) : messages.length,
    fingerprint,
    semantic: semanticFingerprint(resolvedTitle, messages),
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
