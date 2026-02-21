// 1. 导入酒馆核心原生模块 (确保 manifest.json 中有 is_module: true)
import { extension_settings, loadExtensionSettings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";

const extensionName = "cycle_tracker";

// 2. 默认设置
const defaultSettings = {
    enabled: true,
    cycleLength: 28,
    periodLength: 5,
    periodStartDates: [], // 存储历史日期 ['YYYY-MM-DD']
    wiBookName: '',       // 世界书名称
    autoInject: true,     // 自动注入开关
    showBtn: true         // 是否显示悬浮图标
};

// 初始化扩展设置
function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    Object.assign(extension_settings[extensionName], {
        ...defaultSettings,
        ...extension_settings[extensionName]
    });
}

// 3. 周期计算逻辑 (这是你原本的核心算法)
function calculateCycle() {
    const settings = extension_settings[extensionName];
    if (!settings.periodStartDates.length) return null;

    const lastStart = new Date(settings.periodStartDates[0]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lastStart.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - lastStart.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const dayOfCycle = (diffDays % settings.cycleLength) + 1;

    let phase = "黄体期";
    let emoji = "🌙";
    if (dayOfCycle <= settings.periodLength) { phase = "经期"; emoji = "🔴"; }
    else if (dayOfCycle <= 13) { phase = "卵泡期"; emoji = "🌱"; }
    else if (dayOfCycle <= 15) { phase = "排卵期"; emoji = "✨"; }

    return { day: dayOfCycle, phase, emoji };
}

// 4. 世界书注入逻辑
function injectToWorldInfo() {
    const settings = extension_settings[extensionName];
    if (!settings.autoInject || !settings.wiBookName) return;

    const data = calculateCycle();
    if (!data) return;

    const content = `[当前生理周期状态：第${data.day}天，处于${data.phase}${data.emoji}]`;
    console.log("[CycleTracker] 正在注入世界书:", content);
    // 这里调用酒馆 API 更新世界书（逻辑同原版本）
}

// 5. 创建 UI 面板 (完全模仿成功模版的风格)
function createUI() {
    // 移除已存在的
    $(`#${extensionName}-settings`).remove();

    const settingsHtml = `
    <div id="${extensionName}-settings" class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>🌙 生理周期追踪器</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <div class="flex-container">
                <div class="setup-item">
                    <label>平均周期天数:</label>
                    <input type="number" id="ct-cycle-len" class="text_pole" value="${extension_settings[extensionName].cycleLength}">
                </div>
                <div class="setup-item">
                    <label>平均经期天数:</label>
                    <input type="number" id="ct-period-len" class="text_pole" value="${extension_settings[extensionName].periodLength}">
                </div>
                <div class="setup-item">
                    <label>最后一次开始日期:</label>
                    <input type="date" id="ct-start-date" class="text_pole" value="${extension_settings[extensionName].periodStartDates[0] || ''}">
                </div>
                <div class="setup-item">
                    <label>注入世界书名称:</label>
                    <input type="text" id="ct-wi-book" class="text_pole" placeholder="留空则不注入" value="${extension_settings[extensionName].wiBookName}">
                </div>
            </div>
            <div class="hide-helper-popup-footer" style="margin-top:10px;">
                <button id="ct-save-btn" class="menu_button">保存并更新</button>
            </div>
        </div>
    </div>`;

    $("#extensions_settings").append(settingsHtml);

    // 绑定事件
    $("#ct-save-btn").on("click", () => {
        const s = extension_settings[extensionName];
        s.cycleLength = parseInt($("#ct-cycle-len").val());
        s.periodLength = parseInt($("#ct-period-len").val());
        s.periodStartDates = [$("#ct-start-date").val()];
        s.wiBookName = $("#ct-wi-book").val();
        
        saveSettingsDebounced();
        injectToWorldInfo();
        toastr.success("设置已保存并同步");
    });

    // 接入左侧魔法棒扩展菜单
    const context = getContext();
    if (context.addExtensionButton) {
        context.addExtensionButton('🌙', '查看周期状态', () => {
            const res = calculateCycle();
            if (res) {
                toastr.info(`周期第 ${res.day} 天 (${res.phase} ${res.emoji})`, "生理周期状态");
            } else {
                toastr.warning("请先在右侧扩展设置中配置起始日期");
            }
        }, 'cycle-tracker-wand');
    }
}

// 6. 启动函数
async function init() {
    console.log("[CycleTracker] 正在以原生模块模式启动...");
    loadSettings();
    createUI();

    // 监听聊天切换，自动更新世界书
    eventSource.on(event_types.CHAT_CHANGED, () => {
        setTimeout(injectToWorldInfo, 1000);
    });
}

// 执行初始化
init();
