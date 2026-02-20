/**
 * Cycle Tracker — SillyTavern Extension
 * 
 * Architecture:
 *   - Plugin computes current cycle phase and inserts a silent trigger tag
 *     (e.g. "cycle:menstrual") into the prompt each turn.
 *   - World Info entries detect the tag and inject phase-appropriate context.
 *   - LLM reads the context and decides autonomously whether it's relevant
 *     to the current scene — no forced narrative influence.
 *   - The standalone data panel is completely separate from injection logic.
 */

import { eventSource, event_types } from '../../../../script.js';
import { extension_settings, saveSettingsDebounced } from '../../../extensions.js';

const EXT = 'cycle-tracker';

// ── Phase Metadata ────────────────────────────────────────────────────────────

const PHASES = {
    menstrual: {
        label: '🔴 经期',
        emoji: '🔴',
        color: '#e74c3c',
        cssClass: 'phase-menstrual',
        triggerTag: 'cycle:menstrual',
        symptoms: '疲倦、腹部不适、情绪低落或敏感',
    },
    follicular: {
        label: '🌱 卵泡期',
        emoji: '🌱',
        color: '#2ecc71',
        cssClass: 'phase-follicular',
        triggerTag: 'cycle:follicular',
        symptoms: '精力逐渐恢复、思维清晰、社交意愿上升',
    },
    ovulation: {
        label: '⚡ 排卵期',
        emoji: '⚡',
        color: '#f1c40f',
        cssClass: 'phase-ovulation',
        triggerTag: 'cycle:ovulation',
        symptoms: '精力充沛、情绪开朗、表达欲和感知力强',
    },
    luteal: {
        label: '🌙 黄体期',
        emoji: '🌙',
        color: '#9b59b6',
        cssClass: 'phase-luteal',
        triggerTag: 'cycle:luteal',
        symptoms: '内收、需要独处空间、对细节和语气更敏感',
    },
    pms: {
        label: '⚠️ PMS',
        emoji: '⚠️',
        color: '#e67e22',
        cssClass: 'phase-pms',
        triggerTag: 'cycle:pms',
        symptoms: '情绪波动明显、易激惹或感伤、轻微身体不适预兆',
    },
};

// ── Default Settings ──────────────────────────────────────────────────────────

const DEFAULTS = {
    lastStart: '',
    cycleLength: 28,
    periodLength: 5,
    injectEnabled: true,   // inject trigger tag into prompt for World Info detection
};

// ── Core Calculation ──────────────────────────────────────────────────────────

/**
 * Determine which phase a given cycle day falls into.
 */
function getDayPhase(dayInCycle, cycleLen, periodLen) {
    const ovDay    = Math.round(cycleLen / 2);  // ovulation around midpoint
    const pmsStart = cycleLen - 4;              // PMS = last 5 days

    if (dayInCycle <= periodLen)   return 'menstrual';
    if (dayInCycle <= ovDay - 2)   return 'follicular';
    if (dayInCycle <= ovDay + 1)   return 'ovulation';
    if (dayInCycle >= pmsStart)    return 'pms';
    return 'luteal';
}

/**
 * Calculate full status object from saved settings.
 * Returns null if lastStart is not set.
 */
function calcStatus(s) {
    if (!s || !s.lastStart) return null;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(s.lastStart); start.setHours(0, 0, 0, 0);

    const cycleLen  = s.cycleLength  || 28;
    const periodLen = s.periodLength || 5;

    // Normalize across multiple cycles
    const totalDiff  = Math.floor((today - start) / 86400000);
    const dayInCycle = ((totalDiff % cycleLen) + cycleLen) % cycleLen + 1; // 1-indexed

    const phaseKey = getDayPhase(dayInCycle, cycleLen, periodLen);
    const phase    = PHASES[phaseKey];

    // Next period estimation
    const daysUntilNext = cycleLen - dayInCycle + 1;
    const nextDate = new Date(today);
    nextDate.setDate(nextDate.getDate() + daysUntilNext);

    // Actual calendar date for today
    const todayDate = today.toISOString().slice(0, 10);

    return {
        dayInCycle,
        cycleLen,
        phaseKey,
        phaseLabel: phase.label,
        triggerTag: phase.triggerTag,
        symptoms: phase.symptoms,
        emoji: phase.emoji,
        periodDay: dayInCycle <= periodLen ? dayInCycle : null,
        daysUntilNext,
        nextPeriodDate: nextDate.toISOString().slice(0, 10),
        todayDate,
        generatedAt: new Date().toISOString(),
    };
}

