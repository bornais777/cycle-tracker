import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";

const extensionName = "cycle_tracker";

// 1. 数据逻辑
function calculate() {
    const s = extension_settings[extensionName];
    if (!s?.periodStartDates?.length) return null;
    const diff = Math.floor((new Date() - new Date(s.periodStartDates[0])) / 86400000);
    const day = (diff % s.cycleLength) + 1;
    let phase = day <= s.periodLength ? "经期" : (day <= 13 ? "卵泡期" : (day <= 15 ? "排卵期" : "黄体期"));
    return { day, phase };
}

// 2. 弹窗函数 (已跑通)
function showCycleDialog() {
    $(`#${extensionName}-dialog`).remove();
    const res = calculate();
    const dialogHtml = `
    <div id="${extensionName}-dialog" class="diary-exchange-reroll-content" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:100000; padding:20px; border-radius:10px; min-width:280px;">
        <h3 class="diary-exchange-reroll-header" style="margin:0 0 15px 0; padding:10px;">🌙 周期详情</h3>
        <div style="padding:10px;">
            <p>阶段：<b>${res ? res.phase : '未设置'}</b></p>
            <p>天数：<b>${res ? '第 ' + res.day + ' 天' : 'N/A'}</b></p>
            <hr style="opacity:0.2">
            <button id="diag-close-btn" class="menu_button" style="width:100%; margin-top:10px;">关闭</button>
        </div>
    </div>`;
    $('body').append(dialogHtml);
    $('#diag-close-btn').on('click', () => $(`#${extensionName}-dialog`).remove());
}

// 3. 找回丢失的“侧边栏设置” (Extension Tab)
function renderSettings() {
    $(`#${extensionName}-settings`).remove();
    const s = extension_settings[extensionName];
    const settingsHtml = `
    <div id="${extensionName}-settings" class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>🌙 生理周期追踪器</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content" style="padding:10px; display:flex; flex-direction:column; gap:10px;">
            <label>平均周期天数</label>
            <input type="number" id="ct-cycle-len" class="text_pole" value="${s.cycleLength}">
            <label>平均经期天数</label>
            <input type="number" id="ct-period-len" class="text_pole" value="${s.periodLength}">
            <label>最后一次开始日期</label>
            <input type="date" id="ct-start-date" class="text_pole" value="${s.periodStartDates[0] || ''}">
            <button id="ct-save-btn" class="menu_button" style="width:100%">保存全部设置</button>
        </div>
    </div>`;
    $("#extensions_settings").append(settingsHtml);

    $("#ct-save-btn").on("click", () => {
        s.cycleLength = parseInt($("#ct-cycle-len").val());
        s.periodLength = parseInt($("#ct-period-len").val());
        s.periodStartDates = [$("#ct-start-date").val()];
        saveSettingsDebounced();
        toastr.success("设置已保存，数据已同步");
    });
}

// 4. 魔法棒挂载 (增强版)
function mountWand() {
    const context = getContext();
    if (context && context.addExtensionButton) {
        if ($('#cycle-tracker-wand').length) return;
        // 尝试两种方式，图标不行就用文字
        context.addExtensionButton('🌙', '生理周期', () => showCycleDialog(), 'cycle-tracker-wand');
        console.log("🌙 魔法棒挂载尝试成功");
    } else {
        setTimeout(mountWand, 1000);
    }
}

// 5. 初始化
function init() {
    // 确保数据不被克劳德改名
    extension_settings[extensionName] = extension_settings[extensionName] || { 
        cycleLength: 28, 
        periodLength: 5, 
        periodStartDates: [], 
        wiKeyword: '生理周期' 
    };

    renderSettings(); // 渲染侧边栏
    mountWand();      // 挂载魔法棒

    // 悬浮小月亮
    $('#cycle-tracker-float').remove();
    const floatBtn = $(`<div id="cycle-tracker-float" style="position:fixed; bottom:120px; right:20px; z-index:99999; width:45px; height:45px; background:rgba(0,0,0,0.4); border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:26px; border:1px solid rgba(255,255,255,0.2); backdrop-filter:blur(5px); transition: 0.3s;">🌙</div>`);
    $('body').append(floatBtn);
    floatBtn.on('click', () => showCycleDialog());
}

$(document).ready(() => init());
