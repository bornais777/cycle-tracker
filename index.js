// Cycle Tracker Extension for SillyTavern
// 生理周期追踪器 - 使用 SillyTavern.getContext() API
(function () {
    'use strict';

    const MODULE_NAME = 'cycle_tracker';
    const LOG = (msg, ...args) => console.log(`[CycleTracker] ${msg}`, ...args);

    // ==============================
    // 默认设置
    // ==============================
    const DEFAULT_SETTINGS = Object.freeze({
        enabled: true,
        cycleLength: 28,          // 周期天数
        periodLength: 5,          // 经期天数
        periodStartDates: [],     // 历史月经开始日期 ['YYYY-MM-DD', ...]
        wiBookName: '',           // 世界书名称（留空=不注入）
        wiEntryTitle: '生理周期状态', // 世界书条目关键词/标题
        autoInject: true,         // 是否自动注入世界书
        showBtn: true,            // 是否显示浮动按钮
    });

    // ==============================
    // 阶段定义
    // ==============================
    const PHASES = {
        menstrual:  { name: '经期',   emoji: '🔴', days: null },
        follicular: { name: '卵泡期', emoji: '🌱', days: null },
        ovulation:  { name: '排卵期', emoji: '✨', days: null },
        luteal:     { name: '黄体期', emoji: '🌙', days: null },
        unknown:    { name: '未知',   emoji: '❓', days: null },
    };

    // ==============================
    // 工具函数
    // ==============================
    function today() {
        return new Date().toISOString().slice(0, 10);
    }
    function parseDate(str) {
        return new Date(str + 'T00:00:00');
    }
    function diffDays(dateStr1, dateStr2) {
        return Math.round((parseDate(dateStr2) - parseDate(dateStr1)) / 86400000);
    }
    function addDays(dateStr, n) {
        const d = parseDate(dateStr);
        d.setDate(d.getDate() + n);
        return d.toISOString().slice(0, 10);
    }
    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = parseDate(dateStr);
        return `${d.getMonth() + 1}月${d.getDate()}日`;
    }

    // ==============================
    // 周期计算
    // ==============================
    function calcCycleStatus(settings) {
        const { cycleLength, periodLength, periodStartDates } = settings;
        if (!periodStartDates || periodStartDates.length === 0) {
            return { phase: 'unknown', cycleDay: null, nextPeriod: null, daysUntilNext: null, ovulationDate: null };
        }

        const sorted = [...periodStartDates].sort();
        const lastStart = sorted[sorted.length - 1];
        const todayStr = today();
        const daysSinceStart = diffDays(lastStart, todayStr);

        // 在周期内的第几天（1-based）
        const cycleDay = (daysSinceStart % cycleLength) + 1;
        const actualDay = daysSinceStart + 1;

        let phase;
        if (actualDay <= periodLength) {
            phase = 'menstrual';
        } else {
            // 排卵日 ≈ 周期第14天（从经期开始算）
            const ovulationDay = cycleLength - 14;
            if (actualDay <= ovulationDay - 2) {
                phase = 'follicular';
            } else if (actualDay <= ovulationDay + 2) {
                phase = 'ovulation';
            } else {
                phase = 'luteal';
            }
        }

        // 下次经期
        const cyclesElapsed = Math.floor(daysSinceStart / cycleLength);
        const nextPeriodBase = addDays(lastStart, (cyclesElapsed + 1) * cycleLength);
        const daysUntilNext = diffDays(todayStr, nextPeriodBase);
        const actualNextPeriod = daysUntilNext < 0 ? addDays(lastStart, (cyclesElapsed + 2) * cycleLength) : nextPeriodBase;
        const daysUntilActualNext = diffDays(todayStr, actualNextPeriod);

        // 排卵日
        const ovulationDate = addDays(lastStart, cyclesElapsed * cycleLength + (cycleLength - 14));
        const ovulationDiff = diffDays(todayStr, ovulationDate);

        return {
            phase,
            cycleDay: actualDay <= cycleLength ? actualDay : (actualDay % cycleLength) || cycleLength,
            nextPeriod: actualNextPeriod,
            daysUntilNext: daysUntilActualNext,
            ovulationDate,
            ovulationDiff,
            lastStart,
        };
    }

    function buildWIContent(status, settings) {
        const phaseInfo = PHASES[status.phase] || PHASES.unknown;
        const lines = [
            `【当前生理周期状态】`,
            `阶段：${phaseInfo.emoji} ${phaseInfo.name}`,
        ];
        if (status.cycleDay) lines.push(`周期第 ${status.cycleDay} 天`);
        if (status.nextPeriod) {
            lines.push(`下次月经预计：${formatDate(status.nextPeriod)}（${status.daysUntilNext > 0 ? status.daysUntilNext + '天后' : '即将来临'}）`);
        }
        if (status.ovulationDate) {
            lines.push(`本周期排卵日约：${formatDate(status.ovulationDate)}（${status.ovulationDiff > 0 ? status.ovulationDiff + '天后' : status.ovulationDiff < 0 ? Math.abs(status.ovulationDiff) + '天前' : '今天'}）`);
        }
        if (status.lastStart) lines.push(`上次月经开始：${formatDate(status.lastStart)}`);
        lines.push(`周期设定：${settings.cycleLength}天，经期${settings.periodLength}天`);
        return lines.join('\n');
    }

    // ==============================
    // 设置管理
    // ==============================
    function getSettings() {
        const ctx = SillyTavern.getContext();
        if (!ctx.extensionSettings[MODULE_NAME]) {
            ctx.extensionSettings[MODULE_NAME] = structuredClone(DEFAULT_SETTINGS);
        }
        // 补全缺失字段
        for (const key of Object.keys(DEFAULT_SETTINGS)) {
            if (!Object.hasOwn(ctx.extensionSettings[MODULE_NAME], key)) {
                ctx.extensionSettings[MODULE_NAME][key] = DEFAULT_SETTINGS[key];
            }
        }
        return ctx.extensionSettings[MODULE_NAME];
    }

    function saveSettings() {
        SillyTavern.getContext().saveSettingsDebounced();
    }

    // ==============================
    // 世界书注入
    // ==============================
    async function injectToWorldInfo() {
        const settings = getSettings();
        const wiStatus = document.getElementById('ct-wi-status');

        function setWiStatus(type, msg) {
            if (!wiStatus) return;
            wiStatus.className = `ct-wi-status ct-wi-${type}`;
            wiStatus.textContent = msg;
        }

        if (!settings.wiBookName || !settings.autoInject) {
            setWiStatus('warn', '⚠ 未配置世界书或自动注入已关闭');
            return;
        }

        const ctx = SillyTavern.getContext();
        const status = calcCycleStatus(settings);
        const content = buildWIContent(status, settings);

        try {
            // 获取世界书列表
            const response = await fetch('/api/worldinfo/get', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: settings.wiBookName }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            if (!data || !data.entries) {
                throw new Error('世界书数据格式错误');
            }

            // 查找已有条目
            const entries = Object.values(data.entries);
            const existing = entries.find(e =>
                (e.comment && e.comment.includes(settings.wiEntryTitle)) ||
                (e.key && e.key.some && e.key.some(k => k.includes(settings.wiEntryTitle)))
            );

            if (existing) {
                // 更新
                existing.content = content;
                existing.comment = settings.wiEntryTitle;
            } else {
                // 新建
                const newUid = Date.now();
                data.entries[newUid] = {
                    uid: newUid,
                    key: [settings.wiEntryTitle, '生理周期', '月经'],
                    keysecondary: [],
                    comment: settings.wiEntryTitle,
                    content: content,
                    constant: true,
                    selective: false,
                    selectiveLogic: 0,
                    addMemo: true,
                    order: 100,
                    position: 0,
                    disable: false,
                    excludeRecursion: false,
                    probability: 100,
                    useProbability: false,
                    depth: 4,
                    group: '',
                    groupOverride: false,
                    groupWeight: 100,
                    scanDepth: null,
                    caseSensitive: null,
                    matchWholeWords: null,
                    useGroupScoring: null,
                    automationId: '',
                    role: 0,
                    vectorized: false,
                    delayed_until_recursion: false,
                };
            }

            // 保存
            const saveResp = await fetch('/api/worldinfo/edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: settings.wiBookName, data }),
            });

            if (!saveResp.ok) throw new Error(`保存失败 HTTP ${saveResp.status}`);

            setWiStatus('ok', `✅ 已注入世界书「${settings.wiBookName}」`);
            LOG('世界书注入成功', settings.wiBookName);
        } catch (err) {
            setWiStatus('err', `❌ 注入失败: ${err.message}`);
            LOG('世界书注入失败', err);
        }
    }

    // ==============================
    // UI 构建
    // ==============================
    function buildPanel() {
        const overlay = document.createElement('div');
        overlay.id = 'cycle-tracker-overlay';
        overlay.innerHTML = `
<div id="cycle-tracker-panel">
  <h2>🌙 生理周期追踪器 <span class="ct-close" id="ct-panel-close">✕</span></h2>

  <!-- Tab 导航 -->
  <div class="ct-tabs">
    <div class="ct-tab active" data-tab="status">状态</div>
    <div class="ct-tab" data-tab="record">记录</div>
    <div class="ct-tab" data-tab="settings">设置</div>
  </div>

  <!-- ===== Tab: 状态 ===== -->
  <div class="ct-tab-content active" id="ct-tab-status">
    <div id="ct-status-display">
      <div id="ct-phase-badge" class="ct-phase-badge ct-phase-unknown">❓ 未知</div>
      <div class="ct-info-row" id="ct-info-cycleday"></div>
      <div class="ct-info-row" id="ct-info-next"></div>
      <div class="ct-info-row" id="ct-info-ovulation"></div>
      <div class="ct-info-row" id="ct-info-laststart"></div>
    </div>
    <div id="ct-wi-status" class="ct-wi-status ct-wi-warn">⚠ 尚未配置世界书</div>
    <div class="ct-btn-row" style="margin-top:10px">
      <button class="ct-btn ct-btn-primary" id="ct-btn-inject">💉 立即注入世界书</button>
    </div>
  </div>

  <!-- ===== Tab: 记录 ===== -->
  <div class="ct-tab-content" id="ct-tab-record">
    <div class="ct-section">
      <label>记录月经开始日期</label>
      <input type="date" class="ct-input" id="ct-input-date" />
      <div class="ct-btn-row">
        <button class="ct-btn ct-btn-primary" id="ct-btn-add-date">＋ 添加记录</button>
        <button class="ct-btn ct-btn-secondary" id="ct-btn-today">今天</button>
      </div>
    </div>
    <div class="ct-section">
      <label>历史记录</label>
      <div id="ct-history-list"></div>
    </div>
  </div>

  <!-- ===== Tab: 设置 ===== -->
  <div class="ct-tab-content" id="ct-tab-settings">
    <div class="ct-section">
      <label>周期参数</label>
      <div class="ct-setting-row">
        <span>周期天数</span>
        <input type="number" class="ct-input" id="ct-cycle-length" min="21" max="40" style="width:72px" />
      </div>
      <div class="ct-setting-row">
        <span>经期天数</span>
        <input type="number" class="ct-input" id="ct-period-length" min="2" max="10" style="width:72px" />
      </div>
    </div>
    <div class="ct-section">
      <label>世界书设置</label>
      <div class="ct-setting-row">
        <span>世界书名称</span>
      </div>
      <input type="text" class="ct-input" id="ct-wi-name" placeholder="输入世界书名称（不含.json）" style="margin-bottom:8px" />
      <div class="ct-setting-row">
        <span>条目标题/关键词</span>
      </div>
      <input type="text" class="ct-input" id="ct-wi-entry" placeholder="如：生理周期状态" style="margin-bottom:8px" />
      <div class="ct-setting-row">
        <span>自动注入（每次打开面板）</span>
        <label class="ct-toggle">
          <input type="checkbox" id="ct-auto-inject" />
          <span class="ct-toggle-slider"></span>
        </label>
      </div>
      <div class="ct-setting-row">
        <span>显示浮动按钮</span>
        <label class="ct-toggle">
          <input type="checkbox" id="ct-show-btn" />
          <span class="ct-toggle-slider"></span>
        </label>
      </div>
    </div>
    <div class="ct-btn-row">
      <button class="ct-btn ct-btn-primary" id="ct-btn-save-settings">💾 保存设置</button>
    </div>
  </div>

</div>`;
        document.body.appendChild(overlay);
        return overlay;
    }

    // ==============================
    // UI 渲染
    // ==============================
    function renderStatus() {
        const settings = getSettings();
        const status = calcCycleStatus(settings);
        const phaseInfo = PHASES[status.phase] || PHASES.unknown;

        const badge = document.getElementById('ct-phase-badge');
        if (badge) {
            badge.className = `ct-phase-badge ct-phase-${status.phase}`;
            badge.textContent = `${phaseInfo.emoji} ${phaseInfo.name}`;
        }

        const setRow = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = text;
        };

        if (status.cycleDay) {
            setRow('ct-info-cycleday', `周期第 <span>${status.cycleDay}</span> 天`);
        } else {
            setRow('ct-info-cycleday', '暂无数据，请先记录经期开始日期');
        }

        if (status.nextPeriod) {
            const days = status.daysUntilNext;
            setRow('ct-info-next', `下次月经：<span>${formatDate(status.nextPeriod)}</span>（${days > 0 ? days + ' 天后' : days === 0 ? '今天' : Math.abs(days) + ' 天前'}）`);
        } else {
            setRow('ct-info-next', '');
        }

        if (status.ovulationDate) {
            const diff = status.ovulationDiff;
            setRow('ct-info-ovulation', `排卵日约：<span>${formatDate(status.ovulationDate)}</span>（${diff > 0 ? diff + ' 天后' : diff === 0 ? '今天' : Math.abs(diff) + ' 天前'}）`);
        } else {
            setRow('ct-info-ovulation', '');
        }

        if (status.lastStart) {
            setRow('ct-info-laststart', `上次月经：<span>${formatDate(status.lastStart)}</span>`);
        } else {
            setRow('ct-info-laststart', '');
        }
    }

    function renderHistory() {
        const settings = getSettings();
        const list = document.getElementById('ct-history-list');
        if (!list) return;

        const dates = [...(settings.periodStartDates || [])].sort().reverse();
        if (dates.length === 0) {
            list.innerHTML = '<div style="color:#a6adc8;font-size:12px;text-align:center;padding:8px">暂无记录</div>';
            return;
        }

        list.innerHTML = dates.map((d, i) => `
<div class="ct-history-item">
  <span>${formatDate(d)} <span style="color:#585b70;font-size:11px">(${d})</span></span>
  <span class="ct-history-del" data-date="${d}">✕</span>
</div>`).join('');

        list.querySelectorAll('.ct-history-del').forEach(btn => {
            btn.addEventListener('click', () => {
                const dateToRemove = btn.dataset.date;
                settings.periodStartDates = settings.periodStartDates.filter(d => d !== dateToRemove);
                saveSettings();
                renderHistory();
                renderStatus();
            });
        });
    }

    function renderSettingsForm() {
        const settings = getSettings();
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        const setChecked = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };

        setVal('ct-cycle-length', settings.cycleLength);
        setVal('ct-period-length', settings.periodLength);
        setVal('ct-wi-name', settings.wiBookName);
        setVal('ct-wi-entry', settings.wiEntryTitle);
        setChecked('ct-auto-inject', settings.autoInject);
        setChecked('ct-show-btn', settings.showBtn);
    }

    // ==============================
    // 事件绑定
    // ==============================
    function bindEvents(overlay) {
        // 关闭按钮
        document.getElementById('ct-panel-close')?.addEventListener('click', closePanel);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closePanel();
        });

        // Tab切换
        overlay.querySelectorAll('.ct-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                overlay.querySelectorAll('.ct-tab').forEach(t => t.classList.remove('active'));
                overlay.querySelectorAll('.ct-tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`ct-tab-${tabName}`)?.classList.add('active');

                if (tabName === 'settings') renderSettingsForm();
                if (tabName === 'record') renderHistory();
            });
        });

        // 今天快捷键
        document.getElementById('ct-btn-today')?.addEventListener('click', () => {
            const input = document.getElementById('ct-input-date');
            if (input) input.value = today();
        });

        // 添加日期
        document.getElementById('ct-btn-add-date')?.addEventListener('click', () => {
            const input = document.getElementById('ct-input-date');
            if (!input || !input.value) {
                toastr.warning('请先选择日期');
                return;
            }
            const settings = getSettings();
            const dateVal = input.value;
            if (settings.periodStartDates.includes(dateVal)) {
                toastr.info('该日期已存在');
                return;
            }
            settings.periodStartDates.push(dateVal);
            saveSettings();
            renderHistory();
            renderStatus();
            toastr.success(`已添加：${formatDate(dateVal)}`);
        });

        // 立即注入
        document.getElementById('ct-btn-inject')?.addEventListener('click', () => {
            injectToWorldInfo();
        });

        // 保存设置
        document.getElementById('ct-btn-save-settings')?.addEventListener('click', () => {
            const settings = getSettings();
            const getNum = (id, fallback) => {
                const el = document.getElementById(id);
                return el ? (parseInt(el.value) || fallback) : fallback;
            };
            const getStr = (id) => {
                const el = document.getElementById(id);
                return el ? el.value.trim() : '';
            };
            const getBool = (id) => {
                const el = document.getElementById(id);
                return el ? el.checked : false;
            };

            settings.cycleLength = getNum('ct-cycle-length', 28);
            settings.periodLength = getNum('ct-period-length', 5);
            settings.wiBookName = getStr('ct-wi-name');
            settings.wiEntryTitle = getStr('ct-wi-entry') || '生理周期状态';
            settings.autoInject = getBool('ct-auto-inject');
            settings.showBtn = getBool('ct-show-btn');

            saveSettings();
            renderStatus();
            updateBtnVisibility();
            toastr.success('设置已保存');
        });
    }

    // ==============================
    // 面板开关
    // ==============================
    function openPanel() {
        const overlay = document.getElementById('cycle-tracker-overlay');
        if (!overlay) return;
        overlay.classList.add('ct-visible');
        renderStatus();
        renderHistory();

        const settings = getSettings();
        if (settings.autoInject && settings.wiBookName) {
            injectToWorldInfo();
        }
    }

    function closePanel() {
        const overlay = document.getElementById('cycle-tracker-overlay');
        if (overlay) overlay.classList.remove('ct-visible');
    }

    function updateBtnVisibility() {
        const settings = getSettings();
        const btn = document.getElementById('cycle-tracker-btn');
        if (btn) btn.style.display = settings.showBtn ? '' : 'none';
    }

    // ==============================
    // 初始化
    // ==============================
    function init() {
        LOG('初始化');

        // 初始化设置
        getSettings();

        // 构建面板
        const overlay = buildPanel();
        bindEvents(overlay);

        // 浮动按钮
        const btn = document.createElement('div');
        btn.id = 'cycle-tracker-btn';
        btn.title = '生理周期追踪器';
        btn.textContent = '🌙';
        btn.addEventListener('click', openPanel);
        document.body.appendChild(btn);
        updateBtnVisibility();

        // 监听事件（世界书可能在chat切换时需要重新注入）
        const { eventSource, event_types } = SillyTavern.getContext();
        if (eventSource && event_types) {
            eventSource.on(event_types.CHAT_CHANGED, () => {
                const settings = getSettings();
                if (settings.autoInject && settings.wiBookName) {
                    // 延迟确保WI已加载
                    setTimeout(() => injectToWorldInfo(), 1500);
                }
            });
        }

        LOG('初始化完成');
    }

    // ======================================================
    // 入口与酒馆挂载逻辑 (全量替换此段)
    // ======================================================

    async function tryInit() {
        if (window.__cycleTrackerInited) return;
        
        try {
            // 1. 执行核心初始化 (创建悬浮按钮和面板)
            init();
            window.__cycleTrackerInited = true;
            LOG('核心 UI 已加载');

            // 2. 注册到左侧魔法棒扩展菜单 (确保万无一失)
            const context = SillyTavern.getContext();
            if (context && context.addExtensionButton) {
                context.addExtensionButton(
                    '🌙',               // 菜单图标
                    '生理周期追踪器',      // 菜单名称
                    () => {            // 点击动作
                        const overlay = document.getElementById('cycle-tracker-overlay');
                        if (overlay) {
                            overlay.classList.add('ct-visible');
                        } else {
                            // 容错：如果面板还没创建，手动触发按钮点击
                            document.getElementById('cycle-tracker-btn')?.click();
                        }
                    },
                    'cycle-tracker'     // 唯一ID
                );
                LOG('已成功挂载至左侧魔法棒菜单');
            }
        } catch (e) {
            console.error('[CycleTracker] 初始化失败:', e);
        }
    }

    // 立即尝试运行
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        tryInit();
    } else {
        window.addEventListener('DOMContentLoaded', tryInit);
    }

    // 针对 SillyTavern 加载机制的补丁
    try {
        const ctx = SillyTavern.getContext();
        if (ctx && ctx.eventSource && ctx.event_types) {
            // 如果 APP_READY 还没发，就挂载监听；如果发过了，tryInit 内部有锁不会跑两次
            ctx.eventSource.on(ctx.event_types.APP_READY, tryInit);
        }
    } catch (e) {
        // 忽略 getContext 报错，因为上面已经有 DOMContentLoaded 保底
    }

})(); // 结尾闭合
