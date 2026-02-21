import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

const extensionName = "cycle_tracker";

function showCycleDialog() {
    $(`#${extensionName}-dialog`).remove();
    const dialogHtml = `
    <div id="${extensionName}-dialog" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:100000; padding:20px; border-radius:10px; background: #333; color: white; border: 1px solid #777;">
        <h3>🌙 物理注入测试成功</h3>
        <p>如果你能看到这个窗口，说明魔法棒按钮已经生效了！</p>
        <button id="diag-close-btn" class="menu_button" style="width:100%; margin-top:10px;">太棒了</button>
    </div>`;
    $('body').append(dialogHtml);
    $('#diag-close-btn').on('click', () => $(`#${extensionName}-dialog`).remove());
}

function init() {
    extension_settings[extensionName] = extension_settings[extensionName] || { cycleLength: 28, periodLength: 5, periodStartDates: [] };

    // 关键：监听 HTML 文件里的 ID
    $(document).on('click', '#cycle_tracker_menu_button', function() {
        showCycleDialog();
    });

    console.log("🌙 逻辑已就绪，正在等待物理按钮加载...");
}

$(document).ready(() => init());
