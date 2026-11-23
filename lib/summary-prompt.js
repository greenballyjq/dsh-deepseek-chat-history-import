/**
 * Summary prompt presets and composition.
 *
 * The text the user sees and edits is only the content instruction. Host code
 * appends the fixed output constraints (plain text, language, length) after
 * rendering, so a custom prompt cannot remove the length guard by dropping a
 * placeholder.
 */
import { createHash } from 'node:crypto'

export const DEFAULT_SUMMARY_PROMPT_PRESET = 'neutral'

export const MAX_SUMMARY_PROMPT_CHARS = 4000

export const SUMMARY_PROMPT_PRESETS = Object.freeze([
  {
    id: 'neutral',
    name: '中性',
    description: '忠实压缩，适合大多数对话',
    text: '请忠实压缩这段对话，保留：用户的目标与背景、关键事实、已确认的决定与约束、未完成事项与待确认问题、重要数字/名称/链接/结论。不要加入原文没有的内容，不要评价，不要续写；用对话原本的语言，按对话顺序写。',
  },
  {
    id: 'narrative',
    name: '叙事 / 角色扮演',
    description: '保留剧情、人物关系与设定',
    text: '请保留这段对话的主要剧情、人物设定与关系、场景与世界观、用户偏好与约定、未完成的情节线，以及反复出现的梗。不要评价，不要续写，不要加入原文没有的内容；用对话原本的语言，按时间顺序写。',
  },
  {
    id: 'technical',
    name: '技术 / 工作',
    description: '保留目标、决策、代码与未完成事项',
    text: '请保留这段技术/工作对话的目标、背景、约束、已做的决定、代码/命令/配置、错误与修复过程、验证结果、未完成任务和下一步。保留关键标识符、数字与链接，不要编造；用对话原本的语言，按对话顺序写。',
  },
])

const PRESET_BY_ID = new Map(SUMMARY_PROMPT_PRESETS.map((preset) => [preset.id, preset]))

/**
 * Stable short fingerprint of the resolved prompt text. Session metadata stores
 * this instead of the user's custom prompt, so reusing a previous cost sample
 * does not require writing personal instructions to disk.
 */
export function summaryPromptFingerprint(text) {
  return createHash('sha256').update(String(text || ''), 'utf8').digest('hex').slice(0, 12)
}

function presetResult(preset) {
  return {
    preset: preset.id,
    label: preset.name,
    text: preset.text,
    fingerprint: summaryPromptFingerprint(preset.text),
  }
}

/**
 * Resolve the request's prompt selection.
 *
 * Missing input falls back to the neutral preset. A known preset ID uses the
 * host's canonical text; any edited text is a custom prompt. Custom text must
 * be non-empty and is capped before it reaches the model.
 */
export function normalizeSummaryPrompt(input) {
  if (typeof input === 'string') {
    input = { preset: 'custom', text: input }
  }
  const raw = input && typeof input === 'object' ? input : {}
  const presetId = typeof raw.preset === 'string' ? raw.preset.trim() : ''
  const preset = PRESET_BY_ID.get(presetId)
  if (preset && presetId !== 'custom') return presetResult(preset)

  const text = typeof raw.text === 'string' ? raw.text.trim() : ''
  if (!text) {
    if (presetId === 'custom') {
      throw new Error('摘要提示词不能为空')
    }
    const fallback = PRESET_BY_ID.get(DEFAULT_SUMMARY_PROMPT_PRESET)
    return presetResult(fallback)
  }
  if (text.length > MAX_SUMMARY_PROMPT_CHARS) {
    throw new Error('摘要提示词不能超过 ' + MAX_SUMMARY_PROMPT_CHARS + ' 字')
  }
  return {
    preset: 'custom',
    label: '自定义',
    text,
    fingerprint: summaryPromptFingerprint(text),
  }
}

/** The non-editable, never-displayed output constraints. */
export function summaryGuardText(limit) {
  return '\n\n【系统约束，优先于以上内容】只输出纯文本，不要标题、前言或套话；使用对话原本的语言；不超过 '
    + limit + ' 字。'
}

/**
 * Compose the system prompt: visible user text followed by the host guard.
 * Legacy `{{limit}}` placeholders are replaced for compatibility, but new
 * presets and custom prompts do not need one.
 */
export function buildSummaryPrompt(input, limit) {
  const prompt = normalizeSummaryPrompt(input)
  const body = prompt.text.replace(/\{\{limit\}\}/g, String(limit))
  return body + summaryGuardText(limit)
}

/** Strict post-generation length guard; the prompt instruction is advisory. */
export function truncateSummaryText(text, limit) {
  const value = String(text || '').trim()
  const max = Math.max(1, Math.round(Number(limit) || 1))
  return value.length > max ? value.slice(0, max).trimEnd() : value
}

/** Human-readable label for session metadata. */
export function summaryPromptLabel(input) {
  return normalizeSummaryPrompt(input).label
}

/** Fingerprint used to invalidate reuse when a custom prompt changes. */
export function summaryPromptId(input) {
  return normalizeSummaryPrompt(input).fingerprint
}

/** Serialisable preset list for the profile route. */
export function summaryPromptPresets() {
  return SUMMARY_PROMPT_PRESETS.map(({ id, name, description, text }) => ({ id, name, description, text }))
}
