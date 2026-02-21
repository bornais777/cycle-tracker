import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";

const extensionName = "cycle_tracker";

// 1. 核心逻辑（保持不变，确保数据准确）
function calculate() {
    const s = extension_settings[extensionName];
    if (!s?.periodStartDates?.length) return null;
    const diff = Math.floor((new Date() - new Date(s.periodStartDates[0])) / 86400000);
    const day = (diff % s.cycleLength) + 1;
    let phase = day <= s.periodLength ? "经期" : (day <= 13 ? "卵泡期" : (day <= 15 ? "排卵期" : "黄体期"));
    return { day, phase };
}

// 2. 弹窗（模仿日记本 Reroll 弹窗样式）
function showCycleDialog() {
    $(`#${extensionName}-dialog`).remove();
    const res = calculate();
    const dialogHtml = `
    <div id="${extensionName}-dialog" class="diary-exchange-reroll-content" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:100001; padding:20px; border-radius:10px; min-width:280px; box-shadow: 0 0 30px rgba(0,0,0,0.6);">
        <div class="diary-exchange-reroll-header" style="margin-bottom:15px; font-weight:bold; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">
            🌙 生理周期状态
        </div>
        <div style="padding:10px;">
            <p>当前阶段：<span style="color:#daa520;">${res ? res.phase : '未设置'}</span></p>
            <p>周期天数：<span style="color:#daa520;">${res ? '第 ' + res.day + ' 天' : 'N/A'}</span></p>
            <button id="diag-close-btn" class="menu_button" style="width:100%; margin-top:15px;">关闭</button>
        </div>
    </div>`;
    $('body').append(dialogHtml);
    $('#diag-close-btn').on('click', () => $(`#${extensionName}-dialog`).remove());
}

// 3. 【仿日记本写法】注入魔法棒列表按钮
function injectToQuickMenu() {
    if ($('#cycle-tracker-menu-item').length) return;

    // 日记本插件最喜欢用的注入结构
    const menuBtnHtml = `
        <div id="cycle-tracker-menu-item" class="list-group-item menu_button" style="display: flex; align-items: center; cursor: pointer;">
            <i class="fa-solid fa-moon" style="width: 20px; text-align: center; margin-right: 10px;"></i>
            <span>生理周期追踪</span>
        </div>
    `;

    // 尝试多个可能的酒馆菜单容器
    const selectors = [
        '#extensions-buttons',
        '.drawer-content #extensions-settings-button',
        '#quick-menu-contents',
        '.right-drawer-content'
    ];

    let injected = false;
    for (const selector of selectors) {
        const $target = $(selector);
        if ($target.length) {
            // 如果是按钮本身，就在它后面加；如果是容器，就往里加
            if (selector.includes('button')) {
                $target.after(menuBtnHtml);
            } else {
                $target.append(menuBtnHtml);
            }
            injected = true;
            break;
        }
    }

    if (injected) {
        $('#cycle-tracker-menu-item').on('click', () => {
            // 模仿日记本：点击后自动关闭侧边栏菜单（如果有的话）
            $('.drawer-open').removeClass('drawer-open'); 
            showCycleDialog();
        });
        console.log("🌙 周期追踪按钮已注入魔法棒列表");
    }
}

// 4. 初始化
async function init() {
    // 数据初始化
    extension_settings[extensionName] = extension_settings[extensionName] || { 
        cycleLength: 28, periodLength: 5, periodStartDates: [], wiKeyword: '生理周期' 
    };

    // 模仿日记本的延迟注入逻辑，确保菜单 DOM 已经生成
    setTimeout(() => {
        injectToQuickMenu();
    }, 1500);

    // 侧边栏设置面板（已确认有效）
    $(`#${extensionName}-settings`).remove();
    const settingsHtml = `
    <div id="${extensionName}-settings" class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>🌙 生理周期</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content" style="padding:10px;">
            <label>周期天数</label>
            <input type="number" id="ct-cycle-len" class="text_pole" value="${extension_settings[extensionName].cycleLength}">
            <label>起始日期</label>
            <input type="date" id="ct-start-date" class="text_pole" value="${extension_settings[extensionName].periodStartDates[0] || ''}">
            <button id="ct-save-btn" class="menu_button" style="width:100%; margin-top:10px;">保存</button>
        </div>
    </div>`;
    $("#extensions_settings").append(settingsHtml);
    $("#ct-save-btn").on("click", () => {
        extension_settings[extensionName].cycleLength = parseInt($("#ct-cycle-len").val());
        extension_settings[extensionName].periodStartDates = [$("#ct-start-date").val()];
        saveSettingsDebounced();
        toastr.success("设置已保存");
    });
}

$(document).ready(() => init());
