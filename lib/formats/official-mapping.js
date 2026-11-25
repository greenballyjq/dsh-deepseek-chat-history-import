/** Official DeepSeek export that stores every conversation as a mapping tree. */
import { isPlainObject, parseTime } from '../util.js'
import { attachmentOf, contentRole, conversationOf, extractContent, fingerprintOf, latestMessageTime, messageOf } from './canonical.js'


const MAPPING_FRAGMENTS = new Set(['REQUEST', 'RESPONSE', 'THINK'])


function hasDeepSeekFragments(value) {
  if (!isPlainObject(value.mapping)) return false
  for (const node of Object.values(value.mapping)) {
    const fragments = node && node.message && node.message.fragments
    if (!Array.isArray(fragments)) continue
    if (fragments.some((fragment) => fragment && MAPPING_FRAGMENTS.has(fragment.type))) return true
  }
  return false
}


/** Old exports keep attachment names only; the bytes were never in the archive. */
function filesOf(fragments) {
  const files = []
  for (const fragment of Array.isArray(fragments) ? fragments : []) {
    if (!fragment || fragment.type !== 'FILE') continue
    for (const file of Array.isArray(fragment.files) ? fragment.files : []) {
      files.push(attachmentOf({
        id: file.file_id,
        name: file.file_name,
        size: file.file_size,
        image: false,
        exportPath: '',
      }))
    }
  }
  return files
}


function fingerprintOfMapping(value) {
  const nodes = Object.values(value.mapping || {})
    .filter((node) => node && node.message)
    .map((node) => ({
      id: node.id,
      parent: node.parent,
      children: node.children,
      message: {
        model: node.message.model,
        inserted_at: node.message.inserted_at,
        fragments: node.message.fragments,
      },
    }))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))
  return fingerprintOf({
    title: value.title,
    inserted_at: value.inserted_at,
    nodes,
  })
}


/** The mapping-based official export (`conversations.json`, split files, wrappers). */
export const officialMapping = {
  id: 'official/mapping',
  kind: 'official',
  label: '官方导出（无版本号）',
  rank: 2,

  match(_ctx, value) {
    if (!isPlainObject(value)) return null
    if (typeof value.id !== 'string' && typeof value.id !== 'number') return null
    if (!isPlainObject(value.mapping)) return null
    return hasDeepSeekFragments(value) ? { version: null, source: 'structure' } : null
  },

  normalize(value) {
    const messages = []
    for (const [key, node] of Object.entries(value.mapping || {})) {
      if (!node || !node.message) continue
      const content = extractContent(node.message.fragments || node.message.content)
      messages.push(messageOf({
        id: String(node.id == null ? key : node.id),
        parentId: node.parent == null ? null : String(node.parent),
        time: parseTime(node.message.inserted_at),
        role: contentRole(content),
        content,
        files: filesOf(node.message.fragments),
      }))
    }
    let updatedAt = parseTime(value.updated_at)
    if (!updatedAt) updatedAt = latestMessageTime(messages)
    if (!updatedAt) updatedAt = Date.now()
    return conversationOf({
      formatId: officialMapping.id,
      id: value.id,
      title: value.title,
      insertedAt: parseTime(value.inserted_at),
      updatedAt,
      pinned: value.pinned,
      currentMessageId: value.current_message_id,
      messages,
      messageCount: messages.length,
      fingerprint: fingerprintOfMapping(value),
    })
  },
}
