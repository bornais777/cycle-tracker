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

// 2. 核心计算
function calculate() {
    const s = extension_settings[extensionName];
    if (!s.periodStartDates.length) return null;
    const diff = Math.floor((new Date() - new Date(s.periodStartDates[0])) / 86400000);
    const day = (diff % s.cycleLength) + 1;
    let phase = day <= s.periodLength ? "经期" : (day <= 13 ? "卵泡期" : (day <= 15 ? "排卵期" : "黄体期"));
    return { day, phase };
}

// 3. UI 注入 (模仿日记本的 createFloatWindow 逻辑)
function injectCycleUI() {
    // A. 侧边栏面板 (酒馆设置里显示的)
    $(`#${extensionName}-settings`).remove();
    const settingsHtml = `
    <div id="${extensionName}-settings" class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>🌙 生理周期追踪器</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <div style="padding:10px; display:flex; flex-direction:column; gap:8px;">
                <label>平均周期天数</label>
                <input type="number" id="ct-cycle-len" class="text_pole" value="${extension_settings[extensionName].cycleLength}">
                <label>最后一次日期</label>
                <input type="date" id="ct-start-date" class="text_pole" value="${extension_settings[extensionName].periodStartDates[0] || ''}">
                <button id="ct-save-btn" class="menu_button" style="width:100%">保存设置</button>
            </div>
        </div>
    </div>`;
    $("#extensions_settings").append(settingsHtml);

    // B. 魔法棒按钮 (使用 getContext)
    const context = getContext();
    if (context && context.addExtensionButton) {
        context.addExtensionButton('🌙', '生理周期', () => {
            const res = calculate();
            toastr.info(res ? `当前：${res.phase} (第${res.day}天)` : "请先在设置中填写日期");
        }, 'cycle-tracker-wand');
    }

    // C. 强力悬浮球 (模仿日记本 appendTo('body') 的逻辑)
    $('#cycle-tracker-float').remove();
    const floatBtn = $(`
        <div id="cycle-tracker-float" 
             style="position:fixed; bottom:120px; right:20px; z-index:99999; 
                    width:45px; height:45px; background:rgba(0,0,0,0.4); 
                    border-radius:50%; display:flex; align-items:center; 
                    justify-content:center; cursor:pointer; font-size:26px;
                    border: 1px solid rgba(255,255,255,0.2); backdrop-filter:blur(5px);">
            🌙
        </div>
    `);
    $('body').append(floatBtn); // 重点：强行塞进 Body 顶层

    // 绑定事件
    $("#ct-save-btn").on("click", () => {
        extension_settings[extensionName].cycleLength = parseInt($("#ct-cycle-len").val());
        extension_settings[extensionName].periodStartDates = [$("#ct-start-date").val()];
        saveSettingsDebounced();
        toastr.success("设置已保存");
    });

    floatBtn.on('click', () => {
        const res = calculate();
        toastr.info(res ? `周期状态：${res.phase}\n当前第 ${res.day} 天` : "未设置日期");
    });
}

// 4. 初始化
loadSettings();
// 模仿日记本使用 jQuery 的初始化确保 DOM 准备就绪
$(document).ready(() => {
    injectCycleUI();
    console.log("🌙 Cycle Tracker 注入完成");
});
