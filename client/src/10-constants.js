    const API = '/deepseek-import/api'
    const ROW_HEIGHT = 46
    const RECENT_CHIPS = 4
    const DEFAULT_LEVELS = { brief: 800, standard: 1500, detailed: 2500 }
    const DEFAULT_LIMITS = { retainTurns: [1, 5000], maxCostCny: [0, 20] }
    const SUMMARY_LEVELS = { brief: 800, standard: 1500, detailed: 2500 }
    /** Client workspace service; set in apply so a finished import can update the sidebar. */
    let clientWorkspaces = null
    /** Client session service; a finished import refreshes the list so the session row appears. */
    let clientSessions = null
