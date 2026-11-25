/** session — extracted from the original host entry. */
import fs from 'node:fs'
import path from 'node:path'
import { CONTRACT, MAX_WORKSPACE_NAME_CHARS, MEMORY_DIR_NAME, MEMORY_MANIFEST_FILE } from './constants.js'
import { buildMemoryNotice, memoryRelativePath, writeMemory } from './memory.js'
import { readAnyReferenceSystemPrompt } from './log.js'
import { estimateSummaryCost, isDeepSeekPeak, normalizeCompressOptions, placeholderSummary, planCompression, priceTurn, resolveContextWindow } from './planner.js'
import { budgetRatio, resolveDshHome, resolveImportRoot } from './profile.js'
import { CancelledError, summarizeShadowed } from './summary.js'
import { randomId, roundCost } from './util.js'

/**
 * Build the durable events for one import: one turn per user/assistant
 * exchange with the original timestamps and a single session/title event after
 * the first user message. `summary` turns the log into a pre-compacted one:
 * the head, then the summary message, then only the kept turns. The dropped
 * turns are never written, so they cannot be scrolled back to, submitted, or
 * branched from.
 */
export function buildSessionEvents(id, title, turns, headText, meter, summary, modelId) {
  const events = []
  let seq = 0
  let turnNumber = 0
  let titleWritten = false
  const turnInfo = []

  const push = (type, data, time, surfaceOp, sourceEventSeqs) => {
    const event = { type, seq: seq++, time, data }
    if (surfaceOp) event.surfaceOp = surfaceOp
    if (sourceEventSeqs) event.sourceEventSeqs = sourceEventSeqs
    events.push(event)
    return event
  }

  for (const turn of turns) {
    turnNumber += 1
    const time = Number.isFinite(turn.time) && turn.time > 0 ? Math.round(turn.time) : Date.now()
    push('turn/start', { turn: turnNumber }, time)
    push('step/start', { turn: turnNumber, step: 1 }, time)
    if (turnNumber === 1) {
      // DSH requires the first surface node to be a system message head. Use
      // the exact rendered system prompt this host produced for a sibling
      // session in the same workspace: the agent loop only skips its update
      // when the stored head text equals the rendered prompt, otherwise it
      // appends a second system message mid-surface and the log turns invalid.
      push('system/message', {
        turn: 1,
        step: 1,
        message: {
          role: 'system',
          content: [{ type: 'text', text: headText || '' }],
          source: { kind: 'system-prompt' },
          id: randomId(),
        },
      }, time, 'append')
      if (summary && summary.text) {
        push('user/message', {
          role: 'user',
          id: randomId(),
          content: [{ type: 'text', text: summary.text }],
          source: summary.source,
        }, time, 'append')
      }
    }
    const info = { userSeq: null, assistantSeq: null, chars: 0 }
    let userSeq = null
    const userContent = []
    if (turn.user) userContent.push({ type: 'text', text: turn.user })
    if (Array.isArray(turn.attachments) && turn.attachments.length > 0) userContent.push(...turn.attachments)
    if (userContent.length > 0) {
      userSeq = seq
      push('user/message', {
        role: 'user',
        id: randomId(),
        content: userContent,
        source: { kind: 'user' },
      }, time, 'append')
      info.userSeq = userSeq
      info.chars += turn.user.length
    }
    if (!titleWritten && userSeq !== null) {
      push('session/title', {
        title,
        messageSeqs: [userSeq],
        source: { kind: 'fallback' },
      }, time)
      titleWritten = true
    }
    const notes = Array.isArray(turn.notes) ? turn.notes : []
    const assistantText = [turn.text, ...notes].filter(Boolean).join('\n\n').trim()
    const content = []
    if (turn.think) content.push({ type: 'reasoning', text: turn.think })
    if (assistantText) content.push({ type: 'text', text: assistantText })
    if (content.length > 0) {
      info.assistantSeq = seq
      push('assistant/message', {
        turn: turnNumber,
        step: 1,
        message: {
          role: 'assistant',
          id: randomId(),
          content,
          source: { kind: 'model', provider: 'deepseek-web', model: 'deepseek-chat' },
        },
        stream: [],
      }, time + 1, 'append')
      info.chars += turn.think.length + assistantText.length
    }
    push('step/end', { turn: turnNumber, step: 1 }, time + 2)
    push('turn/end', { turn: turnNumber, reason: { kind: 'completed' } }, time + 3)
    const priced = priceTurn(turn, modelId)
    info.tokens = priced.tokens
    info.summaryTokens = priced.summaryTokens
    turnInfo.push(info)
  }

  return { id, title, events, turnInfo, nextSeq: seq }
}