/**
 * For a given cycle day number, return the real calendar date
 * based on the lastStart setting.
 */
function cycledayToDate(dayNum, s) {
    if (!s.lastStart) return null;
    const start = new Date(s.lastStart);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + (dayNum - 1));
    return start.toISOString().slice(0, 10);
}

// ── Timeline Rendering ────────────────────────────────────────────────────────

function renderTimeline(s) {
    const container = document.getElementById('ct_timeline');
    const wrap      = document.getElementById('ct_timeline_wrap');
    if (!container || !wrap) return;

    const cycleLen  = s.cycleLength  || 28;
    const periodLen = s.periodLength || 5;
    const status    = calcStatus(s);
    const todayDay  = status?.dayInCycle ?? null;

    container.innerHTML = '';

    for (let d = 1; d <= cycleLen; d++) {
        const phaseKey  = getDayPhase(d, cycleLen, periodLen);
        const phase     = PHASES[phaseKey];
        const isToday   = d === todayDay;
        const dateStr   = cycledayToDate(d, s) ?? `第${d}天`;

        const cell = document.createElement('div');
        cell.className = `ct-day-cell ${phase.cssClass}${isToday ? ' is-today' : ''}`;
        cell.textContent = d;
        cell.title = [
            `周期第 ${d} 天`,
            `日期：${dateStr}`,
            `阶段：${phase.label}`,
            `特征：${phase.symptoms}`,
            isToday ? '← 今天' : '',
        ].filter(Boolean).join('\n');

        container.appendChild(cell);
    }

    wrap.style.display = 'block';
}

// ── UI Refresh ────────────────────────────────────────────────────────────────

function refreshUI() {
    const s      = extension_settings[EXT];
    const status = calcStatus(s);
    const card   = document.getElementById('ct_status_card');
    if (!card) return;

    if (!status) {
        card.style.display = 'none';
        setApiJson('{ "error": "请先设置月经开始日期" }');
        return;
    }

    // Status card
    card.style.display = 'block';

    const periodInfo = status.periodDay ? `（经期第 ${status.periodDay} 天）` : '';
    document.getElementById('ct_phase_label').textContent =
        `${status.emoji}  ${status.phaseLabel} ${periodInfo}  ·  周期第 ${status.dayInCycle} / ${status.cycleLen} 天`;

    document.getElementById('ct_phase_meta').textContent =
        `特征：${status.symptoms}\n` +
        `距下次月经：约 ${status.daysUntilNext} 天（预计 ${status.nextPeriodDate}）\n` +
        `今日日期：${status.todayDate}`;

    document.getElementById('ct_trigger_tag').textContent =
        s.injectEnabled
            ? `${status.triggerTag}   （每轮静默插入prompt，世界书entry凭此触发）`
            : `注入已关闭 — 世界书entry不会被触发`;

    // API JSON panel
    const apiPayload = {
        cycleDay:           status.dayInCycle,
        totalCycleDays:     status.cycleLen,
        phase:              status.phaseKey,
        phaseLabel:         status.phaseLabel,
        symptoms:           status.symptoms,
        periodDay:          status.periodDay,
        daysUntilNext:      status.daysUntilNext,
        nextPeriodDate:     status.nextPeriodDate,
        todayDate:          status.todayDate,
        triggerTag:         status.triggerTag,
        injectEnabled:      s.injectEnabled,
        generatedAt:        status.generatedAt,
    };
    setApiJson(JSON.stringify(apiPayload, null, 2));
}

function setApiJson(text) {
    const el = document.getElementById('ct_api_json');
    if (el) el.textContent = text;
}

// ── UI Binding ────────────────────────────────────────────────────────────────

