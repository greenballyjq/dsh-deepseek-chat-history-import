import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { normalizeCompressOptions } from '../lib/planner.js'
import { buildMemoryNotice, writeMemory } from '../lib/memory.js'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-memory-'))

const turns = [
  {
    time: Date.UTC(2026, 0, 1, 0, 0, 0),
    user: '用户一',
    text: '助手一',
    think: '思考一',
    notes: [],
    attachments: [{ type: 'image', attachment: { name: '图一.png', attachmentId: 'att-1', bytes: 12 } }],
  },
  {
    time: Date.UTC(2026, 0, 1, 0, 0, 1),
    user: '用户二',
    text: '助手二',
    think: '思考二',
    notes: ['（该回复在导出时未完成）'],
    attachments: [],
  },
]

const full = writeMemory({
  workspaceDir: root,
  title: '测试会话',
  sourceName: 'deepseek_data.zip',
  branch: { rule: 'recent', leafId: 'leaf-1' },
  totalTurns: 4,
  turns,
  kind: 'full',
  keepThinking: true,
  summary: null,
})
assert.equal(full.manifest.kind, 'full')
assert.equal(full.manifest.attachments, 'dsh')
assert.equal(full.manifest.thinking, true)
assert.ok(!('messages' in full.manifest), 'manifest carries no per-message index')
assert.ok(fs.existsSync(path.join(full.dir, 'memory.md')))
assert.ok(fs.existsSync(path.join(full.dir, 'thinking.md')))
const memory = fs.readFileSync(path.join(full.dir, 'memory.md'), 'utf8')
assert.ok(memory.includes('## 第 1 轮'))
assert.ok(memory.includes('用户一'))
assert.ok(!memory.includes('思考一'), 'thinking stays out of memory.md')
assert.ok(!memory.includes('来源：'), 'metadata stays in manifest')
assert.ok(fs.readFileSync(path.join(full.dir, 'thinking.md'), 'utf8').includes('思考一'))

const notice = buildMemoryNotice({
  kind: 'full',
  title: '测试会话',
  archivedTurns: 2,
  inlineTurns: 2,
  relativeMemory: full.relativeDir + '/memory.md',
})
assert.ok(notice.includes('【导入记录】'))
assert.ok(notice.includes('完整存档：'))
assert.ok(notice.includes('对话主题：测试会话。'))

const summaryRoot = path.join(root, 'summary-workspace')
const summary = writeMemory({
  workspaceDir: summaryRoot,
  title: '测试会话',
  sourceName: 'deepseek_data.zip',
  branch: { rule: 'longest', leafId: 'leaf-2' },
  totalTurns: 4,
  turns,
  kind: 'summary',
  keepThinking: false,
  summary: {
    chars: 800,
    prompt: { name: '中性', fingerprint: 'abc' },
    segments: [
      { index: 1, fromTurn: 1, toTurn: 1, text: '摘要一', chars: 3 },
      { index: 2, fromTurn: 2, toTurn: 2, text: '摘要二', chars: 3 },
    ],
    partial: null,
  },
})
assert.equal(summary.manifest.summary.chars, 800)
assert.ok(!('segments' in summary.manifest.summary), 'segment ranges stay out of manifest')
assert.ok(!('messages' in summary.manifest), 'message text stays out of manifest')
const summaryText = fs.readFileSync(path.join(summary.dir, 'memory.md'), 'utf8')
assert.ok(summaryText.includes('## 摘要段 1 · 第 1–1 轮'))
assert.ok(summaryText.includes('摘要一'))
assert.ok(!fs.existsSync(path.join(summary.dir, 'thinking.md')))
assert.ok(!buildMemoryNotice({ kind: 'summary', title: '测试会话', archivedTurns: 2, inlineTurns: 2 }).includes('完整存档：'))

const partial = buildMemoryNotice({
  kind: 'summary',
  title: '测试会话',
  archivedTurns: 2,
  inlineTurns: 2,
  partial: { done: 1, total: 2, fromTurn: 1, toTurn: 1, droppedFrom: 2, droppedTo: 2 },
})
assert.ok(partial.includes('生成摘要时停止'))
assert.ok(partial.includes('【导入记录】'))
assert.ok(!partial.includes('【导入摘要'), 'the old inconsistent prefix is gone')

const splitTurns = [
  { time: 1, user: '一'.repeat(120_000), text: '', think: '', notes: [], attachments: [] },
  { time: 2, user: '二'.repeat(120_000), text: '', think: '', notes: [], attachments: [] },
]
const split = writeMemory({
  workspaceDir: path.join(root, 'split-workspace'),
  title: '分片会话',
  sourceName: 'x.zip',
  branch: { rule: 'recent', leafId: '' },
  totalTurns: 2,
  turns: splitTurns,
  kind: 'full',
  keepThinking: false,
  summary: null,
})
assert.ok(split.files.length > 1, 'large memory content is split')
assert.equal(split.files[0], 'memory.md')
assert.ok(fs.readFileSync(path.join(split.dir, 'memory.md'), 'utf8').includes('](memory-'))

const fullMode = normalizeCompressOptions({ mode: 'full', retainTurns: 10 })
assert.equal(fullMode.mode, 'full')
assert.equal(fullMode.keepThinking, false)
assert.equal(normalizeCompressOptions({ mode: 'full', keepThinking: true }).keepThinking, true)

fs.rmSync(root, { recursive: true, force: true })
console.log('PASS unified memory files: full, summary, thinking, split, copy')
