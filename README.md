# 血压记录 - 使用说明

## 简介

一个运行在 iPhone 上的血压记录 PWA 应用。
- 拍血压仪照片 → OCR 自动识别数值
- 记录每次测量数据和时间
- 生成收缩压/舒张压/心率趋势折线图
- 所有数据保存在手机本地，不上传任何服务器

---

## 一次性部署（约 5 分钟）

### 方式 A：Vercel（推荐，最简单）

1. 将本项目推送到 GitHub 仓库：
   ```bash
   git init
   git add .
   git commit -m "init"
   git remote add origin https://github.com/你的用户名/bp-tracker.git
   git push -u origin main
   ```

2. 访问 [vercel.com](https://vercel.com)，用 GitHub 账号登录

3. 点击 **"New Project"** → 选择 `bp-tracker` 仓库 → **Deploy**

4. 得到你的专属 URL，如 `https://bp-tracker-xxx.vercel.app`

### 方式 B：Cloudflare Pages（备选）

1. 访问 [pages.cloudflare.com](https://pages.cloudflare.com)
2. Connect to Git → 选择仓库 → Framework preset 选 **None** → Deploy

---

## 在 iPhone 上安装

1. 用 **Safari** 打开部署后的 URL
2. 点击底部工具栏的 **分享按钮**（方块加箭头图标）
3. 滚动找到 **"添加到主屏幕"** → 点击 **"添加"**
4. 主屏幕出现血压记录图标，点击即可全屏运行

> ⚠️ **必须用 Safari**，Chrome/Firefox 不支持 iOS PWA 安装

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

## 离线使用

首次打开 URL 加载成功后，所有资源（包括图表库、OCR 库）会被缓存到手机。
之后断网也可以正常使用全部功能。

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
| 离线支持 | Service Worker |
| 数据存储 | localStorage |
| 框架 | 纯 HTML/CSS/JS，无需 Node.js 后端 |
