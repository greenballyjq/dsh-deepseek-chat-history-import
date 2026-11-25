window.__ModuleLoader__.load({
  id: 'dsh-deepseek-chat-history-import',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const API = '/deepseek-chat-history-import/api'
    const ROW_HEIGHT = 46
    const RECENT_CHIPS = 4
    const DEFAULT_SUMMARY_CHARS = 1500
    const DEFAULT_LIMITS = { retainTurns: [1, 5000], maxCostCny: [0, 20], summaryChars: [500, 4000] }
    /** Client workspace service; set in apply so a finished import can update the sidebar. */
    let clientWorkspaces = null
    /** Client session service; a finished import refreshes the list so the session row appears. */
    let clientSessions = null

    const CSS = `
.dsdi-root{display:flex;flex-direction:column;height:100%;min-height:0;gap:10px;padding:16px 18px;box-sizing:border-box;color:var(--dsw-alias-label-primary,#1f2329);font-size:13px;overflow:hidden}
.dsdi-title{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.dsdi-title h1{font-size:16px;font-weight:600;margin:0}
.dsdi-hint{color:var(--dsw-alias-label-secondary,#8a8f99);font-size:12px}
.dsdi-filename{color:#1f2329;font-size:12px;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsdi-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dsdi-input{flex:1 1 320px;min-width:220px;height:32px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#d9dce1);background:var(--dsw-alias-bg-layer-1,#fff);color:inherit;font-size:13px;outline:none;box-sizing:border-box}
.dsdi-input:focus{border-color:var(--dsw-alias-brand-primary,#4d6bfe)}
.dsdi-btn{height:32px;padding:0 14px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#d9dce1);background:var(--dsw-alias-bg-layer-1,#fff);color:inherit;font-size:13px;cursor:pointer;white-space:nowrap}
.dsdi-btn:hover{border-color:var(--dsw-alias-brand-primary,#4d6bfe)}
.dsdi-btn:disabled{opacity:.45;cursor:not-allowed}
.dsdi-btn.primary{background:var(--dsw-alias-brand-primary,#4d6bfe);border-color:var(--dsw-alias-brand-primary,#4d6bfe);color:#fff}
.dsdi-status{display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:var(--dsw-alias-label-secondary,#8a8f99);font-size:12px;min-height:18px}
.dsdi-job{margin:4px 0 0;border-radius:10px;background:#eef2ff;border:1px solid #c9d4ff;padding:10px 12px}
.dsdi-job.done{background:#eaf7ee;border-color:#b9e3c9}
.dsdi-job.failed{background:#fdf1f0;border-color:#f0c2bf}
.dsdi-jobhead{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.dsdi-jobtitle{font-size:13px;font-weight:600;color:#1f2329}
.dsdi-jobpercent{font-size:12px;color:#4d6bfe}
.dsdi-jobsub{font-size:11px;color:#8a8f99;margin-top:2px}
.dsdi-jobbar{margin:8px 0;height:8px;border-radius:4px;background:#dbe3ff;overflow:hidden}
.dsdi-jobfill{height:100%;background:#4d6bfe;border-radius:4px;transition:width .3s}
.dsdi-jobmeta{font-size:11px;color:#8a8f99;line-height:1.6;white-space:pre-wrap;word-break:break-word}
.dsdi-jobactions{display:flex;gap:8px;margin-top:8px}
.dsdi-jobsegments{margin-top:8px;max-height:150px;overflow:auto;background:#fff;border:1px solid #eef1f5;border-radius:8px;padding:8px 10px}
.dsdi-jobsegment{font-size:11px;color:#1f2329;line-height:1.6;margin-bottom:4px;white-space:pre-wrap;word-break:break-word}
.dsdi-jobsegment.pending{color:#8a8f99}
.dsdi-badge{padding:1px 8px;border-radius:999px;background:var(--dsw-alias-bg-layer-2,#f2f4f7);border:1px solid var(--dsw-alias-border-l1,#d9dce1);font-size:11px}
.dsdi-badge.ok{color:var(--dsw-alias-state-success-primary,#1a7f37);border-color:var(--dsw-alias-state-success-primary,#1a7f37)}
.dsdi-list{flex:1 1 auto;min-height:0;overflow:auto;border:1px solid var(--dsw-alias-border-l1,#d9dce1);border-radius:10px;background:var(--dsw-alias-bg-layer-1,#fff);position:relative}
.dsdi-rowitem{display:flex;align-items:center;gap:10px;height:${ROW_HEIGHT}px;padding:0 12px;box-sizing:border-box;border-bottom:1px solid var(--dsw-alias-border-l1,#eef0f3);cursor:pointer}
.dsdi-rowitem:hover{background:var(--dsw-alias-bg-layer-2,#f7f8fa)}
.dsdi-rowitem.selected{background:var(--dsw-alias-bg-selected,#eaf0ff)}
.dsdi-rowtext{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}
.dsdi-rowtitle{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px}
.dsdi-rowmeta{color:var(--dsw-alias-label-secondary,#8a8f99);font-size:11px;display:flex;gap:10px}
.dsdi-empty{padding:40px 16px;text-align:center;color:var(--dsw-alias-label-secondary,#8a8f99)}
.dsdi-section{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1,#e4e7ec);border-radius:10px;background:var(--dsw-alias-bg-layer-2,#fafbfc);flex-shrink:0}
.dsdi-sectiontitle{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary,#1f2329)}
.dsdi-sectionhead{display:flex;align-items:center;justify-content:space-between;gap:10px}
.dsdi-sectionbody{display:flex;flex-direction:column;gap:6px}
.dsdi-sectionempty{color:var(--dsw-alias-label-secondary,#8a8f99);font-size:12px;padding:8px 0}
.dsdi-optlabel{color:var(--dsw-alias-label-secondary,#8a8f99)}
.dsdi-dialognote{font-size:12px;color:var(--dsw-alias-label-secondary,#8a8f99);line-height:1.5;margin-bottom:2px}
.dsdi-desc{font-size:12px;color:var(--dsw-alias-label-secondary,#8a8f99);line-height:1.5}
.dsdi-estimate{min-height:34px;font-size:12px;color:var(--dsw-alias-label-secondary,#8a8f99);line-height:1.5}
.dsdi-warn{font-size:12px;line-height:1.5;color:var(--dsw-alias-state-warning-primary,#92400e);background:var(--dsw-alias-bg-warning,#fffbeb);border:1px solid var(--dsw-alias-border-warning,#f59e0b);border-radius:8px;padding:6px 10px}
.dsdi-option{display:flex;gap:8px;align-items:flex-start;cursor:pointer;font-size:12px;line-height:1.5}
.dsdi-option input{margin-top:2px}
.dsdi-field{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--dsw-alias-label-secondary,#8a8f99);min-height:30px}
.dsdi-promptblock{display:flex;flex-direction:column;gap:5px;padding:2px 0 0}
.dsdi-prompthead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--dsw-alias-label-secondary,#8a8f99);min-height:28px}
.dsdi-prompttext{display:block;width:100%;min-height:92px;max-height:220px;resize:vertical;padding:8px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#d9dce1);background:var(--dsw-alias-bg-layer-1,#fff);color:inherit;font-family:inherit;font-size:12px;line-height:1.6;outline:none;box-sizing:border-box}
.dsdi-prompttext:focus{border-color:var(--dsw-alias-brand-primary,#4d6bfe)}
.dsdi-promptmeta{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary,#8a8f99)}
.dsdi-promptnote{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary,#8a8f99)}
.dsdi-num{width:76px;height:28px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#d9dce1);background:var(--dsw-alias-bg-layer-1,#fff);color:inherit;font-size:12px;padding:0 8px;box-sizing:border-box}
.dsdi-select{height:28px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#d9dce1);background:var(--dsw-alias-bg-layer-1,#fff);color:inherit;font-size:12px;padding:0 8px}
.dsdi-footer{display:flex;align-items:center;gap:12px;flex-wrap:wrap;flex-shrink:0}
.dsdi-recent{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--dsw-alias-label-secondary,#8a8f99);flex-shrink:0}
.dsdi-chip{max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:2px 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1,#d9dce1);background:var(--dsw-alias-bg-layer-1,#fff);color:inherit;font-size:12px;cursor:pointer}
.dsdi-chip:hover{border-color:var(--dsw-alias-brand-primary,#4d6bfe)}
.dsdi-err{color:var(--dsw-alias-state-error-primary,#d1242f);font-size:12px;white-space:pre-wrap}
.dsdi-errorbox{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--dsw-alias-state-error-primary,#d1242f)}
.dsdi-detailtext{font-size:11px;color:#8a8f99;background:#f7f8fa;border:1px solid #eef0f3;border-radius:8px;padding:6px 10px;white-space:pre-wrap;word-break:break-all}
.dsdi-jobdetail{font-size:11px;color:#8a8f99;margin-top:6px}
.dsdi-jobdetailtext{margin-top:4px;white-space:pre-wrap;word-break:break-all;color:#4b5563}
.dsdi-result{font-size:12px;color:var(--dsw-alias-label-secondary,#8a8f99)}
.dsdi-ellipsis{max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsdi-ver-btn{border:none;background:none;color:#4d6bfe;font-size:14px;cursor:pointer;padding:0 4px;line-height:1}
.dsdi-ver-btn:disabled{opacity:.3;cursor:default}
.dsdi-ver-label{white-space:nowrap}
.dsdi-ver-loading{color:#8a8f99}
.dsdi-dialog-layer{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center}
.dsdi-dialog-backdrop{position:absolute;inset:0;background:rgba(15,18,25,.45)}
.dsdi-dialog{position:relative;width:min(1100px,92vw);height:min(760px,86vh);background:#fff;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.25);display:flex;flex-direction:column;overflow:hidden}
.dsdi-dialog.small{width:min(480px,92vw);height:auto;max-height:86vh}
.dsdi-cancel-body{padding:16px 18px 6px}
.dsdi-cancel-line{font-size:13px;color:#1f2329;line-height:1.7}
.dsdi-cancel-note{margin-top:10px;padding-top:10px;border-top:1px solid #eef0f3;font-size:12.5px;color:#4b5563;line-height:1.7;display:flex;flex-direction:column;gap:4px}
.dsdi-cancel-foot{padding:0 18px 12px;font-size:11px;color:#8a8f99}
.dsdi-btn.danger{color:#b3261e;border-color:#f0c2bf}
.dsdi-btn.danger:hover{border-color:#b3261e}
.dsdi-dialog-header{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid #e6e9ee;flex-shrink:0}
.dsdi-dialog-title{font-size:16px;font-weight:600;color:#1f2329}
.dsdi-dialog-sub{font-size:13px;color:#8a8f99;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsdi-dialog-search{display:flex;align-items:center;gap:6px}
.dsdi-dialog-searchinput{width:220px;height:30px;border-radius:8px;border:1px solid #d9dce1;padding:0 10px;font-size:12px;box-sizing:border-box;color:#1f2329}
.dsdi-dialog-matchcount{font-size:11px;color:#8a8f99;min-width:44px;text-align:center}
.dsdi-mini-btn{width:26px;height:26px;border-radius:6px;border:1px solid #d9dce1;background:#fff;color:#1f2329;cursor:pointer}
.dsdi-mini-btn:disabled{opacity:.35;cursor:default}
.dsdi-dialog-filter{display:flex;align-items:center;gap:6px;font-size:12px;color:#1f2329;white-space:nowrap}
.dsdi-dialog-close{width:30px;height:30px;border-radius:8px;border:1px solid #d9dce1;background:#fff;font-size:18px;line-height:1;cursor:pointer;color:#1f2329}
.dsdi-dialog-body{flex:1 1 auto;display:flex;min-height:0}
.dsdi-dialog-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;min-height:0}
.dsdi-load-earlier{align-self:center;margin:8px 0 0;border:none;background:none;color:#4d6bfe;font-size:12px;cursor:pointer;padding:4px 8px;border-radius:6px;flex-shrink:0}
.dsdi-load-earlier:disabled{opacity:.5}
.dsdi-dialog-list{flex:1 1 auto;overflow:auto;padding:8px 0}
.dsdi-dialog-row{box-sizing:border-box;padding:8px 18px}
.dsdi-dialog-row.user .dsdi-dialog-rowmeta{justify-content:flex-end}
.dsdi-dialog-row.user .dsdi-dialog-bubble{margin-left:auto;background:#4d6bfe;color:#fff;border-radius:12px 12px 2px 12px}
.dsdi-dialog-row.user .dsdi-dialog-rowactions{justify-content:flex-end}
.dsdi-dialog-rowmeta{display:flex;align-items:center;gap:8px;font-size:11px;color:#8a8f99;margin-bottom:4px}
.dsdi-dialog-role{font-size:11px;padding:0 7px;border-radius:999px;border:1px solid #d9dce1;color:#1f2329}
.dsdi-dialog-role.user{border-color:#4d6bfe;color:#4d6bfe}
.dsdi-dialog-versions{color:#8a8f99}
.dsdi-dialog-bubble{max-width:72%;background:#f2f4f7;border-radius:12px 12px 12px 2px;padding:8px 12px;font-size:13px;line-height:19px;color:#1f2329;overflow:hidden;word-break:break-word}
.dsdi-dialog-bubbletext{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-height:38px;word-break:break-word}
.dsdi-dialog-rowactions{display:flex;align-items:center;gap:10px;margin-top:6px;font-size:12px}
.dsdi-link-btn{border:none;background:none;color:#4d6bfe;font-size:12px;cursor:pointer;padding:0}
.dsdi-dialog-switch{display:inline-flex;align-items:center;gap:6px;border:1px solid #4d6bfe;border-radius:999px;padding:1px 6px}
.dsdi-ver-label-btn{border:none;background:none;color:#4d6bfe;font-size:12px;cursor:pointer;padding:0 4px;white-space:nowrap}
.dsdi-ver-label-btn::after{content:'';display:inline-block;margin-left:4px;width:0;height:0;border-left:3px solid transparent;border-right:3px solid transparent;border-top:4px solid currentColor;vertical-align:middle}
.dsdi-ver-label-btn:disabled{opacity:.4;cursor:default}
.dsdi-ver-loading{color:#8a8f99;font-size:11px;margin-left:4px}
.dsdi-dialog-side{width:320px;flex:0 0 320px;border-left:1px solid #e6e9ee;display:flex;flex-direction:column;min-height:0;background:#fff}
.dsdi-side-title{padding:12px 14px 2px;font-size:13px;font-weight:600;color:#1f2329}
.dsdi-side-hint{padding:0 14px 8px;font-size:11px;color:#8a8f99}
.dsdi-side-list{flex:1 1 auto;overflow:auto}
.dsdi-side-card{display:flex;flex-direction:column;gap:3px;text-align:left;border:1px solid #e8ebf0;border-radius:8px;background:#fff;padding:6px 9px;cursor:pointer;box-sizing:border-box;width:calc(100% - 20px);margin:3px 10px 0}
.dsdi-side-card:hover{background:#f7f9ff;border-color:#c9d4ff}
.dsdi-side-card-title{font-size:12px;color:#1f2329}
.dsdi-side-card-line{font-size:11px;color:#8a8f99;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsdi-side-card-line.selected{color:#4d6bfe}
.dsdi-side-count{padding:8px 14px;font-size:11px;color:#8a8f99;border-top:1px solid #eef0f3}
.dsdi-dialog-footer{display:flex;align-items:center;gap:10px;padding:12px 18px;border-top:1px solid #e6e9ee;flex-shrink:0}
.dsdi-dialog-selected{flex:1 1 auto;font-size:13px;color:#1f2329;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsdi-dialog-error{font-size:12px;color:#d1242f;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsdi-dialog-empty{flex:1 1 auto;display:flex;align-items:center;justify-content:center;color:#8a8f99;font-size:13px}
.dsdi-version-menu{position:absolute;width:360px;max-height:320px;overflow:auto;background:#fff;border:1px solid #d9dce1;border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.16);padding:6px;z-index:5}
.dsdi-version-menuitem{display:flex;flex-direction:column;gap:2px;width:100%;text-align:left;border:none;background:none;padding:6px 8px;border-radius:6px;cursor:pointer}
.dsdi-version-menuitem:hover{background:#f2f5ff}
.dsdi-version-menuitem.selected{background:#eef2ff}
.dsdi-version-menutitle{font-size:11px;color:#8a8f99}
.dsdi-version-menupreview{font-size:12px;color:#1f2329;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsdi-detail-layer{position:absolute;inset:0;z-index:10}
.dsdi-detail{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(640px,86%);max-height:76%;background:#fff;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.28);display:flex;flex-direction:column;overflow:hidden}
.dsdi-detail-header{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #e6e9ee}
.dsdi-detail-title{font-size:14px;font-weight:600;color:#1f2329;flex:1 1 auto}
.dsdi-detail-text{padding:14px 16px;font-size:13px;line-height:1.6;color:#1f2329;overflow:auto;white-space:pre-wrap;word-break:break-word}
.dsdi-detail-versions{border-top:1px solid #eef0f3;padding:10px 16px 14px;max-height:220px;overflow:auto}
.dsdi-detail-subtitle{font-size:12px;color:#8a8f99;margin-bottom:6px}
.dsdi-detail-version{display:flex;flex-direction:column;gap:2px;width:100%;text-align:left;border:1px solid #e8ebf0;border-radius:8px;background:#fff;padding:6px 8px;margin-bottom:6px;cursor:pointer}
.dsdi-detail-version.selected{border-color:#4d6bfe;background:#eef2ff}
.dsdi-detail-preview{font-size:11px;color:#8a8f99;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsdi-parse{display:flex;align-items:center;gap:10px;flex-shrink:0}
.dsdi-parselabel{font-size:12px;color:#8a8f99;white-space:nowrap}
.dsdi-parsebar{flex:1 1 auto;height:6px;border-radius:3px;background:#e4e7ec;overflow:hidden;min-width:80px}
.dsdi-parsefill{height:100%;background:#4d6bfe;border-radius:3px;transition:width .2s}
.dsdi-parsepercent{font-size:12px;color:#8a8f99;min-width:38px;text-align:right;font-variant-numeric:tabular-nums}
`

    /** Case-insensitive, whitespace-trimmed substring match; no scattered-character fallback. */
    function fuzzyMatch(text, query) {
      const q = String(query || '').trim().toLowerCase()
      if (!q) return true
      return String(text || '').toLowerCase().includes(q)
    }

    async function call(method, params) {
      const response = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method, params }),
      })
      const payload = await response.json().catch(() => null)
      if (!payload || payload.ok !== true) {
        const error = new Error((payload && payload.message) || ('请求失败（' + response.status + '）'))
        if (payload && typeof payload.detail === 'string' && payload.detail) error.detail = payload.detail
        throw error
      }
      return payload
    }

    function formatDate(ms) {
      if (!ms) return ''
      try {
        return new Date(ms).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      } catch {
        return ''
      }
    }

    function formatBytes(bytes) {
      if (!Number.isFinite(bytes) || bytes <= 0) return ''
      if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB'
      if (bytes >= 1024 * 1024) return Math.round(bytes / 1024 / 1024) + ' MB'
      return Math.round(bytes / 1024) + ' KB'
    }

    function relTime(ms) {
      const diff = Date.now() - Number(ms)
      if (!Number.isFinite(diff) || diff < 0) return ''
      if (diff < 60_000) return '刚刚'
      if (diff < 3_600_000) return Math.floor(diff / 60_000) + ' 分钟前'
      if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + ' 小时前'
      if (diff < 7 * 86_400_000) return Math.floor(diff / 86_400_000) + ' 天前'
      try {
        return new Date(Number(ms)).toLocaleDateString('zh-CN')
      } catch {
        return ''
      }
    }

    function compactTime(ms) {
      if (!ms) return ''
      try {
        return new Date(Number(ms)).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      } catch {
        return ''
      }
    }

    function formatCost(value) {
      const cost = Number(value) || 0
      if (cost <= 0) return '0'
      const trim = (text) => text.replace(/\.?0+$/, '')
      if (cost < 0.01) return trim(cost.toFixed(4))
      if (cost < 0.1) return trim(cost.toFixed(3))
      return cost.toFixed(2)
    }

    const TRANSCRIPT_ROW_HEIGHT = 132
    const TRANSCRIPT_SIDEBAR_ROW = 62

    /** Deep copy for the developer-config draft. */
    function cloneJson(value) {
      return value == null ? value : JSON.parse(JSON.stringify(value))
    }

    function pathGet(source, pathText) {
      let cursor = source
      for (const part of String(pathText).split('.')) {
        if (cursor == null) return undefined
        cursor = cursor[part]
      }
      return cursor
    }

    function pathSet(source, pathText, value) {
      const parts = String(pathText).split('.')
      const root = { ...(source || {}) }
      let cursor = root
      for (let index = 0; index < parts.length - 1; index += 1) {
        cursor[parts[index]] = { ...(cursor[parts[index]] || {}) }
        cursor = cursor[parts[index]]
      }
      cursor[parts[parts.length - 1]] = value
      return root
    }

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
      const [reasoningEffort, setReasoningEffort] = React.useState('off')
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
          setReasoningEffort(String(defaults.summaryReasoningEffort || 'off'))
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
      const reasoningOptions = (profileInfo && Array.isArray(profileInfo.reasoningEfforts)) ? profileInfo.reasoningEfforts : []
      const defaultReasoningEffort = () => {
        const settings = (profileInfo && profileInfo.settings) || {}
        const defaults = settings.defaults || {}
        return String(defaults.summaryReasoningEffort || 'off')
      }
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
        reasoningEffort,
        ...(modelChoice ? { model: modelChoice } : {}),
        ...(mode === 'summary' ? { summaryPrompt: { text: summaryPromptText, name: activeSummaryPreset ? activeSummaryPreset.name : '自定义' } } : {}),
      })
      const pathPayload = () => ({ pathRule, leafId })

      React.useEffect(() => {
        setReasoningEffort(defaultReasoningEffort())
      }, [selectedId])

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
          summaryReasoningEffort: defaults.summaryReasoningEffort || 'off',
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
                summaryReasoningEffort: settingsDraft.summaryReasoningEffort,
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
            const costLabel = reasoningEffort === 'off' ? '预计费用' : '预估（不含思考）'
            if (cost > maxCost) {
              parts.push(costLabel + ' ¥' + formatCost(cost) + ' 超过费用上限 ¥' + maxCost + '，不会调用模型')
            } else {
              parts.push('用 ' + modelName() + ' 生成，' + costLabel + ' ¥' + formatCost(cost)
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
            mode === 'summary' ? h('div', { className: 'dsdi-field' },
              h('span', null, '思考强度'),
              h('select', {
                className: 'dsdi-select',
                value: reasoningEffort,
                onChange: (event) => setReasoningEffort(event.target.value),
              },
                reasoningOptions.map((effort) => h('option', { key: effort.id, value: effort.id }, effort.label)),
              ),
            ) : null,
            mode === 'summary' && reasoningEffort !== 'off'
              ? h('div', { className: 'dsdi-warn' }, '思考 token 按输出计费，当前费用预估不包含这部分，实际费用会更高。')
              : null,
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
                h('span', null, '默认思考强度'),
                h('select', {
                  className: 'dsdi-select',
                  value: settingsDraft.summaryReasoningEffort,
                  onChange: (event) => setSettingsDraft({ ...settingsDraft, summaryReasoningEffort: event.target.value }),
                },
                  reasoningOptions.map((effort) => h('option', { key: effort.id, value: effort.id }, effort.label)),
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

    function ImportIcon(props) {
      const size = (props && props.size) || 16
      return h('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
        h('path', { d: 'M8 2v7.2M8 9.2 5.2 6.4M8 9.2l2.8-2.8', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' }),
        h('path', { d: 'M3 11.6v1.2c0 .66.54 1.2 1.2 1.2h7.6c.66 0 1.2-.54 1.2-1.2v-1.2', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' }),
      )
    }

    return {
      inject: ['slots', 'workspaces', 'sessions'],
      apply(ctx) {
        clientWorkspaces = ctx.workspaces
        clientSessions = ctx.sessions
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'deepseek-chat-history-import',
          order: 2,
          label: () => '导入',
        }, ImportIcon))
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: 'deepseek-chat-history-import',
        }, ImportPanel))
      },
    }
  },
})
