    function ImportIcon(props) {
      const size = (props && props.size) || 16
      return h('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
        h('path', { d: 'M8 2v7.2M8 9.2 5.2 6.4M8 9.2l2.8-2.8', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' }),
        h('path', { d: 'M3 11.6v1.2c0 .66.54 1.2 1.2 1.2h7.6c.66 0 1.2-.54 1.2-1.2v-1.2', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' }),
      )
    }
