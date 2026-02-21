import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";

const extensionName = "cycle_tracker";

// 1. 核心计算逻辑
function calculate() {
    const s = extension_settings[extensionName];
    if (!s?.periodStartDates?.length) return null;
    const lastStart = new Date(s.periodStartDates[0]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - lastStart) / (1000 * 60 * 60 * 24));
    const dayOfCycle = (diffDays % s.cycleLength) + 1;
    let phase = "黄体期";
    if (dayOfCycle <= s.periodLength) phase = "经期";
    else if (dayOfCycle <= 13) phase = "卵泡期";
    else if (dayOfCycle <= 15) phase = "排卵期";
    return { day: dayOfCycle, phase };
}

// 2. 交互弹窗 (月亮点击后的效果)
function showCycleDialog() {
    $(`#${extensionName}-dialog`).remove();
    const res = calculate();
    const dialogHtml = `
    <div id="${extensionName}-dialog" class="diary-exchange-reroll-content" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:100000; padding:20px; border-radius:10px; min-width:280px; box-shadow: 0 0 20px rgba(0,0,0,0.5);">
        <h3 class="diary-exchange-reroll-header" style="margin:0 0 15px 0; padding:10px; border-radius:5px;">🌙 周期追踪状态</h3>
        <div style="padding:10px; color: var(--SmartThemeBodyColor);">
            <p>当前阶段：<span style="color:#cba6f7; font-weight:bold;">${res ? res.phase : '未设置'}</span></p>
            <p>当前天数：<span style="color:#cba6f7; font-weight:bold;">${res ? '第 ' + res.day + ' 天' : 'N/A'}</span></p>
            <hr style="opacity:0.2; margin:15px 0;">
            <button id="diag-close-btn" class="menu_button" style="width:100%">确认并返回</button>
        </div>
    </div>`;
    $('body').append(dialogHtml);
    $('#diag-close-btn').on('click', () => $(`#${extensionName}-dialog`).remove());
}

// 3. 【核心任务】向左侧魔法棒列表强行注入按钮
function forceInjectMenu() {
    // 如果按钮已存在，跳过
    if ($('#cycle-tracker-menu-item').length) return;
    
    // 构造菜单按钮 HTML
    const menuBtnHtml = `
        <div id="cycle-tracker-menu-item" class="menu_button fa-solid fa-moon" title="查看生理周期" style="display:flex; align-items:center; gap:10px; padding:5px 10px; cursor:pointer;">
            <span style="margin-left:5px;">生理周期追踪</span>
        </div>
    `;
    
    // 注入目标：#extensions-buttons 是酒馆左侧扩展菜单的列表容器
    const $menuContainer = $('#extensions-buttons');
    if ($menuContainer.length) {
        $menuContainer.append(menuBtnHtml);
        $('#cycle-tracker-menu-item').on('click', () => showCycleDialog());
        console.log("🌙 周期追踪按钮已成功缝入魔法棒菜单");
    }
}

// 4. 侧边栏面板 (扩展设置页)
function renderSettings() {
    $(`#${extensionName}-settings`).remove();
    const s = extension_settings[extensionName];
    const settingsHtml = `
    <div id="${extensionName}-settings" class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>🌙 生理周期设置</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content" style="padding:15px; display:flex; flex-direction:column; gap:12px;">
            <div>
                <label>平均周期 (天)</label>
                <input type="number" id="ct-cycle-len" class="text_pole" value="${s.cycleLength}">
            </div>
            <div>
                <label>最后一次起始日期</label>
                <input type="date" id="ct-start-date" class="text_pole" value="${s.periodStartDates[0] || ''}">
            </div>
            <button id="ct-save-btn" class="menu_button" style="width:100%; margin-top:10px;">同步并保存</button>
        </div>
    </div>`;
    $("#extensions_settings").append(settingsHtml);
    
    $("#ct-save-btn").on("click", () => {
        s.cycleLength = parseInt($("#ct-cycle-len").val());
        s.periodStartDates = [$("#ct-start-date").val()];
        saveSettingsDebounced();
        toastr.success("周期设置已更新！");
    });
}

// 5. 初始化与循环检测
function init() {
    // 确保数据结构完整
    extension_settings[extensionName] = extension_settings[extensionName] || { 
        cycleLength: 28, 
        periodLength: 5, 
        periodStartDates: [], 
        wiKeyword: '生理周期' 
    };

    renderSettings(); // 渲染设置面板

    // 每一秒检查一次菜单是否生成（防止魔法棒菜单加载慢）
    const checkMenu = setInterval(() => {
        if ($('#extensions-buttons').length) {
            forceInjectMenu();
            // 注意：这里不清除 Interval，因为酒馆菜单可能会被重新渲染
        }
    }, 1000);

    // 悬浮球 (保底显示)
    $('#cycle-tracker-float').remove();
    const floatBtn = $(`<div id="cycle-tracker-float" style="position:fixed; bottom:120px; right:20px; z-index:99999; width:45px; height:45px; background:rgba(0,0,0,0.5); border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:26px; border:1px solid rgba(255,255,255,0.2); backdrop-filter:blur(5px);">🌙</div>`);
    $('body').append(floatBtn);
    floatBtn.on('click', () => showCycleDialog());
}

// 入口
$(document).ready(() => init());
