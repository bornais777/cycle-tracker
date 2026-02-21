import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

const extensionName = "cycle_tracker";

// 1. 核心计算函数 (计算经期、排卵期等)
function calculate() {
    const s = extension_settings[extensionName];
    if (!s?.periodStartDates?.length) return null;
    const diff = Math.floor((new Date() - new Date(s.periodStartDates[0])) / 86400000);
    const day = (diff % s.cycleLength) + 1;
    let phase = day <= s.periodLength ? "经期" : (day <= 13 ? "卵泡期" : (day <= 15 ? "排卵期" : "黄体期"));
    return { day, phase };
}

// 2. 交互弹窗 (月亮和魔法棒点击后共用)
function showCycleDialog() {
    $(`#${extensionName}-dialog`).remove();
    const res = calculate();
    const dialogHtml = `
    <div id="${extensionName}-dialog" class="diary-exchange-reroll-content" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:100000; padding:20px; border-radius:10px; min-width:280px; background: linear-gradient(135deg, #f6ecd9 0%, #efe1c8 100%); border: 2px solid #caa574; color: #5c4033;">
        <h3 style="margin-top:0; border-bottom:1px solid #caa574; padding-bottom:5px;">🌙 周期详情</h3>
        <p>当前阶段: <b>${res ? res.phase : '未设置'}</b></p>
        <p>周期天数: <b>${res ? '第 ' + res.day + ' 天' : 'N/A'}</b></p>
        <button id="diag-close-btn" class="menu_button" style="width:100%; margin-top:10px;">关闭窗口</button>
    </div>`;
    $('body').append(dialogHtml);
    $('#diag-close-btn').on('click', () => $(`#${extensionName}-dialog`).remove());
}

// 3. 注册魔法棒菜单按钮 (完全模仿隐藏助手)
function registerWandButton() {
    const context = getContext();
    if (context && context.addExtensionButton) {
        if ($('#cycle-tracker-wand').length) return;
        context.addExtensionButton(
            'fa-moon', 
            '生理周期', 
            () => showCycleDialog(), 
            'cycle-tracker-wand'
        );
    }
}

// 4. 侧边栏面板 (找回消失的设置页)
function renderSidebar() {
    $(`#${extensionName}-settings`).remove();
    const s = extension_settings[extensionName];
    const settingsHtml = `
    <div id="${extensionName}-settings" class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header"><b>🌙 生理周期设置</b></div>
        <div class="inline-drawer-content" style="padding:10px;">
            <label>周期天数</label>
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
        toastr.success("设置已保存！");
    });
}

// 5. 初始化 (大满贯：月亮+侧边栏+魔法棒)
function init() {
    // 数据初始化
    extension_settings[extensionName] = extension_settings[extensionName] || { cycleLength: 28, periodLength: 5, periodStartDates: [] };

    // A. 注入侧边栏
    renderSidebar();

    // B. 注入小月亮 (悬浮球)
    $('#cycle-tracker-float').remove();
    const floatBtn = $(`<div id="cycle-tracker-float" style="position:fixed; bottom:120px; right:20px; z-index:99999; width:45px; height:45px; background:rgba(0,0,0,0.5); border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:26px; border:1px solid rgba(255,255,255,0.2); backdrop-filter:blur(5px);">🌙</div>`);
    $('body').append(floatBtn);
    floatBtn.on('click', () => showCycleDialog());

    // C. 注入魔法棒按钮 (多次尝试，确保成功)
    registerWandButton();
    setTimeout(registerWandButton, 2000); // 2秒后再试一次
    setTimeout(registerWandButton, 5000); // 5秒后再补一刀
}

$(document).ready(() => init());
