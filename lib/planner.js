/** planner — extracted from the original host entry. */
import { overheadFor, summaryCalibration } from './calibrate.js'
import { DEFAULT_KEEP_THINKING, DEFAULT_MAX_COST_CNY, DEFAULT_RETAIN_TURNS, LIMITS, MEMORY_MODES } from './constants.js'
import { budgetRatio, cjkPerChar, defaultReasoningEffort, defaultSummaryChars, estimationParam, getProfile, modelRow, normalizeReasoningEffort, resolveModelId, summaryChunkChars, summaryOutputRatio, summaryPromptTokens } from './profile.js'
import { buildSystemPrompt, normalizePrompt } from './summary-prompt.js'
import { estimateTextTokens, officialTokenCount, summaryCharToToken } from './tokens.js'
import { clampNumber, roundCost } from './util.js'

/**
 * Price one turn. `tokens` is what the imported conversation costs in the model
 * context (user text, assistant text and reasoning). `summaryTokens` excludes
 * the assistant reasoning, which the summarizer never receives.
 */
export function priceTurn(turn, modelId) {
  let tokens = 0
  let summaryTokens = 0
  if (turn.user) {
    const priced = estimateTextTokens(turn.user, modelId) + estimationParam('messageOverhead', 4, modelId)
    tokens += priced
    summaryTokens += priced
  }
  if (turn.think) tokens += estimateTextTokens(turn.think, modelId) + estimationParam('messageOverhead', 4, modelId)
  if (turn.text) {
    const priced = estimateTextTokens(turn.text, modelId) + estimationParam('messageOverhead', 4, modelId)
    tokens += priced
    summaryTokens += priced
  }
  return { tokens, summaryTokens }
}


export function normalizeCompressOptions(input) {
  const raw = input && typeof input === 'object' ? input : {}
  const profile = getProfile()
  const models = profile ? profile.models : {}
  const requested = typeof raw.model === 'string' && raw.model ? raw.model : ''
  const known = requested && models[requested] ? requested : ''
  const fallbackModel = profile ? profile.defaultModel : ''
  const model = known || requested || fallbackModel
  const modelProfile = models[model] || (fallbackModel ? models[fallbackModel] : null)
  const requestedMode = typeof raw.mode === 'string' ? raw.mode : ''
  const mode = MEMORY_MODES.some((item) => item.id === requestedMode) ? requestedMode : 'placeholder'
  return {
    mode,
    keepThinking: raw.keepThinking === undefined ? DEFAULT_KEEP_THINKING : raw.keepThinking === true,
    retainTurns: clampNumber(raw.retainTurns, DEFAULT_RETAIN_TURNS, LIMITS.retainTurns[0], LIMITS.retainTurns[1]),
    summaryChars: clampNumber(raw.summaryChars, defaultSummaryChars(model), LIMITS.summaryChars[0], LIMITS.summaryChars[1]),
    maxCostCny: Math.min(LIMITS.maxCostCny[1], Math.max(LIMITS.maxCostCny[0], Number.isFinite(Number(raw.maxCostCny)) ? Number(raw.maxCostCny) : DEFAULT_MAX_COST_CNY)),
    summaryPrompt: normalizePrompt(raw.summaryPrompt),
    reasoningEffort: typeof raw.reasoningEffort === 'string' && raw.reasoningEffort
      ? normalizeReasoningEffort(raw.reasoningEffort)
      : defaultReasoningEffort(),
    provider: (modelProfile && modelProfile.provider) || (typeof raw.provider === 'string' && raw.provider ? raw.provider : ''),
    model,
    modelInvalid: requested && !known ? requested : '',
  }
}


/** Upper-bound tokens the checkpoint summary can occupy in the model context. */
function summaryContextTokens(shadowedChars, options) {
  if (options.mode !== 'summary') return 200
  const chunks = Math.max(1, Math.ceil(shadowedChars / summaryChunkChars(options.model)))
  return Math.round(chunks * options.summaryChars * estimationParam('summaryFactor', 2, options.model) * summaryCharToToken(options.model))
}


/** Try one retained-turn count against the context budget. */
function solvePlan(turnInfo, options, budget, retainTurns) {
  const cut = Math.max(0, turnInfo.length - retainTurns)
  if (cut <= 0) return null
  const tailTokens = turnInfo.slice(cut).reduce((sum, info) => sum + (info.tokens || 0), 0)
  const shadowedChars = turnInfo.slice(0, cut).reduce((sum, info) => sum + info.chars, 0)
  const summaryTokens = summaryContextTokens(shadowedChars, options)
  const totalTokens = tailTokens + summaryTokens + overheadFor(options.model)
  return { retainTurns, cut, tailTokens, shadowedChars, summaryTokens, totalTokens, fits: totalTokens <= budget }
}


