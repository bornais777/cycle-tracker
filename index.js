import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

const extensionName = "cycle_tracker";

// 1. 弹窗逻辑 (完全模仿隐藏助手的 UI 呼叫方式)
function showCycleDialog() {
    const res = calculate(); // 假设你保留了计算函数
    $(`#${extensionName}-dialog`).remove();
    const dialogHtml = `
    <div id="${extensionName}-dialog" class="drawer-content" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:10000; padding:20px; border:1px solid #ccc; background: var(--SmartThemeBlurColor); backdrop-filter: blur(var(--SmartThemeBlurStrength));">
        <h3>🌙 生理周期状态</h3>
        <p>阶段：${res ? res.phase : '未设置'}</p>
        <button id="diag-close-btn" class="menu_button">关闭</button>
    </div>`;
    $('body').append(dialogHtml);
    $('#diag-close-btn').on('click', () => $(`#${extensionName}-dialog`).remove());
}

// 2. 核心：模仿“隐藏助手”注册按钮
function setupButtons() {
    const context = getContext();
    
    // 检查是否已经存在，防止重复
    if ($('#cycle-tracker-wand').length > 0) return;

    // 这里是关键！模仿隐藏助手的 API 调用
    // 参数1: 图标类名 (用酒馆标准的 fa-moon)
    // 参数2: 悬停显示的文字
    // 参数3: 点击触发的函数
    // 参数4: 按钮的唯一ID
    context.addExtensionButton(
        'fa-moon', 
        '生理周期追踪', 
        () => showCycleDialog(), 
        'cycle-tracker-wand'
    );
    
    console.log(`[${extensionName}] 魔法棒按钮注册尝试完成`);
}

// 3. 初始化：模仿隐藏助手的初始化时机
async function init() {
    // 确保数据结构
    extension_settings[extensionName] = extension_settings[extensionName] || { cycleLength: 28, periodLength: 5, periodStartDates: [] };

    // 尝试注册按钮
    setupButtons();

    // 如果刚加载时酒馆还没准备好，等 2 秒再试一次（隐藏助手的保险做法）
    setTimeout(setupButtons, 2000);
}

$(document).ready(() => init());
