/** conversation — extracted from the original host entry. */
import path from 'node:path'
import { isPlainObject, parseTime, stripRefs } from './util.js'

/** The wrapped IndexedDB record shape: { data: { chat_session, chat_messages } }. */
export function isCacheRecord(value) {
  return isPlainObject(value) && isPlainObject(value.data) && value.data.chat_session && Array.isArray(value.data.chat_messages)
}


/** Accept both the wrapped record and a bare { chat_session, chat_messages }. */
export function cacheRecordOf(value) {
  if (isCacheRecord(value)) return value
  if (isPlainObject(value) && isPlainObject(value.chat_session) && Array.isArray(value.chat_messages)) {
    return { data: value }
  }
  return null
}


/** DeepSeek's official node messages carry fragments; other providers do not. */
function hasDeepSeekFragments(conversation) {
  if (!isPlainObject(conversation) || !isPlainObject(conversation.mapping)) return false
  for (const node of Object.values(conversation.mapping)) {
    const fragments = node && node.message && node.message.fragments
    if (!Array.isArray(fragments)) continue
    if (fragments.some((fragment) => fragment
      && (fragment.type === 'REQUEST' || fragment.type === 'RESPONSE' || fragment.type === 'THINK'))) {
      return true
    }
  }
  return false
}


export function isOfficialConversation(value) {
  return isPlainObject(value)
    && !isCacheRecord(value)
    && (typeof value.id === 'string' || typeof value.id === 'number')
    && hasDeepSeekFragments(value)
}


/**
 * Classify one exported value.
 * Returns { kind: 'official'|'cache', conv } or { kind: 'unknown', reason }.
 */
export function classifyValue(value) {
  if (isPlainObject(value) && isCacheRecord(value)) return { kind: 'cache', conv: value }
  const bare = cacheRecordOf(value)
  if (bare) return { kind: 'cache', conv: bare }
  if (isOfficialConversation(value)) return { kind: 'official', conv: value }
  if (isPlainObject(value) && isPlainObject(value.mapping)) {
    return { kind: 'unknown', reason: 'mapping 中没有 DeepSeek 的 fragments，像是其它 AI 的导出' }
  }
  if (isPlainObject(value) && (Array.isArray(value.messages) || Array.isArray(value.chat_messages))) {
    return { kind: 'unknown', reason: '这是通用的消息数组，不是 DeepSeek 网页导出' }
  }
  return { kind: 'unknown', reason: '不是 DeepSeek 网页对话' }
}


// ---------------------------------------------------------------------------
// Conversation metadata
// ---------------------------------------------------------------------------


export function conversationInfo(kind, conv, index) {
  if (kind === 'official') {
    const mapping = conv.mapping || {}
    const nodes = Object.values(mapping).filter((node) => node && node.message)
    let updated = parseTime(conv.updated_at)
    if (!updated) {
      for (const node of nodes) {
        const time = parseTime(node.message.inserted_at)
        if (time > updated) updated = time
      }
    }
    if (!updated) updated = Date.now()
    return {
      id: String(conv.id == null ? 'official-' + index : conv.id),
      title: String(conv.title == null ? '' : conv.title),
      updatedAt: updated,
      messages: nodes.length,
    }
  }
  const data = conv.data || {}
  const session = data.chat_session || {}
  const messages = Array.isArray(data.chat_messages) ? data.chat_messages : []
  let updated = parseTime(session.updated_at)
  if (!updated) {
    for (const message of messages) {
      const time = parseTime(message.inserted_at)
      if (time > updated) updated = time
    }
  }
  if (!updated) updated = Date.now()
  return {
    id: String(session.id == null ? 'cache-' + index : session.id),
    title: String(session.title == null ? '' : session.title),
    updatedAt: updated,
    messages: messages.length,
  }
}

// ---------------------------------------------------------------------------
// Fragment extraction
// ---------------------------------------------------------------------------


export function extractContent(fragments) {
  let user = ''
  let think = ''
  let text = ''
  for (const fragment of Array.isArray(fragments) ? fragments : []) {
    if (!fragment || typeof fragment !== 'object') continue
    if (fragment.type === 'REQUEST') user += (user ? '\n\n' : '') + String(fragment.content || '')
    else if (fragment.type === 'THINK') think += (think ? '\n\n' : '') + String(fragment.content || '')
    else if (fragment.type === 'RESPONSE') text += (text ? '\n\n' : '') + stripRefs(fragment.content)
  }
  return { user: user.trim(), think: think.trim(), text: text.trim() }
}


export function contentRole(content) {
  if (content.user) return 'user'
  if (content.think || content.text) return 'assistant'
  return null
}

