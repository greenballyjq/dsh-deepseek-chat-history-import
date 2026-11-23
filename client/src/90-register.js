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