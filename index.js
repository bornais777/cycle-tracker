/**
 * Cycle Tracker v3.0
 * Floating button + draggable panel UI
 */

import { eventSource, event_types } from '../../../../script.js';
import { extension_settings, saveSettingsDebounced } from '../../../extensions.js';

const EXT = 'cycle-tracker';

const PHASES = {
    menstrual:  { label: '经期',  en: 'Menstrual',  color: '#c07090', glow: '#c0708055', symptoms: '疲倦、腹部不适、情绪低落或敏感' },
    follicular: { label: '卵泡期', en: 'Follicular', color: '#7ab893', glow: '#7ab89355', symptoms: '精力逐渐恢复、思维清晰、社交意愿上升' },
    ovulation:  { label: '排卵期', en: 'Ovulation',  color: '#c9a84c', glow: '#c9a84c55', symptoms: '精力充沛、情绪开朗、表达欲和感知力强' },
    luteal:     { label: '黄体期', en: 'Luteal',     color: '#8b7ab8', glow: '#8b7ab855', symptoms: '内收、需要独处、对细节和语气更敏感' },
    pms:        { label: 'PMS',   en: 'PMS',        color: '#b8896a', glow: '#b8896a55', symptoms: '情绪波动、易激惹或感伤、轻微身体预警' },
};

const DEFAULTS = {
    lastStart: '',
    cycleLength: 28,
    periodLength: 5,
    injectEnabled: true,
};

// ── Calculation ───────────────────────────────────────────

function getDayPhase(d, cycleLen, periodLen) {
    const ovDay    = Math.round(cycleLen / 2);
    const pmsStart = cycleLen - 4;
    if (d <= periodLen)   return 'menstrual';
    if (d <= ovDay - 2)   return 'follicular';
    if (d <= ovDay + 1)   return 'ovulation';
    if (d >= pmsStart)    return 'pms';
    return 'luteal';
}

function calcStatus(s) {
    if (!s?.lastStart) return null;
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
        triggerTag: `cycle:${phaseKey}`,
    };
}

function cycledayToDate(d, s) {
    if (!s.lastStart) return null;
    const dt = new Date(s.lastStart);
    dt.setHours(0,0,0,0);
    dt.setDate(dt.getDate() + d - 1);
    return dt.toLocaleDateString('zh-CN', { month:'numeric', day:'numeric' });
}

// ── Inject ────────────────────────────────────────────────

eventSource.on(event_types.GENERATE_BEFORE_COMBINE_PROMPTS, (data) => {
    const s = extension_settings[EXT];
    if (!s?.injectEnabled) return;
    const status = calcStatus(s);
    if (!status) return;
    const tag = `\n[${status.triggerTag}]`;
    data.after_note = data.after_note ? data.after_note + tag : tag;
});

// ── Build UI ──────────────────────────────────────────────

