import assert from 'node:assert/strict'
import { buildNodeMap, childMapOf, selectPath, buildTranscript, buildTranscriptTail, extractConversation } from '../lib/conversation.js'
import { normalizeValue } from '../lib/formats/index.js'

function officialConversation(extra = {}) {
  return {
    id: 'branch-1',
    title: 'Branch test',
    inserted_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...extra,
    mapping: {
      n1: {
        id: 'n1',
        parent: null,
        children: ['n2', 'n3'],
        message: { model: 'deepseek-chat', inserted_at: '2026-01-01T00:00:01Z', fragments: [{ type: 'REQUEST', content: 'Q1' }] },
      },
      n2: {
        id: 'n2',
        parent: 'n1',
        children: ['n4'],
        message: { model: 'deepseek-chat', inserted_at: '2026-01-01T00:00:02Z', fragments: [{ type: 'RESPONSE', content: 'A1' }] },
      },
      n4: {
        id: 'n4',
        parent: 'n2',
        children: ['n5'],
        message: { model: 'deepseek-chat', inserted_at: '2026-01-01T00:00:03Z', fragments: [{ type: 'REQUEST', content: 'Q2' }] },
      },
      n5: {
        id: 'n5',
        parent: 'n4',
        children: [],
        message: { model: 'deepseek-chat', inserted_at: '2026-01-01T00:00:04Z', fragments: [{ type: 'RESPONSE', content: 'A2' }] },
      },
      n3: {
        id: 'n3',
        parent: 'n1',
        children: ['n6'],
        message: { model: 'deepseek-chat', inserted_at: '2026-01-01T00:00:06Z', fragments: [{ type: 'RESPONSE', content: 'B1' }] },
      },
      n6: {
        id: 'n6',
        parent: 'n3',
        children: [],
        message: { model: 'deepseek-chat', inserted_at: '2026-01-01T00:00:07Z', fragments: [{ type: 'REQUEST', content: 'Q3' }] },
      },
    },
  }
}

