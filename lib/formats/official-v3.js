/** Official DeepSeek export v3: one flat JSON file per conversation. */
import { isPlainObject, parseTime } from '../util.js'
import { attachmentOf, contentRole, conversationOf, extractContent, fingerprintOf, latestMessageTime, messageOf } from './canonical.js'


/** Version this module understands. */
export const SUPPORTED_VERSION = 3


/**
 * A v3 session carries a message array and the browser's own message ids. The
 * shape is checked tightly so a generic `{id, messages}` file is not claimed.
 */
function isV3Session(value) {
  if (!isPlainObject(value)) return false
  if (typeof value.id !== 'string' && typeof value.id !== 'number') return false
  if (!Array.isArray(value.messages)) return false
  if (!Object.prototype.hasOwnProperty.call(value, 'current_message_id')) return false
  for (const message of value.messages) {
    if (!isPlainObject(message)) return false
    if (message.id == null) return false
    if (!Array.isArray(message.fragments)) return false
    if (typeof message.role !== 'string') return false
  }
  return true
}


function filesOf(fragments) {
  const files = []
  for (const fragment of Array.isArray(fragments) ? fragments : []) {
    if (!fragment || fragment.type !== 'FILE') continue
    for (const file of Array.isArray(fragment.files) ? fragment.files : []) {
      files.push(attachmentOf({
        id: file.id,
        name: file.file_name,
        size: file.file_size,
        image: file.is_image,
        exportPath: file.export_path,
      }))
    }
  }
  return files
}


function fingerprintOfSession(value) {
  return fingerprintOf({
    title: value.title,
    inserted_at: value.inserted_at,
    messages: value.messages.map((message) => ({
      id: message.id,
      parent_id: message.parent_id,
      role: message.role,
      inserted_at: message.inserted_at,
      status: message.status,
      fragments: message.fragments,
    })),
  })
}


/** Official export `export_format_version: 3`. */
export const officialV3 = {
  id: 'official/v3',
  kind: 'official',
  label: '官方导出 v3',
  rank: 2,

  match(ctx, value) {
    if (!isV3Session(value)) return null
    const declared = ctx && ctx.manifest ? Number(ctx.manifest.export_format_version) : NaN
    if (Number.isFinite(declared)) {
      return declared === SUPPORTED_VERSION ? { version: SUPPORTED_VERSION, source: 'manifest' } : null
    }
    return { version: SUPPORTED_VERSION, source: 'structure' }
  },

  normalize(value) {
    const messages = []
    for (const message of value.messages) {
      const content = extractContent(message.fragments)
      messages.push(messageOf({
        id: String(message.id),
        parentId: message.parent_id,
        time: parseTime(message.inserted_at),
        role: message.role === 'USER' ? 'user' : message.role === 'ASSISTANT' ? 'assistant' : contentRole(content),
        content,
        status: typeof message.status === 'string' ? message.status : null,
        files: filesOf(message.fragments),
      }))
    }
    let updatedAt = parseTime(value.updated_at)
    if (!updatedAt) updatedAt = latestMessageTime(messages)
    if (!updatedAt) updatedAt = Date.now()
    return conversationOf({
      formatId: officialV3.id,
      id: value.id,
      title: value.title,
      insertedAt: parseTime(value.inserted_at),
      updatedAt,
      pinned: value.pinned,
      currentMessageId: value.current_message_id,
      messages,
      messageCount: value.messages.length,
      fingerprint: fingerprintOfSession(value),
    })
  },
}
