import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";

const extensionName = "cycle_tracker";

// 1. 初始化设置：新增了触发关键词配置
const defaultSettings = {
    enabled: true,
    cycleLength: 28,
    periodLength: 5,
    periodStartDates: [],
    wiKeyword: '生理周期', // 只要检测到这个词，就触发你的全局世界书
};

function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    Object.assign(extension_settings[extensionName], { ...defaultSettings, ...extension_settings[extensionName] });
}

// 2. 核心计算
function calculateCycle() {
    const settings = extension_settings[extensionName];
    if (!settings.periodStartDates.length) return null;
    const lastStart = new Date(settings.periodStartDates[0]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lastStart.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - lastStart) / (1000 * 60 * 60 * 24));
    const dayOfCycle = (diffDays % settings.cycleLength) + 1;
    let phase = "黄体期";
    if (dayOfCycle <= settings.periodLength) phase = "经期";
    else if (dayOfCycle <= 13) phase = "卵泡期";
    else if (dayOfCycle <= 15) phase = "排卵期";
    return { day: dayOfCycle, phase };
}

// 3. UI 渲染逻辑
function createUI() {
    $(`#${extensionName}-settings`).remove();
    const settingsHtml = `
    <div id="${extensionName}-settings" class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>🌙 生理周期追踪器</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <div class="ct-grid-container">
                <div class="setup-item"><label>周期天数</label><input type="number" id="ct-cycle-len" class="text_pole" value="${extension_settings[extensionName].cycleLength}"></div>
                <div class="setup-item"><label>经期天数</label><input type="number" id="ct-period-len" class="text_pole" value="${extension_settings[extensionName].periodLength}"></div>
                <div class="setup-item" style="grid-column: span 2;"><label>最后一次开始日期</label><input type="date" id="ct-start-date" class="text_pole" value="${extension_settings[extensionName].periodStartDates[0] || ''}"></div>
                <div class="setup-item" style="grid-column: span 2;"><label>对应世界书关键词</label><input type="text" id="ct-wi-key" class="text_pole" value="${extension_settings[extensionName].wiKeyword}"></div>
            </div>
            <button id="ct-save-btn" class="menu_button ct-wide-btn" style="margin-top:10px;">保存设置并刷新</button>
        </div>
    </div>`;
    $("#extensions_settings").append(settingsHtml);

    $("#ct-save-btn").on("click", () => {
        const s = extension_settings[extensionName];
        s.cycleLength = parseInt($("#ct-cycle-len").val());
        s.periodLength = parseInt($("#ct-period-len").val());
        s.periodStartDates = [$("#ct-start-date").val()];
        s.wiKeyword = $("#ct-wi-key").val();
        saveSettingsDebounced();
        toastr.success("设置已保存");
    });

    // 魔法棒挂载补丁
    const mountWand = () => {
        const context = getContext();
        if (context && context.addExtensionButton) {
            context.addExtensionButton('🌙', '周期追踪', () => {
                const res = calculateCycle();
                if (res) toastr.info(`当前：周期第 ${res.day} 天 (${res.phase})`);
                else toastr.warning("请先设置日期");
            }, 'cycle-tracker-wand');
        } else { setTimeout(mountWand, 1000); }
    };
    mountWand();
}

// 4. 初始化
async function init() {
    loadSettings();
    createUI();
    console.log("[CycleTracker] 启动成功");
}
init();
