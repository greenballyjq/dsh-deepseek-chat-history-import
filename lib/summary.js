/** summary — extracted from the original host entry. */
import { SUMMARY_CHUNK_RETRIES, SUMMARY_RETRY_DELAY_MS } from './constants.js'
import { recordSummaryChunk } from './calibrate.js'
import { buildSummaryChunks, tokenCostCny } from './planner.js'
import { buildSystemPrompt, buildUserPrompt, normalizeSummaryText, truncateSummaryText } from './summary-prompt.js'
import { modelRow, summaryChunkChars, summaryMaxTokensFloor, summaryMaxTokensPerChar } from './profile.js'
import { officialTokenCount } from './tokens.js'
import { roundCost } from './util.js'

/** One failed summary chunk, with enough context to keep the completed prefix. */
export class SummaryChunkError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'SummaryChunkError'
    this.retryable = details.retryable !== false
    this.chunkIndex = details.chunkIndex || 0
    this.fromTurn = details.fromTurn || 0
    this.toTurn = details.toTurn || 0
    this.attempts = details.attempts || 0
  }
}

function isRetryableSummaryError(error) {
  if (!error || error instanceof CancelledError || error.name === 'AbortError') return false
  if (error instanceof SummaryChunkError) return error.retryable
  const message = error instanceof Error ? error.message : String(error)
  return !/LLM 服务不可用|摘要模型没有配置|插件安装不完整|缺少摘要提示词/.test(message)
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Retry one chunk only for transient failures; fatal setup errors surface once. */
async function summarizeChunkWithRetry(wctx, options, chunk, signal) {
  let lastError = null
  for (let attempt = 0; attempt <= SUMMARY_CHUNK_RETRIES; attempt += 1) {
    try {
      return await summarizeChunk(wctx, options, chunk, signal)
    } catch (error) {
      if (signal && signal.aborted) throw error
      if (!isRetryableSummaryError(error) || attempt === SUMMARY_CHUNK_RETRIES) {
        if (error instanceof SummaryChunkError) {
          error.attempts = attempt + 1
          throw error
        }
        throw new SummaryChunkError(error instanceof Error ? error.message : String(error), {
          retryable: isRetryableSummaryError(error),
          attempts: attempt + 1,
        })
      }
      lastError = error
      if (SUMMARY_RETRY_DELAY_MS > 0) await delay(SUMMARY_RETRY_DELAY_MS)
    }
  }
  throw lastError
}


/** Summarize one chunk through the host LLM service. */
export async function summarizeChunk(wctx, options, chunk, signal) {
  const llm = typeof wctx.get === 'function' ? wctx.get('llm') : undefined
  if (!llm || typeof llm.stream !== 'function') {
    throw new SummaryChunkError('LLM 服务不可用', { retryable: false })
  }
  const modelProfile = modelRow(options.model)
  if (!modelProfile) throw new SummaryChunkError('摘要模型没有配置', { retryable: false })
  const system = buildSystemPrompt(options.summaryChars)
  const prompt = buildUserPrompt(options.summaryPrompt.text, chunk.text)
  const stream = llm.stream({
    provider: options.provider,
    model: options.model,
    system,
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    maxTokens: Math.max(summaryMaxTokensFloor(options.model), Math.round(options.summaryChars * summaryMaxTokensPerChar(options.model))),
    // Per-import choice; `off` keeps the original no-reasoning behavior.
    reasoningEffort: options.reasoningEffort,
    purpose: 'compaction',
    ...(signal ? { signal } : {}),
  })
  let text = ''
  let usage = null
  for await (const part of stream) {
    if (part.type === 'text-delta') text += part.text
    else if (part.type === 'usage') usage = part.usage
    else if (part.type === 'finish' && part.reason && part.reason.kind === 'error') {
      const failure = part.reason.failure || {}
      throw new SummaryChunkError(failure.message || '模型调用失败', { retryable: true })
    }
  }
  const trimmed = normalizeSummaryText(text)
  // A cancelled stream can end without throwing; the text collected so far is
  // an unfinished segment and must not be counted as generated.
  if (signal && signal.aborted) {
    const aborted = new Error('已停止导入')
    aborted.name = 'AbortError'
    throw aborted
  }
  if (trimmed.length === 0) throw new SummaryChunkError('模型返回空摘要', { retryable: true })
  return {
    text: truncateSummaryText(trimmed, options.summaryChars),
    usage,
    inputChars: system.length + prompt.length,
    officialTokens: officialTokenCount(system, options.model) + officialTokenCount(prompt, options.model),
  }
}

/** Thrown when the user cancels an import job between chunks. */
export class CancelledError extends Error {}


/**
 * Summarize every shadowed chunk and join the per-chunk summaries. A cancel
 * request stops the in-flight stream and, when `shouldKeep` answers true,
 * returns the chunks already finished instead of discarding the spend.
 */
export async function summarizeShadowed(wctx, turns, plan, options, onChunk, isCancelled, shouldKeep, signal) {
  const chunks = buildSummaryChunks(turns, plan, summaryChunkChars(options.model))
  if (chunks.length === 0) {
    return {
      text: '',
      usage: { inputTokens: 0, cacheReadTokens: 0, outputTokens: 0 },
      chunks: 0,
      done: 0,
      total: 0,
      aborted: false,
      costCny: 0,
      ranges: [],
      segments: [],
      failure: null,
    }
  }
  const parts = []
  let inputTokens = 0
  let cacheReadTokens = 0
  let outputTokens = 0
  let cacheWriteTokens = 0
  let costCny = 0
  const stop = () => {
    if (typeof shouldKeep === 'function' && shouldKeep()) return true
    throw new CancelledError('已停止导入')
  }
  const buildResult = (failure) => ({
    text: parts.join('\n\n'),
    usage: { inputTokens, cacheReadTokens, outputTokens },
    costCny,
    chunks: chunks.length,
    done: parts.length,
    total: chunks.length,
    aborted: Boolean(failure) || parts.length < chunks.length,
    ranges: chunks.slice(0, parts.length).map((chunk) => ({ fromTurn: chunk.fromTurn, toTurn: chunk.toTurn })),
    segments: chunks.slice(0, parts.length).map((chunk, index) => ({
      index: index + 1,
      fromTurn: chunk.fromTurn,
      toTurn: chunk.toTurn,
      text: parts[index],
      chars: parts[index].length,
    })),
    failure: failure || null,
  })
  outer: for (let index = 0; index < chunks.length; index += 1) {
    if (typeof isCancelled === 'function' && isCancelled()) {
      if (stop()) break outer
    }
    let result
    const startedAt = Date.now()
    try {
      result = await summarizeChunkWithRetry(wctx, options, chunks[index], signal)
    } catch (error) {
      if (signal && signal.aborted) {
        if (stop()) break outer
      }
      if (error instanceof CancelledError) throw error
      const message = error instanceof Error ? error.message : String(error)
      const failure = {
        message,
        chunkIndex: index + 1,
        fromTurn: chunks[index].fromTurn,
        toTurn: chunks[index].toTurn,
        attempts: error && error.attempts ? error.attempts : 1,
        retryable: !(error && error.retryable === false),
      }
      if (parts.length === 0) {
        throw new SummaryChunkError('摘要第 ' + failure.chunkIndex + ' 段（第 '
          + failure.fromTurn + '–' + failure.toTurn + ' 轮）失败：' + message, failure)
      }
      return buildResult(failure)
    }
    // An abort that lands right after the stream ends still means the segment
    // was interrupted; only the segments already in `parts` count.
    if (signal && signal.aborted) {
      if (stop()) break outer
    }
    parts.push(result.text)
    if (result.usage) {
      const usage = result.usage
      const promptTokens = Number(usage.inputTokens || 0) + Number(usage.cacheReadTokens || 0) + Number(usage.cacheWriteTokens || 0)
      if (promptTokens > 0) {
        try {
          recordSummaryChunk(options.model, {
            officialTokens: Number(result.officialTokens) || 0,
            level: Number(options.summaryChars) || 0,
            chunkChars: Number(chunks[index] && chunks[index].text ? chunks[index].text.length : 0),
            inputChars: Number(result.inputChars) || 0,
            inputTokens: promptTokens,
            cacheHit: Number(usage.cacheReadTokens || 0) + Number(usage.cacheWriteTokens || 0),
            outputTokens: Number(usage.outputTokens || 0),
            outputChars: result.text.length,
            seconds: (Date.now() - startedAt) / 1000,
            reused: Boolean(options.reused),
          })
        } catch {
          // Calibration is optional; a failed local sample must not discard the summary.
        }
      }
      inputTokens += result.usage.inputTokens || 0
      cacheReadTokens += result.usage.cacheReadTokens || 0
      outputTokens += result.usage.outputTokens || 0
      cacheWriteTokens += result.usage.cacheWriteTokens || 0
      // Price each chunk at the moment it finished, so an import that crosses
      // a peak window boundary is charged the right half for each side.
      costCny += tokenCostCny(options.model, result.usage, Date.now())
    }
    if (typeof onChunk === 'function') {
      onChunk({
        done: index + 1,
        total: chunks.length,
        text: result.text,
        inputTokens,
        cacheReadTokens,
        outputTokens,
        costCny: roundCost(costCny),
      })
    }
    if (typeof isCancelled === 'function' && isCancelled()) {
      if (stop()) break outer
    }
  }
  return buildResult(null)
}


/* ------------------------------------------------------------------ *
 * In-place repair of already-imported oversized sessions.
 * ------------------------------------------------------------------ */

