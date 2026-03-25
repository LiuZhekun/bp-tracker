# 血压记录 - 使用说明

## 简介

一个运行在 iPhone 上的血压记录 PWA 应用。
- 拍血压仪照片 → OCR 自动识别数值
- 记录每次测量数据和时间
- 生成收缩压/舒张压/心率趋势折线图
- 所有数据保存在手机本地，不上传任何服务器
- **首次访问后完全离线运行**，不依赖任何远程服务

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

> 部署完成后 GitHub Pages 仅作为静态文件托管，应用在手机上首次加载后即可完全离线使用。

---

## 在 iPhone 上安装

1. 用 **Safari** 打开 `https://你的用户名.github.io/bp-tracker/`
2. 点击底部工具栏的 **分享按钮**（方块加箭头图标）
3. 滚动找到 **"添加到主屏幕"** → 点击 **"添加"**
4. 主屏幕出现血压记录图标，点击即可全屏运行

> ⚠️ **必须用 Safari**，Chrome/Firefox 不支持 iOS PWA 安装

---

## 离线机制

| 阶段 | 说明 |
|------|------|
| 首次访问 | Safari 加载页面，Service Worker 自动缓存所有本地文件 + Chart.js + Tesseract.js 主文件 |
| 首次使用 OCR | Tesseract WASM 引擎和语言包（~15MB）在首次拍照识别时下载并缓存 |
| 之后 | **完全离线运行**，不再请求任何网络资源 |

> 💡 建议首次打开后**拍一次照试试 OCR**，确保识别引擎也被缓存。手动录入、图表、历史等功能首次加载后即可离线。

---

## 功能说明

### 录入血压
- 点击「📷 拍照识别血压仪」，调用后置摄像头拍照
- OCR 自动识别收缩压/舒张压/心率，识别结果可手动修正
- 也可跳过拍照，直接手动填入数值
- 时间默认为当前时间，可修改

### 趋势图表
- 查看收缩压（红）、舒张压（蓝）、心率（绿）的变化曲线
- 可切换：近7天 / 近30天 / 全部
- 浅色虚线为正常血压参考线（120/80）

### 历史记录
- 查看所有历史记录，每条显示血压状态（正常/偏高/高血压/偏低）
- 点击 `×` 删除记录
- 点击右上角「导出CSV」可将所有数据导出到手机，可用 Excel 打开

---

## 本地测试（可选）

```bash
# 安装一个简单的本地服务器
npx serve .

# 手机和电脑连同一 WiFi，手机 Safari 访问：
# http://电脑IP:3000
```

---

## 数据安全

- 所有数据保存在手机 **localStorage**（本地存储）
- 不会上传到任何服务器
- 清除 Safari 网站数据会丢失记录，建议定期用「导出CSV」备份

---

## 技术栈

| 功能 | 库 |
|------|-----|
| OCR 识别 | [Tesseract.js](https://github.com/naptha/tesseract.js) v5 |
| 图表 | [Chart.js](https://www.chartjs.org/) v4 |
| 离线支持 | Service Worker（缓存优先策略） |
| 数据存储 | localStorage |
| 托管 | GitHub Pages（仅首次加载，之后离线） |
| 框架 | 纯 HTML/CSS/JS，无需 Node.js 后端 |