/* ------------------------------------------------------------------ *
 * Compression planning: placeholder or model-generated summary.
 * ------------------------------------------------------------------ */


/** Whether this conversation was imported before (its workspace directory exists). */
export function importedBefore(title) {
  try {
    return fs.existsSync(path.join(resolveImportRoot(), sanitizeWorkspaceName(title)))
  } catch {
    return false
  }
}

/**
 * Last completed summary usage recorded by the unified memory manifest.
 * Returns null when no manifest matches the requested plan.
 */
function summaryUsageFromManifest(root, base, plan, summaryChars, summaryPrompt) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const name = entry.name
    if (name !== base && !name.startsWith(base + ' (')) continue
    const file = path.join(root, name, MEMORY_DIR_NAME, MEMORY_MANIFEST_FILE)
    if (!fs.existsSync(file)) continue
    let manifest
    try {
      manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      continue
    }
    if (!manifest || manifest.kind !== 'summary' || !manifest.turns || !manifest.summary) continue
    if (manifest.summary.partial) continue
    if (Number(manifest.turns.total) !== plan.tailTurns + plan.shadowedTurns) continue
    if (Number(manifest.turns.archived) !== plan.shadowedTurns) continue
    const chars = Number(manifest.summary.chars)
    if (Number.isFinite(summaryChars) && chars !== Number(summaryChars)) continue
    const prompt = manifest.summary.prompt || {}
    if (summaryPrompt && prompt.name && prompt.name !== summaryPrompt.name) continue
    if (summaryPrompt && prompt.fingerprint && summaryPrompt.fingerprint && prompt.fingerprint !== summaryPrompt.fingerprint) continue
    const usage = manifest.summary.usage
    if (!usage) continue
    return {
      matched: true,
      summaryChars: chars,
      input: Number(usage.inputTokens || 0) + Number(usage.cacheReadTokens || 0),
      output: Number(usage.outputTokens || 0),
    }
  }
  return null
}


/**
 * Last completed summary usage for this conversation, when the plan matches.
 * Reads the unified manifest first, then legacy summary records.
 */
export function lastSummaryUsage(title, plan, summaryChars, summaryPrompt) {
  try {
    const base = sanitizeWorkspaceName(title)
    const root = resolveImportRoot()
    if (!fs.existsSync(root)) return null
    const manifestUsage = summaryUsageFromManifest(root, base, plan, summaryChars, summaryPrompt)
    if (manifestUsage) return manifestUsage
    const candidates = []
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const name = entry.name
      if (name !== base && !name.startsWith(base + ' (')) continue
      const file = path.join(root, name, 'deepseek-import-summary.md')
      if (!fs.existsSync(file)) continue
      candidates.push({ file, mtime: fs.statSync(file).mtimeMs })
    }
    candidates.sort((a, b) => b.mtime - a.mtime)
    for (const candidate of candidates) {
      const text = fs.readFileSync(candidate.file, 'utf8')
      if (text.includes('未生成摘要')) continue
      const retain = /- 保留轮数：(\d+) \/ (\d+)/.exec(text)
      const level = /- 摘要长度：(\d+)/.exec(text)
      const usage = /- 实际用量：未命中 (\d+)、缓存命中 (\d+)、输出 (\d+)/.exec(text)
      const prompt = /^- 摘要提示词：(.+?)(?: \(([0-9a-f]+)\))?$/m.exec(text)
      if (!retain) continue
      const tail = Number(retain[1])
      const total = Number(retain[2])
      if (tail !== plan.tailTurns || total !== plan.tailTurns + plan.shadowedTurns) continue
      if (level && Number(level[1]) !== Number(summaryChars)) continue
      if (prompt && summaryPrompt) {
        if (prompt[1].trim() !== summaryPrompt.name) continue
        if (prompt[2] && summaryPrompt.fingerprint && prompt[2] !== summaryPrompt.fingerprint) continue
      }
      if (!level) {
        const cost = /- 费用：¥([\d.]+)/.exec(text)
        if (!cost) continue
        return { matched: true, summaryChars: null, input: 0, output: 0, previousCost: Number(cost[1]) }
      }
      return {
        matched: true,
        summaryChars: Number(level[1]),
        input: usage ? Number(usage[1]) + Number(usage[2]) : 0,
        output: usage ? Number(usage[3]) : 0,
      }
    }
    return null
  } catch {
    return null
  }
}

