    const API = '/deepseek-chat-history-import/api'
    const ROW_HEIGHT = 46
    const RECENT_CHIPS = 4
    const DEFAULT_SUMMARY_CHARS = 1500
    const DEFAULT_LIMITS = { retainTurns: [1, 5000], maxCostCny: [0, 20], summaryChars: [500, 4000] }
    /** Client workspace service; set in apply so a finished import can update the sidebar. */
    let clientWorkspaces = null
    /** Client session service; a finished import refreshes the list so the session row appears. */
    let clientSessions = null