function buildUI() {
    // Remove existing
    document.getElementById('ct-fab')?.remove();
    document.getElementById('ct-panel')?.remove();
    document.getElementById('ct-overlay')?.remove();
    document.getElementById('ct-styles')?.remove();

    // ── Styles ──
    const style = document.createElement('style');
    style.id = 'ct-styles';
    style.textContent = `
        /* FAB */
        #ct-fab {
            position: fixed;
            right: 18px;
            bottom: 120px;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: linear-gradient(135deg, #2a1f35, #1a1428);
            border: 1.5px solid #6b4d8044;
            box-shadow: 0 4px 20px #00000088, 0 0 12px #9b6fc422;
            cursor: pointer;
            z-index: 9998;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            user-select: none;
            touch-action: none;
            transition: box-shadow 0.2s, transform 0.15s;
        }
        #ct-fab:hover {
            box-shadow: 0 4px 24px #00000099, 0 0 18px #9b6fc455;
            transform: scale(1.08);
        }
        #ct-fab.active {
            box-shadow: 0 4px 24px #00000099, 0 0 22px #9b6fc477;
        }

        /* Overlay */
        #ct-overlay {
            position: fixed;
            inset: 0;
            z-index: 9998;
            display: none;
        }

        /* Panel */
        #ct-panel {
            position: fixed;
            right: 14px;
            bottom: 178px;
            width: 310px;
            max-height: 70vh;
            background: linear-gradient(160deg, #1c1525 0%, #150f20 100%);
            border: 1px solid #3d2d5022;
            border-radius: 18px;
            box-shadow: 0 8px 40px #00000099, 0 0 0 1px #ffffff08;
            z-index: 9999;
            display: none;
            flex-direction: column;
            overflow: hidden;
            font-family: -apple-system, 'PingFang SC', sans-serif;
            touch-action: none;
        }
        #ct-panel.open { display: flex; }

        /* Panel header (drag handle) */
        #ct-panel-header {
            padding: 14px 16px 10px;
            cursor: grab;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid #ffffff0a;
            flex-shrink: 0;
        }
        #ct-panel-header:active { cursor: grabbing; }
        #ct-panel-title {
            font-size: 0.82em;
            font-weight: 600;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: #9b7fc4;
            opacity: 0.85;
        }
        #ct-panel-close {
            width: 22px; height: 22px;
            border-radius: 50%;
            background: #ffffff0f;
            border: none;
            color: #ffffff55;
            font-size: 13px;
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: background 0.15s;
            flex-shrink: 0;
        }
        #ct-panel-close:hover { background: #ffffff1a; color: #fff; }

        /* Scrollable body */
        #ct-panel-body {
            overflow-y: auto;
            flex: 1;
            padding: 14px 16px 18px;
            scrollbar-width: thin;
            scrollbar-color: #3d2d50 transparent;
        }
        #ct-panel-body::-webkit-scrollbar { width: 4px; }
        #ct-panel-body::-webkit-scrollbar-track { background: transparent; }
        #ct-panel-body::-webkit-scrollbar-thumb { background: #3d2d50; border-radius: 2px; }

        /* Status card */
        #ct-status-card {
            border-radius: 12px;
            padding: 14px;
            margin-bottom: 14px;
            background: #ffffff06;
            border: 1px solid #ffffff0d;
            transition: border-color 0.4s, box-shadow 0.4s;
        }
        #ct-phase-name {
            font-size: 1.1em;
            font-weight: 700;
            margin-bottom: 2px;
            letter-spacing: 0.03em;
        }
        #ct-phase-day {
            font-size: 0.78em;
            opacity: 0.5;
            margin-bottom: 8px;
        }
        #ct-phase-symptoms {
            font-size: 0.78em;
            opacity: 0.6;
            line-height: 1.5;
        }
        #ct-next-period {
            margin-top: 8px;
            font-size: 0.75em;
            opacity: 0.4;
        }

        /* Section label */
        .ct-section {
            font-size: 0.7em;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #9b7fc4;
            opacity: 0.6;
            margin: 14px 0 8px;
        }

        /* Input row */
        .ct-input-row {
            display: flex;
            gap: 8px;
            align-items: center;
            margin-bottom: 8px;
        }
        .ct-label {
            font-size: 0.75em;
            opacity: 0.55;
            white-space: nowrap;
            min-width: 52px;
        }
        .ct-input {
            flex: 1;
            background: #ffffff08;
            border: 1px solid #ffffff12;
            border-radius: 8px;
            padding: 7px 10px;
            color: #e0d8f0;
            font-size: 0.82em;
            outline: none;
            transition: border-color 0.2s;
            width: 100%;
            box-sizing: border-box;
        }
        .ct-input:focus { border-color: #9b7fc455; }
        .ct-input[type="number"] { max-width: 72px; }

        /* Buttons */
        .ct-btn {
            width: 100%;
            padding: 9px;
            border-radius: 9px;
            border: 1px solid #9b7fc422;
            background: linear-gradient(135deg, #2d1f42, #221832);
            color: #c4a8f0;
            font-size: 0.8em;
            font-weight: 600;
            letter-spacing: 0.04em;
            cursor: pointer;
            transition: background 0.18s, box-shadow 0.18s;
            margin-bottom: 6px;
        }
        .ct-btn:hover {
            background: linear-gradient(135deg, #3a2850, #2d2040);
            box-shadow: 0 2px 12px #9b7fc422;
        }
        .ct-btn.secondary {
            background: transparent;
            border-color: #ffffff10;
            color: #ffffff44;
            font-weight: 400;
        }
        .ct-btn.secondary:hover {
            background: #ffffff08;
            color: #ffffff77;
        }

        /* Toggle */
        .ct-toggle-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin: 10px 0;
        }
        .ct-toggle-label {
            font-size: 0.78em;
            opacity: 0.6;
        }
        .ct-toggle {
            position: relative;
            width: 36px; height: 20px;
            cursor: pointer;
        }
        .ct-toggle input { opacity: 0; width: 0; height: 0; }
        .ct-toggle-track {
            position: absolute;
            inset: 0;
            border-radius: 20px;
            background: #ffffff15;
            transition: background 0.2s;
        }
        .ct-toggle input:checked + .ct-toggle-track { background: #7b5ca8; }
        .ct-toggle-thumb {
            position: absolute;
            top: 3px; left: 3px;
            width: 14px; height: 14px;
            border-radius: 50%;
            background: #ffffffcc;
            transition: transform 0.2s;
        }
        .ct-toggle input:checked ~ .ct-toggle-thumb { transform: translateX(16px); }

        /* Timeline */
        #ct-timeline-wrap { margin-top: 4px; }
        #ct-timeline {
            display: flex;
            flex-wrap: wrap;
            gap: 3px;
        }
        .ct-day {
            width: 24px; height: 24px;
            border-radius: 5px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.65em;
            cursor: default;
            border: 1px solid transparent;
            transition: transform 0.1s;
            position: relative;
        }
        .ct-day:hover { transform: scale(1.3); z-index: 5; }
        .ct-day.today {
            box-shadow: 0 0 0 1.5px #fff8;
            font-weight: bold;
        }
        .ct-day.ph-menstrual  { background:#c0709022; color:#d4899a; border-color:#c0709033; }
        .ct-day.ph-follicular { background:#7ab89322; color:#8fccaa; border-color:#7ab89333; }
        .ct-day.ph-ovulation  { background:#c9a84c22; color:#d4ba6a; border-color:#c9a84c33; }
        .ct-day.ph-luteal     { background:#8b7ab822; color:#a090cc; border-color:#8b7ab833; }
        .ct-day.ph-pms        { background:#b8896a22; color:#c9a080; border-color:#b8896a33; }

        /* Legend */
        #ct-legend {
            display: flex;
            flex-wrap: wrap;
            gap: 8px 14px;
            margin-top: 10px;
        }
        .ct-legend-item {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 0.7em;
            opacity: 0.55;
        }
        .ct-legend-dot {
            width: 8px; height: 8px;
            border-radius: 2px;
        }

        /* Override result */
        #ct-override-result {
            font-size: 0.75em;
            opacity: 0.5;
            margin-top: 6px;
            line-height: 1.5;
        }

        /* Divider */
        .ct-divider {
            height: 1px;
            background: #ffffff08;
            margin: 12px 0;
        }
    `;
    document.head.appendChild(style);

    // ── FAB ──
    const fab = document.createElement('div');
    fab.id = 'ct-fab';
    fab.innerHTML = '🌙';
    fab.title = 'Cycle Tracker';
    document.body.appendChild(fab);

    // ── Overlay (click outside to close) ──
    const overlay = document.createElement('div');
    overlay.id = 'ct-overlay';
    document.body.appendChild(overlay);

    // ── Panel ──
    const panel = document.createElement('div');
    panel.id = 'ct-panel';
    panel.innerHTML = `
        <div id="ct-panel-header">
            <div id="ct-panel-title">🌙 Cycle Tracker</div>
            <button id="ct-panel-close">✕</button>
        </div>
        <div id="ct-panel-body">

            <!-- Status card -->
            <div id="ct-status-card">
                <div id="ct-phase-name">—</div>
                <div id="ct-phase-day">请先设置日期</div>
                <div id="ct-phase-symptoms"></div>
                <div id="ct-next-period"></div>
            </div>

            <!-- Input -->
            <div class="ct-section">基础设置</div>

            <div class="ct-input-row">
                <span class="ct-label">经期开始</span>
                <input type="date" id="ct-date" class="ct-input" />
            </div>
            <div class="ct-input-row">
                <span class="ct-label">周期长度</span>
                <input type="number" id="ct-cycle-len" class="ct-input" value="28" min="21" max="45" />
                <span class="ct-label" style="min-width:auto;opacity:0.35">天</span>
            </div>
            <div class="ct-input-row">
                <span class="ct-label">经期长度</span>
                <input type="number" id="ct-period-len" class="ct-input" value="5" min="2" max="10" />
                <span class="ct-label" style="min-width:auto;opacity:0.35">天</span>
            </div>

            <button class="ct-btn" id="ct-btn-generate">生成完整周期视图</button>

            <!-- Inject toggle -->
            <div class="ct-toggle-row">
                <span class="ct-toggle-label">启用世界书触发注入</span>
                <label class="ct-toggle">
                    <input type="checkbox" id="ct-inject-toggle" checked />
                    <div class="ct-toggle-track"></div>
                    <div class="ct-toggle-thumb"></div>
                </label>
            </div>

            <div class="ct-divider"></div>

            <!-- Manual correction -->
            <div class="ct-section">手动校正</div>
            <div class="ct-input-row">
                <span class="ct-label">今天第</span>
                <input type="number" id="ct-override-day" class="ct-input" min="1" max="45" placeholder="如 3" />
                <span class="ct-label" style="min-width:auto;opacity:0.35">天</span>
                <button class="ct-btn" id="ct-btn-override" style="width:auto;padding:7px 12px;margin:0;flex-shrink:0">应用</button>
            </div>
            <div id="ct-override-result"></div>

            <!-- Timeline (hidden until generated) -->
            <div id="ct-timeline-section" style="display:none">
                <div class="ct-divider"></div>
                <div class="ct-section">周期视图</div>
                <div id="ct-timeline-wrap">
                    <div id="ct-timeline"></div>
                    <div id="ct-legend"></div>
                </div>
            </div>

        </div>
    `;
    document.body.appendChild(panel);

    // ── Event: FAB click ──
    let panelOpen = false;

    function openPanel() {
        panel.classList.add('open');
        overlay.style.display = 'block';
        fab.classList.add('active');
        panelOpen = true;
        refreshStatus();
    }

    function closePanel() {
        panel.classList.remove('open');
        overlay.style.display = 'none';
        fab.classList.remove('active');
        panelOpen = false;
    }

    fab.addEventListener('click', () => panelOpen ? closePanel() : openPanel());
    overlay.addEventListener('click', closePanel);
    document.getElementById('ct-panel-close').addEventListener('click', closePanel);

    // ── Event: Generate ──
    document.getElementById('ct-btn-generate').addEventListener('click', () => {
        saveInputs();
        const s = extension_settings[EXT];
        if (!s.lastStart) { showToast('请先输入经期开始日期'); return; }
        renderTimeline();
        refreshStatus();
        document.getElementById('ct-timeline-section').style.display = 'block';
    });

    // ── Event: Override ──
    document.getElementById('ct-btn-override').addEventListener('click', () => {
        const s = extension_settings[EXT];
        const cycleLen = parseInt(document.getElementById('ct-cycle-len').value) || 28;
        const day = parseInt(document.getElementById('ct-override-day').value);
        if (!day || day < 1 || day > cycleLen) { showToast(`请输入 1–${cycleLen} 之间的天数`); return; }
        const today = new Date(); today.setHours(0,0,0,0);
        const inferred = new Date(today);
        inferred.setDate(today.getDate() - (day - 1));
        const iso = inferred.toISOString().slice(0,10);
        s.lastStart = iso;
        s.cycleLength = cycleLen;
        s.periodLength = parseInt(document.getElementById('ct-period-len').value) || 5;
        document.getElementById('ct-date').value = iso;
        saveSettingsDebounced();
        refreshStatus();
        if (document.getElementById('ct-timeline-section').style.display !== 'none') renderTimeline();
        document.getElementById('ct-override-result').textContent = `✓ 已校正为第 ${day} 天，推算开始日期 ${iso}`;
    });

    // ── Event: Inject toggle ──
    document.getElementById('ct-inject-toggle').addEventListener('change', (e) => {
        extension_settings[EXT].injectEnabled = e.target.checked;
        saveSettingsDebounced();
    });

    // ── Drag: FAB ──
    makeDraggable(fab, { constrainToViewport: true });

    // ── Drag: Panel (header) ──
    makeDraggable(panel, { handle: document.getElementById('ct-panel-header'), constrainToViewport: true });

    // ── Load saved values ──
    const s = extension_settings[EXT];
    document.getElementById('ct-date').value = s.lastStart || '';
    document.getElementById('ct-cycle-len').value = s.cycleLength || 28;
    document.getElementById('ct-period-len').value = s.periodLength || 5;
    document.getElementById('ct-inject-toggle').checked = s.injectEnabled !== false;

    if (s.lastStart) refreshStatus();
}

