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
