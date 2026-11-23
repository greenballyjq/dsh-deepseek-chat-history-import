    function TranscriptPicker({ path, conversationId, title, onClose, onConfirm, initialLeafId }) {
      const [messages, setMessages] = React.useState([])
      const [leafId, setLeafId] = React.useState('')
      const [pathLength, setPathLength] = React.useState(0)
      const [loading, setLoading] = React.useState(true)
      const [error, setError] = React.useState('')
      const [switching, setSwitching] = React.useState(false)
      const [query, setQuery] = React.useState('')
      const [searchIndex, setSearchIndex] = React.useState(0)
      const [onlyVersions, setOnlyVersions] = React.useState(false)
      const [scrollTop, setScrollTop] = React.useState(0)
      const [sideScrollTop, setSideScrollTop] = React.useState(0)
      const [viewport, setViewport] = React.useState(560)
      const [detail, setDetail] = React.useState(null)
      const [versionMenu, setVersionMenu] = React.useState(null)
      const [hasMoreBefore, setHasMoreBefore] = React.useState(false)
      const [loadingBefore, setLoadingBefore] = React.useState(false)
      const [tailState, setTailState] = React.useState(null)
      const [highlight, setHighlight] = React.useState(false)
      const listRef = React.useRef(null)
      const sideRef = React.useRef(null)
      const dialogRef = React.useRef(null)

      const load = async (before) => {
        const payload = await call('transcript', {
          path,
          id: conversationId,
          limit: 600,
          ...(initialLeafId ? { leafId: initialLeafId } : {}),
          ...(before ? { before } : {}),
        })
        return payload
      }

      React.useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError('')
        load().then((payload) => {
          if (cancelled) return
          setMessages(Array.isArray(payload.messages) ? payload.messages : [])
          setLeafId(payload.leafId || '')
          setPathLength(Number(payload.pathLength) || 0)
          setHasMoreBefore(Boolean(payload.hasMoreBefore))
        }).catch((cause) => {
          if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause))
        }).finally(() => {
          if (!cancelled) setLoading(false)
        })
        return () => { cancelled = true }
      }, [path, conversationId, initialLeafId])

      React.useEffect(() => {
        const previous = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = previous }
      }, [])

      React.useEffect(() => {
        if (loading || messages.length === 0) return undefined
        const timer = setTimeout(() => {
          const element = listRef.current
          if (!element) return
          element.scrollTop = element.scrollHeight
          setScrollTop(element.scrollTop)
        }, 0)
        return () => clearTimeout(timer)
      }, [loading])

      React.useEffect(() => {
        const element = listRef.current
        if (!element) return undefined
        const measure = () => setViewport(element.clientHeight || 560)
        measure()
        if (typeof ResizeObserver === 'function') {
          const observer = new ResizeObserver(measure)
          observer.observe(element)
          return () => observer.disconnect()
        }
        return undefined
      }, [loading])

      React.useEffect(() => {
        if (!versionMenu) return undefined
        const close = () => setVersionMenu(null)
        window.addEventListener('pointerdown', close)
        return () => window.removeEventListener('pointerdown', close)
      }, [versionMenu])

      React.useEffect(() => {
        const onKey = (event) => {
          if (event.key !== 'Escape') return
          if (detail) { setDetail(null); return }
          if (versionMenu) { setVersionMenu(null); return }
          onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [detail, versionMenu, onClose])

      React.useEffect(() => {
        if (!highlight) return undefined
        const timer = setTimeout(() => setHighlight(false), 1600)
        return () => clearTimeout(timer)
      }, [highlight])

      const rows = React.useMemo(() => {
        const all = messages.map((message, index) => ({ message, index }))
        if (!onlyVersions) return all
        return all.filter((row) => row.message.versions && row.message.versions.length > 1)
      }, [messages, onlyVersions])

      const branches = React.useMemo(() => {
        const out = []
        messages.forEach((message, index) => {
          const versions = message.versions || []
          if (versions.length < 2) return
          out.push({ index, message, total: versions.length })
        })
        return out
      }, [messages])

      const startIndex = Math.max(0, Math.floor(scrollTop / TRANSCRIPT_ROW_HEIGHT) - 2)
      const endIndex = Math.min(rows.length, startIndex + Math.ceil(viewport / TRANSCRIPT_ROW_HEIGHT) + 4)
      const visible = rows.slice(startIndex, endIndex)
      const sideStart = Math.max(0, Math.floor(sideScrollTop / TRANSCRIPT_SIDEBAR_ROW) - 2)
      const sideEnd = Math.min(branches.length, sideStart + Math.ceil(viewport / TRANSCRIPT_SIDEBAR_ROW) + 4)
      const sideVisible = branches.slice(sideStart, sideEnd)

      const q = query.trim()
      const matches = q ? rows.filter((row) => fuzzyMatch(row.message.text, q)) : []
      const matchCount = matches.length
      const currentMatch = matchCount > 0 ? matches[searchIndex % matchCount] : null

      const scrollToPosition = (position) => {
        const element = listRef.current
        if (!element) return
        element.scrollTop = Math.max(0, position * TRANSCRIPT_ROW_HEIGHT - 60)
        setScrollTop(element.scrollTop)
      }

      const jumpToMatch = (delta) => {
        if (matchCount === 0) return
        const next = (searchIndex + delta + matchCount) % matchCount
        setSearchIndex(next)
        const target = matches[next]
        const position = rows.findIndex((row) => row.index === target.index)
        if (position >= 0) scrollToPosition(position)
      }

      const loadEarlier = async () => {
        if (loadingBefore || messages.length === 0 || !hasMoreBefore) return
        setLoadingBefore(true)
        try {
          const payload = await load(messages[0].id)
          const earlier = Array.isArray(payload.messages) ? payload.messages : []
          setMessages((current) => earlier.concat(current))
          setHasMoreBefore(Boolean(payload.hasMoreBefore))
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setLoadingBefore(false)
        }
      }

      const switchVersion = async (rowIndex, versionId) => {
        if (switching) return
        setSwitching(true)
        setVersionMenu(null)
        setError('')
        try {
          const payload = await call('tail', { path, id: conversationId, versionId, limit: 600 })
          const tail = Array.isArray(payload.messages) ? payload.messages : []
          setMessages((current) => current.slice(0, rowIndex).concat(tail))
          setLeafId(payload.leafId || '')
          setPathLength(rowIndex + tail.length)
          setTailState(payload.hasMore ? { versionId, after: tail.length > 0 ? tail[tail.length - 1].id : '' } : null)
          setHighlight(true)
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setSwitching(false)
        }
      }

      const loadMoreTail = async () => {
        if (!tailState || switching) return
        setSwitching(true)
        try {
          const payload = await call('tail', {
            path,
            id: conversationId,
            versionId: tailState.versionId,
            after: tailState.after,
            limit: 600,
          })
          const tail = Array.isArray(payload.messages) ? payload.messages : []
          setMessages((current) => current.concat(tail))
          setLeafId(payload.leafId || leafId)
          setPathLength((current) => current + tail.length)
          setTailState(payload.hasMore ? { versionId: tailState.versionId, after: tail.length > 0 ? tail[tail.length - 1].id : tailState.after } : null)
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setSwitching(false)
        }
      }

      const openDetail = async (message) => {
        try {
          const payload = await call('message', { path, id: conversationId, messageId: message.id })
          setDetail({ messageId: message.id, text: payload.text || '', role: payload.role || message.role, time: payload.time || message.time, versions: payload.versions || message.versions || [] })
        } catch (cause) {
          setDetail({ messageId: message.id, text: message.text || '', role: message.role, time: message.time, versions: message.versions || [] })
        }
      }

      const openVersionMenu = (event, rowIndex, message) => {
        event.stopPropagation()
        const rect = event.currentTarget.getBoundingClientRect()
        const dialog = dialogRef.current ? dialogRef.current.getBoundingClientRect() : { left: 0, top: 0 }
        setVersionMenu({
          rowIndex,
          messageId: message.id,
          x: Math.max(12, Math.min(rect.left - dialog.left - 160, dialog.width - 380)),
          y: rect.bottom - dialog.top + 6,
          versions: message.versions || [],
          selected: message.selectedVersion || 0,
        })
      }

      const selectedLast = messages.length > 0 ? messages[messages.length - 1] : null

      return h('div', { className: 'dsdi-dialog-layer' },
        h('div', { className: 'dsdi-dialog-backdrop', onClick: onClose }),
        h('div', { className: 'dsdi-dialog', ref: dialogRef },
          h('div', { className: 'dsdi-dialog-header' },
            h('span', { className: 'dsdi-dialog-title' }, '选择版本'),
            h('span', { className: 'dsdi-dialog-sub' }, title || ''),
            h('div', { style: { flex: '1 1 auto' } }),
            h('div', { className: 'dsdi-dialog-search' },
              h('input', {
                className: 'dsdi-dialog-searchinput',
                placeholder: '搜索对话内容',
                value: query,
                onChange: (event) => { setQuery(event.target.value); setSearchIndex(0) },
                onKeyDown: (event) => {
                  if (event.key === 'Enter') jumpToMatch(event.shiftKey ? -1 : 1)
                },
              }),
              q ? h('span', { className: 'dsdi-dialog-matchcount' }, matchCount > 0 ? (searchIndex % matchCount) + 1 + ' / ' + matchCount : '无匹配') : null,
              q ? h('button', { className: 'dsdi-mini-btn', disabled: matchCount === 0, onClick: () => jumpToMatch(-1), title: '上一个匹配' }, '‹') : null,
              q ? h('button', { className: 'dsdi-mini-btn', disabled: matchCount === 0, onClick: () => jumpToMatch(1), title: '下一个匹配' }, '›') : null,
            ),
            h('label', { className: 'dsdi-dialog-filter' },
              h('input', {
                type: 'checkbox',
                checked: onlyVersions,
                onChange: (event) => setOnlyVersions(event.target.checked),
              }),
              '只看有版本的消息',
            ),
            h('button', { className: 'dsdi-dialog-close', onClick: onClose, title: '关闭' }, '×'),
          ),
          h('div', { className: 'dsdi-dialog-body' },
            h('div', { className: 'dsdi-dialog-main' },
              hasMoreBefore
                ? h('button', { className: 'dsdi-load-earlier', disabled: loadingBefore, onClick: loadEarlier },
                  loadingBefore ? '加载中…' : '加载更早的消息')
                : null,
              loading
                ? h('div', { className: 'dsdi-dialog-empty' }, '读取中…')
                : error && messages.length === 0
                  ? h('div', { className: 'dsdi-dialog-empty' }, '读取失败：' + error)
                  : h('div', {
                    className: 'dsdi-dialog-list',
                    ref: listRef,
                    onScroll: (event) => setScrollTop(event.currentTarget.scrollTop),
                  },
                    h('div', { style: { height: rows.length * TRANSCRIPT_ROW_HEIGHT, position: 'relative' } },
                      visible.map((row, offset) => {
                        const message = row.message
                        const versions = message.versions || []
                        const position = message.selectedVersion >= 0 ? message.selectedVersion : 0
                        const rowPosition = startIndex + offset
                        const isUser = message.role === 'user'
                        const isCurrentMatch = currentMatch && currentMatch.index === row.index
                        return h('div', {
                          key: message.id,
                          className: 'dsdi-dialog-row' + (isUser ? ' user' : '') + (isCurrentMatch ? ' match' : '') + (highlight && row.index >= rows.length - 4 ? ' changed' : ''),
                          style: { position: 'absolute', top: rowPosition * TRANSCRIPT_ROW_HEIGHT, left: 0, right: 0, height: TRANSCRIPT_ROW_HEIGHT },
                        },
                          h('div', { className: 'dsdi-dialog-rowmeta' },
                            h('span', { className: 'dsdi-dialog-role ' + (isUser ? 'user' : 'assistant') }, isUser ? '你' : '助手'),
                            h('span', null, '第 ' + (row.index + 1) + ' 条'),
                            h('span', null, compactTime(message.time)),
                            versions.length > 1 ? h('span', { className: 'dsdi-dialog-versions' }, versions.length + ' 个版本') : null,
                          ),
                          h('div', { className: 'dsdi-dialog-bubble' }, h('div', { className: 'dsdi-dialog-bubbletext' }, message.text || '（空白消息）')),
                          h('div', { className: 'dsdi-dialog-rowactions' },
                            h('button', { className: 'dsdi-link-btn', onClick: () => openDetail(message) }, '全文'),
                            versions.length > 1
                              ? h('span', { className: 'dsdi-dialog-switch' },
                                h('button', {
                                  className: 'dsdi-ver-btn',
                                  disabled: switching || position <= 0,
                                  onClick: (event) => { event.stopPropagation(); switchVersion(row.index, versions[position - 1].id) },
                                }, '‹'),
                                h('button', {
                                  className: 'dsdi-ver-label-btn',
                                  disabled: switching,
                                  onClick: (event) => openVersionMenu(event, row.index, message),
                                }, '版本 ' + (position + 1) + ' / ' + versions.length),
                                h('button', {
                                  className: 'dsdi-ver-btn',
                                  disabled: switching || position >= versions.length - 1,
                                  onClick: (event) => { event.stopPropagation(); switchVersion(row.index, versions[position + 1].id) },
                                }, '›'),
                                switching ? h('span', { className: 'dsdi-ver-loading' }, '切换中…') : null,
                              )
                              : null,
                          ),
                        )
                      }),
                    ),
                  ),
            ),
            h('div', { className: 'dsdi-dialog-side' },
              h('div', { className: 'dsdi-side-title' }, '多版本位置'),
              h('div', { className: 'dsdi-side-hint' }, '点一下跳到该位置'),
              h('div', {
                className: 'dsdi-side-list',
                ref: sideRef,
                onScroll: (event) => setSideScrollTop(event.currentTarget.scrollTop),
              },
                h('div', { style: { height: branches.length * TRANSCRIPT_SIDEBAR_ROW, position: 'relative' } },
                  sideVisible.map((entry, offset) => h('button', {
                    key: entry.message.id,
                    className: 'dsdi-side-card',
                    style: { position: 'absolute', top: (sideStart + offset) * TRANSCRIPT_SIDEBAR_ROW, left: 0, right: 0, height: TRANSCRIPT_SIDEBAR_ROW - 6 },
                    onClick: () => {
                      const position = rows.findIndex((row) => row.index === entry.index)
                      if (position >= 0) scrollToPosition(position)
                    },
                  },
                    h('span', { className: 'dsdi-side-card-title' }, '第 ' + (entry.index + 1) + ' 条 · ' + entry.total + ' 个版本'),
                    (entry.message.versions || []).slice(0, 2).map((version, versionIndex) => h('span', {
                      key: version.id,
                      className: 'dsdi-side-card-line' + (version.selected ? ' selected' : ''),
                    }, (versionIndex + 1) + '. ' + (version.preview || '').slice(0, 26))),
                  )),
                ),
              ),
              h('div', { className: 'dsdi-side-count' }, '共 ' + branches.length + ' 处'),
            ),
          ),
          h('div', { className: 'dsdi-dialog-footer' },
            h('span', { className: 'dsdi-dialog-selected' }, selectedLast
              ? '已选 ' + (pathLength || messages.length) + ' 条消息'
              : '还没有选择版本'),
            error && messages.length > 0 ? h('span', { className: 'dsdi-dialog-error' }, error) : null,
            tailState ? h('button', { className: 'dsdi-link-btn', disabled: switching, onClick: loadMoreTail }, '加载更多') : null,
            h('button', { className: 'dsdi-btn', onClick: onClose }, '取消'),
            h('button', {
              className: 'dsdi-btn primary',
              disabled: !leafId || switching,
              onClick: () => { if (leafId) onConfirm(leafId, selectedLast ? String(selectedLast.text || '').slice(0, 40) : '') },
            }, '使用这个版本'),
          ),
          versionMenu ? h('div', {
            className: 'dsdi-version-menu',
            style: { left: versionMenu.x + 'px', top: versionMenu.y + 'px' },
            onPointerDown: (event) => event.stopPropagation(),
          },
            versionMenu.versions.map((version, index) => h('button', {
              key: version.id,
              className: 'dsdi-version-menuitem' + (index === versionMenu.selected ? ' selected' : ''),
              onClick: () => switchVersion(versionMenu.rowIndex, version.id),
            },
              h('span', { className: 'dsdi-version-menutitle' }, '版本 ' + (index + 1) + ' / ' + versionMenu.versions.length + ' · ' + compactTime(version.time)),
              h('span', { className: 'dsdi-version-menupreview' }, (version.preview || '').slice(0, 40)),
            )),
          ) : null,
          detail ? h('div', { className: 'dsdi-detail-layer' },
            h('div', { className: 'dsdi-dialog-backdrop', onClick: () => setDetail(null) }),
            h('div', { className: 'dsdi-detail' },
              h('div', { className: 'dsdi-detail-header' },
                h('span', { className: 'dsdi-detail-title' }, (detail.role === 'user' ? '你' : '助手') + ' · ' + compactTime(detail.time)),
                h('button', { className: 'dsdi-dialog-close', onClick: () => setDetail(null) }, '×'),
              ),
              h('div', { className: 'dsdi-detail-text' }, detail.text || '（空白消息）'),
              detail.versions && detail.versions.length > 1 ? h('div', { className: 'dsdi-detail-versions' },
                h('div', { className: 'dsdi-detail-subtitle' }, '这条消息的版本'),
                detail.versions.map((version, index) => h('button', {
                  key: version.id,
                  className: 'dsdi-detail-version' + (version.selected ? ' selected' : ''),
                  onClick: () => { setDetail(null); switchVersion(0, version.id) },
                },
                  h('span', null, '版本 ' + (index + 1) + ' / ' + detail.versions.length + ' · ' + compactTime(version.time)),
                  h('span', { className: 'dsdi-detail-preview' }, (version.preview || '').slice(0, 50)),
                )),
              ) : null,
            ),
          ) : null,
        ),
      )
    }

    /** One short line describing the import settings; used by the estimate row. */