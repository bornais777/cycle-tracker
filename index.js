(function () {
    'use strict';

    function init() {
        // 创建浮动按钮
        if (document.getElementById('cycle-tracker-btn')) return;

        var btn = document.createElement('div');
        btn.id = 'cycle-tracker-btn';
        btn.textContent = '🌙';
        btn.style.cssText = [
            'position:fixed',
            'bottom:120px',
            'right:16px',
            'width:48px',
            'height:48px',
            'border-radius:50%',
            'background:#6e3fa3',
            'color:#fff',
            'font-size:24px',
            'line-height:48px',
            'text-align:center',
            'cursor:pointer',
            'z-index:2147483647',
            'box-shadow:0 3px 12px rgba(0,0,0,0.4)',
        ].join(';');

        btn.onclick = function () {
            alert('🌙 生理周期追踪器运行正常！');
        };

        document.body.appendChild(btn);
        console.log('[CycleTracker] 按钮已创建');
    }

    // 多重触发保险
    if (document.body) {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }

    setTimeout(init, 1000);
    setTimeout(init, 3000);

    try {
        var ctx = SillyTavern.getContext();
        if (ctx && ctx.eventSource && ctx.event_types) {
            ctx.eventSource.on(ctx.event_types.APP_READY, init);
        }
    } catch(e) {
        console.log('[CycleTracker] getContext error:', e);
    }

})();