function cacheConversation(extra = {}) {
  return {
    data: {
      chat_session: { id: 'branch-cache', title: 'Cache branch', inserted_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z', ...extra },
      chat_messages: [
        { message_id: 'n1', parent_id: null, role: 'user', inserted_at: '2026-01-01T00:00:01Z', fragments: [{ type: 'REQUEST', content: 'Q1' }] },
        { message_id: 'n2', parent_id: 'n1', role: 'assistant', inserted_at: '2026-01-01T00:00:02Z', fragments: [{ type: 'RESPONSE', content: 'A1' }] },
        { message_id: 'n4', parent_id: 'n2', role: 'user', inserted_at: '2026-01-01T00:00:03Z', fragments: [{ type: 'REQUEST', content: 'Q2' }] },
        { message_id: 'n5', parent_id: 'n4', role: 'assistant', inserted_at: '2026-01-01T00:00:04Z', fragments: [{ type: 'RESPONSE', content: 'A2' }] },
        { message_id: 'n3', parent_id: 'n1', role: 'assistant', inserted_at: '2026-01-01T00:00:06Z', fragments: [{ type: 'RESPONSE', content: 'B1' }] },
        { message_id: 'n6', parent_id: 'n3', role: 'user', inserted_at: '2026-01-01T00:00:07Z', fragments: [{ type: 'REQUEST', content: 'Q3' }] },
      ],
    },
  }
}

const ids = (nodes) => nodes.map((node) => node.id)

/** Normalize one raw fixture the same way an imported file is normalized. */
function asConversation(value) {
  const normalized = normalizeValue(value, {})
  assert.ok(normalized, 'fixture must be recognized')
  return normalized.conv
}

let failures = 0
function check(name, fn) {
  try {
    fn()
    console.log('PASS', name)
  } catch (error) {
    failures += 1
    console.error('FAIL', name, error.message)
  }
}

const official = asConversation(officialConversation())
const officialMap = buildNodeMap(official)
const officialChildren = childMapOf(officialMap.nodes)

check('recent picks the latest leaf, not the longest branch', () => {
  assert.deepEqual(ids(selectPath(officialMap, officialChildren, 'recent', '')), ['n1', 'n3', 'n6'])
})

check('longest still picks the deepest branch', () => {
  assert.deepEqual(ids(selectPath(officialMap, officialChildren, 'longest', '')), ['n1', 'n2', 'n4', 'n5'])
})

check('transcript opens on the latest branch', () => {
  const result = buildTranscript(official, { limit: 600 })
  assert.deepEqual(result.messages.map((message) => message.id), ['n1', 'n3', 'n6'])
  assert.equal(result.leafId, 'n6')
})

check('transcript reopens on a stored custom leaf', () => {
  const result = buildTranscript(official, { limit: 600, leafId: 'n5' })
  assert.deepEqual(result.messages.map((message) => message.id), ['n1', 'n2', 'n4', 'n5'])
  assert.equal(result.leafId, 'n5')
})

check('switching a version still follows the longest continuation', () => {
  const result = buildTranscriptTail(official, 'n3', { limit: 600 })
  assert.deepEqual(result.messages.map((message) => message.id), ['n3', 'n6'])
})

check('recent prefers the marked current version over the latest', () => {
  const marked = asConversation(officialConversation({ current_message_id: 'n5' }))
  const map = buildNodeMap(marked)
  const children = childMapOf(map.nodes)
  assert.deepEqual(ids(selectPath(map, children, 'recent', '')), ['n1', 'n2', 'n4', 'n5'])
  const result = buildTranscript(marked, { limit: 600 })
  assert.equal(result.leafId, 'n5')
})

check('browser record uses its current message id', () => {
  const cache = asConversation(cacheConversation({ current_message_id: 'n5' }))
  const map = buildNodeMap(cache)
  const children = childMapOf(map.nodes)
  assert.deepEqual(ids(selectPath(map, children, 'recent', '')), ['n1', 'n2', 'n4', 'n5'])
})

check('import path uses the latest branch by default', () => {
  const turns = extractConversation(official, { rule: 'recent', leafId: '' })
  assert.equal(turns[turns.length - 1].user, 'Q3')
})

check('latest tie prefers the longer chain', () => {
  const conversation = {
    id: 'tie-1',
    title: 'Tie',
    inserted_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    mapping: {
      a1: { id: 'a1', parent: null, children: ['a2'], message: { inserted_at: '2026-01-01T00:00:01Z', fragments: [{ type: 'REQUEST', content: 'A' }] } },
      a2: { id: 'a2', parent: 'a1', children: [], message: { inserted_at: '2026-01-01T00:00:02Z', fragments: [{ type: 'RESPONSE', content: 'A2' }] } },
      b1: { id: 'b1', parent: null, children: ['b2'], message: { inserted_at: '2026-01-01T00:00:01Z', fragments: [{ type: 'REQUEST', content: 'B' }] } },
      b2: { id: 'b2', parent: 'b1', children: ['b3'], message: { inserted_at: '2026-01-01T00:00:02Z', fragments: [{ type: 'RESPONSE', content: 'B2' }] } },
      b3: { id: 'b3', parent: 'b2', children: ['b4'], message: { inserted_at: '2026-01-01T00:00:02Z', fragments: [{ type: 'REQUEST', content: 'B3' }] } },
      b4: { id: 'b4', parent: 'b3', children: [], message: { inserted_at: '2026-01-01T00:00:02Z', fragments: [{ type: 'RESPONSE', content: 'B4' }] } },
    },
  }
  const map = buildNodeMap(asConversation(conversation))
  const children = childMapOf(map.nodes)
  assert.deepEqual(ids(selectPath(map, children, 'recent', '')), ['b1', 'b2', 'b3', 'b4'])
})

if (failures > 0) process.exitCode = 1