// ── Save inputs to settings ───────────────────────────────

function saveInputs() {
    const s = extension_settings[EXT];
    s.lastStart    = document.getElementById('ct-date').value;
    s.cycleLength  = parseInt(document.getElementById('ct-cycle-len').value)  || 28;
    s.periodLength = parseInt(document.getElementById('ct-period-len').value) || 5;
    saveSettingsDebounced();
}

// ── Refresh status card ───────────────────────────────────

function refreshStatus() {
    saveInputs();
    const s = extension_settings[EXT];
    const status = calcStatus(s);
    const card = document.getElementById('ct-status-card');
    if (!card) return;

    if (!status) {
        document.getElementById('ct-phase-name').textContent = '—';
        document.getElementById('ct-phase-day').textContent = '请先设置经期开始日期';
        document.getElementById('ct-phase-symptoms').textContent = '';
        document.getElementById('ct-next-period').textContent = '';
        card.style.borderColor = '#ffffff0d';
        card.style.boxShadow = 'none';
        return;
    }

    const periodInfo = status.periodDay ? `  经期第 ${status.periodDay} 天` : '';
    document.getElementById('ct-phase-name').textContent = status.phaseLabel;
    document.getElementById('ct-phase-name').style.color = status.color;
    document.getElementById('ct-phase-day').textContent = `周期第 ${status.dayInCycle} / ${status.cycleLen} 天${periodInfo}`;
    document.getElementById('ct-phase-symptoms').textContent = status.symptoms;
    document.getElementById('ct-next-period').textContent = `下次月经约 ${status.daysUntilNext} 天后（${status.nextPeriodDate}）`;
    card.style.borderColor = status.color + '33';
    card.style.boxShadow = `0 0 18px ${status.glow}`;
}

