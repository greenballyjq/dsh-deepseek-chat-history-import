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
const longSession = {
  id: 'long',
  title: '完整存档测试',
  current_message_id: 6,
  inserted_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:06.000Z',
  messages: Array.from({ length: 6 }, (_, index) => ({
    id: index + 1,
    parent_id: index === 0 ? null : index,
    role: index % 2 === 0 ? 'USER' : 'ASSISTANT',
    status: 'FINISHED',
    inserted_at: '2026-01-01T00:00:0' + (index + 1) + '.000Z',
    fragments: [{
      type: index % 2 === 0 ? 'REQUEST' : 'RESPONSE',
      content: (index % 2 === 0 ? '问题 ' : '回答 ') + (index + 1),
    }],
  })),
}
const zipPath = writeZip(dir, 'deepseek_data-2026-01-01', {
  'manifest.json': JSON.stringify({ export_format_version: 3 }),
  'chat_sessions/imp.json': JSON.stringify(session),
  'chat_sessions/long.json': JSON.stringify(longSession),
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
let summaryCalls = 0
const llm = {
  async resolveModelInfo() { return { context: { contextWindow: 1_048_576 } } },
  stream() {
    summaryCalls += 1
    return (async function* generate() {
      yield { type: 'text-delta', text: '摘要测试文本' }
      yield { type: 'usage', usage: { inputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 8 } }
      yield { type: 'finish', reason: { kind: 'done' } }
    })()
  },
}
const wctx = {
  get(name) {
    if (name === 'attachments') return attachmentsService
    if (name === 'sessionPersistence') return persistenceService
    if (name === 'workspaceRegistry') return workspaceService
    if (name === 'llm') return llm
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

const fullStart = savedEvents.length
const fullJob = createImportJob()
await runImportJob(wctx, fullJob, {
  path: zipPath,
  ids: ['long'],
  compress: { mode: 'full', retainTurns: 2 },
  pathRule: 'recent',
})
assert.equal(fullJob.status, 'done', fullJob.error)
assert.equal(fullJob.result.mode, 'full')
assert.equal(fullJob.result.compressed, true)
const fullEvents = savedEvents.slice(fullStart)
const checkpoint = fullEvents.find((event) => event.type === 'user/message'
  && event.data.content.some((block) => block.type === 'text' && block.text.includes('完整存档：')))
assert.ok(checkpoint, 'full archive checkpoint names the memory file')
const importsRoot = path.join(dir, 'imports')
const workspaceDir = path.join(importsRoot, '完整存档测试')
const memoryRoot = path.join(workspaceDir, 'deepseek-memory')
assert.ok(fs.existsSync(path.join(memoryRoot, 'manifest.json')))
assert.ok(fs.existsSync(path.join(memoryRoot, 'memory.md')))
assert.ok(!fs.existsSync(path.join(workspaceDir, 'deepseek-import-record.md')))
assert.ok(!fs.existsSync(path.join(workspaceDir, 'deepseek-import-summary.md')))

const dropJob = createImportJob()
await runImportJob(wctx, dropJob, {
  path: zipPath,
  ids: ['long'],
  compress: { mode: 'placeholder', retainTurns: 2 },
  pathRule: 'recent',
})
assert.equal(dropJob.status, 'done', dropJob.error)
const dropDir = path.join(importsRoot, '完整存档测试 (2)')
assert.ok(fs.existsSync(dropDir), 'drop import creates its own workspace')
assert.ok(!fs.existsSync(path.join(dropDir, 'deepseek-import-record.md')), 'no legacy record file')
assert.ok(!fs.existsSync(path.join(dropDir, 'deepseek-memory')), 'drop import creates no memory directory')

const summaryStart = savedEvents.length
const summaryJob = createImportJob()
await runImportJob(wctx, summaryJob, {
  path: zipPath,
  ids: ['long'],
  compress: {
    mode: 'summary',
    retainTurns: 2,
    summaryChars: 800,
    maxCostCny: 1,
    summaryPrompt: { text: '保留要点。', name: '中性' },
  },
  pathRule: 'recent',
})
assert.equal(summaryJob.status, 'done', summaryJob.error)
assert.equal(summaryJob.result.mode, 'summary')
assert.ok(summaryCalls > 0, 'the summary model was called')
const summaryDir = path.join(importsRoot, '完整存档测试 (3)')
const summaryMemoryRoot = path.join(summaryDir, 'deepseek-memory')
const summaryManifest = JSON.parse(fs.readFileSync(path.join(summaryMemoryRoot, 'manifest.json'), 'utf8'))
assert.equal(summaryManifest.kind, 'summary')
assert.equal(summaryManifest.turns.archived, 1)
assert.ok(fs.readFileSync(path.join(summaryMemoryRoot, 'memory.md'), 'utf8').includes('## 摘要段 1'))
const summaryCheckpoint = savedEvents.slice(summaryStart).find((event) => event.type === 'user/message'
  && event.data.content.some((block) => block.type === 'text' && block.text.includes('已概括为摘要')))
assert.ok(summaryCheckpoint, 'summary checkpoint uses the unified prefix')
assert.ok(!fs.existsSync(path.join(summaryDir, 'deepseek-import-summary.md')))

console.log('PASS import writes image blocks, status notes and a durable session')
