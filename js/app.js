/**
 * app.js - 主应用逻辑
 * 负责：视图切换、拍照OCR、表单保存、历史记录渲染、导出
 */

// ===== 当前激活视图 =====
let currentView = 'add';
// 当前图表时间范围（天数，0=全部）
let currentRange = 7;
// 待删除的记录 id
let pendingDeleteId = null;

// ===== DOM 元素引用 =====
const $ = id => document.getElementById(id);
const cameraInput = $('camera-input');
const photoPreview = $('photo-preview');
const previewImg = $('preview-img');
const ocrStatus = $('ocr-status');
const inputSys = $('input-sys');
const inputDia = $('input-dia');
const inputPulse = $('input-pulse');
const inputTime = $('input-time');
const inputNote = $('input-note');

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
  setDefaultTime();
  bindEvents();
  // 注册 SW
  registerSW();
});

// 将当前时间设为默认测量时间
function setDefaultTime() {
  const now = new Date();
  // datetime-local 格式：YYYY-MM-DDTHH:mm
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  inputTime.value = local;
}

// ===== 注册 Service Worker =====
function registerSW() {
  if ('serviceWorker' in navigator) {
    // 使用相对路径，兼容 GitHub Pages 子路径部署
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

// ===== 绑定所有事件 =====
function bindEvents() {
  // 底部导航切换
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // 拍照按钮 → 触发 file input（调用摄像头）
  $('take-photo-btn').addEventListener('click', () => cameraInput.click());

  // 用户选择/拍摄了照片
  cameraInput.addEventListener('change', onPhotoSelected);

  // 保存按钮
  $('save-btn').addEventListener('click', onSave);

  // 导出 CSV
  $('export-btn').addEventListener('click', () => {
    const ok = Storage.exportCSV();
    showToast(ok ? '✅ 已导出 CSV 文件' : '⚠️ 暂无数据可导出');
  });

  // 时间范围选择
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRange = parseInt(btn.dataset.range);
      renderChart();
    });
  });

  // 删除确认弹窗
  $('confirm-ok').addEventListener('click', () => {
    if (pendingDeleteId) {
      Storage.remove(pendingDeleteId);
      pendingDeleteId = null;
      $('confirm-modal').classList.add('hidden');
      renderHistory();
      showToast('✅ 已删除');
    }
  });

  $('confirm-cancel').addEventListener('click', () => {
    pendingDeleteId = null;
    $('confirm-modal').classList.add('hidden');
  });
}

// ===== 视图切换 =====
function switchView(view) {
  // 更新 DOM
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  // 更新导航按钮高亮
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  currentView = view;

  // 进入图表/历史视图时刷新数据
  if (view === 'chart') renderChart();
  if (view === 'history') renderHistory();
}

// ===== 拍照后处理 =====
async function onPhotoSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  // 显示图片预览
  const url = URL.createObjectURL(file);
  previewImg.src = url;
  photoPreview.classList.remove('hidden');
  ocrStatus.className = 'ocr-status';
  ocrStatus.textContent = '⏳ 正在识别数据...';

  // 图片加载后执行 OCR
  previewImg.onload = async () => {
    try {
      const result = await OCR.recognize(previewImg);

      if (result) {
        // 自动填入识别结果
        if (result.sys) inputSys.value = result.sys;
        if (result.dia) inputDia.value = result.dia;
        if (result.pulse) inputPulse.value = result.pulse;
        ocrStatus.className = 'ocr-status success';
        ocrStatus.textContent = `✅ 识别成功：${result.sys}/${result.dia}` + (result.pulse ? ` 心率${result.pulse}` : '');
      } else {
        ocrStatus.className = 'ocr-status error';
        ocrStatus.textContent = '⚠️ 识别不准确，请手动填写数值';
      }
    } catch (err) {
      ocrStatus.className = 'ocr-status error';
      ocrStatus.textContent = '⚠️ 识别失败，请手动填写数值';
    }

    // 清空 input 以便下次选择同一文件也能触发 change
    cameraInput.value = '';
  };
}

// ===== 保存记录 =====
function onSave() {
  const sys = parseInt(inputSys.value);
  const dia = parseInt(inputDia.value);
  const pulse = inputPulse.value ? parseInt(inputPulse.value) : null;
  const time = inputTime.value;
  const note = inputNote.value.trim();

  // 验证必填字段
  if (!sys || !dia) {
    showToast('⚠️ 请填写收缩压和舒张压');
    return;
  }
  if (sys <= dia) {
    showToast('⚠️ 收缩压应大于舒张压');
    return;
  }
  if (!time) {
    showToast('⚠️ 请选择测量时间');
    return;
  }

  Storage.save({ sys, dia, pulse, time, note });
  showToast('✅ 记录已保存');

  // 清空表单，重置时间为当前时间
  inputSys.value = '';
  inputDia.value = '';
  inputPulse.value = '';
  inputNote.value = '';
  setDefaultTime();
  photoPreview.classList.add('hidden');
  previewImg.src = '';
}

// ===== 渲染图表视图 =====
function renderChart() {
  const records = Storage.getByDays(currentRange);
  Charts.render(records);
}

// ===== 渲染历史记录列表 =====
function renderHistory() {
  const records = Storage.getAll();
  const list = $('record-list');
  const noData = $('no-data-history');

  if (records.length === 0) {
    list.innerHTML = '';
    noData.classList.remove('hidden');
    return;
  }

  noData.classList.add('hidden');
  list.innerHTML = records.map(r => buildRecordHTML(r)).join('');

  // 绑定删除按钮事件
  list.querySelectorAll('.record-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      pendingDeleteId = btn.dataset.id;
      $('confirm-modal').classList.remove('hidden');
    });
  });
}

// 构建单条记录的 HTML
function buildRecordHTML(r) {
  const tag = getBPTag(r.sys, r.dia);
  const timeStr = formatRecordTime(r.time);
  const pulseStr = r.pulse ? `心率 ${r.pulse} 次/分` : '';
  const noteStr = r.note ? `· ${r.note}` : '';

  return `
    <div class="record-item">
      <div class="record-bp">
        <span class="record-sys">${r.sys}</span>
        <span class="record-slash">/</span>
        <span class="record-dia">${r.dia}</span>
      </div>
      <div class="record-info">
        <div class="record-time">${timeStr}</div>
        ${pulseStr ? `<div class="record-pulse">❤️ ${pulseStr}</div>` : ''}
        ${noteStr ? `<div class="record-note">${escapeHTML(noteStr)}</div>` : ''}
      </div>
      <span class="record-tag ${tag.cls}">${tag.label}</span>
      <button class="record-delete-btn" data-id="${r.id}" title="删除">×</button>
    </div>
  `;
}

// 根据血压值返回状态标签（参考《中国高血压防治指南》）
function getBPTag(sys, dia) {
  if (sys < 90 || dia < 60) return { cls: 'tag-low', label: '偏低' };
  if (sys < 120 && dia < 80) return { cls: 'tag-normal', label: '正常' };
  if (sys < 130 && dia < 80) return { cls: 'tag-high-1', label: '偏高' };
  if (sys < 140 && dia < 90) return { cls: 'tag-high-1', label: '高压前期' };
  return { cls: 'tag-high-2', label: '高血压' };
}

// 格式化时间为可读字符串："2026-03-25 08:30"
function formatRecordTime(isoStr) {
  const d = new Date(isoStr);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

// 防 XSS：转义 HTML 特殊字符
function escapeHTML(str) {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ===== Toast 提示 =====
let toastTimer = null;
function showToast(msg) {
  const toast = $('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2500);
}