/** Turn a solved retention into the checkpoint plan consumed by the writer. */
function buildPlan(turnInfo, solved) {
  const shadowedTurns = turnInfo.slice(0, solved.cut)
  const surface = shadowedTurns.filter((info) => info.userSeq !== null || info.assistantSeq !== null)
  const shadowedSeqs = []
  for (const info of surface) {
    if (info.userSeq !== null) shadowedSeqs.push(info.userSeq)
    if (info.assistantSeq !== null) shadowedSeqs.push(info.assistantSeq)
  }
  return {
    start: shadowedSeqs.length > 0 ? shadowedSeqs[0] : null,
    end: shadowedSeqs.length > 0 ? shadowedSeqs[shadowedSeqs.length - 1] : null,
    shadowedSeqs,
    shadowedTurns: shadowedTurns.length,
    tailTurns: turnInfo.length - solved.cut,
    shadowedTokens: shadowedTurns.reduce((sum, info) => sum + (info.tokens || 0), 0),
    shadowedSummaryTokens: shadowedTurns.reduce((sum, info) => sum + (info.summaryTokens || 0), 0),
    shadowedChars: shadowedTurns.reduce((sum, info) => sum + info.chars, 0),
    tailTokens: solved.tailTokens,
    summaryTokens: solved.summaryTokens,
    contextTotalTokens: solved.totalTokens,
    contextBudgetTokens: 0,
    effectiveRetainTurns: solved.retainTurns,
    adjusted: false,
  }
}


/**
 * The largest retention that fits the context budget. More retained turns mean
 * a larger tail but a smaller summary, so the search verifies the candidates
 * around the boundary as well.
 */