// ── Render timeline ───────────────────────────────────────

function renderTimeline() {
    const s = extension_settings[EXT];
    const cycleLen  = s.cycleLength  || 28;
    const periodLen = s.periodLength || 5;
    const status    = calcStatus(s);
    const todayDay  = status?.dayInCycle;

    const container = document.getElementById('ct-timeline');
    const legend    = document.getElementById('ct-legend');
    if (!container) return;

    container.innerHTML = '';
    legend.innerHTML = '';

    for (let d = 1; d <= cycleLen; d++) {
        const pk    = getDayPhase(d, cycleLen, periodLen);
        const phase = PHASES[pk];
        const isToday = d === todayDay;
        const dateStr = cycledayToDate(d, s) ?? '';

        const cell = document.createElement('div');
        cell.className = `ct-day ph-${pk}${isToday ? ' today' : ''}`;
        cell.textContent = d;
        cell.title = `第 ${d} 天${dateStr ? '  ' + dateStr : ''}\n${phase.label}${isToday ? '\n← 今天' : ''}`;
        container.appendChild(cell);
    }

    // Legend
    const shown = new Set();
    for (let d = 1; d <= cycleLen; d++) {
        const pk = getDayPhase(d, cycleLen, periodLen);
        if (!shown.has(pk)) {
            shown.add(pk);
            const item = document.createElement('div');
            item.className = 'ct-legend-item';
            item.innerHTML = `<div class="ct-legend-dot" style="background:${PHASES[pk].color}"></div>${PHASES[pk].label}`;
            legend.appendChild(item);
        }
    }
}

