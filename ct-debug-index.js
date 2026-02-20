/**
 * Cycle Tracker v3.1 - Termux compatible
 * No ES module imports, uses SillyTavern globals directly
 */

(function () {
    'use strict';

    // ── Error display ─────────────────────────────────────
    window.onerror = function(msg, src, line) {
        const d = document.createElement('div');
        d.style.cssText = 'position:fixed;top:10px;left:10px;right:10px;z-index:99999;' +
            'background:#3a0000;color:#ff9999;padding:12px;border-radius:8px;font-size:12px;' +
            'font-family:monospace;white-space:pre-wrap;word-break:break-all;border:1px solid #ff000055;';
        d.textContent = '[CT Error]\n' + msg + '\nLine: ' + line;
        document.body.appendChild(d);
        setTimeout(function(){ d.remove(); }, 20000);
    };

    const EXT = 'cycle-tracker';

    const PHASES = {
        menstrual:  { label: '经期',  color: '#c07090', glow: '#c0709055', symptoms: '疲倦、腹部不适、情绪低落或敏感' },
        follicular: { label: '卵泡期', color: '#7ab893', glow: '#7ab89355', symptoms: '精力逐渐恢复、思维清晰、社交意愿上升' },
        ovulation:  { label: '排卵期', color: '#c9a84c', glow: '#c9a84c55', symptoms: '精力充沛、情绪开朗、表达欲和感知力强' },
        luteal:     { label: '黄体期', color: '#8b7ab8', glow: '#8b7ab855', symptoms: '内收、需要独处、对细节和语气更敏感' },
        pms:        { label: 'PMS',   color: '#b8896a', glow: '#b8896a55', symptoms: '情绪波动、易激惹或感伤、轻微身体预警' },
    };

    const DEFAULTS = {
        lastStart: '',
        cycleLength: 28,
        periodLength: 5,
        injectEnabled: true,
    };

    // ── Helpers ───────────────────────────────────────────

    function getSettings() {
        if (!window.extension_settings) window.extension_settings = {};
        if (!window.extension_settings[EXT]) {
            window.extension_settings[EXT] = Object.assign({}, DEFAULTS);
        }
        const s = window.extension_settings[EXT];
        for (const [k, v] of Object.entries(DEFAULTS)) {
            if (s[k] === undefined) s[k] = v;
        }
        return s;
    }

    function save() {
        if (window.saveSettingsDebounced) window.saveSettingsDebounced();
    }

    function getDayPhase(d, cycleLen, periodLen) {
        const ovDay    = Math.round(cycleLen / 2);
        const pmsStart = cycleLen - 4;
        if (d <= periodLen)   return 'menstrual';
        if (d <= ovDay - 2)   return 'follicular';
        if (d <= ovDay + 1)   return 'ovulation';
        if (d >= pmsStart)    return 'pms';
        return 'luteal';
    }

    function calcStatus() {
        const s = getSettings();
        if (!s.lastStart) return null;
        const today = new Date(); today.setHours(0,0,0,0);
        const start = new Date(s.lastStart); start.setHours(0,0,0,0);
        const cycleLen  = s.cycleLength  || 28;
        const periodLen = s.periodLength || 5;
        const diff = Math.floor((today - start) / 86400000);
        const dayInCycle = ((diff % cycleLen) + cycleLen) % cycleLen + 1;
        const phaseKey = getDayPhase(dayInCycle, cycleLen, periodLen);
        const phase = PHASES[phaseKey];
        const daysUntilNext = cycleLen - dayInCycle + 1;
        const nextDate = new Date(today);
        nextDate.setDate(nextDate.getDate() + daysUntilNext);
        return {
            dayInCycle, cycleLen, phaseKey,
            phaseLabel: phase.label,
            color: phase.color,
            glow: phase.glow,
            symptoms: phase.symptoms,
            periodDay: dayInCycle <= periodLen ? dayInCycle : null,
            daysUntilNext,
            nextPeriodDate: nextDate.toISOString().slice(0,10),
            triggerTag: 'cycle:' + phaseKey,
        };
    }

    function cycledayToDate(d) {
        const s = getSettings();
        if (!s.lastStart) return null;
        const dt = new Date(s.lastStart);
        dt.setHours(0,0,0,0);
        dt.setDate(dt.getDate() + d - 1);
        return dt.toLocaleDateString('zh-CN', { month:'numeric', day:'numeric' });
    }

    function showToast(msg) {
        if (typeof toastr !== 'undefined') { toastr.warning(msg); return; }
        const t = document.createElement('div');
        t.textContent = msg;
        Object.assign(t.style, {
            position:'fixed', bottom:'180px', left:'50%', transform:'translateX(-50%)',
            background:'#2a1f35', color:'#c4a8f0', padding:'8px 16px', borderRadius:'8px',
            fontSize:'0.82em', zIndex:'10000', opacity:'0', transition:'opacity 0.2s',
        });
        document.body.appendChild(t);
        setTimeout(function(){ t.style.opacity = '1'; }, 10);
        setTimeout(function(){ t.style.opacity = '0'; setTimeout(function(){ t.remove(); }, 300); }, 2500);
    }

    // ── Prompt injection ──────────────────────────────────

    function setupInjection() {
        // Hook into SillyTavern's event system
        const events = window.eventSource || (window.SillyTavern && window.SillyTavern.eventSource);
        if (!events) {
            setTimeout(setupInjection, 1000);
            return;
        }

        // Try different event names used across ST versions
        const evNames = [
            'generate_before_combine_prompts',
            'GENERATE_BEFORE_COMBINE_PROMPTS',
        ];

        evNames.forEach(function(ev) {
            try {
                events.on(ev, function(data) {
                    const s = getSettings();
                    if (!s.injectEnabled) return;
                    const status = calcStatus();
                    if (!status) return;
                    const tag = '\n[' + status.triggerTag + ']';
                    if (data && typeof data.after_note === 'string') {
                        data.after_note += tag;
                    } else if (data) {
                        data.after_note = tag;
                    }
                });
            } catch(e) {}
        });
    }

    // ── Styles ────────────────────────────────────────────

    function injectStyles() {
        if (document.getElementById('ct-styles')) return;
        const style = document.createElement('style');
        style.id = 'ct-styles';
        style.textContent = [
            '#ct-fab{position:fixed;right:18px;bottom:120px;width:48px;height:48px;border-radius:50%;',
            'background:linear-gradient(135deg,#2a1f35,#1a1428);border:1.5px solid #6b4d8044;',
            'box-shadow:0 4px 20px #00000088,0 0 12px #9b6fc422;cursor:pointer;z-index:9998;',
            'display:flex;align-items:center;justify-content:center;font-size:20px;',
            'user-select:none;touch-action:none;transition:box-shadow .2s,transform .15s;}',

            '#ct-fab:hover{box-shadow:0 4px 24px #00000099,0 0 18px #9b6fc455;transform:scale(1.08);}',

            '#ct-overlay{position:fixed;inset:0;z-index:9997;display:none;}',

            '#ct-panel{position:fixed;right:14px;bottom:178px;width:300px;max-height:72vh;',
            'background:linear-gradient(160deg,#1c1525,#150f20);border:1px solid #3d2d5022;',
            'border-radius:18px;box-shadow:0 8px 40px #00000099,0 0 0 1px #ffffff08;',
            'z-index:9999;display:none;flex-direction:column;overflow:hidden;',
            'font-family:-apple-system,"PingFang SC",sans-serif;touch-action:none;}',
            '#ct-panel.open{display:flex;}',

            '#ct-ph{padding:14px 16px 10px;cursor:grab;display:flex;align-items:center;',
            'justify-content:space-between;border-bottom:1px solid #ffffff0a;flex-shrink:0;}',
            '#ct-ph:active{cursor:grabbing;}',
            '#ct-pt{font-size:.82em;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#9b7fc4;opacity:.85;}',
            '#ct-pc{width:22px;height:22px;border-radius:50%;background:#ffffff0f;border:none;',
            'color:#ffffff55;font-size:13px;cursor:pointer;display:flex;align-items:center;',
            'justify-content:center;transition:background .15s;flex-shrink:0;}',
            '#ct-pc:hover{background:#ffffff1a;color:#fff;}',

            '#ct-pb{overflow-y:auto;flex:1;padding:14px 16px 18px;',
            'scrollbar-width:thin;scrollbar-color:#3d2d50 transparent;}',
            '#ct-pb::-webkit-scrollbar{width:4px;}',
            '#ct-pb::-webkit-scrollbar-thumb{background:#3d2d50;border-radius:2px;}',

            '#ct-sc{border-radius:12px;padding:14px;margin-bottom:14px;',
            'background:#ffffff06;border:1px solid #ffffff0d;transition:border-color .4s,box-shadow .4s;}',
            '#ct-pn{font-size:1.1em;font-weight:700;margin-bottom:2px;}',
            '#ct-pd{font-size:.78em;opacity:.5;margin-bottom:8px;}',
            '#ct-ps{font-size:.78em;opacity:.6;line-height:1.5;}',
            '#ct-np{margin-top:8px;font-size:.75em;opacity:.4;}',

            '.ct-sec{font-size:.7em;text-transform:uppercase;letter-spacing:.1em;',
            'color:#9b7fc4;opacity:.6;margin:14px 0 8px;}',

            '.ct-row{display:flex;gap:8px;align-items:center;margin-bottom:8px;}',
            '.ct-lbl{font-size:.75em;opacity:.55;white-space:nowrap;min-width:52px;}',
            '.ct-inp{flex:1;background:#ffffff08;border:1px solid #ffffff12;border-radius:8px;',
            'padding:7px 10px;color:#e0d8f0;font-size:.82em;outline:none;',
            'transition:border-color .2s;width:100%;box-sizing:border-box;}',
            '.ct-inp:focus{border-color:#9b7fc455;}',
            '.ct-inp[type=number]{max-width:72px;}',

            '.ct-btn{width:100%;padding:9px;border-radius:9px;border:1px solid #9b7fc422;',
            'background:linear-gradient(135deg,#2d1f42,#221832);color:#c4a8f0;font-size:.8em;',
            'font-weight:600;letter-spacing:.04em;cursor:pointer;',
            'transition:background .18s,box-shadow .18s;margin-bottom:6px;}',
            '.ct-btn:hover{background:linear-gradient(135deg,#3a2850,#2d2040);box-shadow:0 2px 12px #9b7fc422;}',

            '.ct-tog-row{display:flex;align-items:center;justify-content:space-between;margin:10px 0;}',
            '.ct-tog-lbl{font-size:.78em;opacity:.6;}',
            '.ct-tog{position:relative;width:36px;height:20px;cursor:pointer;}',
            '.ct-tog input{opacity:0;width:0;height:0;}',
            '.ct-tok{position:absolute;inset:0;border-radius:20px;background:#ffffff15;transition:background .2s;}',
            '.ct-tog input:checked+.ct-tok{background:#7b5ca8;}',
            '.ct-tob{position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;',
            'background:#ffffffcc;transition:transform .2s;}',
            '.ct-tog input:checked~.ct-tob{transform:translateX(16px);}',

            '#ct-tl{display:flex;flex-wrap:wrap;gap:3px;}',
            '.ct-day{width:24px;height:24px;border-radius:5px;display:flex;align-items:center;',
            'justify-content:center;font-size:.65em;cursor:default;border:1px solid transparent;',
            'transition:transform .1s;position:relative;}',
            '.ct-day:hover{transform:scale(1.3);z-index:5;}',
            '.ct-day.today{box-shadow:0 0 0 1.5px #fff8;font-weight:bold;}',
            '.ph-menstrual{background:#c0709022;color:#d4899a;border-color:#c0709033;}',
            '.ph-follicular{background:#7ab89322;color:#8fccaa;border-color:#7ab89333;}',
            '.ph-ovulation{background:#c9a84c22;color:#d4ba6a;border-color:#c9a84c33;}',
            '.ph-luteal{background:#8b7ab822;color:#a090cc;border-color:#8b7ab833;}',
            '.ph-pms{background:#b8896a22;color:#c9a080;border-color:#b8896a33;}',

            '#ct-leg{display:flex;flex-wrap:wrap;gap:8px 14px;margin-top:10px;}',
            '.ct-li{display:flex;align-items:center;gap:5px;font-size:.7em;opacity:.55;}',
            '.ct-ld{width:8px;height:8px;border-radius:2px;}',

            '#ct-or{font-size:.75em;opacity:.5;margin-top:6px;line-height:1.5;}',
            '.ct-div{height:1px;background:#ffffff08;margin:12px 0;}',
        ].join('');
        document.head.appendChild(style);
    }

    // ── Build UI ──────────────────────────────────────────

    function buildUI() {
        document.getElementById('ct-fab')?.remove();
        document.getElementById('ct-panel')?.remove();
        document.getElementById('ct-overlay')?.remove();

        injectStyles();

        // FAB
        const fab = document.createElement('div');
        fab.id = 'ct-fab';
        fab.innerHTML = '🌙';
        fab.title = 'Cycle Tracker';
        document.body.appendChild(fab);

        // Overlay
        const overlay = document.createElement('div');
        overlay.id = 'ct-overlay';
        document.body.appendChild(overlay);

        // Panel
        const panel = document.createElement('div');
        panel.id = 'ct-panel';
        panel.innerHTML = [
            '<div id="ct-ph">',
            '  <div id="ct-pt">🌙 Cycle Tracker</div>',
            '  <button id="ct-pc">✕</button>',
            '</div>',
            '<div id="ct-pb">',

            '  <div id="ct-sc">',
            '    <div id="ct-pn">—</div>',
            '    <div id="ct-pd">请先设置经期开始日期</div>',
            '    <div id="ct-ps"></div>',
            '    <div id="ct-np"></div>',
            '  </div>',

            '  <div class="ct-sec">基础设置</div>',
            '  <div class="ct-row">',
            '    <span class="ct-lbl">经期开始</span>',
            '    <input type="date" id="ct-date" class="ct-inp" />',
            '  </div>',
            '  <div class="ct-row">',
            '    <span class="ct-lbl">周期长度</span>',
            '    <input type="number" id="ct-clen" class="ct-inp" value="28" min="21" max="45" />',
            '    <span style="font-size:.75em;opacity:.35">天</span>',
            '  </div>',
            '  <div class="ct-row">',
            '    <span class="ct-lbl">经期长度</span>',
            '    <input type="number" id="ct-plen" class="ct-inp" value="5" min="2" max="10" />',
            '    <span style="font-size:.75em;opacity:.35">天</span>',
            '  </div>',
            '  <button class="ct-btn" id="ct-gen">生成完整周期视图</button>',

            '  <div class="ct-tog-row">',
            '    <span class="ct-tog-lbl">启用世界书触发注入</span>',
            '    <label class="ct-tog">',
            '      <input type="checkbox" id="ct-inj" checked />',
            '      <div class="ct-tok"></div>',
            '      <div class="ct-tob"></div>',
            '    </label>',
            '  </div>',

            '  <div class="ct-div"></div>',
            '  <div class="ct-sec">手动校正</div>',
            '  <div class="ct-row">',
            '    <span class="ct-lbl">今天第</span>',
            '    <input type="number" id="ct-oday" class="ct-inp" min="1" max="45" placeholder="如 3" />',
            '    <span style="font-size:.75em;opacity:.35">天</span>',
            '    <button class="ct-btn" id="ct-obtn" style="width:auto;padding:7px 12px;margin:0;flex-shrink:0">应用</button>',
            '  </div>',
            '  <div id="ct-or"></div>',

            '  <div id="ct-tls" style="display:none">',
            '    <div class="ct-div"></div>',
            '    <div class="ct-sec">周期视图</div>',
            '    <div id="ct-tl"></div>',
            '    <div id="ct-leg"></div>',
            '  </div>',

            '</div>',
        ].join('');
        document.body.appendChild(panel);

        // ── Load saved values ──
        const s = getSettings();
        document.getElementById('ct-date').value = s.lastStart || '';
        document.getElementById('ct-clen').value = s.cycleLength || 28;
        document.getElementById('ct-plen').value = s.periodLength || 5;
        document.getElementById('ct-inj').checked = s.injectEnabled !== false;

        if (s.lastStart) refreshStatus();

        // ── Open / close ──
        let open = false;

        function openPanel() {
            panel.classList.add('open');
            overlay.style.display = 'block';
            open = true;
            refreshStatus();
        }
        function closePanel() {
            panel.classList.remove('open');
            overlay.style.display = 'none';
            open = false;
        }

        fab.addEventListener('click', function() { open ? closePanel() : openPanel(); });
        overlay.addEventListener('click', closePanel);
        document.getElementById('ct-pc').addEventListener('click', closePanel);

        // ── Generate ──
        document.getElementById('ct-gen').addEventListener('click', function() {
            saveInputs();
            const s2 = getSettings();
            if (!s2.lastStart) { showToast('请先输入经期开始日期'); return; }
            renderTimeline();
            refreshStatus();
            document.getElementById('ct-tls').style.display = 'block';
        });

        // ── Override ──
        document.getElementById('ct-obtn').addEventListener('click', function() {
            const cycleLen = parseInt(document.getElementById('ct-clen').value) || 28;
            const day = parseInt(document.getElementById('ct-oday').value);
            if (!day || day < 1 || day > cycleLen) { showToast('请输入 1–' + cycleLen + ' 之间的天数'); return; }
            const today = new Date(); today.setHours(0,0,0,0);
            const inf = new Date(today);
            inf.setDate(today.getDate() - (day - 1));
            const iso = inf.toISOString().slice(0,10);
            const s2 = getSettings();
            s2.lastStart   = iso;
            s2.cycleLength = cycleLen;
            s2.periodLength = parseInt(document.getElementById('ct-plen').value) || 5;
            document.getElementById('ct-date').value = iso;
            save();
            refreshStatus();
            if (document.getElementById('ct-tls').style.display !== 'none') renderTimeline();
            document.getElementById('ct-or').textContent = '✓ 已校正为第 ' + day + ' 天，推算开始日期 ' + iso;
        });

        // ── Inject toggle ──
        document.getElementById('ct-inj').addEventListener('change', function(e) {
            getSettings().injectEnabled = e.target.checked;
            save();
        });

        // ── Drag: FAB ──
        makeDraggable(fab);

        // ── Drag: Panel by header ──
        makeDraggable(panel, document.getElementById('ct-ph'));
    }

    // ── Save inputs ───────────────────────────────────────

    function saveInputs() {
        const s = getSettings();
        s.lastStart    = document.getElementById('ct-date').value;
        s.cycleLength  = parseInt(document.getElementById('ct-clen').value) || 28;
        s.periodLength = parseInt(document.getElementById('ct-plen').value) || 5;
        save();
    }

    // ── Refresh status card ───────────────────────────────

    function refreshStatus() {
        saveInputs();
        const status = calcStatus();
        const pn = document.getElementById('ct-pn');
        const pd = document.getElementById('ct-pd');
        const ps = document.getElementById('ct-ps');
        const np = document.getElementById('ct-np');
        const sc = document.getElementById('ct-sc');
        if (!pn) return;

        if (!status) {
            pn.textContent = '—';
            pd.textContent = '请先设置经期开始日期';
            ps.textContent = '';
            np.textContent = '';
            sc.style.borderColor = '#ffffff0d';
            sc.style.boxShadow = 'none';
            return;
        }

        const periodInfo = status.periodDay ? '  经期第 ' + status.periodDay + ' 天' : '';
        pn.textContent = status.phaseLabel;
        pn.style.color = status.color;
        pd.textContent = '周期第 ' + status.dayInCycle + ' / ' + status.cycleLen + ' 天' + periodInfo;
        ps.textContent = status.symptoms;
        np.textContent = '下次月经约 ' + status.daysUntilNext + ' 天后（' + status.nextPeriodDate + '）';
        sc.style.borderColor = status.color + '33';
        sc.style.boxShadow = '0 0 18px ' + status.glow;
    }

    // ── Timeline ──────────────────────────────────────────

    function renderTimeline() {
        const s = getSettings();
        const cycleLen  = s.cycleLength  || 28;
        const periodLen = s.periodLength || 5;
        const status    = calcStatus();
        const todayDay  = status ? status.dayInCycle : null;

        const tl  = document.getElementById('ct-tl');
        const leg = document.getElementById('ct-leg');
        if (!tl) return;
        tl.innerHTML = '';
        leg.innerHTML = '';

        for (let d = 1; d <= cycleLen; d++) {
            const pk    = getDayPhase(d, cycleLen, periodLen);
            const phase = PHASES[pk];
            const isToday = d === todayDay;
            const dateStr = cycledayToDate(d) || '';

            const cell = document.createElement('div');
            cell.className = 'ct-day ph-' + pk + (isToday ? ' today' : '');
            cell.textContent = d;
            cell.title = '第 ' + d + ' 天' + (dateStr ? '  ' + dateStr : '') + '\n' + phase.label + (isToday ? '\n← 今天' : '');
            tl.appendChild(cell);
        }

        const shown = {};
        for (let d = 1; d <= cycleLen; d++) {
            const pk = getDayPhase(d, cycleLen, periodLen);
            if (!shown[pk]) {
                shown[pk] = true;
                const item = document.createElement('div');
                item.className = 'ct-li';
                item.innerHTML = '<div class="ct-ld" style="background:' + PHASES[pk].color + '"></div>' + PHASES[pk].label;
                leg.appendChild(item);
            }
        }
    }

    // ── Draggable ─────────────────────────────────────────

    function makeDraggable(el, handle) {
        const h = handle || el;
        let sx, sy, ox, oy, dragging = false;

        function start(e) {
            const t = e.touches ? e.touches[0] : e;
            sx = t.clientX; sy = t.clientY;
            const r = el.getBoundingClientRect();
            ox = r.left; oy = r.top;
            dragging = true;
            el.style.transition = 'none';
            e.preventDefault();
        }

        function move(e) {
            if (!dragging) return;
            const t = e.touches ? e.touches[0] : e;
            let nx = ox + (t.clientX - sx);
            let ny = oy + (t.clientY - sy);
            const r = el.getBoundingClientRect();
            nx = Math.max(0, Math.min(window.innerWidth  - r.width,  nx));
            ny = Math.max(0, Math.min(window.innerHeight - r.height, ny));
            el.style.left   = nx + 'px';
            el.style.top    = ny + 'px';
            el.style.right  = 'auto';
            el.style.bottom = 'auto';
            e.preventDefault();
        }

        function end() { dragging = false; el.style.transition = ''; }

        h.addEventListener('mousedown',  start, { passive: false });
        h.addEventListener('touchstart', start, { passive: false });
        document.addEventListener('mousemove',  move, { passive: false });
        document.addEventListener('touchmove',  move, { passive: false });
        document.addEventListener('mouseup',    end);
        document.addEventListener('touchend',   end);
    }

    // ── Init ──────────────────────────────────────────────

    function init() {
        getSettings();
        buildUI();
        setupInjection();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
