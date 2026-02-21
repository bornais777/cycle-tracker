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
    let emoji = day <= s.periodLength ? "🩸" : "🌕";
    return { day, phase, emoji };
}

// 3. 弹窗交互 UI
function showCycleDialog() {
    const res = calculate();
    $(`#${extensionName}-dialog`).remove();
    
    const dialogHtml = `
    <div id="${extensionName}-dialog" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:100000; background: linear-gradient(135deg, #f6ecd9 0%, #efe1c8 100%); border: 2px solid #caa574; padding:20px; border-radius:10px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); min-width:280px; color:#5c4033;">
        <h3 style="margin-top:0; border-bottom:1px solid #caa574;">🌙 周期状态详情</h3>
        <p><b>当前阶段:</b> ${res ? res.phase + ' ' + res.emoji : '未设置'}</p>
        <p><b>周期天数:</b> ${res ? '第 ' + res.day + ' 天' : 'N/A'}</p>
        <hr/>
        <div style="display:flex; flex-direction:column; gap:10px;">
            <label>快速调整起始日期:</label>
            <input type="date" id="diag-start-date" class="text_pole" value="${extension_settings[extensionName].periodStartDates[0] || ''}">
            <button id="diag-save-btn" class="menu_button" style="background:linear-gradient(135deg, #daa520 0%, #cd853f 100%); color:white;">更新并同步世界书</button>
            <button id="diag-close-btn" class="menu_button">关闭窗口</button>
        </div>
    </div>`;
    
    $('body').append(dialogHtml);

    // 弹窗内交互逻辑
    $('#diag-save-btn').on('click', () => {
        extension_settings[extensionName].periodStartDates = [$('#diag-start-date').val()];
        saveSettingsDebounced();
        toastr.success("设置已更新，世界书关键词「" + extension_settings[extensionName].wiKeyword + "」已激活");
        showCycleDialog(); // 刷新弹窗数值
    });
    $('#diag-close-btn').on('click', () => $(`#${extensionName}-dialog`).remove());
}

// 4. 注入逻辑
function initUI() {
    // 侧边栏面板
    $(`#${extensionName}-settings`).remove();
    const settingsHtml = `
    <div id="${extensionName}-settings" class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header"><b>🌙 生理周期</b></div>
        <div class="inline-drawer-content" style="padding:10px;">
            <label>世界书触发词</label>
            <input type="text" id="ct-wi-key" class="text_pole" value="${extension_settings[extensionName].wiKeyword}">
            <button id="ct-main-save" class="menu_button" style="width:100%; margin-top:10px;">保存全局设定</button>
        </div>
    </div>`;
    $("#extensions_settings").append(settingsHtml);
    $("#ct-main-save").on("click", () => {
        extension_settings[extensionName].wiKeyword = $("#ct-wi-key").val();
        saveSettingsDebounced();
        toastr.success("全局设定已保存");
    });

    // 魔法棒挂载
    const context = getContext();
    if (context && context.addExtensionButton) {
        context.addExtensionButton('🌙', '周期追踪', () => showCycleDialog(), 'cycle-tracker-wand');
    }

    // 悬浮球挂载
    $('#cycle-tracker-float').remove();
    const floatBtn = $(`<div id="cycle-tracker-float" style="position:fixed; bottom:120px; right:20px; z-index:99999; width:45px; height:45px; background:rgba(0,0,0,0.4); border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:26px; border:1px solid rgba(255,255,255,0.2); backdrop-filter:blur(5px);">🌙</div>`);
    $('body').append(floatBtn);
    floatBtn.on('click', () => showCycleDialog());
}

loadSettings();
$(document).ready(() => initUI());
