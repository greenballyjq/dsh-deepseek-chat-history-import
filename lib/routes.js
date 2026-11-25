/** routes — extracted from the original host entry. */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { LIMITS, MEMORY_MODES, REASONING_EFFORTS, USER_PROFILE_FILE } from './constants.js'
import { buildMessageDetail, buildTranscript, buildTranscriptTail } from './conversation.js'
import { labelOf } from './formats/index.js'
import { readBody, sendJson } from './http.js'
import { createImportJob, importJob, jobView, runImportJob, setImportJob } from './jobs.js'
import { formatCounts, formatFor, kindFor, loadFileCache, loadSources, loadSourcesAsync, nodeMapFor, normalizePathOptions, sourceExists, turnInfoFor, validateSourceInputs } from './load.js'
import { checkContract, contractStatus } from './log.js'
import { estimateSummaryCost, normalizeCompressOptions, planCompression, resolveContextWindow } from './planner.js'
import { importedBefore, lastSummaryUsage } from './session.js'
import { budgetRatio, defaultSummaryChars, loadProfile, normalizeReasoningEffort, readSettings, resolveDshHome, resolveImportRoot, saveUserProfileModel, summaryCharsForLevel, summaryLevels, writeSettings } from './profile.js'
import { DEFAULT_SUMMARY_PROMPT_PRESET, MAX_SUMMARY_PROMPT_CHARS, summaryPromptPresets } from './summary-prompt.js'
import { deleteCustomSummaryPreset, saveCustomSummaryPreset } from './summary-presets.js'
import { pruneUploads, readLastSet, readRecent, touchRecent, writeLastSet } from './store.js'
import { friendlyMessage } from './util.js'

/** The model whose profile drives the panel defaults. */
function chosenModel(profile) {
  if (!profile) return ''
  const settings = readSettings()
  return typeof settings.model === 'string' && profile.models[settings.model] ? settings.model : profile.defaultModel
}


/** Settings as the panel sees them; legacy summaryLevel ids map to characters. */
function effectiveSettings(profile) {
  const settings = readSettings()
  const defaults = settings.defaults && typeof settings.defaults === 'object' ? { ...settings.defaults } : {}
  defaults.summaryReasoningEffort = normalizeReasoningEffort(defaults.summaryReasoningEffort)
  if (!Number.isFinite(Number(defaults.summaryChars)) && typeof defaults.summaryLevel === 'string') {
    const chars = summaryCharsForLevel(chosenModel(profile), defaults.summaryLevel)
    if (chars > 0) defaults.summaryChars = chars
  }
  delete defaults.summaryLevel
  return { ...settings, defaults }
}


/** The most recent async load, polled by the panel while it parses. */
let loadJob = null


function prepareLoadInputs(params) {
  const rawPaths = Array.isArray(params.paths)
    ? params.paths
    : (params.path ? [params.path] : [])
  const inputs = rawPaths.map((item) => String(item || '').trim()).filter(Boolean)
  if (inputs.length === 0) throw new Error('请选择文件')
  return { inputs, validation: validateSourceInputs(inputs) }
}


function buildLoadPayload(cached, validation, inputs) {
  const skipped = [...validation.failures, ...(cached && cached.skipped ? cached.skipped : [])]
  if (!cached || cached.byId.size === 0) {
    const reasons = skipped.slice(0, 3).map((skip) => skip.reason).filter(Boolean)
    throw new Error(reasons.length > 0 ? reasons.join('；') : '没有识别到 DeepSeek 对话')
  }
  const conversations = [...cached.byId.keys()].map((id) => {
    const info = cached.meta.get(id) || { title: '', messages: 0, updatedAt: 0 }
    return {
      id,
      title: info.title,
      messages: info.messages,
      updatedAt: info.updatedAt,
      kind: kindFor(cached, id),
      format: labelOf(formatFor(cached, id)),
    }
  })
  conversations.sort((a, b) => b.updatedAt - a.updatedAt)
  const formats = formatCounts(cached).map((item) => ({ ...item, label: labelOf(item.id) }))
  if (inputs.length === 1) {
    try {
      touchRecent(inputs[0], conversations.length)
    } catch {
      // Recent is a convenience; the last set still remembers the input.
    }
  }
  writeLastSet(inputs)
  pruneUploads()
  return {
    ok: true,
    format: cached.kind,
    formats,
    conversations,
    path: cached.path,
    sources: cached.sources,
    skipped,
    duplicates: cached.duplicates || 0,
    updated: cached.updated || 0,
    conflicts: cached.conflicts || 0,
    duplicateConversations: cached.duplicateConversations || 0,
    sameConversations: cached.sameConversations || 0,
    updatedConversations: cached.updatedConversations || 0,
    conflictConversations: cached.conflictConversations || 0,
    oldOnly: cached.oldOnly || 0,
    newOnly: cached.newOnly || 0,
    latestSource: cached.latestSource || '',
    recent: readRecent(),
    lastSet: readLastSet(),
  }
}


