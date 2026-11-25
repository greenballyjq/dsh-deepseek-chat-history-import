    const DEV_FIELDS = [
      { path: 'tokens.cjkPerChar', label: '汉字 token/字', step: 0.05 },
      { path: 'tokens.latinPerChar', label: '拉丁 token/字', step: 0.05 },
      { path: 'context.window', label: '上下文窗口', step: 1024 },
      { path: 'context.minRetainTurns', label: '最少保留轮数', step: 1 },
      { path: 'context.systemOverhead', label: '固定开销 tokens', step: 1000 },
      { path: 'context.budgetRatio', label: '预算占比', step: 0.05 },
      { path: 'pricing.peak.cacheHit', label: '高峰·缓存命中', step: 0.01 },
      { path: 'pricing.peak.cacheMiss', label: '高峰·未命中', step: 0.5 },
      { path: 'pricing.peak.output', label: '高峰·输出', step: 0.5 },
      { path: 'pricing.offPeak.cacheHit', label: '低峰·缓存命中', step: 0.01 },
      { path: 'pricing.offPeak.cacheMiss', label: '低峰·未命中', step: 0.5 },
      { path: 'pricing.offPeak.output', label: '低峰·输出', step: 0.5 },
      { path: 'summary.promptTokens', label: '提示词 tokens', step: 50 },
      { path: 'summary.outputRatio', label: '输出占比', step: 0.01 },
      { path: 'summary.chunkChars', label: '分块字符', step: 1000 },
      { path: 'summary.maxTokensPerChar', label: '输出 token/字', step: 0.5 },
      { path: 'summary.maxTokensFloor', label: '输出 token 下限', step: 256 },
      { path: 'summary.reasoningEffort', label: '思考强度', text: true },
      { path: 'estimation.messageOverhead', label: '估算·消息开销', step: 1 },
      { path: 'estimation.tailSafety', label: '估算·尾部余量', step: 50 },
      { path: 'estimation.summaryFactor', label: '估算·摘要系数', step: 0.1 },
      { path: 'estimation.minOutputChars', label: '估算·最少输出字', step: 10 },
      { path: 'estimation.outputTokensPerSegment', label: '估算·每段输出', step: 50 },
      { path: 'estimation.cacheHitRatio', label: '估算·缓存命中', step: 0.05 },
      { path: 'estimation.ewmaAlpha', label: '估算·EWMA 系数', step: 0.05 },
      { path: 'estimation.coldCacheHitRatio', label: '估算·冷启动命中', step: 0.05 },
      { path: 'estimation.warmCacheHitRatio', label: '估算·重复命中', step: 0.05 },
      { path: 'estimation.inputScale', label: '估算·输入系数', step: 0.05 },
      { path: 'estimation.outputScale', label: '估算·输出系数', step: 0.05 },
    ]

    function ImportPanel() {
      const [filePath, setFilePath] = React.useState('')
      const [fileName, setFileName] = React.useState('')
      const [picking, setPicking] = React.useState(false)
      const [pickDone, setPickDone] = React.useState(0)
      const [pickTotal, setPickTotal] = React.useState(0)
      const [loading, setLoading] = React.useState(false)
      const [error, setError] = React.useState('')
      const [errorDetail, setErrorDetail] = React.useState('')
      const [errorOpen, setErrorOpen] = React.useState(false)
      const [format, setFormat] = React.useState('')
      const [formats, setFormats] = React.useState([])
      const [conversations, setConversations] = React.useState([])
      const [query, setQuery] = React.useState('')
      const [selectedId, setSelectedId] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const [notice, setNotice] = React.useState('')
      const [job, setJob] = React.useState(null)
      const [jobExpanded, setJobExpanded] = React.useState(false)
      const [cancelDialog, setCancelDialog] = React.useState(null)
      const [profileInfo, setProfileInfo] = React.useState(null)
      const [settingsOpen, setSettingsOpen] = React.useState(false)
      const [settingsDraft, setSettingsDraft] = React.useState(null)
      const [settingsError, setSettingsError] = React.useState('')
      const [settingsSaving, setSettingsSaving] = React.useState(false)
      const [devOpen, setDevOpen] = React.useState(false)
      const [devModelId, setDevModelId] = React.useState('')
      const [devDraft, setDevDraft] = React.useState(null)
      const [devSaving, setDevSaving] = React.useState(false)
      const [devError, setDevError] = React.useState('')
      const [contractChecking, setContractChecking] = React.useState(false)
      const [contractOpen, setContractOpen] = React.useState(false)
      const [profileOpen, setProfileOpen] = React.useState(false)
      const [scrollTop, setScrollTop] = React.useState(0)
      const [listHeight, setListHeight] = React.useState(380)
      const listRef = React.useRef(null)
      const [mode, setMode] = React.useState('placeholder')
      const [retainTurns, setRetainTurns] = React.useState(100)
      const [summaryChars, setSummaryChars] = React.useState(DEFAULT_SUMMARY_CHARS)
      const [summaryPromptPreset, setSummaryPromptPreset] = React.useState('neutral')
      const [summaryPromptText, setSummaryPromptText] = React.useState('')
      const [summaryPromptBase, setSummaryPromptBase] = React.useState('neutral')
      const [customPromptDraft, setCustomPromptDraft] = React.useState('')
      const [presetDialog, setPresetDialog] = React.useState(null)
      const [maxCost, setMaxCost] = React.useState(1)
      const [estimate, setEstimate] = React.useState(null)
      const [estimating, setEstimating] = React.useState(false)
      const [estimateError, setEstimateError] = React.useState('')
      const [recent, setRecent] = React.useState([])
      const [sources, setSources] = React.useState([])
      const [duplicateConversations, setDuplicateConversations] = React.useState(0)
      const [sameConversations, setSameConversations] = React.useState(0)
      const [updatedConversations, setUpdatedConversations] = React.useState(0)
      const [conflictConversations, setConflictConversations] = React.useState(0)
      const [oldOnly, setOldOnly] = React.useState(0)
      const [newOnly, setNewOnly] = React.useState(0)
      const [parseProgress, setParseProgress] = React.useState(null)
      const [skipped, setSkipped] = React.useState([])
      const [skippedOpen, setSkippedOpen] = React.useState(false)
      const [pathRule, setPathRule] = React.useState('recent')
      const [leafId, setLeafId] = React.useState('')
      const [pathSummary, setPathSummary] = React.useState('')
      const [loadedPath, setLoadedPath] = React.useState('')
      const [transcriptOpen, setTranscriptOpen] = React.useState(false)
      const pollRef = React.useRef(null)
      const syncedJobRef = React.useRef('')
      const fileInputRef = React.useRef(null)
      const autoLoadedRef = React.useRef(false)
      const promptInitRef = React.useRef(false)

      const currentPath = () => loadedPath || filePath
      const MAX_FILES = 5000
      const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024
      const modelChoice = (profileInfo && profileInfo.settings && profileInfo.settings.model) || ''

      const fail = (cause) => {
        const message = cause instanceof Error ? cause.message : String(cause)
        const detail = cause && typeof cause === 'object' && typeof cause.detail === 'string' ? cause.detail : ''
        setError(message)
        setErrorDetail(detail)
        setErrorOpen(false)
      }
      const clearError = () => {
        setError('')
        setErrorDetail('')
        setErrorOpen(false)
      }

      const readStoredJobId = () => {
        try { return sessionStorage.getItem('dsdi-job-id') || '' } catch { return '' }
      }
      const storeJobId = (id) => {
        try {
          if (id) sessionStorage.setItem('dsdi-job-id', id)
          else sessionStorage.removeItem('dsdi-job-id')
        } catch {
          // Restoring the job after a reload is optional.
        }
      }

      React.useEffect(() => {
        let cancelled = false
        call('recent').then((payload) => {
          if (cancelled) return
          const entries = Array.isArray(payload.recent) ? payload.recent : []
          setRecent(entries)
          const lastSet = Array.isArray(payload.lastSet) ? payload.lastSet.filter((item) => typeof item === 'string' && item) : []
          const targets = lastSet.length > 0 ? lastSet : (entries[0] && entries[0].path ? [entries[0].path] : [])
          if (!autoLoadedRef.current && targets.length > 0) {
            autoLoadedRef.current = true
            onLoad(targets)
          }
        }).catch(() => { /* recent files are optional */ })
        call('profile').then((payload) => {
          if (cancelled) return
          setProfileInfo(payload)
          const settings = payload.settings || {}
          const defaults = settings.defaults || {}
          if (Number.isFinite(defaults.retainTurns)) setRetainTurns(Math.min(5000, Math.max(1, Math.round(defaults.retainTurns))))
          const levelList = Array.isArray(payload.summaryLevels) ? payload.summaryLevels : []
          const standardLevel = levelList.find((level) => level && level.id === 'standard') || levelList[0]
          const startChars = Number(defaults.summaryChars) > 0
            ? Number(defaults.summaryChars)
            : (Number(payload.defaultSummaryChars) > 0
              ? Number(payload.defaultSummaryChars)
              : (standardLevel ? Number(standardLevel.chars) : DEFAULT_SUMMARY_CHARS))
          if (startChars > 0) setSummaryChars(startChars)
          if (Number.isFinite(defaults.maxCostCny)) setMaxCost(Math.min(20, Math.max(0, defaults.maxCostCny)))
          const presets = Array.isArray(payload.summaryPresets) ? payload.summaryPresets : []
          const defaultId = payload.defaultSummaryPrompt || 'neutral'
          const initial = presets.find((preset) => preset && preset.id === defaultId) || presets[0]
          if (!promptInitRef.current && initial) {
            promptInitRef.current = true
            setSummaryPromptPreset(initial.id)
            setSummaryPromptBase(initial.id)
            setSummaryPromptText(initial.text || '')
          }
        }).catch(fail)
        return () => { cancelled = true }
      }, [])

      const levels = profileInfo && Array.isArray(profileInfo.summaryLevels) && profileInfo.summaryLevels.length > 0
        ? profileInfo.summaryLevels
        : [{ id: 'standard', name: '标准', chars: DEFAULT_SUMMARY_CHARS }]
      const limits = (profileInfo && profileInfo.limits) || DEFAULT_LIMITS
      const summaryPresets = (profileInfo && Array.isArray(profileInfo.summaryPresets)) ? profileInfo.summaryPresets : []
      const summaryPromptLimit = Number(profileInfo && profileInfo.maxSummaryPromptChars) > 0 ? Number(profileInfo.maxSummaryPromptChars) : 4000
      const activeSummaryPreset = summaryPresets.find((preset) => preset && preset.id === summaryPromptPreset) || null
      const builtinSummaryPresets = summaryPresets.filter((preset) => preset && preset.builtin)
      const customSummaryPresets = summaryPresets.filter((preset) => preset && !preset.builtin)
      const promptError = mode === 'summary' && summaryPromptPreset === 'custom' && !summaryPromptText.trim()
        ? '摘要提示词不能为空'
        : (mode === 'summary' && summaryPromptText.length > summaryPromptLimit ? '摘要提示词不能超过 ' + summaryPromptLimit + ' 字' : '')
      const compressPayload = () => ({
        mode,
        retainTurns,
        summaryChars: Number(summaryChars),
        maxCostCny: maxCost,
        ...(modelChoice ? { model: modelChoice } : {}),
        ...(mode === 'summary' ? { summaryPrompt: { text: summaryPromptText, name: activeSummaryPreset ? activeSummaryPreset.name : '自定义' } } : {}),
      })
      const pathPayload = () => ({ pathRule, leafId })

      const chooseSummaryPreset = (value) => {
        if (value === 'custom') {
          const draft = customPromptDraft || summaryPromptText
          setSummaryPromptPreset('custom')
          setSummaryPromptText(draft || '')
          return
        }
        const preset = summaryPresets.find((item) => item && item.id === value)
        if (!preset) return
        setSummaryPromptPreset(preset.id)
        setSummaryPromptBase(preset.id)
        setSummaryPromptText(preset.text || '')
      }
      const editSummaryPrompt = (value) => {
        setSummaryPromptText(value)
        setCustomPromptDraft(value)
        if (summaryPromptPreset !== 'custom') setSummaryPromptPreset('custom')
      }
      const restoreSummaryPreset = () => {
        const preset = summaryPresets.find((item) => item && item.id === summaryPromptBase)
          || summaryPresets.find((item) => item && item.id === 'neutral')
          || summaryPresets[0]
        if (!preset) return
        setSummaryPromptPreset(preset.id)
        setSummaryPromptText(preset.text || '')
      }
      const closePresetDialog = () => setPresetDialog(null)
      const openSavePreset = () => {
        const base = activeSummaryPreset && !activeSummaryPreset.builtin
          ? activeSummaryPreset.name + ' 副本'
          : '我的预设'
        setPresetDialog({ mode: 'save', name: base.slice(0, 40), error: '', busy: false })
      }
      const openDeletePreset = () => {
        if (!activeSummaryPreset || activeSummaryPreset.builtin) return
        setPresetDialog({ mode: 'delete', preset: activeSummaryPreset, error: '', busy: false })
      }
      const submitSavePreset = async () => {
        if (!presetDialog || presetDialog.busy) return
        const name = String(presetDialog.name || '').trim()
        if (!name) {
          setPresetDialog({ ...presetDialog, error: '预设名称不能为空' })
          return
        }
        setPresetDialog({ ...presetDialog, busy: true, error: '' })
        try {
          const payload = await call('summaryPresetSave', { name, text: summaryPromptText })
          const saved = payload && payload.preset
          if (!saved) throw new Error('保存失败')
          setProfileInfo((current) => current
            ? { ...current, summaryPresets: [...(Array.isArray(current.summaryPresets) ? current.summaryPresets : []), saved] }
            : current)
          setSummaryPromptPreset(saved.id)
          setSummaryPromptBase(saved.id)
          setSummaryPromptText(saved.text || '')
          setPresetDialog(null)
          setEstimateError('')
        } catch (cause) {
          setPresetDialog({ ...presetDialog, busy: false, error: cause instanceof Error ? cause.message : String(cause) })
        }
      }
      const submitDeletePreset = async () => {
        if (!presetDialog || !presetDialog.preset || presetDialog.busy) return
        const target = presetDialog.preset
        setPresetDialog({ ...presetDialog, busy: true, error: '' })
        try {
          await call('summaryPresetDelete', { id: target.id })
          setProfileInfo((current) => current
            ? { ...current, summaryPresets: (Array.isArray(current.summaryPresets) ? current.summaryPresets : []).filter((preset) => preset.id !== target.id) }
            : current)
          if (summaryPromptPreset === target.id) {
            const fallback = summaryPresets.find((preset) => preset && preset.builtin && preset.id === 'neutral')
              || summaryPresets.find((preset) => preset && preset.builtin)
              || summaryPresets[0]
            setSummaryPromptPreset(fallback ? fallback.id : 'neutral')
            setSummaryPromptBase(fallback ? fallback.id : 'neutral')
            setSummaryPromptText(fallback ? (fallback.text || '') : '')
          }
          setPresetDialog(null)
          setEstimateError('')
        } catch (cause) {
          setPresetDialog({ ...presetDialog, busy: false, error: cause instanceof Error ? cause.message : String(cause) })
        }
      }

      const filtered = React.useMemo(() => {
        const q = query.trim()
        if (!q) return conversations
        return conversations.filter((item) => fuzzyMatch(String(item.title || ''), q))
      }, [conversations, query])

      React.useEffect(() => {
        setEstimate(null)
        setEstimateError('')
        const target = currentPath()
        if (!selectedId || !target) return undefined
        if (promptError) {
          setEstimateError(promptError)
          setEstimating(false)
          return undefined
        }
        setEstimating(true)
        let cancelled = false
        const timer = setTimeout(async () => {
          try {
            const payload = await call('estimate', { path: target, ids: [selectedId], compress: compressPayload(), ...pathPayload() })
            if (!cancelled) setEstimate(payload)
          } catch (cause) {
            if (!cancelled) setEstimateError(cause instanceof Error ? cause.message : String(cause))
          } finally {
            if (!cancelled) setEstimating(false)
          }
        }, 400)
        return () => { cancelled = true; clearTimeout(timer); setEstimating(false) }
      }, [mode, selectedId, loadedPath, filePath, retainTurns, summaryChars, maxCost, pathRule, leafId, modelChoice, summaryPromptPreset, summaryPromptText, promptError])

      const applyLoadPayload = (payload) => {
        const nextSources = Array.isArray(payload.sources) ? payload.sources : []
        setLoadedPath(payload.path)
        setFilePath(payload.path)
        setSources(nextSources)
        setSkipped(Array.isArray(payload.skipped) ? payload.skipped : [])
        setDuplicateConversations(Number(payload.duplicateConversations) || 0)
        setSameConversations(Number(payload.sameConversations) || 0)
        setUpdatedConversations(Number(payload.updatedConversations) || 0)
        setConflictConversations(Number(payload.conflictConversations) || 0)
        setOldOnly(Number(payload.oldOnly) || 0)
        setNewOnly(Number(payload.newOnly) || 0)
        setSkippedOpen(false)
        setFileName(nextSources.length > 1
          ? nextSources.length + ' 个文件'
          : String((nextSources[0] && nextSources[0].name) || '').replace(/^\d{10,}-/, ''))
        setFormat(payload.format)
        setFormats(Array.isArray(payload.formats) ? payload.formats : [])
        setConversations(Array.isArray(payload.conversations) ? payload.conversations : [])
        setSelectedId(null)
        setScrollTop(0)
        setPathRule('recent')
        setLeafId('')
        setPathSummary('')
        if (Array.isArray(payload.recent)) setRecent(payload.recent)
      }

      const onLoad = async (target) => {
        const list = Array.isArray(target)
          ? target.filter((item) => typeof item === 'string' && item)
          : (typeof target === 'string' && target ? [target] : (loadedPath ? [loadedPath] : []))
        if (list.length === 0) { setError('请先选择文件'); return }
        setLoading(true)
        setParseProgress({ done: 0, total: 0 })
        clearError()
        setNotice('')
        try {
          const started = await call('loadStart', list.length === 1 ? { path: list[0] } : { paths: list })
          let job = started.job || null
          if (!job) throw new Error('读取没有开始')
          setParseProgress({ done: Number(job.done) || 0, total: Number(job.total) || 0 })
          while (job.status === 'running') {
            await new Promise((resolve) => setTimeout(resolve, 250))
            const status = await call('loadStatus', {})
            job = status.job
            if (!job) throw new Error('读取状态丢失')
            setParseProgress({ done: Number(job.done) || 0, total: Number(job.total) || 0 })
          }
          if (job.status !== 'done') throw new Error(job.error || '读取失败')
          applyLoadPayload(job.payload)
        } catch (cause) {
          fail(cause)
          call('recent').then((payload) => {
            if (Array.isArray(payload.recent)) setRecent(payload.recent)
          }).catch(() => { /* recent is optional */ })
        } finally {
          setLoading(false)
          setParseProgress(null)
        }
      }

      const onPickFile = () => {
        clearError()
        setNotice('')
        if (fileInputRef.current) fileInputRef.current.click()
      }

      const uploadFile = async (file) => {
        const response = await fetch('/deepseek-chat-history-import/upload', {
          method: 'POST',
          headers: { 'x-file-name': encodeURIComponent(file.name) },
          body: file,
        })
        const payload = await response.json().catch(() => null)
        if (!payload || payload.ok !== true) throw new Error((payload && payload.message) || '读取文件失败')
        return payload.path
      }

      const onFileChosen = async (event) => {
        const input = event && event.target ? event.target : null
        const files = input && input.files ? Array.from(input.files) : []
        if (input) input.value = ''
        if (files.length === 0) return
        if (files.length > MAX_FILES) {
          fail(new Error('一次最多选择 ' + MAX_FILES + ' 个文件'))
          return
        }
        const totalBytes = files.reduce((sum, file) => sum + (Number(file.size) || 0), 0)
        if (totalBytes > MAX_UPLOAD_BYTES) {
          fail(new Error('文件总大小超过 2GB'))
          return
        }
        setPicking(true)
        setPickDone(0)
        setPickTotal(files.length)
        clearError()
        setNotice('')
        const paths = []
        const failed = []
        try {
          for (let index = 0; index < files.length; index += 1) {
            const file = files[index]
            if (!/\.(json|jsonl|zip)$/i.test(file.name)) {
              failed.push({ source: file.name, reason: '不是 json/jsonl/zip 文件' })
            } else {
              try {
                paths.push(await uploadFile(file))
              } catch (cause) {
                failed.push({ source: file.name, reason: cause instanceof Error ? cause.message : String(cause) })
              }
            }
            if (index % 10 === 0 || index === files.length - 1) setPickDone(index + 1)
          }
          if (paths.length === 0) {
            throw new Error(failed.length > 0
              ? failed.map((item) => item.source + '：' + item.reason).join('；')
              : '没有可读取的文件')
          }
          await onLoad(paths)
          if (failed.length > 0) setSkipped((previous) => previous.concat(failed))
        } catch (cause) {
          fail(cause)
        } finally {
          setPicking(false)
        }
      }

      const changePathRule = (value) => {
        if (value === 'custom') { setTranscriptOpen(true); return }
        setPathRule(value)
        setLeafId('')
        setPathSummary('')
      }

      const stopPolling = () => {
        if (pollRef.current) {
          clearTimeout(pollRef.current)
          pollRef.current = null
        }
      }
      const schedulePoll = (fn, delay) => {
        stopPolling()
        pollRef.current = setTimeout(fn, delay || 500)
      }
      const pollJob = async () => {
        try {
          const payload = await call('importStatus', {})
          const next = payload.job || null
          if (next && readStoredJobId() !== next.id) {
            setJob(null)
            setBusy(false)
            stopPolling()
            return
          }
          if (next && next.status === 'cancelled') {
            storeJobId('')
            setCancelDialog(null)
            setJob(null)
            const spent = Number((next.usage && next.usage.costCny) || 0)
            setNotice(spent > 0
              ? '已停止导入，本次已用约 ¥' + formatCost(spent) + '，未写入会话。'
              : '已停止导入，未写入会话。')
            setBusy(false)
            stopPolling()
            return
          }
          if (next && next.status === 'done') {
            setCancelDialog(null)
            syncWorkspace(next)
          }
          if (next && next.status === 'failed') setCancelDialog(null)
          setJob(next)
          if (next && next.status === 'running') {
            setBusy(true)
            schedulePoll(pollJob, 500)
          } else {
            setBusy(false)
            stopPolling()
          }
        } catch {
          schedulePoll(pollJob, 800)
        }
      }

      /** Refresh the session list and place the finished session in its workspace. */
      const syncWorkspace = (finished) => {
        if (!finished || !finished.result || !finished.result.workspaceId) return
        if (syncedJobRef.current === finished.id) return
        syncedJobRef.current = finished.id
        if (clientSessions && typeof clientSessions.refresh === 'function') {
          const refreshed = clientSessions.refresh()
          if (refreshed && typeof refreshed.then === 'function') {
            refreshed.then(() => {
              try {
                if (clientWorkspaces && typeof clientWorkspaces.insertSessionBefore === 'function') {
                  const inserted = clientWorkspaces.insertSessionBefore(finished.result.workspaceId, finished.result.sessionId)
                  if (inserted && typeof inserted.catch === 'function') inserted.catch(() => {})
                }
              } catch {
                // The session is listed either way.
              }
            }).catch(() => {})
          }
        } else if (clientWorkspaces && typeof clientWorkspaces.insertSessionBefore === 'function') {
          try {
            const inserted = clientWorkspaces.insertSessionBefore(finished.result.workspaceId, finished.result.sessionId)
            if (inserted && typeof inserted.catch === 'function') inserted.catch(() => {})
          } catch {
            // The session is listed either way.
          }
        }
      }

      React.useEffect(() => {
        pollJob()
        return stopPolling
      }, [])

      React.useEffect(() => {
        const element = listRef.current
        if (!element) return undefined
        const measure = () => setListHeight(element.clientHeight || 380)
        measure()
        if (typeof ResizeObserver === 'function') {
          const observer = new ResizeObserver(measure)
          observer.observe(element)
          return () => observer.disconnect()
        }
        window.addEventListener('resize', measure)
        return () => window.removeEventListener('resize', measure)
      }, [conversations.length, selectedId])

      React.useEffect(() => {
        if (!cancelDialog) return undefined
        const onKey = (event) => { if (event.key === 'Escape') setCancelDialog(null) }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [cancelDialog])

      const onImport = async () => {
        if (!selectedId || busy || promptError) return
        clearError()
        setNotice('')
        setJobExpanded(false)
        setCancelDialog(null)
        setBusy(true)
        try {
          const payload = await call('importStart', {
            path: currentPath(),
            ids: [selectedId],
            compress: compressPayload(),
            ...pathPayload(),
          })
          if (payload.job) storeJobId(payload.job.id)
          if (payload.job && payload.job.status === 'done') syncWorkspace(payload.job)
          setJob(payload.job || null)
          if (payload.job && payload.job.status === 'running') schedulePoll(pollJob, 500)
          else setBusy(false)
        } catch (cause) {
          setBusy(false)
          fail(cause)
        }
      }

      const openCancelDialog = () => {
        if (!job || job.status !== 'running') return
        if (job.phase === 'writing') return
        const done = (job.summary && job.summary.done) || 0
        const totalSegments = (job.summary && job.summary.total) || 0
        setCancelDialog({
          done,
          total: totalSegments,
          canKeep: done > 0,
          spent: Number((job.usage && job.usage.costCny) || 0),
          retainTurns: job.plan && job.plan.retainTurns != null ? job.plan.retainTurns : null,
        })
      }

      const stopImport = async (kind) => {
        setCancelDialog(null)
        setBusy(true)
        try {
          await call('importCancel', { mode: kind })
        } catch {
          // The next poll reports the real status.
        }
      }

      const dismissJob = () => {
        storeJobId('')
        setJob(null)
        setJobExpanded(false)
        setNotice('')
      }

      const openSettings = () => {
        const settings = (profileInfo && profileInfo.settings) || {}
        const defaults = settings.defaults || {}
        setSettingsDraft({
          importRoot: (profileInfo && profileInfo.importRoot) || '',
          model: settings.model || (profileInfo && profileInfo.profile ? profileInfo.profile.defaultModel : '') || '',
          retainTurns: Number.isFinite(defaults.retainTurns) ? defaults.retainTurns : retainTurns,
          summaryChars: Number.isFinite(Number(defaults.summaryChars)) ? Number(defaults.summaryChars) : summaryChars,
          maxCostCny: Number.isFinite(defaults.maxCostCny) ? defaults.maxCostCny : maxCost,
        })
        setSettingsError('')
        const devs = (profileInfo && profileInfo.devModels) || {}
        const devModel = settings.model && devs[settings.model] ? settings.model : (Object.keys(devs)[0] || '')
        setDevModelId(devModel)
        setDevDraft(devs[devModel] ? cloneJson(devs[devModel]) : null)
        setDevError('')
        setDevOpen(false)
        setSettingsOpen(true)
      }

      const pickDevModel = (id) => {
        const devs = (profileInfo && profileInfo.devModels) || {}
        setDevModelId(id)
        setDevError('')
        setDevDraft(devs[id] ? cloneJson(devs[id]) : null)
      }

      const devPatchOf = (draft) => {
        let patch = {}
        for (const field of DEV_FIELDS) {
          const value = pathGet(draft, field.path)
          if (value !== undefined) patch = pathSet(patch, field.path, value)
        }
        if (draft.summary && Array.isArray(draft.summary.levels)) {
          patch = pathSet(patch, 'summary.levels', draft.summary.levels)
        }
        return patch
      }

      const saveDevConfig = async () => {
        if (!devDraft || !devModelId) return
        setDevSaving(true)
        setDevError('')
        try {
          const payload = await call('devConfigSave', { model: devModelId, config: devPatchOf(devDraft) })
          const fresh = await call('profile')
          setProfileInfo(fresh)
          const devs = (fresh && fresh.devModels) || {}
          setDevDraft(devs[devModelId] ? cloneJson(devs[devModelId]) : cloneJson(payload.config))
        } catch (cause) {
          setDevError(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setDevSaving(false)
        }
      }

      const saveSettings = async () => {
        if (!settingsDraft) return
        setSettingsSaving(true)
        setSettingsError('')
        try {
          const payload = await call('settings', {
            set: {
              importRoot: settingsDraft.importRoot,
              model: settingsDraft.model || '',
              defaults: {
                retainTurns: settingsDraft.retainTurns,
                summaryChars: settingsDraft.summaryChars,
                maxCostCny: settingsDraft.maxCostCny,
              },
            },
          })
          setProfileInfo((current) => current ? { ...current, settings: payload.settings, importRoot: payload.settings.importRoot || current.importRoot } : current)
          if (Number.isFinite(Number(settingsDraft.retainTurns))) setRetainTurns(Math.min(limits.retainTurns[1], Math.max(limits.retainTurns[0], Math.round(Number(settingsDraft.retainTurns)))))
          if (Number.isFinite(Number(settingsDraft.summaryChars))) setSummaryChars(Math.min(limits.summaryChars[1], Math.max(limits.summaryChars[0], Math.round(Number(settingsDraft.summaryChars)))))
          if (Number.isFinite(Number(settingsDraft.maxCostCny))) setMaxCost(Math.min(limits.maxCostCny[1], Math.max(limits.maxCostCny[0], Number(settingsDraft.maxCostCny))))
          setSettingsOpen(false)
        } catch (cause) {
          setSettingsError(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setSettingsSaving(false)
        }
      }

      const recheckContract = async () => {
        setContractChecking(true)
        try {
          const payload = await call('contract', {})
          setProfileInfo((current) => current ? { ...current, contract: payload.contract } : current)
        } catch (cause) {
          fail(cause)
        } finally {
          setContractChecking(false)
        }
      }

      const formatElapsed = (ms) => {
        const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000))
        const minutes = Math.floor(total / 60)
        const seconds = total % 60
        return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0')
      }

      const resultSummary = (result) => {
        if (!result) return ''
        const parts = []
        if (result.partial) {
          const dropped = result.partial.droppedTo >= result.partial.droppedFrom
            ? '；第 ' + result.partial.droppedFrom + '–' + result.partial.droppedTo + ' 轮未生成摘要，已丢弃'
            : ''
          parts.push('部分摘要（第 ' + result.partial.fromTurn + '–' + result.partial.toTurn + ' 轮，计划 '
            + result.partial.total + ' 段，已生成 ' + result.partial.done + ' 段'
            + (result.summaryTotalChars ? '，约 ' + result.summaryTotalChars + ' 字' : '') + '）已写入会话' + dropped)
        } else if (result.mode === 'summary' && result.summarySegments > 0) {
          parts.push('摘要 ' + result.summarySegments + ' 段（约 ' + result.summaryTotalChars + ' 字）已写入会话')
        } else if (result.compressed) {
          parts.push('较早的 ' + Math.max(0, result.totalTurns - result.retainedTurns) + ' 轮已丢弃')
        } else {
          parts.push('保留全部 ' + result.totalTurns + ' 轮')
        }
        if (result.compressed) parts.push('保留最近 ' + result.retainedTurns + ' 轮')
        if (result.attachments && (result.attachments.images || result.attachments.files)) {
          const bits = []
          if (result.attachments.images) bits.push(result.attachments.images + ' 张图片')
          if (result.attachments.files) bits.push(result.attachments.files + ' 个文件')
          parts.push('附件 ' + bits.join('、'))
        }
        if (result.attachments && result.attachments.skipped) parts.push(result.attachments.skipped + ' 个附件未导入')
        if (result.incompleteReplies) parts.push(result.incompleteReplies + ' 条回复未完成')
        if (result.contextPercent != null) parts.push('占用模型上下文约 ' + result.contextPercent + '%')
        if (result.costCny) parts.push('费用约 ¥' + formatCost(result.costCny))
        if (result.fallback && result.reason) parts.push(result.reason)
        return parts.join(' · ')
      }

      const total = filtered.length
      const firstIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 4)
      const visibleCount = Math.ceil(Math.max(220, listHeight) / ROW_HEIGHT) + 8
      const visible = filtered.slice(firstIndex, firstIndex + visibleCount)
      const selected = conversations.find((item) => item.id === selectedId) || null
      const estimateItem = estimate && Array.isArray(estimate.items) ? estimate.items[0] : null
      const recentNameCounts = {}
      for (const entry of recent) recentNameCounts[entry.name] = (recentNameCounts[entry.name] || 0) + 1
      const contractBroken = Boolean(profileInfo && profileInfo.contract && profileInfo.contract.ok === false)
      const profileBroken = Boolean(profileInfo && profileInfo.profile && profileInfo.profile.error)

      const modelName = () => {
        const profile = profileInfo && profileInfo.profile
        const models = (profile && profile.models) || {}
        const chosen = modelChoice || (profile && profile.defaultModel) || ''
        return (models[chosen] && models[chosen].name) || chosen || '摘要模型'
      }

      const estimateText = () => {
        if (!estimateItem) return ''
        if (estimateItem.refused) return '这个对话无法导入：' + estimateItem.refusedReason
        const parts = []
        if (!estimateItem.willCompress) {
          parts.push('对话共 ' + estimateItem.turns + ' 轮，全部保留')
        } else {
          const context = estimateItem.context
          const effective = context && context.effectiveRetainTurns ? context.effectiveRetainTurns : retainTurns
          const older = Math.max(0, estimateItem.turns - effective)
          parts.push('保留最近 ' + effective + ' 轮，前 ' + older + ' 轮' + (mode === 'summary' ? '概括为摘要' : '不保留'))
          if (context && context.adjusted && !estimateItem.forced) parts.push('按当前设置会超出模型上下文，保留轮数已自动减少到 ' + effective + ' 轮')
          if (mode === 'summary' && estimateItem.estimate) {
            const cost = estimateItem.estimate.costCny
            if (cost > maxCost) {
              parts.push('预计费用 ¥' + formatCost(cost) + ' 超过费用上限 ¥' + maxCost + '，不会调用模型')
            } else {
              parts.push('用 ' + modelName() + ' 生成，预计费用 ¥' + formatCost(cost)
                + (estimateItem.estimate.peak ? '（按高峰价计）' : '（按空闲价计）'))
            }
          }
        }
        if (estimateItem.context) {
          const budgetPercent = estimateItem.context.budgetTokens && estimateItem.context.windowTokens
            ? Math.round((estimateItem.context.budgetTokens / estimateItem.context.windowTokens) * 100)
            : 80
          parts.push('占用模型上下文约 ' + estimateItem.context.percent + '%'
            + (estimateItem.willCompress ? '（超过 ' + budgetPercent + '% 会自动压缩较早的对话）' : ''))
        }
        return parts.join('；')
      }

      const renderRow = (item) => h('div', {
        key: item.id,
        className: 'dsdi-rowitem' + (item.id === selectedId ? ' selected' : ''),
        onClick: () => { setSelectedId(item.id); setPathRule('recent'); setLeafId(''); setPathSummary('') },
      },
        h('span', { className: 'dsdi-rowtext' },
          h('span', { className: 'dsdi-rowtitle' }, item.title || '（无标题）'),
          h('span', { className: 'dsdi-rowmeta' },
            item.format ? h('span', null, item.format) : null,
            h('span', null, item.messages + ' 条消息'),
            h('span', null, formatDate(item.updatedAt)),
          ),
        ),
      )

      const formatBadge = formats.length > 0
        ? (formats.length === 1 ? formats[0].label : '混合来源')
        : (format === 'official' ? '官方导出' : format === 'cache' ? '浏览器记录' : format ? '混合来源' : '')
      const formatSummary = formats.length > 1
        ? formats.map((item) => item.label + ' ' + item.count + ' 个').join(' · ')
        : ''
      const parsePercent = parseProgress && parseProgress.total > 0
        ? Math.min(100, Math.round((parseProgress.done / parseProgress.total) * 100))
        : 0
      const duplicateText = duplicateConversations > 0
        ? '有 ' + duplicateConversations + ' 个对话出现在多个来源里：' + sameConversations + ' 个内容相同'
          + (updatedConversations > 0 ? '、' + updatedConversations + ' 个采用较新版本' : '')
          + (conflictConversations > 0 ? '、' + conflictConversations + ' 个无法判断哪份更新（保留先读到的）' : '')
        : ''

      return h('div', { className: 'dsdi-root' },
        h('style', null, CSS),
        h('div', { className: 'dsdi-title' },
          h('h1', null, '导入 DeepSeek 对话'),
          h('span', { className: 'dsdi-hint' }, '支持官方导出文件与浏览器导出文件'),
          h('div', { style: { flex: '1 1 auto' } }),
          h('button', { className: 'dsdi-btn', onClick: openSettings }, '插件配置'),
        ),
        h('div', { className: 'dsdi-row' },
          h('input', {
            ref: fileInputRef,
            type: 'file',
            multiple: true,
            accept: '.json,.jsonl,.zip,application/json',
            style: { display: 'none' },
            onChange: onFileChosen,
          }),
          h('button', { className: 'dsdi-btn', disabled: picking, onClick: onPickFile }, picking
            ? '上传中 ' + (pickTotal > 0 ? pickDone + '/' + pickTotal : '…')
            : '选择文件'),
          fileName
            ? h('span', { className: 'dsdi-filename', title: fileName }, fileName)
            : h('span', { className: 'dsdi-hint' }, '还没有选择文件'),
        ),
        recent.length > 0 ? h('div', { className: 'dsdi-recent' },
          h('span', null, '最近'),
          recent.slice(0, RECENT_CHIPS).map((entry) => h('button', {
            key: entry.path,
            className: 'dsdi-chip',
            title: entry.path,
            onClick: () => { setFileName(entry.name || ''); onLoad(entry.path) },
          }, entry.name
            + (recentNameCounts[entry.name] > 1 && entry.bytes ? ' · ' + formatBytes(entry.bytes) : '')
            + ' · ' + relTime(entry.openedAt))),
        ) : null,
        job ? h('div', { className: 'dsdi-job' + (job.status === 'done' ? ' done' : job.status === 'failed' ? ' failed' : '') },
          job.status === 'running' ? h('div', null,
            h('div', { className: 'dsdi-jobhead' },
              h('span', { className: 'dsdi-jobtitle' }, '正在导入《' + (job.title || (selected && selected.title) || '对话') + '》'),
              h('span', { className: 'dsdi-jobpercent' }, Math.max(1, Math.round((job.progress || 0) * 100)) + '%'),
            ),
            h('div', { className: 'dsdi-jobsub' }, '工作区：' + (job.workspaceName || job.title || (selected && selected.title) || '对话')),
            h('div', { className: 'dsdi-jobbar' },
              h('div', { className: 'dsdi-jobfill', style: { width: Math.max(2, Math.round((job.progress || 0) * 100)) + '%' } }),
            ),
            h('div', { className: 'dsdi-jobmeta' }, [
              job.phaseText + (job.summary && job.summary.total > 0 ? '（' + job.summary.done + ' / ' + job.summary.total + ' 段）' : ''),
              '用时 ' + formatElapsed(job.elapsedMs),
              job.usage && job.usage.costCny != null
                ? '已用约 ¥' + formatCost(job.usage.costCny)
                : '',
            ].filter(Boolean).join(' · ')),
            h('div', { className: 'dsdi-jobactions' },
              job.summary && job.summary.total > 0
                ? h('button', { className: 'dsdi-btn', onClick: () => setJobExpanded(!jobExpanded) }, jobExpanded ? '收起摘要' : '查看摘要')
                : null,
              h('button', {
                className: 'dsdi-btn',
                onClick: openCancelDialog,
                disabled: job.phase === 'writing',
                title: job.phase === 'writing' ? '会话正在写入，停止不会生效' : '',
              }, job.phase === 'writing' ? '写入中…' : '停止导入'),
            ),
            jobExpanded && job.summary && job.summary.segments.length > 0
              ? h('div', { className: 'dsdi-jobsegments' },
                job.summary.segments.map((segment) => h('div', { key: segment.index, className: 'dsdi-jobsegment' },
                  '第 ' + segment.index + ' 段：' + segment.text)),
                job.summary.done < job.summary.total
                  ? h('div', { className: 'dsdi-jobsegment pending' }, '第 ' + (job.summary.done + 1) + ' 段：正在生成')
                  : null,
              )
              : null,
          ) : null,
          job.status === 'done' && job.result ? h('div', null,
            h('div', { className: 'dsdi-jobhead' },
              h('span', { className: 'dsdi-jobtitle' }, '已导入《' + (job.result.title || '对话') + '》'),
            ),
            h('div', { className: 'dsdi-jobsub' }, '工作区：' + job.result.workspaceName),
            h('div', { className: 'dsdi-jobmeta' }, resultSummary(job.result)),
            h('div', { className: 'dsdi-jobactions' },
              h('button', { className: 'dsdi-btn', onClick: dismissJob }, '关闭'),
            ),
          ) : null,
          job.status === 'failed' ? h('div', null,
            h('div', { className: 'dsdi-jobhead' }, h('span', { className: 'dsdi-jobtitle' }, '导入失败')),
            h('div', { className: 'dsdi-jobmeta' }, job.error || '未知错误'),
            job.errorDetail ? h('details', { className: 'dsdi-jobdetail' },
              h('summary', null, '详情'),
              h('div', { className: 'dsdi-jobdetailtext' }, job.errorDetail),
            ) : null,
            h('div', { className: 'dsdi-jobactions' },
              h('button', { className: 'dsdi-btn', onClick: onImport }, '重试'),
              h('button', { className: 'dsdi-btn', onClick: dismissJob }, '关闭'),
            ),
          ) : null,
        ) : null,
        loading ? h('div', { className: 'dsdi-parse' },
          h('span', { className: 'dsdi-parselabel' }, '解析中'),
          h('div', { className: 'dsdi-parsebar' },
            h('div', { className: 'dsdi-parsefill', style: { width: parsePercent + '%' } }),
          ),
          h('span', { className: 'dsdi-parsepercent' }, parsePercent + '%'),
        ) : null,
        h('div', { className: 'dsdi-status' },
          formatBadge ? h('span', { className: 'dsdi-badge ok' }, formatBadge) : null,
          formatSummary ? h('span', { className: 'dsdi-result' }, formatSummary) : null,
          sources.length > 1 ? h('span', null, sources.length + ' 个文件') : null,
          conversations.length ? h('span', null, '共 ' + conversations.length + ' 个对话') : null,
          duplicateText ? h('span', { className: 'dsdi-result' }, duplicateText) : null,
          oldOnly > 0 ? h('span', { className: 'dsdi-result' }, '只出现在较早导出：' + oldOnly + ' 个') : null,
          newOnly > 0 ? h('span', { className: 'dsdi-result' }, '只出现在较新导出：' + newOnly + ' 个') : null,
          skipped.length > 0 ? h('span', { className: 'dsdi-result' }, '跳过 ' + skipped.length + ' 项') : null,
          skipped.length > 0 ? h('button', { className: 'dsdi-link-btn', onClick: () => setSkippedOpen(!skippedOpen) }, skippedOpen ? '收起' : '详情') : null,
          notice ? h('span', { className: 'dsdi-result' }, notice) : null,
        ),
        skippedOpen && skipped.length > 0 ? h('div', { className: 'dsdi-detailtext' },
          skipped.slice(0, 12).map((item, index) => h('div', { key: index }, (item.source ? item.source + '：' : '') + item.reason)),
        ) : null,
        error ? h('div', { className: 'dsdi-errorbox' },
          h('span', null, error),
          errorDetail ? h('button', {
            className: 'dsdi-link-btn',
            onClick: () => setErrorOpen(!errorOpen),
          }, errorOpen ? '收起详情' : '详情') : null,
        ) : null,
        error && errorOpen && errorDetail ? h('div', { className: 'dsdi-detailtext' }, errorDetail) : null,
        contractBroken ? h('div', { className: 'dsdi-errorbox' },
          h('span', null, '当前 DSH 版本可能不兼容，导入可能失败。'),
          h('button', { className: 'dsdi-link-btn', disabled: contractChecking, onClick: recheckContract },
            contractChecking ? '检查中…' : '重新检查'),
          h('button', { className: 'dsdi-link-btn', onClick: () => setContractOpen(!contractOpen) }, contractOpen ? '收起详情' : '详情'),
        ) : null,
        contractBroken && contractOpen && profileInfo.contract.error
          ? h('div', { className: 'dsdi-detailtext' }, profileInfo.contract.error)
          : null,
        profileBroken ? h('div', { className: 'dsdi-errorbox' },
          h('span', null, '模型配置有误，导入已暂停。'),
          h('button', { className: 'dsdi-link-btn', onClick: () => setProfileOpen(!profileOpen) }, profileOpen ? '收起详情' : '详情'),
        ) : null,
        profileBroken && profileOpen && profileInfo.profile.error
          ? h('div', { className: 'dsdi-detailtext' }, profileInfo.profile.error)
          : null,
        conversations.length > 0 ? h('div', { className: 'dsdi-row' },
          h('input', {
            className: 'dsdi-input',
            placeholder: '搜索标题',
            value: query,
            onChange: (event) => setQuery(event.target.value),
          }),
        ) : null,
        conversations.length > 0 ? h('div', { className: 'dsdi-list', ref: listRef, onScroll: (event) => setScrollTop(event.currentTarget.scrollTop) },
          total > visibleCount ? h('div', { style: { height: (total * ROW_HEIGHT) + 'px', position: 'relative' } },
            h('div', { style: { position: 'absolute', top: (firstIndex * ROW_HEIGHT) + 'px', left: 0, right: 0 } },
              visible.map(renderRow),
            ),
          ) : visible.map(renderRow),
        ) : h('div', { className: 'dsdi-list' },
          h('div', { className: 'dsdi-empty' }, conversations.length ? '没有匹配的对话' : '选择文件后显示对话'),
        ),
        h('div', { className: 'dsdi-section' },
          h('div', { className: 'dsdi-sectionhead' },
            h('span', { className: 'dsdi-sectiontitle' }, '导入设置'),
          ),
          selected ? h('div', { className: 'dsdi-sectionbody' },
            h('div', { className: 'dsdi-field' },
              h('span', null, '版本'),
              h('select', {
                className: 'dsdi-select',
                value: pathRule === 'custom' ? 'custom' : pathRule,
                onChange: (event) => changePathRule(event.target.value),
              },
                h('option', { value: 'recent' }, '最后继续的版本'),
                h('option', { value: 'longest' }, '消息最多的版本'),
                h('option', { value: 'custom' }, '逐条选择版本…'),
              ),
              pathRule === 'custom' ? h('span', { className: 'dsdi-desc dsdi-ellipsis' }, '已选：' + (pathSummary || '…'),
                h('button', { className: 'dsdi-link-btn', style: { marginLeft: '8px' }, onClick: () => { clearError(); setNotice(''); setTranscriptOpen(true) } }, '重选'),
              ) : null,
            ),
            h('div', { className: 'dsdi-field' },
              h('span', null, '保留最近'),
              h('input', {
                className: 'dsdi-num',
                type: 'number',
                min: limits.retainTurns[0],
                max: limits.retainTurns[1],
                step: 10,
                value: retainTurns,
                onChange: (event) => {
                  const value = Number(event.target.value)
                  if (!Number.isFinite(value)) return
                  setRetainTurns(Math.min(limits.retainTurns[1], Math.max(limits.retainTurns[0], Math.round(value))))
                },
              }),
              h('span', null, '轮'),
              estimateItem ? h('span', { className: 'dsdi-desc' }, '共 ' + estimateItem.turns + ' 轮') : null,
            ),
            h('div', { className: 'dsdi-field' },
              h('span', null, '超出部分'),
              h('label', { className: 'dsdi-option' },
                h('input', { type: 'radio', name: 'dsdi-mode', checked: mode === 'placeholder', onChange: () => setMode('placeholder') }),
                h('span', null, '不保留'),
              ),
              h('label', { className: 'dsdi-option' },
                h('input', { type: 'radio', name: 'dsdi-mode', checked: mode === 'summary', onChange: () => setMode('summary') }),
                h('span', null, '概括为摘要'),
              ),
            ),
            mode === 'summary' ? h('div', { className: 'dsdi-field' },
              h('span', null, '摘要'),
              h('select', {
                className: 'dsdi-select',
                value: String(summaryChars),
                onChange: (event) => setSummaryChars(Number(event.target.value)),
              },
                levels.map((level) => h('option', { key: level.id || level.chars, value: String(level.chars) }, level.name)),
              ),
              h('span', { className: 'dsdi-optlabel' }, '费用上限'),
              h('input', {
                className: 'dsdi-num',
                type: 'number',
                min: limits.maxCostCny[0],
                max: limits.maxCostCny[1],
                step: 0.5,
                value: maxCost,
                title: '超过费用上限就不会调用模型',
                onChange: (event) => setMaxCost(Number(event.target.value) || 0),
              }),
              h('span', null, '元'),
            ) : null,
            mode === 'summary' && summaryPresets.length > 0 ? h('div', { className: 'dsdi-promptblock' },
              h('div', { className: 'dsdi-prompthead' },
                h('span', null, '提示词'),
                h('select', {
                  className: 'dsdi-select',
                  value: summaryPromptPreset,
                  onChange: (event) => chooseSummaryPreset(event.target.value),
                },
                  h('optgroup', { label: '内置预设' },
                    builtinSummaryPresets.map((preset) => h('option', {
                      key: preset.id,
                      value: preset.id,
                      title: preset.description || '',
                    }, preset.name || preset.id)),
                  ),
                  customSummaryPresets.length > 0 ? h('optgroup', { label: '我的预设' },
                    customSummaryPresets.map((preset) => h('option', {
                      key: preset.id,
                      value: preset.id,
                      title: preset.description || '',
                    }, preset.name || preset.id)),
                  ) : null,
                  h('option', { value: 'custom' }, '自定义'),
                ),
                h('button', { className: 'dsdi-link-btn', onClick: restoreSummaryPreset }, '恢复预设'),
                h('button', { className: 'dsdi-link-btn', onClick: openSavePreset }, '保存为预设'),
                activeSummaryPreset && !activeSummaryPreset.builtin
                  ? h('button', { className: 'dsdi-link-btn', onClick: openDeletePreset }, '删除')
                  : null,
              ),
              h('textarea', {
                className: 'dsdi-prompttext',
                rows: 4,
                maxLength: summaryPromptLimit,
                value: summaryPromptText,
                placeholder: '选择预设，或直接输入自定义提示词',
                onChange: (event) => editSummaryPrompt(event.target.value),
              }),
              h('div', { className: 'dsdi-promptmeta' },
                h('span', null, ''),
                h('span', null, summaryPromptText.length + ' / ' + summaryPromptLimit),
              ),
              promptError ? h('div', { className: 'dsdi-err' }, promptError) : null,
            ) : null,
            h('div', { className: 'dsdi-estimate' }, estimating
              ? ''
              : (estimateError ? '无法预估：' + estimateError : estimateText())),
          ) : h('div', { className: 'dsdi-sectionbody' },
            h('div', { className: 'dsdi-sectionempty' }, '选择一个对话后可以设置版本、保留轮数和摘要方式。'),
          ),
        ),
                h('div', { className: 'dsdi-footer' },
          h('button', {
            className: 'dsdi-btn primary',
            disabled: busy || !selectedId || estimating || profileBroken || Boolean(promptError),
            onClick: onImport,
          }, busy ? '导入中…' : (estimating ? '计算中…' : '导入')),
          h('span', { className: 'dsdi-result' }, selected ? '已选择：' + (selected.title || '无标题') : '先选择一个对话'),
        ),
        transcriptOpen && selectedId ? h(TranscriptPicker, {
          path: currentPath(),
          conversationId: selectedId,
          title: selected ? (selected.title || '无标题') : '',
          initialLeafId: pathRule === 'custom' ? leafId : '',
          onClose: () => setTranscriptOpen(false),
          onConfirm: (leaf, preview) => {
            setPathRule('custom')
            setLeafId(leaf)
            setPathSummary(preview || '')
            setTranscriptOpen(false)
          },
        }) : null,
        cancelDialog ? h('div', { className: 'dsdi-dialog-layer' },
          h('div', { className: 'dsdi-dialog-backdrop', onClick: () => setCancelDialog(null) }),
          h('div', { className: 'dsdi-dialog small', role: 'dialog', 'aria-modal': 'true' },
            h('div', { className: 'dsdi-dialog-header' },
              h('span', { className: 'dsdi-dialog-title' }, '停止导入？'),
            ),
            h('div', { className: 'dsdi-cancel-body' },
              h('div', { className: 'dsdi-cancel-line' }, cancelDialog.canKeep
                ? '已生成 ' + cancelDialog.done + ' / ' + cancelDialog.total + ' 段摘要'
                  + (cancelDialog.spent > 0 ? '，本次已用约 ¥' + formatCost(cancelDialog.spent) : '') + '。'
                : '还没有生成摘要，停止不会产生费用，也不会创建会话。'),
              cancelDialog.canKeep ? h('div', { className: 'dsdi-cancel-note' },
                h('div', null, '保留已完成部分：已生成的 ' + cancelDialog.done + ' 段会作为摘要写入会话'
                  + (cancelDialog.total > cancelDialog.done
                    ? '；其余 ' + (cancelDialog.total - cancelDialog.done) + ' 段不生成摘要。'
                    : '。')
                  + (cancelDialog.retainTurns != null ? '保留最近 ' + cancelDialog.retainTurns + ' 轮原文。' : '')),
                h('div', null, '停止并丢弃：不写入任何内容，已用费用不退。'),
              ) : null,
            ),
            h('div', { className: 'dsdi-dialog-footer' },
              h('button', { className: 'dsdi-btn danger', onClick: () => stopImport('discard') }, cancelDialog.canKeep ? '停止并丢弃' : '停止导入'),
              cancelDialog.canKeep
                ? h('button', { className: 'dsdi-btn', onClick: () => stopImport('keep') }, '保留已完成部分并停止')
                : null,
              h('div', { style: { flex: '1 1 auto' } }),
              h('button', { className: 'dsdi-btn primary', onClick: () => setCancelDialog(null) }, '继续导入'),
            ),
          ),
        ) : null,
        settingsOpen && settingsDraft ? h('div', { className: 'dsdi-dialog-layer' },
          h('div', { className: 'dsdi-dialog-backdrop', onClick: () => setSettingsOpen(false) }),
          h('div', { className: 'dsdi-dialog small', role: 'dialog', 'aria-modal': 'true' },
            h('div', { className: 'dsdi-dialog-header' },
              h('span', { className: 'dsdi-dialog-title' }, '插件配置'),
            ),
            h('div', { className: 'dsdi-cancel-body', style: { overflow: 'auto', maxHeight: '70vh' } },
              h('div', { className: 'dsdi-dialognote' }, '这些值用于新导入；已导入的会话不受影响。'),
              h('div', { className: 'dsdi-field' },
                h('span', { className: 'dsdi-optlabel' }, '导入位置'),
                h('input', {
                  className: 'dsdi-input',
                  value: settingsDraft.importRoot,
                  title: '新导入的工作区会建在这个目录下',
                  onChange: (event) => setSettingsDraft({ ...settingsDraft, importRoot: event.target.value }),
                }),
                h('button', {
                  className: 'dsdi-link-btn',
                  onClick: () => setSettingsDraft({ ...settingsDraft, importRoot: (profileInfo && profileInfo.defaultImportRoot) || '' }),
                }, '恢复默认'),
              ),
              profileInfo && profileInfo.profile && Object.keys(profileInfo.profile.models).length > 0
                ? h('div', { className: 'dsdi-field' },
                  h('span', null, '摘要模型'),
                  h('select', {
                    className: 'dsdi-select',
                    value: settingsDraft.model,
                    onChange: (event) => setSettingsDraft({ ...settingsDraft, model: event.target.value }),
                  },
                    Object.entries(profileInfo.profile.models).map(([id, info]) => h('option', { key: id, value: id }, info.name || id)),
                  ),
                )
                : null,
              h('div', { className: 'dsdi-field' },
                h('span', null, '默认保留最近'),
                h('input', {
                  className: 'dsdi-num',
                  type: 'number',
                  min: limits.retainTurns[0],
                  max: limits.retainTurns[1],
                  step: 10,
                  value: settingsDraft.retainTurns,
                  onChange: (event) => setSettingsDraft({ ...settingsDraft, retainTurns: Number(event.target.value) }),
                }),
                h('span', null, '轮'),
              ),
              h('div', { className: 'dsdi-field' },
                h('span', null, '默认摘要'),
                h('select', {
                  className: 'dsdi-select',
                  value: String(settingsDraft.summaryChars),
                  onChange: (event) => setSettingsDraft({ ...settingsDraft, summaryChars: Number(event.target.value) }),
                },
                  levels.map((level) => h('option', { key: level.id || level.chars, value: String(level.chars) }, level.name)),
                ),
              ),
              h('div', { className: 'dsdi-field' },
                h('span', null, '默认费用上限'),
                h('input', {
                  className: 'dsdi-num',
                  type: 'number',
                  min: limits.maxCostCny[0],
                  max: limits.maxCostCny[1],
                  step: 0.5,
                  value: settingsDraft.maxCostCny,
                  onChange: (event) => setSettingsDraft({ ...settingsDraft, maxCostCny: Number(event.target.value) }),
                }),
                h('span', null, '元'),
              ),
              h('div', { className: 'dsdi-section' },
                h('div', { className: 'dsdi-sectionhead' },
                  h('span', { className: 'dsdi-sectiontitle' }, '开发者配置'),
                  h('button', { className: 'dsdi-link-btn', onClick: () => setDevOpen(!devOpen) }, devOpen ? '收起' : '展开'),
                ),
                devOpen ? h('div', { className: 'dsdi-sectionbody' },
                  h('div', { className: 'dsdi-field' },
                    h('span', null, '模型'),
                    h('select', {
                      className: 'dsdi-select',
                      value: devModelId,
                      onChange: (event) => pickDevModel(event.target.value),
                    },
                      Object.keys((profileInfo && profileInfo.devModels) || {}).map((id) => h('option', { key: id, value: id }, id)),
                    ),
                  ),
                  devDraft ? h('div', { style: { display: 'grid', gridTemplateColumns: '1fr', gap: '4px', maxHeight: '300px', overflow: 'auto', paddingRight: '4px' } },
                    DEV_FIELDS.map((field) => h('div', { className: 'dsdi-field', key: field.path },
                      h('span', null, field.label),
                      h('input', {
                        className: 'dsdi-num',
                        type: field.text ? 'text' : 'number',
                        ...(field.text ? {} : { step: field.step }),
                        value: pathGet(devDraft, field.path) == null ? '' : pathGet(devDraft, field.path),
                        onChange: (event) => setDevDraft(pathSet(devDraft, field.path, field.text ? event.target.value : Number(event.target.value))),
                      }),
                    )),
                    ((devDraft.summary && Array.isArray(devDraft.summary.levels)) ? devDraft.summary.levels : []).map((level, index) => h('div', { className: 'dsdi-field', key: 'level-' + index },
                      h('span', null, '摘要档位·' + (level.name || level.id || String(index + 1))),
                      h('input', {
                        className: 'dsdi-num',
                        type: 'number',
                        min: 1,
                        step: 100,
                        value: level.chars,
                        onChange: (event) => setDevDraft({
                          ...devDraft,
                          summary: {
                            ...devDraft.summary,
                            levels: devDraft.summary.levels.map((item, itemIndex) => (
                              itemIndex === index ? { ...item, chars: Number(event.target.value) } : item
                            )),
                          },
                        }),
                      }),
                      h('span', null, '字'),
                    )),
                  ) : h('div', { className: 'dsdi-desc' }, '这个模型没有可编辑的配置'),
                  devError ? h('div', { className: 'dsdi-err' }, devError) : null,
                  h('div', { className: 'dsdi-field' },
                    h('button', {
                      className: 'dsdi-btn primary',
                      disabled: devSaving || !devDraft,
                      onClick: saveDevConfig,
                    }, devSaving ? '保存中…' : '保存开发者配置'),
                  ),
                  h('div', { className: 'dsdi-desc' }, '写入本机 profile.json：' + ((profileInfo && profileInfo.devConfigPath) || '')),
                ) : null,
              ),
              settingsError ? h('div', { className: 'dsdi-err' }, settingsError) : null,
            ),
            h('div', { className: 'dsdi-dialog-footer' },
              h('div', { style: { flex: '1 1 auto' } }),
              h('button', { className: 'dsdi-btn', onClick: () => setSettingsOpen(false) }, '取消'),
              h('button', { className: 'dsdi-btn primary', disabled: settingsSaving, onClick: saveSettings }, settingsSaving ? '保存中…' : '保存'),
            ),
          ),
        ) : null,
        presetDialog ? h('div', { className: 'dsdi-dialog-layer' },
          h('div', { className: 'dsdi-dialog-backdrop', onClick: closePresetDialog }),
          h('div', { className: 'dsdi-dialog small', role: 'dialog', 'aria-modal': 'true' },
            h('div', { className: 'dsdi-dialog-header' },
              h('span', { className: 'dsdi-dialog-title' }, presetDialog.mode === 'delete' ? '删除预设' : '保存为预设'),
            ),
            h('div', { className: 'dsdi-cancel-body' },
              presetDialog.mode === 'delete'
                ? h('div', { className: 'dsdi-dialognote' }, '删除「' + (presetDialog.preset && presetDialog.preset.name) + '」？内置预设不会受影响。')
                : h('div', { className: 'dsdi-dialognote' }, '保存当前提示词，之后可在“我的预设”中选择。'),
              presetDialog.mode === 'save'
                ? h('div', { className: 'dsdi-field' },
                  h('span', { className: 'dsdi-optlabel' }, '名称'),
                  h('input', {
                    className: 'dsdi-input',
                    value: presetDialog.name,
                    maxLength: 40,
                    placeholder: '给这个预设起个名字',
                    autoFocus: true,
                    onChange: (event) => setPresetDialog({ ...presetDialog, name: event.target.value, error: '' }),
                  }),
                )
                : null,
              presetDialog.error ? h('div', { className: 'dsdi-err' }, presetDialog.error) : null,
            ),
            h('div', { className: 'dsdi-dialog-footer' },
              h('div', { style: { flex: '1 1 auto' } }),
              h('button', { className: 'dsdi-btn', disabled: presetDialog.busy, onClick: closePresetDialog }, '取消'),
              presetDialog.mode === 'delete'
                ? h('button', { className: 'dsdi-btn danger', disabled: presetDialog.busy, onClick: submitDeletePreset }, presetDialog.busy ? '删除中…' : '删除')
                : h('button', { className: 'dsdi-btn primary', disabled: presetDialog.busy, onClick: submitSavePreset }, presetDialog.busy ? '保存中…' : '保存'),
            ),
          ),
        ) : null,
      )
    }
