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
  reasoningEffort: 'high',
  summaryPrompt: { text: '只保留关键决定，不要写别的内容。', name: '自定义' },
})
const chunk = { text: '用户：请总结。\n\n助手：好的。', fromTurn: 1, toTurn: 1 }
const result = await summarizeChunk(wctx, options, chunk, null)

assert.ok(captured, 'LLM stream was called')
assert.ok(captured.system.includes('只保留关键决定'), 'user prompt is in the system message')
assert.ok(captured.system.includes('输出要求'), 'host framing is present')
assert.ok(captured.system.includes('不超过 800 字'), 'the framing carries the selected limit')
assert.equal(captured.maxTokens, 2400, 'output budget is limit × 3')
assert.ok(captured.system.includes('不是对话中的角色'), 'the summarizer is framed as external, not a character')
assert.ok(captured.messages[0].content[0].text.includes('<transcript>'), 'conversation data is delimited')
assert.ok(!captured.messages[0].content[0].text.includes('段（第'), 'no segment or turn metadata is sent')
assert.equal(captured.reasoningEffort, 'high', 'the per-import effort reaches the request')
assert.ok(!captured.system.includes('{{limit}}'), 'no placeholder remains')
assert.ok(result.text.length <= 800, 'strict output truncation')
console.log('PASS summarizeChunk composes user prompt + host framing and truncates')
