import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";

const extensionName = "cycle_tracker";

// 1. 初始化设置
function loadSettings() {
    const defaultSettings = {
        cycleLength: 28,
        periodLength: 5,
        periodStartDates: [],
        wiKeyword: '生理周期',
    };
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    Object.assign(extension_settings[extensionName], { ...defaultSettings, ...extension_settings[extensionName] });
}

// 2. 核心计算逻辑
function calculateCycle() {
    const settings = extension_settings[extensionName];
    if (!settings || !settings.periodStartDates.length) return null;
    const lastStart = new Date(settings.periodStartDates[0]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - lastStart) / (1000 * 60 * 60 * 24));
    const dayOfCycle = (diffDays % settings.cycleLength) + 1;
    let phase = "黄体期";
    if (dayOfCycle <= settings.periodLength) phase = "经期";
    else if (dayOfCycle <= 13) phase = "卵泡期";
    else if (dayOfCycle <= 15) phase = "排卵期";
    return { day: dayOfCycle, phase };
}

// 3. UI 与 魔法棒挂载 (重点修复)
function setupUI() {
    // 移除旧面板
    $(`#${extensionName}-settings`).remove();
    
    // 插入侧边栏设置
    const settingsHtml = `
    <div id="${extensionName}-settings" class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>🌙 生理周期追踪器</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <div class="ct-grid">
                <label>平均周期天数</label>
                <input type="number" id="ct-cycle-len" class="text_pole" value="${extension_settings[extensionName].cycleLength}">
                <label>最后一次开始日期</label>
                <input type="date" id="ct-start-date" class="text_pole" value="${extension_settings[extensionName].periodStartDates[0] || ''}">
                <label>世界书触发词</label>
                <input type="text" id="ct-wi-key" class="text_pole" value="${extension_settings[extensionName].wiKeyword}">
            </div>
            <button id="ct-save-btn" class="menu_button ct-wide-btn">保存并关联世界书</button>
        </div>
    </div>`;
    $("#extensions_settings").append(settingsHtml);

    $("#ct-save-btn").on("click", () => {
        const s = extension_settings[extensionName];
        s.cycleLength = parseInt($("#ct-cycle-len").val());
        s.periodStartDates = [$("#ct-start-date").val()];
        s.wiKeyword = $("#ct-wi-key").val();
        saveSettingsDebounced();
        toastr.success("设置已保存");
    });

    // 魔法棒按钮挂载：采用循环检测机制
    let attempts = 0;
    const mountButton = setInterval(() => {
        attempts++;
        const context = getContext();
        if (context && context.addExtensionButton) {
            // 如果已经存在则不重复添加
            if ($('#cycle-tracker-wand').length === 0) {
                context.addExtensionButton('🌙', '周期追踪', () => {
                    const res = calculateCycle();
                    toastr.info(res ? `当前：第 ${res.day} 天 (${res.phase})` : "请先在设置中填写起始日期");
                }, 'cycle-tracker-wand');
            }
            clearInterval(mountButton);
            console.log("[CycleTracker] 魔法棒按钮挂载成功");
        }
        if (attempts > 30) clearInterval(mountButton); // 30秒后停止尝试
    }, 1000);

    // 强行渲染悬浮球 (如果魔法棒不习惯，可以用这个)
    if ($('#cycle-tracker-float').length === 0) {
        $('body').append('<div id="cycle-tracker-float" style="position:fixed; bottom:100px; right:20px; z-index:9999; cursor:pointer; font-size:30px; filter: drop-shadow(0 0 5px rgba(0,0,0,0.5));">🌙</div>');
        $('#cycle-tracker-float').on('click', () => {
            const res = calculateCycle();
            toastr.info(res ? `周期：${res.day}天 (${res.phase})` : "未设置日期");
        });
    }
}

// 4. 初始化
async function init() {
    loadSettings();
    setupUI();
}

init();