// ---------------------------------------------------------------------------
// Trunk computation
// ---------------------------------------------------------------------------


/**
 * Walk a parent->child message graph and return the path reaching the deepest
 * leaf. Ties choose the later message, then the saved current path. Only real
 * parent-child edges are followed, so branches can never be spliced.
 */
export function deepestPath({ nodes, childrenOf, timeOf, idOf, preferredIds }) {
  const memo = new Map()
  const visiting = new Set()

  function depthOf(node) {
    const id = idOf(node)
    if (memo.has(id)) return memo.get(id)
    if (visiting.has(id)) return 0
    visiting.add(id)
    let best = 0
    for (const child of childrenOf(id)) {
      const childDepth = 1 + depthOf(child)
      if (childDepth > best) best = childDepth
    }
    visiting.delete(id)
    memo.set(id, best)
    return best
  }

  function chooseChild(id) {
    const children = childrenOf(id)
    if (children.length === 0) return null
    let best = null
    let bestDepth = -1
    for (const child of children) {
      const depth = depthOf(child)
      if (depth > bestDepth) {
        best = child
        bestDepth = depth
      } else if (depth === bestDepth && best) {
        const childTime = timeOf(child)
        const bestTime = timeOf(best)
        const preferred = preferredIds.has(idOf(child)) && !preferredIds.has(idOf(best))
        if (childTime !== bestTime ? childTime > bestTime : preferred) best = child
      }
    }
    return best
  }

  let start = null
  let startDepth = -1
  for (const node of nodes) {
    if (node.parentId != null && nodes.some((candidate) => idOf(candidate) === node.parentId)) continue
    const depth = 1 + depthOf(node)
    if (depth > startDepth || (depth === startDepth && start && timeOf(node) > timeOf(start))) {
      start = node
      startDepth = depth
    }
  }
  if (!start) return []

  const path = [start]
  let current = start
  for (;;) {
    const child = chooseChild(idOf(current))
    if (!child) break
    path.push(child)
    current = child
  }
  return path
}


/** Build the message tree of one conversation for either export format. */
export function buildNodeMap(kind, conv) {
  const byId = new Map()
  if (kind === 'official') {
    const mapping = conv.mapping || {}
    for (const [key, node] of Object.entries(mapping)) {
      if (!node || !node.message) continue
      const content = extractContent(node.message.fragments || node.message.content)
      const id = String(node.id == null ? key : node.id)
      byId.set(id, {
        id,
        parentId: node.parent == null ? null : String(node.parent),
        time: parseTime(node.message.inserted_at),
        role: contentRole(content),
        content,
      })
    }
    return {
      byId,
      nodes: [...byId.values()],
      currentId: conv.current_message_id != null ? String(conv.current_message_id) : null,
    }
  }
  const data = conv.data || {}
  const messages = Array.isArray(data.chat_messages) ? data.chat_messages : []
  for (const message of messages) {
    if (!message || message.message_id == null) continue
    const id = String(message.message_id)
    byId.set(id, {
      id,
      parentId: message.parent_id == null ? null : String(message.parent_id),
      time: parseTime(message.inserted_at),
      role: message.role === 'USER' ? 'user' : message.role === 'ASSISTANT' ? 'assistant' : null,
      content: extractContent(message.fragments),
    })
  }
  return {
    byId,
    nodes: [...byId.values()],
    currentId: data.chat_session && data.chat_session.current_message_id != null
      ? String(data.chat_session.current_message_id)
      : null,
  }
}


export function childMapOf(nodes) {
  const map = new Map()
  for (const node of nodes) {
    if (node.parentId == null) continue
    const list = map.get(node.parentId)
    if (list) list.push(node)
    else map.set(node.parentId, [node])
  }
  return map
}


/** Chain from the root to the given message. */
export function chainTo(byId, id) {
  const chain = []
  const seen = new Set()
  let cursor = byId.get(String(id))
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id)
    chain.push(cursor)
    cursor = cursor.parentId != null ? byId.get(cursor.parentId) : undefined
  }
  return chain.reverse()
}


export function isVisibleNode(node) {
  return Boolean(node && node.role && (node.content.user || node.content.think || node.content.text))
}


/** Ids on the chain from the export's current tip to the root. */
export function preferredIdsFor(current, getNode, parentOf) {
  const preferred = new Set()
  if (current == null) return preferred
  let cursor = getNode(String(current))
  const guard = new Set()
  while (cursor && !guard.has(cursor.id)) {
    guard.add(cursor.id)
    preferred.add(cursor.id)
    cursor = parentOf(cursor) != null ? getNode(parentOf(cursor)) : undefined
  }
  return preferred
}


