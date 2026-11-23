import assert from 'node:assert/strict'
import {
  DEFAULT_SUMMARY_PROMPT_PRESET,
  MAX_SUMMARY_PROMPT_CHARS,
  SUMMARY_PROMPT_PRESETS,
  buildSummaryPrompt,
  normalizeSummaryPrompt,
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

test('defaults to the neutral preset', () => {
  const prompt = normalizeSummaryPrompt(undefined)
  assert.equal(prompt.preset, DEFAULT_SUMMARY_PROMPT_PRESET)
  assert.equal(prompt.label, '中性')
  assert.ok(prompt.text.length > 20)
})

test('known presets use the host text and ignore edited text', () => {
  const prompt = normalizeSummaryPrompt({ preset: 'technical', text: 'this is ignored' })
  assert.equal(prompt.preset, 'technical')
  assert.equal(prompt.label, '技术 / 工作')
  assert.notEqual(prompt.text, 'this is ignored')
  assert.ok(prompt.text.includes('代码'))
})

test('custom text is preserved and labelled custom', () => {
  const prompt = normalizeSummaryPrompt({ preset: 'custom', text: '  保留所有关键决定。  ' })
  assert.equal(prompt.preset, 'custom')
  assert.equal(prompt.label, '自定义')
  assert.equal(prompt.text, '保留所有关键决定。')
})

test('an unknown preset with text falls back to custom', () => {
  const prompt = normalizeSummaryPrompt({ preset: 'unknown', text: '自定义内容' })
  assert.equal(prompt.preset, 'custom')
  assert.equal(prompt.text, '自定义内容')
})

test('empty custom text is rejected', () => {
  assert.throws(() => normalizeSummaryPrompt({ preset: 'custom', text: '   ' }), /不能为空/)
})

test('overlong custom text is rejected', () => {
  assert.throws(
    () => normalizeSummaryPrompt({ preset: 'custom', text: 'x'.repeat(MAX_SUMMARY_PROMPT_CHARS + 1) }),
    /不能超过/,
  )
})

test('the fixed guard is appended and carries the limit', () => {
  const system = buildSummaryPrompt({ preset: 'custom', text: '只保留要点' }, 1500)
  assert.ok(system.startsWith('只保留要点'))
  assert.ok(system.includes('系统约束'))
  assert.ok(system.includes('不超过 1500 字'))
  assert.ok(system.includes('纯文本'))
})

test('a legacy placeholder is replaced and leaves no variable', () => {
  const system = buildSummaryPrompt({ preset: 'custom', text: '写 {{limit}} 字以内' }, 800)
  assert.ok(system.includes('写 800 字以内'))
  assert.ok(!system.includes('{{limit}}'))
  assert.ok(system.includes('不超过 800 字'))
})

test('every preset has no placeholder and no fixed-guard leakage', () => {
  for (const preset of SUMMARY_PROMPT_PRESETS) {
    assert.ok(!preset.text.includes('{{limit}}'))
    assert.ok(!preset.text.includes('系统约束'))
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

test('compress options carry the normalized prompt', () => {
  const options = normalizeCompressOptions({
    mode: 'summary',
    summaryPrompt: { preset: 'narrative', text: 'ignored' },
  })
  assert.equal(options.summaryPrompt.preset, 'narrative')
  assert.equal(options.summaryPrompt.label, '叙事 / 角色扮演')
  assert.ok(options.summaryPrompt.text.includes('剧情'))
  assert.throws(
    () => normalizeCompressOptions({ mode: 'summary', summaryPrompt: { preset: 'custom', text: '' } }),
    /不能为空/,
  )
})

test('estimate input tokens include the custom prompt and guard', () => {
  const turns = [{ user: 'u'.repeat(1200), text: 'a'.repeat(1200) }]
  const plan = { shadowedTurns: 1, shadowedChars: 2400, tailTurns: 0 }
  const base = estimateSummaryCost(
    plan,
    normalizeCompressOptions({ mode: 'summary', summaryPrompt: { preset: 'neutral' } }),
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
      summaryPrompt: { preset: 'custom', text: '请保留所有关键决定和约束。'.repeat(80) },
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

console.log(`summary prompt tests: ${passed} passed`)
