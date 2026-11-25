/** Browser IndexedDB record of DeepSeek chat sessions. */
import { isPlainObject, parseTime } from '../util.js'
import { attachmentOf, conversationOf, extractContent, fingerprintOf, messageOf } from './canonical.js'


/** The record body inside the optional `data` wrapper. */
function recordOf(value) {
  if (!isPlainObject(value)) return null
  if (isPlainObject(value.data) && value.data.chat_session && Array.isArray(value.data.chat_messages)) {
    return value.data
  }
  if (isPlainObject(value.chat_session) && Array.isArray(value.chat_messages)) return value
  return null
}


/** Browser records reference files through signed URLs, never raw bytes. */
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
        exportPath: '',
      }))
    }
  }
  return files
}


function fingerprintOfRecord(session, messages) {
  return fingerprintOf({
    title: session.title,
    inserted_at: session.inserted_at,
    messages: messages.map((message) => ({
      message_id: message.message_id,
      parent_id: message.parent_id,
      role: message.role,
      inserted_at: message.inserted_at,
      model: message.model,
      fragments: message.fragments,
    })),
  })
}


/** One browser export record: `{data:{chat_session,chat_messages}}` or bare. */
export const browserRecord = {
  id: 'browser/record',
  kind: 'cache',
  label: '浏览器记录',
  rank: 1,

  match(_ctx, value) {
    return recordOf(value) ? { version: null, source: 'structure' } : null
  },

  normalize(value) {
    const data = recordOf(value)
    const session = data.chat_session || {}
    const raw = Array.isArray(data.chat_messages) ? data.chat_messages : []
    const messages = []
    for (const message of raw) {
      if (!message || message.message_id == null) continue
      const content = extractContent(message.fragments)
      messages.push(messageOf({
        id: String(message.message_id),
        parentId: message.parent_id,
        time: parseTime(message.inserted_at),
        role: message.role === 'USER' ? 'user' : message.role === 'ASSISTANT' ? 'assistant' : null,
        content,
        files: filesOf(message.fragments),
      }))
    }
    let updatedAt = parseTime(session.updated_at)
    if (!updatedAt) {
      for (const message of raw) {
        const time = parseTime(message && message.inserted_at)
        if (time > updatedAt) updatedAt = time
      }
    }
    if (!updatedAt) updatedAt = Date.now()
    return conversationOf({
      formatId: browserRecord.id,
      id: session.id,
      title: session.title,
      insertedAt: parseTime(session.inserted_at),
      updatedAt,
      pinned: session.pinned,
      currentMessageId: session.current_message_id,
      messages,
      messageCount: raw.length,
      fingerprint: fingerprintOfRecord(session, raw),
    })
  },
}
