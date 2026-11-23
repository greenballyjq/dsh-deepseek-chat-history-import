import assert from 'node:assert/strict'
import { normalizeCompressOptions } from '../lib/planner.js'
import { summarizeChunk } from '../lib/summary.js'

let captured = null
const llm = {
  stream(request) {
    captured = request
    return (async function* generate() {
      yield { type: 'text-delta', text: 'x'.repeat(5000) }
      yield { type: 'usage', usage: { inputTokens: 120, cacheReadTokens: 0, outputTokens: 900 } }
      yield { type: 'finish', reason: { kind: 'done' } }
    })()
  },
}
const wctx = { get(name) { return name === 'llm' ? llm : undefined } }
const options = normalizeCompressOptions({
  mode: 'summary',
  summaryChars: 800,
  summaryPrompt: { preset: 'custom', text: '只保留关键决定，不要写别的内容。' },
})
const chunk = { text: '用户：请总结。\n\n助手：好的。', fromTurn: 1, toTurn: 1 }
const result = await summarizeChunk(wctx, options, chunk, 0, 1, null)

assert.ok(captured, 'LLM stream was called')
assert.ok(captured.system.includes('只保留关键决定'), 'custom prompt is in the system prompt')
assert.ok(captured.system.includes('系统约束'), 'fixed guard is appended')
assert.ok(captured.system.includes('不超过 800 字'), 'guard carries the selected limit')
assert.ok(!captured.system.includes('{{limit}}'), 'no visible placeholder remains')
assert.ok(result.text.length <= 800, 'strict output truncation')
console.log('PASS summarizeChunk composes custom prompt + hidden guard and truncates')