function bindUI() {
    const s = extension_settings[EXT];
    if (!document.getElementById('ct_last_start')) return;

    // Populate saved values
    document.getElementById('ct_last_start').value = s.lastStart || '';
    document.getElementById('ct_cycle_len').value  = s.cycleLength;
    document.getElementById('ct_period_len').value = s.periodLength;

    // ── Save ──
    document.getElementById('ct_save').addEventListener('click', () => {
        s.lastStart    = document.getElementById('ct_last_start').value;
        s.cycleLength  = parseInt(document.getElementById('ct_cycle_len').value)  || 28;
        s.periodLength = parseInt(document.getElementById('ct_period_len').value) || 5;
        saveSettingsDebounced();
        refreshUI();
        if (s.lastStart) renderTimeline(s);
        toastr.success('Cycle Tracker 设置已保存');
    });

    // ── Generate full cycle view ──
    document.getElementById('ct_generate').addEventListener('click', () => {
        // Read inputs immediately without requiring Save first
        s.lastStart    = document.getElementById('ct_last_start').value;
        s.cycleLength  = parseInt(document.getElementById('ct_cycle_len').value)  || 28;
        s.periodLength = parseInt(document.getElementById('ct_period_len').value) || 5;

        if (!s.lastStart) {
            toastr.warning('请先输入上次月经开始日期');
            return;
        }

        saveSettingsDebounced();
        renderTimeline(s);
        refreshUI();
    });

    // ── Manual day override ──
    document.getElementById('ct_apply_override').addEventListener('click', () => {
        const overrideDay = parseInt(document.getElementById('ct_override_day').value);
        const cycleLen    = parseInt(document.getElementById('ct_cycle_len').value) || 28;

        if (!overrideDay || overrideDay < 1 || overrideDay > cycleLen) {
            toastr.warning(`请输入 1–${cycleLen} 之间的天数`);
            return;
        }

        // Back-calculate lastStart from "today is day N"
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const inferredStart = new Date(today);
        inferredStart.setDate(today.getDate() - (overrideDay - 1));
        const inferredISO = inferredStart.toISOString().slice(0, 10);

        s.lastStart    = inferredISO;
        s.cycleLength  = cycleLen;
        s.periodLength = parseInt(document.getElementById('ct_period_len').value) || 5;

        // Update the date input field to reflect the change
        document.getElementById('ct_last_start').value = inferredISO;

        saveSettingsDebounced();
        renderTimeline(s);
        refreshUI();

        const resultEl = document.getElementById('ct_override_result');
        if (resultEl) {
            resultEl.textContent =
                `✓ 已校正：今天 = 周期第 ${overrideDay} 天，推算开始日期为 ${inferredISO}`;
        }
        toastr.success(`已校正为周期第 ${overrideDay} 天`);
    });

    // ── Copy JSON ──
    document.getElementById('ct_copy_json').addEventListener('click', () => {
        const text = document.getElementById('ct_api_json').textContent;
        navigator.clipboard.writeText(text)
            .then(() => toastr.info('JSON 已复制到剪贴板'))
            .catch(() => toastr.error('复制失败，请手动选择文本'));
    });

    // ── Refresh API panel ──
    document.getElementById('ct_refresh_api').addEventListener('click', refreshUI);

    // Initial render
    refreshUI();
    if (s.lastStart) renderTimeline(s);
}

// ── Prompt Injection ──────────────────────────────────────────────────────────
//
// We insert only the phase trigger tag (e.g. "cycle:menstrual") as a hidden
// token at the end of the prompt. The World Info system detects this keyword
// and injects the appropriate entry content. The LLM then decides whether the
// entry is relevant to the current scene.
//
// This is intentionally minimal — we are not writing narrative instructions
// directly here; that is the World Info entry's job.

eventSource.on(event_types.GENERATE_BEFORE_COMBINE_PROMPTS, (data) => {
    const s = extension_settings[EXT];
    if (!s?.injectEnabled) return;

    const status = calcStatus(s);
    if (!status) return;

    // Append trigger tag invisibly to after_note
    // The tag is readable by the World Info keyword scanner but will not
    // appear in the visible chat bubbles.
    const tag = `\n[${status.triggerTag}]`;

    if (typeof data.after_note === 'string') {
        data.after_note += tag;
    } else {
        data.after_note = tag;
    }
});

// ── Extension Entry Point ─────────────────────────────────────────────────────

jQuery(async () => {
    // Initialize settings with defaults
    if (!extension_settings[EXT]) extension_settings[EXT] = {};
    const saved = extension_settings[EXT];
    for (const [key, val] of Object.entries(DEFAULTS)) {
        if (saved[key] === undefined) saved[key] = val;
    }

    // Load settings panel HTML
    try {
        const html = await $.get(`scripts/extensions/${EXT}/settings.html`);
        $('#extensions_settings').append(html);
        bindUI();
    } catch (err) {
        console.error(`[${EXT}] Failed to load settings.html`, err);
    }
});