function loadJobView(job) {
  if (!job) return null
  return {
    id: job.id,
    status: job.status,
    done: job.done,
    total: job.total,
    label: job.label,
    elapsedMs: Date.now() - job.startedAt,
    error: job.error,
    errorDetail: job.errorDetail,
    payload: job.status === 'done' ? job.payload : null,
  }
}


async function runLoadJob(job, validation, inputs) {
  try {
    const cached = await loadSourcesAsync(validation.files, (progress) => {
      job.done = progress.done
      job.total = progress.total
      job.label = progress.label
    })
    job.payload = buildLoadPayload(cached, validation, inputs)
    job.status = 'done'
    job.done = job.total
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error)
    job.status = 'failed'
    job.error = friendlyMessage(raw)
    job.errorDetail = job.error === raw ? '' : raw
  }
}


export async function handleRoute(wctx, req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, message: 'POST only' })
    return
  }
  let body
  try {
    body = await readBody(req)
  } catch (error) {
    sendJson(res, 400, { ok: false, message: error.message })
    return
  }
  const method = body && body.method
  const params = (body && body.params) || {}

  try {
    if (method === 'load') {
      const { inputs, validation } = prepareLoadInputs(params)
      sendJson(res, 200, buildLoadPayload(loadSources(validation.files), validation, inputs))
      return
    }

    if (method === 'loadStart') {
      if (loadJob && loadJob.status === 'running') throw new Error('已有读取在进行')
      const { inputs, validation } = prepareLoadInputs(params)
      const job = {
        id: 'load-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
        status: 'running',
        done: 0,
        total: 0,
        label: '',
        startedAt: Date.now(),
        error: '',
        errorDetail: '',
        payload: null,
      }
      loadJob = job
      setTimeout(() => { runLoadJob(job, validation, inputs) }, 0)
      sendJson(res, 200, { ok: true, job: loadJobView(job) })
      return
    }

    if (method === 'loadStatus') {
      sendJson(res, 200, { ok: true, job: loadJobView(loadJob) })
      return
    }

    if (method === 'recent') {
      sendJson(res, 200, { ok: true, recent: readRecent(), lastSet: readLastSet() })
      return
    }

    if (method === 'estimate') {
      const filePath = String(params.path || '').trim()
      if (!filePath) throw new Error('请填写 JSON 文件路径')
      const selectedIds = Array.isArray(params.ids) ? params.ids.map(String) : []
      if (selectedIds.length === 0) throw new Error('没有选择任何会话')
      if (!sourceExists(filePath)) throw new Error('文件不存在：' + filePath)
      const cached = loadFileCache(filePath)
      if (!cached || cached.byId.size === 0) throw new Error('没有识别到 DeepSeek 对话')
      const wanted = new Set(selectedIds)
      const options = normalizeCompressOptions(params.compress)
      const profileLoad = loadProfile()
      if (options.mode === 'summary' && profileLoad.error) throw new Error(profileLoad.error)
      if (options.mode === 'summary' && options.modelInvalid) throw new Error('摘要模型「' + options.modelInvalid + '」没有配置，请在设置里换一个模型。')
      const pathOptions = normalizePathOptions(params)
      const contextWindow = await resolveContextWindow(wctx, options)
      const items = []
      for (const id of wanted) {
        const conv = cached.byId.get(id)
        if (!conv) continue
        const priced = turnInfoFor(conv, pathOptions, options.model)
        const planned = planCompression(priced.turnInfo, options, contextWindow)
        let estimate = null
        if (planned.kind === 'plan') {
          const reused = importedBefore(conv.title || '')
          const previous = reused ? lastSummaryUsage(conv.title || '', planned.plan, planned.options.summaryChars, planned.options.summaryPrompt) : null
          const samePlan = Boolean(previous && (previous.summaryChars == null || previous.summaryChars === planned.options.summaryChars))
          const previousUsage = samePlan && previous.input > 0 ? previous : null
          const previousCost = samePlan && !previousUsage && previous.previousCost > 0 ? previous.previousCost : null
          estimate = estimateSummaryCost(
            planned.plan,
            planned.options,
            Date.now(),
            priced.turns,
            samePlan,
            previousUsage,
            previousCost,
          )
        }
        const budget = Math.floor(contextWindow * budgetRatio(options.model))
        const noCompressContext = planned.kind === 'none'
          ? {
              totalTokens: planned.contextTokens || 0,
              budgetTokens: budget,
              windowTokens: contextWindow,
              percent: planned.contextTokens ? Math.ceil((planned.contextTokens / contextWindow) * 100) : 0,
              effectiveRetainTurns: null,
              requestedRetainTurns: options.retainTurns,
              adjusted: false,
            }
          : null
        items.push({
          id,
          title: (cached.meta.get(id) || {}).title || '',
          turns: priced.turnInfo.length,
          chars: priced.chars,
          tokens: priced.tokens,
          willCompress: planned.kind === 'plan',
          refused: planned.kind === 'refuse',
          refusedReason: planned.kind === 'refuse' ? planned.reason : '',
          noCompressReason: planned.kind === 'none' ? planned.reason : '',
          forced: planned.kind === 'plan' ? Boolean(planned.forced) : false,
          degradedFromSummary: planned.kind === 'plan' ? Boolean(planned.degradedFromSummary) : false,
          context: planned.kind === 'plan' ? {
            totalTokens: planned.plan.contextTotalTokens,
            budgetTokens: planned.plan.contextBudgetTokens,
            windowTokens: contextWindow,
            percent: Math.ceil((planned.plan.contextTotalTokens / contextWindow) * 100),
            effectiveRetainTurns: planned.plan.effectiveRetainTurns,
            requestedRetainTurns: options.retainTurns,
            adjusted: planned.plan.adjusted && planned.plan.effectiveRetainTurns !== options.retainTurns,
          } : noCompressContext,
          estimate,
        })
      }
      sendJson(res, 200, { ok: true, options, contextWindow, items })
      return
    }

    if (method === 'transcript') {
      const filePath = String(params.path || '').trim()
      const id = String(params.id || '')
      if (!filePath || !id) throw new Error('缺少文件或对话')
      if (!sourceExists(filePath)) throw new Error('文件不存在：' + filePath)
      const cached = loadFileCache(filePath)
      const conv = cached.byId.get(id)
      if (!conv) throw new Error('找不到这个对话')
      sendJson(res, 200, { ok: true, ...buildTranscript(conv, params, nodeMapFor(cached, id, conv)) })
      return
    }

    if (method === 'message') {
      const filePath = String(params.path || '').trim()
      const id = String(params.id || '')
      const messageId = String(params.messageId || '')
      if (!filePath || !id || !messageId) throw new Error('缺少文件、对话或消息')
      if (!sourceExists(filePath)) throw new Error('文件不存在：' + filePath)
      const cached = loadFileCache(filePath)
      const conv = cached.byId.get(id)
      if (!conv) throw new Error('找不到这个对话')
      sendJson(res, 200, { ok: true, ...buildMessageDetail(conv, messageId, nodeMapFor(cached, id, conv)) })
      return
    }

    if (method === 'tail') {
      const filePath = String(params.path || '').trim()
      const id = String(params.id || '')
      const versionId = String(params.versionId || '')
      if (!filePath || !id || !versionId) throw new Error('缺少文件、对话或版本')
      if (!sourceExists(filePath)) throw new Error('文件不存在：' + filePath)
      const cached = loadFileCache(filePath)
      const conv = cached.byId.get(id)
      if (!conv) throw new Error('找不到这个对话')
      sendJson(res, 200, { ok: true, ...buildTranscriptTail(conv, versionId, params, nodeMapFor(cached, id, conv)) })
      return
    }

    if (method === 'importStart') {
      const filePath = String(params.path || '').trim()
      if (!filePath) throw new Error('缺少文件')
      const selectedIds = Array.isArray(params.ids) ? params.ids.map(String) : []
      if (selectedIds.length === 0) throw new Error('没有选择对话')
      if (!sourceExists(filePath)) throw new Error('文件不存在：' + filePath)
      if (importJob && importJob.status === 'running') throw new Error('已有导入在进行')
      const compressCheck = normalizeCompressOptions(params.compress)
      const profileLoad = loadProfile()
      if (compressCheck.mode === 'summary' && profileLoad.error) throw new Error(profileLoad.error)
      if (compressCheck.mode === 'summary' && !profileLoad.profile) throw new Error('插件安装不完整，缺少模型配置。')
      if (compressCheck.mode === 'summary' && compressCheck.modelInvalid) throw new Error('摘要模型「' + compressCheck.modelInvalid + '」没有配置，请在设置里换一个模型。')
      fs.mkdirSync(resolveImportRoot(), { recursive: true })
      const job = createImportJob()
      try { job.abort = new AbortController() } catch { job.abort = null }
      setImportJob(job)
      setTimeout(() => {
        runImportJob(wctx, job, params).catch((error) => {
          job.status = 'failed'
          job.error = error instanceof Error ? error.message : String(error)
        })
      }, 0)
      sendJson(res, 200, { ok: true, jobId: job.id, job: jobView(job) })
      return
    }

    if (method === 'importStatus') {
      sendJson(res, 200, { ok: true, job: jobView(importJob) })
      return
    }

    if (method === 'importCancel') {
      if (importJob && importJob.status === 'running') {
        importJob.cancelMode = params.mode === 'keep' ? 'keep' : 'discard'
        importJob.cancelled = true
        try {
          if (importJob.abort && typeof importJob.abort.abort === 'function') importJob.abort.abort()
        } catch {
          // The stream ends on its own when the signal is unavailable.
        }
      }
      sendJson(res, 200, { ok: true, job: jobView(importJob) })
      return
    }

    if (method === 'guiUrl') {
      const origin = wctx.webServer.getOrigin()
      const url = wctx.connection.authenticatedUrl(origin)
      sendJson(res, 200, { ok: true, url })
      return
    }

    if (method === 'summaryPresetSave') {
      const preset = saveCustomSummaryPreset({
        name: params.name,
        text: params.text,
      })
      sendJson(res, 200, { ok: true, preset })
      return
    }

    if (method === 'summaryPresetDelete') {
      const result = deleteCustomSummaryPreset(params.id)
      sendJson(res, 200, { ok: true, ...result })
      return
    }

    if (method === 'profile') {
      const loaded = loadProfile()
      const profile = loaded.profile
      sendJson(res, 200, {
        ok: true,
        profile: {
          version: profile ? profile.version : 0,
          defaultModel: profile ? profile.defaultModel : '',
          models: profile
            ? Object.fromEntries(Object.entries(profile.models).map(([id, model]) => ([id, { name: model.name || id }])))
            : {},
          sources: loaded.sources,
          error: loaded.error,
        },
        settings: effectiveSettings(profile),
        importRoot: resolveImportRoot(),
        defaultImportRoot: path.join(os.homedir(), 'DeepSeek-Imports'),
        summaryLevels: summaryLevels(chosenModel(profile)),
        defaultSummaryChars: defaultSummaryChars(chosenModel(profile)),
        reasoningEfforts: REASONING_EFFORTS,
        memoryModes: MEMORY_MODES,
        devModels: profile ? profile.models : {},
        devConfigPath: USER_PROFILE_FILE,
        summaryPresets: summaryPromptPresets(),
        defaultSummaryPrompt: DEFAULT_SUMMARY_PROMPT_PRESET,
        maxSummaryPromptChars: MAX_SUMMARY_PROMPT_CHARS,
        limits: LIMITS,
        contract: contractStatus,
      })
      return
    }

    if (method === 'settings') {
      const set = params.set
      if (set && typeof set === 'object') {
        const loaded = loadProfile()
        if (typeof set.model === 'string') {
          if (set.model === '') writeSettings({ model: '' })
          else {
            if (!loaded.profile || !loaded.profile.models[set.model]) throw new Error('这个模型没有配置，请换一个。')
            writeSettings({ model: set.model })
          }
        }
        if (typeof set.importRoot === 'string') {
          const root = set.importRoot.trim()
          if (!root || !path.isAbsolute(root)) throw new Error('导入位置需要填写完整路径。')
          try {
            fs.mkdirSync(root, { recursive: true })
            fs.accessSync(root, fs.constants.W_OK)
          } catch {
            throw new Error('这个位置不可写，请换一个。')
          }
          writeSettings({ importRoot: root })
        }
        if (set.defaults && typeof set.defaults === 'object') {
          const current = readSettings().defaults && typeof readSettings().defaults === 'object' ? readSettings().defaults : {}
          const defaults = { ...current }
          delete defaults.summaryLevel
          if (Number.isFinite(Number(set.defaults.retainTurns))) defaults.retainTurns = Math.min(LIMITS.retainTurns[1], Math.max(LIMITS.retainTurns[0], Math.round(Number(set.defaults.retainTurns))))
          const requestedChars = Number(set.defaults.summaryChars)
          const legacyChars = typeof set.defaults.summaryLevel === 'string'
            ? summaryCharsForLevel(chosenModel(loaded.profile), set.defaults.summaryLevel)
            : 0
          const nextChars = Number.isFinite(requestedChars) && requestedChars > 0 ? requestedChars : legacyChars
          if (nextChars > 0) defaults.summaryChars = Math.min(LIMITS.summaryChars[1], Math.max(LIMITS.summaryChars[0], Math.round(nextChars)))
          if (Number.isFinite(Number(set.defaults.maxCostCny))) defaults.maxCostCny = Math.min(LIMITS.maxCostCny[1], Math.max(LIMITS.maxCostCny[0], Number(set.defaults.maxCostCny)))
          if (typeof set.defaults.summaryReasoningEffort === 'string') defaults.summaryReasoningEffort = normalizeReasoningEffort(set.defaults.summaryReasoningEffort)
          writeSettings({ defaults })
        }
      }
      sendJson(res, 200, { ok: true, settings: effectiveSettings(loadProfile().profile) })
      return
    }

    if (method === 'devConfigSave') {
      const model = String(params.model || '').trim()
      const config = params.config && typeof params.config === 'object' ? params.config : null
      if (!model) throw new Error('缺少模型')
      if (!config) throw new Error('缺少配置内容')
      const saved = saveUserProfileModel(model, config)
      sendJson(res, 200, { ok: true, model, config: saved })
      return
    }

    if (method === 'contract') {
      contractStatus = checkContract(path.join(resolveDshHome(), 'sessions'))
      sendJson(res, 200, { ok: true, contract: contractStatus })
      return
    }

    throw new Error('未知方法：' + String(method || ''))
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error)
    const message = friendlyMessage(raw)
    sendJson(res, 400, { ok: false, message, detail: message === raw ? '' : raw })
  }
}


/**
 * Resolve services lazily: activation must not depend on services that may
 * register later than the web boot's entry check (a pending inject keeps the
 * entry inactive and the whole app reports a failed web boot).
 */
export function lazyServices(wctx) {
  return {
    get(name) {
      return typeof wctx.get === 'function' ? wctx.get(name) : undefined
    },
    get webServer() { return this.get('webServer') },
    get sessions() { return this.get('sessions') },
    get sessionPersistence() { return this.get('sessionPersistence') },
    get workspaceRegistry() { return this.get('workspaceRegistry') },
    get connection() { return this.get('connection') },
  }
}