/** Clean a conversation title into a directory and workspace name. */
export function sanitizeWorkspaceName(title) {
  let name = String(title || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
  if (!name) name = '对话'
  if (name.length > MAX_WORKSPACE_NAME_CHARS) name = name.slice(0, MAX_WORKSPACE_NAME_CHARS).trim()
  return name || '对话'
}


/**
 * Pick the next free workspace name for one import. Every import gets its own
 * workspace, so importing the same conversation twice never overwrites the
 * earlier summary: `<title>`, `<title> (2)`, `<title> (3)`…
 */
function nextWorkspaceName(base) {
  const taken = new Set()
  try {
    for (const entry of fs.readdirSync(resolveImportRoot(), { withFileTypes: true })) {
      if (entry.isDirectory()) taken.add(entry.name)
    }
  } catch {
    // No import root yet — the base name is free.
  }
  if (!taken.has(base)) return base
  let index = 2
  while (taken.has(base + ' (' + index + ')')) index += 1
  return base + ' (' + index + ')'
}


/**
 * Create the workspace owned by one import. One import = one workspace, so a
 * repeated import of the same conversation lands in a numbered sibling.
 */
async function createConversationWorkspace(wctx, title) {
  const name = nextWorkspaceName(sanitizeWorkspaceName(title))
  const dir = path.join(resolveImportRoot(), name)
  fs.mkdirSync(dir, { recursive: true })
  let workspace = await wctx.workspaceRegistry.resolveByPath(dir)
  if (!workspace) workspace = await wctx.workspaceRegistry.create(dir, name)
  return { workspace, dir, name }
}


/** Remove a workspace that never produced a durable session. */
async function discardWorkspace(wctx, workspace, dir) {
  try {
    if (workspace && typeof wctx.workspaceRegistry.delete === 'function') {
      await wctx.workspaceRegistry.delete(workspace.id)
    }
  } catch {
    // The registry may already be gone; the directory removal still runs.
  }
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    // Leaving a directory is harmless next to the failed import.
  }
}