function fitRetention(turnInfo, options, budget, floor) {
  const highest = Math.max(floor, Math.min(options.retainTurns, turnInfo.length - 1))
  const fits = (retain) => {
    const solved = solvePlan(turnInfo, options, budget, retain)
    return solved && solved.fits ? solved : null
  }
  const direct = fits(highest)
  if (direct) return { solved: direct, adjusted: highest !== options.retainTurns }
  if (!fits(floor)) return { solved: null, adjusted: true }
  let low = floor
  let high = highest
  let best = null
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const solved = fits(mid)
    if (solved) {
      best = solved
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  // The token total is not strictly monotonic (tail grows as the summary
  // shrinks), so a few larger candidates are verified before settling.
  for (let retain = best ? best.retainTurns + 1 : floor; retain <= highest && retain <= (best ? best.retainTurns + 3 : floor + 3); retain += 1) {
    const solved = fits(retain)
    if (solved) best = solved
  }
  return { solved: best, adjusted: true }
}


/**
 * Decide whether the conversation needs a checkpoint and produce one that fits
 * the model context budget. Compression happens when the retained-turn cap is
 * below the conversation length, or when keeping everything would exceed the
 * budget. Returns `none`, a `plan`, or a `refuse` reason.
 */
export function planCompression(turnInfo, options, contextWindow) {
  const totalTokens = turnInfo.reduce((sum, info) => sum + (info.tokens || 0), 0)
  const budget = Math.floor(contextWindow * budgetRatio(options.model))
  const coversAll = options.retainTurns >= turnInfo.length
  if (coversAll && totalTokens + overheadFor(options.model) <= budget) {
    return { kind: 'none', reason: 'covers', contextTokens: totalTokens + overheadFor(options.model) }
  }
  const forced = coversAll
  const configuredFloor = Math.floor(Number((modelRow(options.model) || {}).context && (modelRow(options.model) || {}).context.minRetainTurns) || 4)
  const floor = Math.max(1, Math.min(options.retainTurns, configuredFloor))
  const primary = fitRetention(turnInfo, options, budget, floor)
  if (primary.solved && primary.solved.fits) {
    const plan = buildPlan(turnInfo, primary.solved)
    if (!plan) return { kind: 'none', reason: 'covers', contextTokens: totalTokens + overheadFor(options.model) }
    plan.contextBudgetTokens = budget
    plan.adjusted = primary.adjusted
    return { kind: 'plan', plan, options, degradedFromSummary: false, forced }
  }
  // A summary that cannot fit falls back to the placeholder checkpoint, which
  // adds almost nothing to the context.
  if (options.mode === 'summary') {
    const placeholderOptions = { ...options, mode: 'placeholder' }
    const fallback = fitRetention(turnInfo, placeholderOptions, budget, floor)
    if (fallback.solved && fallback.solved.fits) {
      const plan = buildPlan(turnInfo, fallback.solved)
      if (plan) {
        plan.contextBudgetTokens = budget
        plan.adjusted = true
        return { kind: 'plan', plan, options: placeholderOptions, degradedFromSummary: true, forced }
      }
    }
  }
  const lastTurnTokens = turnInfo.length > 0 ? (turnInfo[turnInfo.length - 1].tokens || 0) : 0
  const minimumTailTokens = lastTurnTokens + estimationParam('tailSafety', 200, options.model) + overheadFor(options.model)
  return {
    kind: 'refuse',
    reason: minimumTailTokens > budget
      ? '该对话单轮内容已超过模型上下文上限（' + Math.round(budget / 1000) + 'K tokens），无法导入'
      : '该对话按当前设置无法放入模型上下文（上限 ' + Math.round(budget / 1000) + 'K tokens）；请降低保留轮数',
  }
}


/** Resolve the model window for the configured route, with a safe fallback. */
export async function resolveContextWindow(wctx, options) {
  try {
    const llm = typeof wctx.get === 'function' ? wctx.get('llm') : undefined
    if (llm && typeof llm.resolveModelInfo === 'function') {
      const info = await llm.resolveModelInfo(options.provider, options.model)
      if (info && info.context && Number.isFinite(info.context.contextWindow)) return info.context.contextWindow
    }
  } catch {
    // Fall back to the profile's window below.
  }
  const row = modelRow(options.model)
  const configured = row && row.context ? Number(row.context.window) : NaN
  return Number.isFinite(configured) && configured > 0 ? configured : 1_048_576
}


/** Fixed checkpoint text containing no conversation content. */
export function placeholderSummary(plan, title) {
  return '【导入记录】较早的 ' + plan.shadowedTurns + ' 轮对话已丢弃，保留最近 ' + plan.tailTurns
    + ' 轮原文。对话主题：' + (title || '（无标题）') + '。'
}


/** One turn rendered as summarizer input. */
function turnText(turn) {
  const parts = []
  if (turn.user) parts.push('用户：' + turn.user)
  if (turn.text) parts.push('助手：' + turn.text)
  return parts.join('\n\n')
}


/** Split the shadowed turns into summarization chunks by character budget. */
export function buildSummaryChunks(turns, plan, chunkChars) {
  const chunks = []
  let current = []
  let currentChars = 0
  let fromTurn = 1
  for (let index = 0; index < plan.shadowedTurns; index += 1) {
    const text = turnText(turns[index])
    if (text.length === 0) continue
    if (current.length > 0 && currentChars + text.length > chunkChars) {
      chunks.push({ text: current.join('\n\n'), fromTurn, toTurn: index })
      current = []
      currentChars = 0
      fromTurn = index + 1
    }
    current.push(text)
    currentChars += text.length
  }
  if (current.length > 0) chunks.push({ text: current.join('\n\n'), fromTurn, toTurn: plan.shadowedTurns })
  return chunks
}


/** Minutes since midnight for an "HH:MM" profile value. */
function clockMinutes(value) {
  const [hours, minutes] = String(value || '00:00').split(':').map(Number)
  return (Number(hours) || 0) * 60 + (Number(minutes) || 0)
}


/**
 * Whether one instant falls in a model's peak window. Statutory holidays are
 * not detected: a weekday inside a peak window is priced as peak.
 */
export function isDeepSeekPeak(atMs, modelId) {
  const row = modelRow(resolveModelId(modelId))
  if (!row) return true
  const pricing = row.pricing
  let parts
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: pricing.timeZone || 'Asia/Shanghai',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(Number(atMs) || Date.now()))
  } catch {
    // An unusable time zone prices as peak, which is the conservative side.
    return true
  }
  const read = (type) => {
    const entry = parts.find((part) => part.type === type)
    return entry ? entry.value : ''
  }
  const weekday = read('weekday')
  const isoDay = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[weekday] || 0
  if (isoDay === 0 || isoDay === 6 || isoDay === 7) return false
  const minutes = Number(read('hour')) * 60 + Number(read('minute'))
  for (const window of pricing.peakWindows || []) {
    if (!Array.isArray(window.days) || !window.days.includes(isoDay)) continue
    if (minutes >= clockMinutes(window.from) && minutes < clockMinutes(window.to)) return true
  }
  return false
}


/**
 * Cost of one usage block in yuan from the model's profile prices. The host
 * reports `inputTokens` as cache-miss input only (cached tokens arrive
 * separately in `cacheReadTokens`), so the two are priced apart.
 */
