import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { writeZip } from './test-fixtures.mjs'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-import-'))
const store = path.join(dir, 'store')
fs.mkdirSync(path.join(store, 'dsh-deepseek-import'), { recursive: true })
fs.writeFileSync(
  path.join(store, 'dsh-deepseek-import', 'settings.json'),
  JSON.stringify({ importRoot: path.join(dir, 'imports') }),
)
process.env.LOCALAPPDATA = store
process.env.DSH_HOME = path.join(dir, 'dsh-home')

const { createImportJob, runImportJob } = await import('../lib/jobs.js')

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const session = {
  id: 'imp',
  title: '导入冒烟',
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
        { type: 'FILE', files: [{ id: 'f1', file_name: 'pic.png', file_size: png.length, is_image: true, export_path: 'chat_sessions/imp_files/f1.png' }] },
        { type: 'REQUEST', content: '看图' },
      ],
    },
    {
      id: 2,
      parent_id: 1,
      role: 'ASSISTANT',
      status: 'INCOMPLETE',
      inserted_at: '2026-01-01T00:00:02.000Z',
      fragments: [{ type: 'RESPONSE', content: '这是一张图' }],
    },
  ],
}
const zipPath = writeZip(dir, 'deepseek_data-2026-01-01', {
  'manifest.json': JSON.stringify({ export_format_version: 3 }),
  'chat_sessions/imp.json': JSON.stringify(session),
  'chat_sessions/imp_files/f1.png': png,
})

const savedEvents = []
let imageSaves = 0
const handle = {
  async append(events) { savedEvents.push(...events) },
  async flush() {},
  async close() {},
}
const workspace = {
  id: 'w1',
  name: '导入冒烟',
  async attachSession() {},
  async insertSessionBefore() {},
}
const attachmentsService = {
  async saveImage(input) {
    imageSaves += 1
    return { attachmentId: 'img-1', mediaType: input.mediaType, bytes: input.data.length, width: 1, height: 1, name: input.name }
  },
  async saveFile() { throw new Error('unexpected file save') },
}
const persistenceService = { async create() { return handle } }
const workspaceService = {
  async resolveByPath() { return undefined },
  async create() { return workspace },
  async delete() {},
}
const wctx = {
  get(name) {
    if (name === 'attachments') return attachmentsService
    if (name === 'sessionPersistence') return persistenceService
    if (name === 'workspaceRegistry') return workspaceService
    return undefined
  },
  get attachments() { return attachmentsService },
  get sessionPersistence() { return persistenceService },
  get workspaceRegistry() { return workspaceService },
}

const job = createImportJob()
await runImportJob(wctx, job, {
  path: zipPath,
  ids: ['imp'],
  compress: { mode: 'placeholder' },
  pathRule: 'recent',
})
assert.equal(job.status, 'done', job.error)
assert.equal(imageSaves, 1)
assert.equal(job.result.attachments.images, 1)
assert.equal(job.result.attachments.skipped, 0)
assert.equal(job.result.incompleteReplies, 1)

const userEvent = savedEvents.find((event) => event.type === 'user/message')
assert.ok(userEvent)
assert.ok(userEvent.data.content.some((block) => block.type === 'image'), 'image block is written')
const assistantEvent = savedEvents.find((event) => event.type === 'assistant/message')
assert.ok(assistantEvent.data.message.content.some((block) => block.type === 'text' && block.text.includes('未完成')))
const titleEvent = savedEvents.find((event) => event.type === 'session/title')
assert.equal(titleEvent.data.title, '导入冒烟')

console.log('PASS import writes image blocks, status notes and a durable session')
