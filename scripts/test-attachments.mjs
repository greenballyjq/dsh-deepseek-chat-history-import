import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadSources } from '../lib/load.js'
import { extractConversation } from '../lib/conversation.js'
import { resolveTurnAttachments } from '../lib/attachments.js'
import { buildSessionEvents } from '../lib/session.js'
import { writeZip } from './test-fixtures.mjs'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-attach-'))
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const session = {
  id: 's1',
  title: '附件测试',
  current_message_id: 4,
  inserted_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:04.000Z',
  messages: [
    {
      id: 1,
      parent_id: null,
      role: 'USER',
      status: 'FINISHED',
      inserted_at: '2026-01-01T00:00:01.000Z',
      fragments: [
        {
          type: 'FILE',
          files: [
            { id: 'f1', file_name: 'pic.png', file_size: png.length, is_image: true, export_path: 'chat_sessions/s1_files/f1.png' },
            { id: 'f3', file_name: 'doc.txt', file_size: 3, is_image: false, export_path: 'chat_sessions/s1_files/f3.txt' },
            { id: 'm1', file_name: 'missing.png', file_size: 10, is_image: true, export_path: 'chat_sessions/s1_files/missing.png' },
          ],
        },
        { type: 'REQUEST', content: 'look' },
      ],
    },
    {
      id: 2,
      parent_id: 1,
      role: 'ASSISTANT',
      status: 'INCOMPLETE',
      inserted_at: '2026-01-01T00:00:02.000Z',
      fragments: [{ type: 'THINK', content: 'hmm' }, { type: 'RESPONSE', content: 'partial' }],
    },
    {
      id: 3,
      parent_id: 2,
      role: 'USER',
      status: 'FINISHED',
      inserted_at: '2026-01-01T00:00:03.000Z',
      fragments: [
        {
          type: 'FILE',
          files: [
            { id: 'f1', file_name: 'pic.png', file_size: png.length, is_image: true, export_path: 'chat_sessions/s1_files/f1.png' },
            { id: 'e1', file_name: 'evil.png', file_size: png.length, is_image: true, export_path: '../evil.png' },
          ],
        },
        { type: 'REQUEST', content: 'again' },
      ],
    },
    {
      id: 4,
      parent_id: 3,
      role: 'ASSISTANT',
      status: 'CONTENT_FILTER',
      inserted_at: '2026-01-01T00:00:04.000Z',
      fragments: [{ type: 'TEMPLATE_RESPONSE', content: '无法回答' }],
    },
  ],
}

const zip = writeZip(dir, 'export', {
  'manifest.json': JSON.stringify({ export_format_version: 3 }),
  'chat_sessions/s1.json': JSON.stringify(session),
  'chat_sessions/s1_files/f1.png': png,
  'chat_sessions/s1_files/f3.txt': 'abc',
})

const cached = loadSources([zip])
assert.equal(cached.byId.size, 1)
const conv = cached.byId.get('s1')
assert.ok(conv.sourcePath.endsWith('.zip'), 'source path is kept for attachment lookup')

const turns = extractConversation(conv, { rule: 'recent', leafId: '' })
assert.equal(turns.length, 2)
assert.deepEqual(turns[0].notes, ['（该回复在导出时未完成）'])
assert.deepEqual(turns[1].notes, [])
assert.equal(turns[0].files.length, 3)

const calls = { images: [], files: [] }
let imageSeq = 0
let fileSeq = 0
const wctx = {
  get(name) {
    if (name !== 'attachments') return undefined
    return {
      async saveImage(input) {
        calls.images.push(input)
        imageSeq += 1
        return { attachmentId: 'img-' + imageSeq, mediaType: input.mediaType, bytes: input.data.length, width: 1, height: 1, name: input.name }
      },
      async saveFile(input) {
        calls.files.push(input)
        fileSeq += 1
        return { attachmentId: 'file-' + fileSeq, name: input.name || 'file', bytes: input.data.length }
      },
    }
  },
}

const resolved = await resolveTurnAttachments(wctx, turns, { sourcePath: conv.sourcePath })
assert.equal(resolved.stats.images, 1, 'one image is saved even when two turns reference it')
assert.equal(resolved.stats.files, 1)
assert.equal(resolved.stats.skipped, 1, 'the missing archive member is skipped')
assert.equal(calls.images.length, 1)
assert.equal(calls.files.length, 1)
assert.ok(resolved.turns[0].notes.some((note) => note.includes('missing.png')))
const blocks = resolved.turns.flatMap((turn) => turn.attachments || [])
assert.equal(blocks.filter((block) => block.type === 'image').length, 2)
assert.equal(blocks.filter((block) => block.type === 'file').length, 1)
assert.equal(calls.images[0].mediaType, 'image/png')

const built = buildSessionEvents('session-attach', '附件测试', resolved.turns, 'head', null, null, 'deepseek-chat')
const userEvents = built.events.filter((event) => event.type === 'user/message')
assert.equal(userEvents.length, 2)
const firstContent = userEvents[0].data.content
assert.equal(firstContent[0].type, 'text')
assert.ok(firstContent.some((block) => block.type === 'image'))
assert.ok(firstContent.some((block) => block.type === 'file'))
const secondContent = userEvents[1].data.content
assert.equal(secondContent.filter((block) => block.type === 'image').length, 1)
const firstAssistant = built.events.find((event) => event.type === 'assistant/message' && event.data.turn === 1)
assert.ok(firstAssistant.data.message.content.some((block) => block.type === 'text' && block.text.includes('未完成')))
const secondAssistant = built.events.find((event) => event.type === 'assistant/message' && event.data.turn === 2)
assert.ok(secondAssistant.data.message.content.some((block) => block.type === 'text' && block.text === '无法回答'))

const oldOfficial = JSON.parse(JSON.stringify({
  id: 'old-file',
  title: '旧附件',
  inserted_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:01Z',
  mapping: {
    n1: {
      id: 'n1',
      parent: null,
      children: [],
      message: {
        inserted_at: '2026-01-01T00:00:01Z',
        fragments: [
          { type: 'FILE', files: [{ file_id: 'x', file_name: 'old.docx', file_size: 10 }] },
          { type: 'REQUEST', content: 'hi' },
        ],
      },
    },
  },
}))
const oldPath = path.join(dir, 'old.json')
fs.writeFileSync(oldPath, JSON.stringify(oldOfficial))
const oldCached = loadSources([oldPath])
const oldTurns = extractConversation(oldCached.byId.get('old-file'), { rule: 'recent', leafId: '' })
assert.equal(oldTurns[0].files[0].exportPath, '')
const oldResolved = await resolveTurnAttachments(wctx, oldTurns, { sourcePath: oldCached.byId.get('old-file').sourcePath })
assert.equal(oldResolved.stats.images + oldResolved.stats.files, 0, 'old exports have no attachment bytes')

console.log('PASS attach imported files, dedupe, skip missing, unsafe paths, status notes')