export function tokenCostCny(model, usage, atMs) {
  const row = modelRow(model)
  if (!row) return 0
  const pricing = row.pricing
  const window = isDeepSeekPeak(atMs, model) ? pricing.peak : pricing.offPeak
  const miss = Math.max(0, usage.inputTokens || 0)
  const hit = Math.max(0, usage.cacheReadTokens || 0)
  const output = Math.max(0, usage.outputTokens || 0)
  return (miss * window.cacheMiss + hit * window.cacheHit + output * window.output) / 1_000_000
}


/** Pre-call cost estimate: this gate runs before any model call. */
export function estimateSummaryCost(plan, options, atMs, turns, samePlan, previousUsage, previousCost) {
  const at = Number(atMs) || Date.now()
  const observed = summaryCalibration(options.model) || {}
  const chunkBudget = summaryChunkChars(options.model)
  const measuredPromptTokens = Math.round(officialTokenCount(buildSystemPrompt(options.summaryPrompt.text, options.summaryChars), options.model))
  const promptTokensPerChunk = Math.max(0, measuredPromptTokens || Math.round(Number(summaryPromptTokens(options.model)) || 0))

  let chunks = []
  if (Array.isArray(turns) && turns.length > 0) {
    chunks = buildSummaryChunks(turns, plan, chunkBudget)
  }
  let sizes = chunks.map((chunk) => chunk.text.length)
  if (sizes.length === 0) {
    const count = Math.max(1, Math.ceil(plan.shadowedChars / chunkBudget))
    sizes = new Array(count).fill(plan.shadowedChars / count)
  }

  if (!previousUsage && Number(previousCost) > 0) {
    return {
      chunks: sizes.length,
      inputTokens: 0,
      outputTokens: 0,
      costCny: roundCost(Number(previousCost)),
      cacheHitRatio: 1,
      outputTokensPerSegment: 0,
      peak: isDeepSeekPeak(at),
    }
  }

  if (previousUsage && previousUsage.input > 0) {
    const input = Number(previousUsage.input) || 0
    const output = Number(previousUsage.output) || 0
    const warmCost = tokenCostCny(options.model, { inputTokens: 0, cacheReadTokens: input, outputTokens: output }, at)
    return {
      chunks: sizes.length,
      inputTokens: input,
      outputTokens: output,
      costCny: roundCost(warmCost),
      cacheHitRatio: 1,
      outputTokensPerSegment: output / Math.max(1, sizes.length),
      peak: isDeepSeekPeak(at),
    }
  }

  const fallbackTokensPerChar = cjkPerChar(options.model)
  const inputScale = Number(observed.inputScale) > 0
    ? Number(observed.inputScale)
    : Number(estimationParam('inputScale', 1, options.model)) || 1
  const coldHitRatio = Number.isFinite(Number(observed.coldHitRatio))
    ? Math.min(1, Math.max(0, Number(observed.coldHitRatio)))
    : Math.min(1, Math.max(0, Number(estimationParam('coldCacheHitRatio', 0, options.model)) || 0))
  const warmHitRatio = Number.isFinite(Number(observed.warmHitRatio))
    ? Math.min(1, Math.max(0, Number(observed.warmHitRatio)))
    : Math.min(1, Math.max(0, Number(estimationParam('warmCacheHitRatio', 0.95, options.model)) || 0.95))
  const hitRatio = samePlan ? warmHitRatio : coldHitRatio
  const outputScale = Number(observed.outputScale) > 0
    ? Number(observed.outputScale)
    : Number(estimationParam('outputScale', 1, options.model)) || 1

  let inputTokens = 0
  let outputTokens = 0
  let costCny = 0
  const officialSizes = chunks.length > 0
    ? chunks.map((chunk) => officialTokenCount(chunk.text, options.model))
    : sizes.map((chars) => chars * fallbackTokensPerChar)
  for (let i = 0; i < officialSizes.length; i += 1) {
    const chunkInput = Math.round(officialSizes[i] * inputScale) + promptTokensPerChunk
    const hit = Math.round(chunkInput * hitRatio)
    const miss = chunkInput - hit
    const chunkChars = sizes[i]
    const outputChars = Math.min(
      options.summaryChars,
      Math.max(Number(estimationParam('minOutputChars', 120, options.model)) || 120, chunkChars * summaryOutputRatio(options.model)),
    )
    const output = Math.round(outputChars * fallbackTokensPerChar * outputScale)
    inputTokens += chunkInput
    outputTokens += output
    costCny += tokenCostCny(options.model, { inputTokens: miss, cacheReadTokens: hit, outputTokens: output }, at)
  }

  return {
    chunks: sizes.length,
    inputTokens,
    outputTokens,
    costCny: roundCost(costCny),
    cacheHitRatio: hitRatio,
    outputTokensPerSegment: outputTokens / Math.max(1, sizes.length),
    peak: isDeepSeekPeak(at),
  }
}
