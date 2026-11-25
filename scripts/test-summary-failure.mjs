import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-summary-failure-'))
process.env.LOCALAPPDATA = path.join(dir, 'store')
process.env.DSH_HOME = path.join(dir, 'dsh-home')

const { normalizeCompressOptions } = await import('../lib/planner.js')
const { summarizeShadowed, SummaryChunkError } = await import('../lib/summary.js')

const long = 'x'.repeat(40_000)
const turns = [
  { user: long, text: 'a' },
  { user: long, text: 'b' },
]
const plan = { shadowedTurns: 2, tailTurns: 1 }
const options = normalizeCompressOptions({
  mode: 'summary',
  summaryChars: 800,
  summaryPrompt: { text: '只保留要点。', name: '中性' },
})

function usageStream(text) {
  return (async function* generate() {
    yield { type: 'text-delta', text }
    yield { type: 'usage', usage: { inputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 8 } }
    yield { type: 'finish', reason: { kind: 'done' } }
  })()
}

function makeLlm(behavior) {
  let calls = 0
  return {
    get calls() { return calls },
    stream() {
      calls += 1
      return behavior(calls)
    },
  }
}

async function run(llm) {
  const wctx = { get(name) { return name === 'llm' ? llm : undefined } }
  return summarizeShadowed(wctx, turns, plan, options, () => {}, () => false, () => false, null)
}

// Retry succeeds: first attempt fails, then both chunks succeed.
{
  const llm = makeLlm((call) => {
    if (call === 1) throw new Error('临时网络错误')
    return usageStream('摘要' + call)
  })
  const result = await run(llm)
  assert.equal(result.failure, null)
  assert.equal(result.done, 2)
  assert.equal(llm.calls, 3)
  assert.ok(result.segments.every((segment) => segment.text.length > 0))
  console.log('PASS retry succeeds on the next attempt')
}

// Second chunk fails after the first succeeded: keep the first segment.
{
  const llm = makeLlm((call) => {
    if (call === 1) return usageStream('第一段摘要')
    throw new Error('模型持续失败')
  })
  const result = await run(llm)
  assert.equal(result.done, 1)
  assert.equal(result.segments.length, 1)
  assert.equal(result.failure.chunkIndex, 2)
  assert.equal(result.failure.fromTurn, 2)
  assert.equal(result.failure.attempts, 2)
  assert.ok(result.aborted)
  assert.ok(result.costCny >= 0)
  console.log('PASS partial result keeps completed segments')
}

// First chunk never succeeds: a named hard error, not an empty placeholder.
{
  const llm = makeLlm(() => { throw new Error('模型持续失败') })
  await assert.rejects(
    () => run(llm),
    (error) => error instanceof SummaryChunkError
      && /摘要第 1 段/.test(error.message)
      && /模型持续失败/.test(error.message),
  )
  console.log('PASS first-chunk failure is a hard summary error')
}

fs.rmSync(dir, { recursive: true, force: true })
console.log('PASS summary retry and partial failure handling')