/** Chain to the most recent visible leaf; ties choose the longer chain. */
export function latestPath(map, childrenMap, preferredIds) {
  const { byId, nodes } = map
  const childrenOf = (id) => childrenMap.get(id) || []
  const preferred = preferredIds || new Set()
  const depthOf = (node) => {
    let depth = 0
    let cursor = node
    const guard = new Set()
    while (cursor && cursor.parentId != null && byId.has(cursor.parentId) && !guard.has(cursor.id)) {
      guard.add(cursor.id)
      depth += 1
      cursor = byId.get(cursor.parentId)
    }
    return depth
  }
  let best = null
  let bestTime = -Infinity
  let bestDepth = -1
  for (const node of nodes) {
    if (!isVisibleNode(node)) continue
    if (childrenOf(node.id).some(isVisibleNode)) continue
    const time = node.time || 0
    const depth = depthOf(node)
    if (time > bestTime
      || (time === bestTime && depth > bestDepth)
      || (time === bestTime && depth === bestDepth && best
        && preferred.has(node.id) && !preferred.has(best.id))) {
      best = node
      bestTime = time
      bestDepth = depth
    }
  }
  return best ? chainTo(byId, best.id).filter(isVisibleNode) : []
}


/** Select one path through the conversation tree. */
export function selectPath(map, childrenMap, rule, leafId) {
  const { byId, currentId } = map
  if (rule === 'custom' && leafId && byId.has(String(leafId))) {
    return chainTo(byId, leafId)
  }
  const preferred = preferredIdsFor(currentId, (id) => byId.get(id), (node) => node.parentId)
  if (rule === 'recent') {
    // The version the export marked as current; official exports without that
    // record use the most recent leaf (not the deepest branch).
    if (currentId != null && byId.has(currentId)) return chainTo(byId, currentId)
    return latestPath(map, childrenMap, preferred)
  }
  return deepestPath({
    nodes: map.nodes,
    childrenOf: (id) => childrenMap.get(id) || [],
    timeOf: (node) => node.time,
    idOf: (node) => node.id,
    preferredIds: preferred,
  })
}


/** One transcript row: the message text plus the versions available at its position. */
export function transcriptMessage(node, siblings) {
  const versions = siblings.map((item) => ({
    id: item.id,
    preview: String(item.content.user || item.content.text || '').trim().slice(0, 60),
    time: item.time || 0,
  }))
  return {
    id: node.id,
    role: node.role,
    time: node.time || 0,
    text: String(node.content.user || node.content.text || '').trim().slice(0, 400),
    versions,
    selectedVersion: versions.findIndex((version) => version.id === node.id),
  }
}


/** Visible siblings of one message (its alternative versions), oldest first. */
export function versionsOf(map, childrenMap, node) {
  const parentId = node.parentId
  const list = parentId != null ? childrenMap.get(parentId) || [] : map.nodes.filter((item) => item.parentId == null)
  return list.filter(isVisibleNode).slice().sort((a, b) => (a.time || 0) - (b.time || 0))
}


/** Walk down from one message, always taking the branch with the most content. */
export function deepestFrom(map, childrenMap, start) {
  const chain = [start]
  const seen = new Set([start.id])
  const subDepth = (node) => {
    let best = 0
    for (const child of (childrenMap.get(node.id) || []).filter(isVisibleNode)) {
      best = Math.max(best, 1 + subDepth(child))
    }
    return best
  }
  let cursor = start
  for (;;) {
    const kids = (childrenMap.get(cursor.id) || []).filter(isVisibleNode)
    if (kids.length === 0) break
    const next = kids.reduce((best, kid) => (subDepth(kid) > subDepth(best) ? kid : best), kids[0])
    if (seen.has(next.id)) break
    seen.add(next.id)
    chain.push(next)
    cursor = next
  }
  ;(void map)
  return chain
}


/** The visible messages of the currently selected path. */
export function pathMessages(map, childrenMap) {
  const currentChain = map.currentId != null ? chainTo(map.byId, map.currentId).filter(isVisibleNode) : []
  if (currentChain.length > 0) return currentChain
  return selectPath(map, childrenMap, 'recent', '').filter(isVisibleNode)
}