export async function writeSession(wctx, title, turns, createdAt, compressInput, hooks) {
  const options = normalizeCompressOptions(compressInput)
  if (options.mode === 'summary' && options.modelInvalid) {
    throw new Error('模型 ' + options.modelInvalid + ' 没有价格或参数配置，请在 profile.json 里补充后再导入摘要')
  }
  const report = {
    mode: options.mode,
    model: options.model,
    compressed: false,
    fallback: false,
    reason: '',
    estimated: null,
    actual: null,
    context: null,
    partial: null,
    summaryError: null,
  }
  const onPhase = (hooks && hooks.onPhase) || (() => {})
  const onSummary = (hooks && hooks.onSummary) || (() => {})
  const onUsage = (hooks && hooks.onUsage) || (() => {})
  const onPlan = (hooks && hooks.onPlan) || (() => {})
  const isCancelled = (hooks && hooks.isCancelled) || (() => false)
  const cancelMode = (hooks && hooks.cancelMode) || (() => 'discard')
  const signal = (hooks && hooks.signal) || null
  const relativeMemory = memoryRelativePath()
  const sourceName = hooks && hooks.sourcePath ? path.basename(hooks.sourcePath) : ''
  const branch = { rule: (hooks && hooks.pathRule) || 'recent', leafId: (hooks && hooks.leafId) || '' }

  onPhase('read', 0.06, '读取文件')
  const dshHome = resolveDshHome()
  const sessionsRoot = path.join(dshHome, 'sessions')
  // Every import gets a brand-new numbered workspace, so the system prompt is
  // borrowed from the newest session on disk instead of a sibling workspace.
  const headText = readAnyReferenceSystemPrompt(sessionsRoot)

  onPhase('tidy', 0.14, '整理对话')
  const id = 'session-' + randomId()
  const meter = typeof wctx.get === 'function' ? wctx.get('tokenMeter') : undefined
  let built = buildSessionEvents(id, title, turns, headText, meter, null, options.model)
  let events = built.events

  // Compression: plan the shadowed range, then resolve its summary text.
  // The plan is validated against the model context budget BEFORE writing:
  // the retained tail plus the checkpoint summary plus the fixed system
  // overhead must fit, otherwise retention shrinks, the summary degrades to a
  // placeholder, or the import refuses.
  onPhase('tidy', 0.22, '整理对话')
  const contextWindow = await resolveContextWindow(wctx, options)
  const planned = planCompression(built.turnInfo, options, contextWindow)
  let shadowedTurns = 0
  let tailTurns = 0
  let checkpointSummaryText = ''
  let summarySegments = []
  let memoryKind = ''
  if (planned.kind === 'refuse') throw new Error(planned.reason)
  if (planned.kind === 'none') {
    const budget = Math.floor(contextWindow * budgetRatio(options.model))
    report.reason = '保留全部轮数'
    report.context = {
      totalTokens: planned.contextTokens || 0,
      budgetTokens: budget,
      windowTokens: contextWindow,
      percent: planned.contextTokens ? Math.ceil((planned.contextTokens / contextWindow) * 100) : 0,
      effectiveRetainTurns: null,
      requestedRetainTurns: options.retainTurns,
      adjusted: false,
      degradedFromSummary: false,
    }
  }
  if (planned.kind === 'plan') {
    const plan = planned.plan
    const planOptions = planned.options
    const reused = importedBefore(title)
    planOptions.reused = reused
    const previous = reused ? lastSummaryUsage(title, plan, planOptions.summaryChars, planOptions.summaryPrompt) : null
    const samePlan = Boolean(previous && (previous.summaryChars == null || previous.summaryChars === planOptions.summaryChars))
    const previousUsage = samePlan && previous.input > 0 ? previous : null
    const previousCost = samePlan && !previousUsage && previous.previousCost > 0 ? previous.previousCost : null
    report.compressed = true
    report.reason = planned.forced ? '整段对话超出上下文，已自动压缩' : '已压缩较早的对话'
    report.context = {
      totalTokens: plan.contextTotalTokens,
      budgetTokens: plan.contextBudgetTokens,
      windowTokens: contextWindow,
      percent: Math.ceil((plan.contextTotalTokens / contextWindow) * 100),
      effectiveRetainTurns: plan.effectiveRetainTurns,
      requestedRetainTurns: options.retainTurns,
      adjusted: plan.adjusted && plan.effectiveRetainTurns !== options.retainTurns,
      degradedFromSummary: planned.degradedFromSummary,
    }
    onPlan({ retainTurns: plan.tailTurns, totalTurns: turns.length, shadowedTurns: plan.shadowedTurns })
    let summaryText = ''
    if (planOptions.mode === 'summary') {
      const estimate = estimateSummaryCost(plan, planOptions, Date.now(), turns, samePlan, previousUsage, previousCost)
      report.estimated = estimate
      onPhase('summary', 0.3, '生成摘要')
      onUsage({ estimate: estimate.costCny, maxCost: planOptions.maxCostCny })
      if (estimate.costCny > planOptions.maxCostCny) {
        report.fallback = true
        report.reason = '预估费用 ¥' + estimate.costCny + ' 超过上限 ¥' + planOptions.maxCostCny + '，未调用模型'
        summaryText = placeholderSummary(plan, title)
      } else {
        const summarized = await summarizeShadowed(wctx, turns, plan, planOptions, (chunk) => {
          onSummary(chunk)
          onUsage({ inputTokens: chunk.inputTokens, outputTokens: chunk.outputTokens, costCny: chunk.costCny })
        }, isCancelled, () => cancelMode() === 'keep', signal)
        const ranges = summarized.ranges || []
        const lastRange = ranges.length > 0 ? ranges[ranges.length - 1] : null
        const partial = (summarized.failure || summarized.aborted) && summarized.done > 0
          ? {
              done: summarized.done,
              total: summarized.total,
              fromTurn: ranges.length > 0 ? ranges[0].fromTurn : 1,
              toTurn: lastRange ? lastRange.toTurn : 0,
              droppedFrom: lastRange ? lastRange.toTurn + 1 : 1,
              droppedTo: plan.shadowedTurns,
              error: summarized.failure || null,
            }
          : null
        if (summarized.done === 0) {
          throw new Error(summarized.failure
            ? '摘要第 ' + summarized.failure.chunkIndex + ' 段（第 ' + summarized.failure.fromTurn + '–'
              + summarized.failure.toTurn + ' 轮）失败：' + summarized.failure.message
            : '摘要没有生成任何内容')
        }
        if (partial) report.partial = partial
        if (summarized.failure) {
          report.summaryError = summarized.failure
          report.reason = '摘要第 ' + summarized.failure.chunkIndex + ' 段失败，已保留前 ' + summarized.done + ' 段'
        }
        summarySegments = Array.isArray(summarized.segments) ? summarized.segments : []
        summaryText = buildMemoryNotice({
          kind: 'summary',
          title,
          archivedTurns: plan.shadowedTurns,
          inlineTurns: plan.tailTurns,
          partial,
        }) + '\n\n' + summarized.text
        memoryKind = 'summary'
        // Each chunk was priced when it finished, so a run that spans a
        // peak boundary is not re-priced at one single window.
        report.actual = { ...summarized.usage, costCny: roundCost(summarized.costCny), peak: isDeepSeekPeak(Date.now()) }
      }
    } else if (planOptions.mode === 'full') {
      summaryText = buildMemoryNotice({
        kind: 'full',
        title,
        archivedTurns: plan.shadowedTurns,
        inlineTurns: plan.tailTurns,
        relativeMemory,
      })
      report.reason = '较早内容已完整存档'
      memoryKind = 'full'
    } else {
      summaryText = placeholderSummary(plan, title)
      if (planned.degradedFromSummary) {
        report.fallback = true
        report.reason = '摘要会使上下文超出上限，已改为仅保留最近对话'
      }
    }
    checkpointSummaryText = summaryText
    shadowedTurns = plan.shadowedTurns
    tailTurns = plan.tailTurns
    // Write only the kept turns behind the summary. The dropped turns never
    // enter the log: no transcript row, no model request, no branch target.
    const keptTurns = turns.slice(plan.shadowedTurns)
    built = buildSessionEvents(id, title, keptTurns, headText, meter, {
      text: summaryText,
      // This host build accepts the user source for an imported message; the
      // summary reads as the first message of the session.
      source: { kind: 'user' },
    }, options.model)
    events = built.events
  }

  // A keep request that arrives after the summary finished still writes the
  // session; every other cancel stops before anything durable is created.
  if (isCancelled()) {
    const keepable = cancelMode() === 'keep' && (report.partial !== null || checkpointSummaryText !== '')
    if (!keepable) throw new CancelledError('已停止导入')
  }
  onPhase('writing', 0.94, '写入会话')
  // The workspace is created only now: a cancelled import must not leave an
  // empty workspace behind.
  const { workspace, dir, name } = await createConversationWorkspace(wctx, title)
  if (memoryKind) {
    try {
      const summary = memoryKind === 'summary'
        ? {
            chars: options.summaryChars,
            prompt: options.summaryPrompt,
            segments: summarySegments,
            usage: report.actual
              ? {
                  inputTokens: report.actual.inputTokens || 0,
                  cacheReadTokens: report.actual.cacheReadTokens || 0,
                  outputTokens: report.actual.outputTokens || 0,
                }
              : null,
            partial: report.partial,
            failure: report.summaryError,
          }
        : null
      report.memory = writeMemory({
        workspaceDir: dir,
        title,
        sourceName,
        branch,
        totalTurns: turns.length,
        turns: turns.slice(0, shadowedTurns),
        kind: memoryKind,
        keepThinking: Boolean(options.keepThinking),
        summary,
      })
    } catch (error) {
      await discardWorkspace(wctx, workspace, dir)
      throw error
    }
  }
  const header = {
    version: CONTRACT.version,
    id,
    // Import time, not the source conversation time: the workspace list sorts
    // sessions by recency, so a fresh import must land at the top.
    createdAt: Date.now(),
    cwd: dir,
    isSeeded: false,
    delegationDepth: 0,
    agentPreset: 'standard',
  }
  const handle = await wctx.sessionPersistence.create(header)
  try {
    if (events.length > 0) await handle.append(events)
    await handle.flush()
  } catch (error) {
    // A failed write must not leave an empty workspace in the sidebar.
    await discardWorkspace(wctx, workspace, dir)
    throw error
  } finally {
    await handle.close()
  }
  // Attach the durable session to the conversation workspace so the GUI lists
  // it. Deliberately do NOT publish a live session here: a pre-existing live
  // session blocks the later resume ("session already exists"), so the GUI
  // loads the conversation from the durable log on demand.
  if (workspace && typeof workspace.attachSession === 'function') {
    await workspace.attachSession(id)
    try {
      // Keep the session at the top of the workspace list; the order is
      // cosmetic, so a rejected insert never fails the import.
      if (typeof workspace.insertSessionBefore === 'function') await workspace.insertSessionBefore(id)
    } catch {
      // The session is attached either way.
    }
  }
  // The session list summary reads its title from the projection cache, which
  // is written only for live sessions. This build exposes no public way to
  // seed a cold session's title, so the row shows "未命名" until the session is
  // opened once; the conversation title event is already in the log.
  return {
    id,
    turns: events.length,
    report,
    shadowedTurns,
    tailTurns,
    workspace: { id: workspace && workspace.id ? workspace.id : '', name, dir },
  }
}

/* ------------------------------------------------------------------ *
 * Import jobs: one active job, progress polled by the panel.
 * ------------------------------------------------------------------ */

