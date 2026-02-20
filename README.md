# 🌙 Cycle Tracker — SillyTavern Extension

追踪生理周期并通过世界书（World Info）系统将阶段状态引入叙事，
LLM自主判断是否在当前场景中体现，不强制影响剧情方向。

---

## 安装

```bash
# 在 SillyTavern 根目录下
cd public/scripts/extensions/
git clone https://github.com/your-username/cycle-tracker
```

或在 ST 界面：Extensions → Install Extension → 填入 repo 地址

---

## 工作原理

```
插件（计算）
  ↓ 每轮对话前，将当前阶段标签静默插入 prompt
  ↓ 例如: [cycle:menstrual]

世界书（条件触发）
  ↓ 检测到触发词，激活对应 entry
  ↓ Entry 内容：该阶段的生理/情绪背景描述

LLM（生成）
  ↓ 读到 entry 内容
  ↓ 自行判断当前场景是否相关
  ↓ 相关 → 在语气、细节、角色反应中自然体现
  ↓ 不相关 → 忽略，剧情正常进行
```

**插件不写叙事指令，只提供标签。**
**世界书不做语义判断，只做关键词匹配。**
**LLM负责语义判断，决定是否以及如何体现。**

---

## 使用步骤

### 1. 设置插件

打开 Extensions → Cycle Tracker

- 输入上次月经开始日期
- 设置周期长度（默认28天）和经期长度（默认5天）
- 点击 **📊 生成完整周期视图** → 查看彩色时间轴和当前状态
- 如果日期计算和实际不符，用**手动校正**功能直接指定今天是第几天

### 2. 配置世界书

打开 `worldbook_entries.md`，将5个entry导入你的世界书：

| 阶段   | 触发词             |
|--------|--------------------|
| 经期   | `cycle:menstrual`  |
| 卵泡期 | `cycle:follicular` |
| 排卵期 | `cycle:ovulation`  |
| 黄体期 | `cycle:luteal`     |
| PMS    | `cycle:pms`        |

建议设置：
- 插入位置：`Before Main Prompt` 或 `After System Prompt`
- 深度：1–3
- 不勾选 constant

### 3. 开始对话

插件会自动在每轮对话时插入当前阶段标签，世界书负责触发对应entry。
无需任何手动操作。

---

## 功能

- **完整周期时间轴** — 彩色显示每一天的阶段，悬停查看具体日期
- **手动校正** — 输入"今天是第X天"直接校正，自动反推开始日期
- **独立数据面板** — JSON格式显示完整状态数据，可复制，与注入完全独立
- **隐藏注入** — 标签不出现在聊天气泡，只存在于prompt中

---

## 文件说明

| 文件 | 说明 |
|------|------|
| `index.js` | 主逻辑：计算、注入、UI绑定 |
| `settings.html` | 设置面板 HTML |
| `style.css` | 样式 |
| `manifest.json` | ST 扩展声明 |
| `worldbook_entries.md` | 世界书 entry 模板（需手动导入） |
