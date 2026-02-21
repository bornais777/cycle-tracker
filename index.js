import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";

const extensionName = "cycle_tracker";

function calculate() {
    const s = extension_settings[extensionName];
    if (!s?.periodStartDates?.length) return null;
    const diff = Math.floor((new Date() - new Date(s.periodStartDates[0])) / 86400000);
    const day = (diff % s.cycleLength) + 1;
    let phase = day <= s.periodLength ? "经期" : (day <= 13 ? "卵泡期" : (day <= 15 ? "排卵期" : "黄体期"));
    return { day, phase };
}

// 弹窗函数 (已跑通)
function showCycleDialog() {
    $(`#${extensionName}-dialog`).remove();
    const res = calculate();
    const dialogHtml = `
    <div id="${extensionName}-dialog" class="diary-exchange-reroll-content" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:100000; padding:20px; border-radius:10px; min-width:280px;">
        <h3 class="diary-exchange-reroll-header" style="margin:0 0 15px 0; padding:10px;">🌙 周期详情</h3>
        <div style="padding:10px;">
            <p>阶段：${res ? res.phase : '未设置'}</p>
            <p>天数：${res ? '第 '+res.day+' 天' : 'N/A'}</p>
            <button id="diag-close-btn" class="menu_button" style="width:100%; margin-top:10px;">关闭</button>
        </div>
    </div>`;
    $('body').append(dialogHtml);
    $('#diag-close-btn').on('click', () => $(`#${extensionName}-dialog`).remove());
}

// 魔法棒挂载：模仿日记本的“安全挂载”
function mountWandButton() {
    const context = getContext();
    if (context && context.addExtensionButton) {
        // 如果已经存在则不重复添加
        if ($('#cycle-tracker-wand').length) return;
        
        context.addExtensionButton(
            'fas fa-moon', // 使用日记本同款图标类名，不直接用emoji
            '生理周期状态', 
            () => showCycleDialog(), 
            'cycle-tracker-wand'
        );
        console.log("🌙 魔法棒挂载成功");
    } else {
        // 如果API没好，每隔1秒试一次，直到成功
        setTimeout(mountWandButton, 1000);
    }
}

function init() {
    // 初始化数据
    extension_settings[extensionName] = extension_settings[extensionName] || { cycleLength: 28, periodLength: 5, periodStartDates: [], wiKeyword: '生理周期' };
    
    // 注入小月亮 (已跑通)
    $('#cycle-tracker-float').remove();
    const floatBtn = $(`<div id="cycle-tracker-float" style="position:fixed; bottom:120px; right:20px; z-index:99999; width:45px; height:45px; background:rgba(0,0,0,0.4); border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:26px; border:1px solid rgba(255,255,255,0.2); backdrop-filter:blur(5px);">🌙</div>`);
    $('body').append(floatBtn);
    floatBtn.on('click', () => showCycleDialog());

    // 尝试挂载魔法棒
    mountWandButton();
}

$(document).ready(() => init());
