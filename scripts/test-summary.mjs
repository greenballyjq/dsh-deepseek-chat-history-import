import assert from 'node:assert/strict'
import {
  MAX_SUMMARY_PROMPT_CHARS,
  SUMMARY_PROMPT_PRESETS,
  buildSystemPrompt,
  buildUserPrompt,
  normalizeSummaryText,
  normalizePrompt,
  summaryPromptFingerprint,
  truncateSummaryText,
} from '../lib/summary-prompt.js'
import { normalizeCompressOptions, estimateSummaryCost } from '../lib/planner.js'

let passed = 0
function test(name, fn) {
  try {
    fn()
    passed += 1
    console.log('PASS', name)
  } catch (error) {
    console.error('FAIL', name)
    throw error
  }
}

test('request text is preserved and named', () => {
  const prompt = normalizePrompt({ text: '  保留所有关键决定。  ', name: '技术 / 工作' })
  assert.equal(prompt.text, '保留所有关键决定。')
  assert.equal(prompt.name, '技术 / 工作')
  assert.equal(prompt.fingerprint, summaryPromptFingerprint('保留所有关键决定。'))
})

test('a missing name falls back to 自定义', () => {
  const prompt = normalizePrompt({ text: '保留要点' })
  assert.equal(prompt.name, '自定义')
})

test('empty prompt text is rejected', () => {
  assert.throws(() => normalizePrompt({ text: '   ' }), /不能为空/)
})

test('a missing prompt falls back to the neutral preset', () => {
  const prompt = normalizePrompt(undefined)
  assert.ok(prompt.text.length > 20)
  assert.equal(prompt.name, '中性')
})

test('overlong prompt text is rejected', () => {
  assert.throws(
    () => normalizePrompt({ text: 'x'.repeat(MAX_SUMMARY_PROMPT_CHARS + 1) }),
    /不能超过/,
  )
})

test('the fixed system prompt carries the limit but not the style', () => {
  const system = buildSystemPrompt(1500)
  assert.ok(system.includes('你是对话摘要器'))
  assert.ok(system.includes('不超过 1500 字'))
  assert.ok(system.includes('一段纯文本正文'))
  assert.ok(!system.includes('只保留要点'))
  const user = buildUserPrompt('只保留要点', '用户：请总结。')
  assert.ok(user.includes('风格要求：只保留要点'))
  assert.ok(user.includes('<transcript>\n用户：请总结。\n</transcript>'))
})

test('a literal {{limit}} stays in the style text, not in the system prompt', () => {
  const system = buildSystemPrompt(800)
  const user = buildUserPrompt('写 {{limit}} 字以内', '用户：请总结。')
  assert.ok(!system.includes('{{limit}}'))
  assert.ok(system.includes('不超过 800 字'))
  assert.ok(user.includes('写 {{limit}} 字以内'))
})

test('summaries are normalized to one paragraph', () => {
  assert.equal(normalizeSummaryText('第一段\n\n第二段\n- 项目'), '第一段 第二段 - 项目')
  assert.equal(normalizeSummaryText('  a\t\tb  '), 'a b')
})

test('presets carry no host framing text', () => {
  for (const preset of SUMMARY_PROMPT_PRESETS) {
    assert.ok(!preset.text.includes('{{limit}}'))
    assert.ok(!preset.text.includes('输出要求'))
    assert.ok(!preset.text.includes('不超过'))
    assert.ok(!preset.text.includes('一段纯文本'))
  }
})

test('custom fingerprints differ when text changes', () => {
  assert.notEqual(summaryPromptFingerprint('a'), summaryPromptFingerprint('b'))
  assert.equal(summaryPromptFingerprint('same'), summaryPromptFingerprint('same'))
})

test('post-generation truncation is strict', () => {
  assert.equal(truncateSummaryText('abcdef', 3), 'abc')
  assert.equal(truncateSummaryText('  abcdef  ', 4), 'abcd')
  assert.equal(truncateSummaryText('abc', 10), 'abc')
})

test('compress options carry the validated prompt and a clamped length', () => {
  const options = normalizeCompressOptions({
    mode: 'summary',
    summaryChars: 99_999,
    summaryPrompt: { text: '保留剧情与人物关系。', name: '叙事 / 角色扮演' },
  })
  assert.equal(options.summaryPrompt.name, '叙事 / 角色扮演')
  assert.equal(options.summaryPrompt.text, '保留剧情与人物关系。')
  assert.ok(options.summaryChars <= 4_000)
  assert.throws(
    () => normalizeCompressOptions({ mode: 'summary', summaryPrompt: { text: '' } }),
    /不能为空/,
  )
})

test('estimate input tokens include the prompt text', () => {
  const turns = [{ user: 'u'.repeat(1200), text: 'a'.repeat(1200) }]
  const plan = { shadowedTurns: 1, shadowedChars: 2400, tailTurns: 0 }
  const base = estimateSummaryCost(
    plan,
    normalizeCompressOptions({ mode: 'summary', summaryPrompt: { text: '保留要点。' } }),
    Date.now(),
    turns,
    false,
    null,
    null,
  )
  const custom = estimateSummaryCost(
    plan,
    normalizeCompressOptions({
      mode: 'summary',
      summaryPrompt: { text: '请保留所有关键决定和约束。'.repeat(80) },
    }),
    Date.now(),
    turns,
    false,
    null,
    null,
  )
  assert.ok(custom.inputTokens > base.inputTokens)
  assert.ok(custom.costCny >= base.costCny)
})

test('reasoning effort is validated and carried per import', () => {
  const high = normalizeCompressOptions({ mode: 'summary', reasoningEffort: 'high', summaryPrompt: { text: '保留要点。' } })
  assert.equal(high.reasoningEffort, 'high')
  const invalid = normalizeCompressOptions({ mode: 'summary', reasoningEffort: 'bogus', summaryPrompt: { text: '保留要点。' } })
  assert.ok(['off', 'low', 'high', 'max'].includes(invalid.reasoningEffort))
})

test('placeholder compression needs no prompt', () => {
  const options = normalizeCompressOptions({ mode: 'placeholder', retainTurns: 10 })
  assert.equal(options.mode, 'placeholder')
  assert.ok(options.summaryPrompt.text.length > 20)
})

console.log(`summary prompt tests: ${passed} passed`)
