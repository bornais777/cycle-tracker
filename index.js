import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";

const extensionName = "cycle_tracker";

// 1. 核心计算 (为了防止报错，加了空值判断)
function calculate() {
    const s = extension_settings[extensionName];
    if (!s || !s.periodStartDates || s.periodStartDates.length === 0) return null;
    const diff = Math.floor((new Date() - new Date(s.periodStartDates[0])) / 86400000);
    const day = (diff % s.cycleLength) + 1;
    let phase = day <= s.periodLength ? "经期" : (day <= 13 ? "卵泡期" : (day <= 15 ? "排卵期" : "黄体期"));
    return { day, phase };
}

// 2. 弹窗函数 (已跑通的逻辑)
function showCycleDialog() {
    $(`#${extensionName}-dialog`).remove();
    const res = calculate();
    const dialogHtml = `
    <div id="${extensionName}-dialog" class="diary-exchange-reroll-content" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:100000; padding:20px; border-radius:10px; min-width:280px; background: #f6ecd9; border: 2px solid #caa574; color: #5c4033;">
        <h3 style="margin:0 0 10px 0;">🌙 周期详情</h3>
        <p>阶段：<b>${res ? res.phase : '未设置'}</b></p>
        <p>天数：<b>${res ? '第 '+res.day+' 天' : 'N/A'}</b></p>
        <button id="diag-close-btn" class="menu_button" style="width:100%; margin-top:10px;">关闭</button>
    </div>`;
    $('body').append(dialogHtml);
    $('#diag-close-btn').on('click', () => $(`#${extensionName}-dialog`).remove());
}

// 3. 侧边栏渲染 (确保扩展面板不消失)
function renderSettings() {
    $(`#${extensionName}-settings`).remove();
    const s = extension_settings[extensionName];
    const settingsHtml = `
    <div id="${extensionName}-settings" class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header"><b>🌙 生理周期设置</b></div>
        <div class="inline-drawer-content" style="padding:10px;">
            <label>周期长度</label>
            <input type="number" id="ct-cycle-len" class="text_pole" value="${s.cycleLength}">
            <label>起始日期</label>
            <input type="date" id="ct-start-date" class="text_pole" value="${s.periodStartDates[0] || ''}">
            <button id="ct-save-btn" class="menu_button" style="width:100%; margin-top:10px;">保存</button>
        </div>
    </div>`;
    $("#extensions_settings").append(settingsHtml);
    $("#ct-save-btn").on("click", () => {
        s.cycleLength = parseInt($("#ct-cycle-len").val());
        s.periodStartDates = [$("#ct-start-date").val()];
        saveSettingsDebounced();
        toastr.success("设置已保存");
    });
}

// 4. 初始化
function init() {
    // 确保数据结构存在
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = { cycleLength: 28, periodLength: 5, periodStartDates: [] };
    }

    renderSettings(); // 恢复侧边栏

    // 绑定物理按钮点击事件 (魔法棒列表里的按钮)
    $(document).on('click', '#cycle_tracker_menu_button', function() {
        showCycleDialog();
    });

    // 恢复小月亮悬浮球
    $('#cycle-tracker-float').remove();
    const floatBtn = $(`<div id="cycle-tracker-float" style="position:fixed; bottom:120px; right:20px; z-index:99999; width:45px; height:45px; background:rgba(0,0,0,0.5); border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:26px; border:1px solid rgba(255,255,255,0.2); backdrop-filter:blur(5px);">🌙</div>`);
    $('body').append(floatBtn);
    floatBtn.on('click', () => showCycleDialog());
}

// 5. 仿隐藏助手：确保酒馆加载好后再运行
$(document).ready(() => {
    init();
});
