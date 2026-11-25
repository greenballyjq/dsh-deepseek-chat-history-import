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


/** SHA-1 of one projected conversation; the semantic projection below uses it. */
function fingerprintOf(projected) {
  return createHash('sha1').update(JSON.stringify(stableValue(projected))).digest('hex')
}


/** Citation markers differ between exports; ignore them when comparing chats. */
function semanticText(value) {
  return stripRefs(value)
    .replace(/【\d+†[^】]*】/g, '')
    .replace(/\[\d+†[^\]]*\]/g, '')
}


/**
 * Semantic fingerprint of the chat itself: roles, times and text. Titles are
 * compared separately, and format-specific fields, message ids, empty messages
 * and citation markers are ignored. Two exports of the same chat produce the
 * same value.
 */
function semanticFingerprint(messages) {
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
  return fingerprintOf({ messages: projected })
}


/** Per-conversation semantic cache; computed only when a duplicate appears. */
const semanticCache = new WeakMap()


/** Semantic fingerprint of one conversation, memoized on the conversation. */
export function semanticOf(conv) {
  const cached = semanticCache.get(conv)
  if (cached) return cached
  const value = semanticFingerprint(conv.messages)
  semanticCache.set(conv, value)
  return value
}


/** One attachment referenced by a message; only `exportPath` can be imported. */
export function attachmentOf({ id, name, size, image, exportPath }) {
  return {
    id: String(id == null ? '' : id),
    name: String(name == null ? '' : name),
    size: Number(size) || 0,
    image: Boolean(image),
    exportPath: typeof exportPath === 'string' ? exportPath : '',
  }
}


/**
 * One canonical message.
 *
 * `content` is already extracted, `role` is already resolved; downstream code
 * never inspects format-specific fields.
 */
export function messageOf({ id, parentId, time, role, content, status = null, files = [] }) {
  return {
    id,
    parentId: parentId == null ? null : String(parentId),
    time: Number(time) || 0,
    role,
    content,
    status,
    files: Array.isArray(files) ? files : [],
  }
}


/**
 * One canonical conversation.
 *
 * `messageCount` is the count the source reports (it can differ from
 * `messages.length` when a format stores unusable records). The semantic
 * fingerprint is computed lazily by `semanticOf` when a merge needs it.
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