// ── Draggable ─────────────────────────────────────────────

function makeDraggable(el, { handle, constrainToViewport } = {}) {
    const dragHandle = handle || el;
    let startX, startY, origX, origY, isDragging = false, hasMoved = false;

    function getPos() {
        const rect = el.getBoundingClientRect();
        return { x: rect.left, y: rect.top };
    }

    function onStart(e) {
        const touch = e.touches?.[0] ?? e;
        startX = touch.clientX;
        startY = touch.clientY;
        const pos = getPos();
        origX = pos.x;
        origY = pos.y;
        isDragging = true;
        hasMoved = false;
        el.style.transition = 'none';
        e.preventDefault();
    }

    function onMove(e) {
        if (!isDragging) return;
        const touch = e.touches?.[0] ?? e;
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) hasMoved = true;

        let nx = origX + dx;
        let ny = origY + dy;

        if (constrainToViewport) {
            const rect = el.getBoundingClientRect();
            const w = rect.width, h = rect.height;
            nx = Math.max(0, Math.min(window.innerWidth  - w, nx));
            ny = Math.max(0, Math.min(window.innerHeight - h, ny));
        }

        el.style.left   = nx + 'px';
        el.style.top    = ny + 'px';
        el.style.right  = 'auto';
        el.style.bottom = 'auto';
        e.preventDefault();
    }

    function onEnd() {
        isDragging = false;
        el.style.transition = '';
    }

    dragHandle.addEventListener('mousedown',  onStart, { passive: false });
    dragHandle.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('mousemove',  onMove,  { passive: false });
    document.addEventListener('touchmove',  onMove,  { passive: false });
    document.addEventListener('mouseup',    onEnd);
    document.addEventListener('touchend',   onEnd);
}

// ── Toast ─────────────────────────────────────────────────

function showToast(msg) {
    if (typeof toastr !== 'undefined') { toastr.warning(msg); return; }
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
        position:'fixed', bottom:'180px', left:'50%', transform:'translateX(-50%)',
        background:'#2a1f35', color:'#c4a8f0', padding:'8px 16px', borderRadius:'8px',
        fontSize:'0.82em', zIndex:'10000', opacity:'0',
        transition:'opacity 0.2s', pointerEvents:'none',
    });
    document.body.appendChild(t);
    setTimeout(() => t.style.opacity = '1', 10);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2500);
}

// ── Entry ─────────────────────────────────────────────────

jQuery(async () => {
    if (!extension_settings[EXT]) extension_settings[EXT] = {};
    const saved = extension_settings[EXT];
    for (const [k, v] of Object.entries(DEFAULTS)) {
        if (saved[k] === undefined) saved[k] = v;
    }
    buildUI();
});
