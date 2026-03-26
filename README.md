# 血压记录 - 使用说明

## 简介

一个可在手机浏览器中使用的 **血压记录 PWA**（渐进式 Web 应用）。

- **录入**：支持 **语音说出** 血压数值（浏览器需支持 Web Speech API），也可 **纯手动** 填写收缩压 / 舒张压 / 心率 / 备注；测量时间默认取保存时刻，可展开修改为具体时间。
- **统计与图表**：收缩压、舒张压、心率趋势折线图，带指南分级 **色带背景**；可切换图例显示/隐藏；提供 **统计卡片**（均值、达标率、峰值预警、脉压差等）与 **血压分布** 条形统计。
- **历史**：列表展示、按 **日期区间** 筛选（同一日历内选择起止日）、单条删除、**导出 CSV** / **导入 CSV**（相同时间的记录会覆盖）。
- **隐私**：数据仅存本机浏览器 **localStorage**，不上传服务器。
- **离线**：在 **至少成功在线打开过一次** 并完成 Service Worker 安装与资源缓存后，可 **完全离线** 使用核心功能（见下文「离线机制」）。

---

## 部署方式：GitHub Pages（一次性，约 3 分钟）

1. 将本项目推送到 GitHub 仓库：
   ```bash
   cd bp-tracker
   git init
   git add .
   git commit -m "初始化血压记录 PWA"
   git remote add origin https://github.com/你的用户名/bp-tracker.git
   git push -u origin main
   ```

2. 进入 GitHub 仓库页面 → **Settings** → **Pages**

3. Source 选择 **Deploy from a branch** → Branch 选 **main** → 文件夹选 **/ (root)** → **Save**

4. 等待约 1 分钟，页面顶部出现 URL：
   ```
   https://你的用户名.github.io/bp-tracker/
   ```

> GitHub Pages 仅托管静态文件；应用逻辑与数据都在用户浏览器侧完成。

---

## 在 iPhone 上安装

1. 用 **Safari** 打开部署后的地址。
2. 点击底部工具栏的 **分享按钮**（方块加箭头图标）。
3. 滚动找到 **「添加到主屏幕」** → 点击 **「添加」**。
4. 主屏幕出现图标后，可从主屏幕 **全屏** 打开使用。

> ⚠️ **iOS 上添加到主屏幕通常需使用 Safari**；其他浏览器对 PWA 安装的支持可能不同。

---

## 离线机制

| 阶段 | 说明 |
|------|------|
| **首次访问（需联网）** | 页面注册 Service Worker；`install` 阶段会 **预缓存** 本地 HTML/CSS/JS、图标，以及来自 jsDelivr 的 **Chart.js**、**Flatpickr**（含样式与中文语言包）。 |
| **运行时** | 对 `cdn.jsdelivr.net` 的 GET 请求采用 **缓存优先**，未命中时再请求网络并写入缓存。 |
| **之后** | 在缓存已就绪的前提下，**可离线** 打开应用、录入、看图、查历史（数据仍在 localStorage）。 |

**注意：**

- 若用户 **从未在联网状态下成功打开过** 本站，则无法预先拉取 CDN 与 SW 脚本，**离线不可用**。
- 当前入口页 **未引入** Tesseract 等 OCR 脚本；仓库中的 `js/ocr.js` 为预留/实验代码，**不参与** 现有线上功能。

---

## 功能说明

### 录入

- **语音**：点击麦克风，说出如「高压 130 低压 85 心率 72」等（具体以页面提示为例）；不支持语音的浏览器会隐藏麦克风按钮。
- **手动**：直接输入数值；时间行默认折叠，不填则保存时使用 **当前时刻**。
- **保存**：写入 localStorage，新记录排在列表前部。

### 趋势与统计（图表页）

- 时间范围：**近 7 天 / 近 30 天 / 近 3 个月 / 全部 / 自定义**。
- **自定义**：使用 **Flatpickr 区间模式**，在同一日历中先后点选 **开始日** 与 **结束日**（同一天点两次即单日区间）。
- 图表含色带分区说明；可点击图例按钮切换收缩压、舒张压、心率曲线显示。

### 历史记录

- 支持 **日期区间筛选**（与图表类似的区间选择器）及 **清除筛选**。
- **导出**：生成带 BOM 的 CSV，便于 Excel 打开。
- **导入**：选择 CSV，按「时间」合并（相同时间则更新该条）。
- 删除单条需确认。

---

## 本地测试（可选）

```bash
npx serve .
```

手机与电脑同一 Wi‑Fi 时，可用手机浏览器访问 `http://电脑IP:3000`（端口以终端输出为准）。

> 本地调试时建议使用 **http://localhost** 或 **HTTPS**，以便 Service Worker 在支持的浏览器中正常注册（不同浏览器对 `file://` 与局域网 HTTP 策略不同）。

---

## 数据与安全

- 存储位置：浏览器 **localStorage**，键名 `bp_records`，值为 **JSON 数组**（每条含 id、time、sys、dia、pulse、note 等）。
- 数据 **不会** 自动同步到其他设备；清除站点数据或卸载浏览器可能导致丢失。
- 建议定期使用 **导出 CSV** 做备份。

---

## 技术栈

| 项目 | 说明 |
|------|------|
| 运行环境 | 纯 HTML / CSS / JavaScript，无构建步骤与后端 |
| 图表 | [Chart.js](https://www.chartjs.org/) 4.4（jsDelivr CDN） |
| 日期区间 | [Flatpickr](https://flatpickr.js.org/) 4.6.13 + 中文语言包（jsDelivr CDN） |
| 语音 | Web Speech API（`SpeechRecognition`，浏览器可选支持） |
| 离线 | Service Worker（`sw.js`），缓存版本见文件内 `CACHE_VERSION` |
| 持久化 | `localStorage` |
| 清单 | `manifest.json`，图标含 SVG 与 PNG |

### 主要文件

- `index.html` — 页面结构与脚本引用  
- `js/app.js` — 交互、语音、历史与图表入口  
- `js/storage.js` — 读写 localStorage、筛选、统计、CSV 导入导出  
- `js/charts.js` — Chart.js 图表与统计卡片渲染  
- `css/style.css` — 样式（含浅色/深色偏好）  
- `sw.js` — 预缓存与 fetch 策略  
- `js/ocr.js` — 当前 **未** 在 `index.html` 中引用  

---

## 更新缓存版本

修改 `sw.js` 中的 **`CACHE_VERSION`** 并部署后，用户下次访问会淘汰旧缓存，避免一直使用过期脚本或样式。