/** A window of the current path, newest last. */
export function buildTranscript(kind, conv, options, prebuilt) {
  const map = prebuilt ? prebuilt.map : buildNodeMap(kind, conv)
  const childrenMap = prebuilt ? prebuilt.children : childMapOf(map.nodes)
  const leafId = options && options.leafId ? String(options.leafId) : ''
  let all = null
  if (leafId && map.byId.has(leafId)) {
    const chain = chainTo(map.byId, leafId).filter(isVisibleNode)
    if (chain.length > 0) all = chain
  }
  if (!all) all = currentPathMessages(prebuilt && prebuilt.key, map, childrenMap)
  const limit = Math.min(2000, Math.max(50, Number(options && options.limit) || 600))
  let end = all.length
  if (options && options.before) {
    const position = all.findIndex((node) => node.id === String(options.before))
    if (position > 0) end = position
  }
  const start = Math.max(0, end - limit)
  const messages = all.slice(start, end).map((node) => transcriptMessage(node, versionsOf(map, childrenMap, node)))
  return {
    messages,
    leafId: all.length > 0 ? all[all.length - 1].id : '',
    pathLength: all.length,
    hasMoreBefore: start > 0,
  }
}


/** One message with its full text and versions, for the detail dialog. */
export function buildMessageDetail(kind, conv, id, prebuilt) {
  const map = prebuilt ? prebuilt.map : buildNodeMap(kind, conv)
  const childrenMap = prebuilt ? prebuilt.children : childMapOf(map.nodes)
  const node = map.byId.get(String(id))
  if (!node) return { text: '', role: '', time: 0, versions: [] }
  const versions = versionsOf(map, childrenMap, node)
  return {
    text: String(node.content.user || node.content.text || '').trim(),
    role: node.role,
    time: node.time || 0,
    versions: versions.map((version) => ({
      id: version.id,
      preview: String(version.content.user || version.content.text || '').trim().slice(0, 60),
      time: version.time || 0,
      selected: version.id === node.id,
    })),
  }
}


/** A window of the continuation that follows one version. */
export function buildTranscriptTail(kind, conv, versionId, options, prebuilt) {
  const map = prebuilt ? prebuilt.map : buildNodeMap(kind, conv)
  const childrenMap = prebuilt ? prebuilt.children : childMapOf(map.nodes)
  const start = map.byId.get(String(versionId))
  if (!start) return { messages: [], leafId: '', hasMore: false }
  const chain = deepestFrom(map, childrenMap, start)
  let from = 0
  if (options && options.after) {
    const position = chain.findIndex((node) => node.id === String(options.after))
    if (position >= 0) from = position + 1
  }
  const limit = Math.min(2000, Math.max(50, Number(options && options.limit) || 600))
  const windowNodes = chain.slice(from, from + limit)
  const messages = windowNodes.map((node) => transcriptMessage(node, versionsOf(map, childrenMap, node)))
  return {
    messages,
    leafId: chain[chain.length - 1].id,
    hasMore: from + limit < chain.length,
  }
}

export function trunkFor(kind, conv, options) {
  const map = buildNodeMap(kind, conv)
  const childrenMap = childMapOf(map.nodes)
  const path = selectPath(map, childrenMap, options && options.rule, options && options.leafId)
  return path
    .filter(isVisibleNode)
    .map((node) => ({ role: node.role, content: node.content, time: node.time }))
}


export function buildTurns(trunk) {
  const turns = []
  let current = null
  for (const message of trunk) {
    if (message.role === 'user') {
      if (current) turns.push(current)
      current = { user: message.content.user, assistants: [], time: message.time }
    } else if (message.role === 'assistant') {
      if (!current) current = { user: '', assistants: [], time: message.time }
      current.assistants.push(message.content)
    }
  }
  if (current) turns.push(current)
  const out = []
  for (const turn of turns) {
    const think = turn.assistants.map((part) => part.think).filter(Boolean).join('\n\n').trim()
    const text = turn.assistants.map((part) => part.text).filter(Boolean).join('\n\n').trim()
    const user = String(turn.user || '').trim()
    if (!user && !think && !text) continue
    out.push({ user, think, text, time: turn.time })
  }
  return out
}


export function extractConversation(kind, conv, options) {
  return buildTurns(trunkFor(kind, conv, options))
}

// ---------------------------------------------------------------------------
// Durable session writing
// ---------------------------------------------------------------------------


/** Visible message chains keyed by file revision and conversation id. */
export const pathCache = new Map()


export function currentPathMessages(cacheKey, map, childrenMap) {
  if (cacheKey) {
    const hit = pathCache.get(cacheKey)
    if (hit) return hit
  }
  const chain = pathMessages(map, childrenMap)
  if (cacheKey) {
    pathCache.set(cacheKey, chain)
    if (pathCache.size > 24) pathCache.delete(pathCache.keys().next().value)
  }
  return chain
}

