/**
 * app.js - 主应用逻辑
 * 负责：视图切换、拍照OCR、语音输入、表单保存、历史记录渲染、导出
 */

// ===== 当前激活视图 =====
let currentView = 'add';
// 当前图表时间范围
let currentRange = 'day';
// 待删除的记录 id
let pendingDeleteId = null;

// ===== DOM 元素引用 =====
const $ = id => document.getElementById(id);
const cameraInput  = $('camera-input');
const photoPreview = $('photo-preview');
const previewImg   = $('preview-img');
const ocrStatus    = $('ocr-status');
const inputSys     = $('input-sys');
const inputDia     = $('input-dia');
const inputPulse   = $('input-pulse');
const inputTime    = $('input-time');
const inputNote    = $('input-note');

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
  setDefaultTime();
  bindEvents();
  registerSW();
  checkVoiceSupport();
});

// 将当前时间设为默认测量时间
function setDefaultTime() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 16);
  inputTime.value = local;
}

// ===== 注册 Service Worker =====
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

// 检查语音支持，不支持时隐藏按钮
function checkVoiceSupport() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    $('voice-btn').style.display = 'none';
  }
}

// ===== 绑定所有事件 =====
function bindEvents() {
  // 底部导航切换
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // 拍照按钮
  $('take-photo-btn').addEventListener('click', () => cameraInput.click());
  cameraInput.addEventListener('change', onPhotoSelected);

  // 语音按钮
  $('voice-btn').addEventListener('click', startVoiceInput);
  $('voice-stop-btn').addEventListener('click', stopVoiceInput);

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
      currentRange = btn.dataset.range;
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

// =========================================================
// ===== 语音输入
// =========================================================
let recognition = null;

function startVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('⚠️ 当前浏览器不支持语音识别，请用 Safari');
    return;
  }

  // 显示语音面板，隐藏照片预览
  photoPreview.classList.add('hidden');
  $('voice-panel').classList.remove('hidden');
  $('voice-result').textContent = '';

  recognition = new SpeechRecognition();
  recognition.lang = 'zh-CN';        // 普通话识别
  recognition.continuous = false;    // 说完一句自动停止
  recognition.interimResults = true; // 显示实时中间结果

  // 实时显示识别中的内容
  recognition.onresult = (event) => {
    const interim = Array.from(event.results)
      .map(r => r[0].transcript)
      .join('');
    $('voice-result').textContent = interim;

    // 最终结果：解析血压数据
    if (event.results[event.results.length - 1].isFinal) {
      const finalText = interim;
      console.log('[语音] 识别文本:', finalText);
      const parsed = parseSpeechInput(finalText);
      if (parsed) {
        fillFormFromVoice(parsed);
      } else {
        $('voice-hint').textContent = '未识别到血压数据，请重试';
      }
    }
  };

  recognition.onerror = (e) => {
    console.error('[语音] 错误:', e.error);
    const msgs = {
      'not-allowed': '请允许麦克风权限',
      'no-speech':   '未检测到声音，请重试',
      'network':     '网络错误，请检查连接',
    };
    showToast('⚠️ ' + (msgs[e.error] || '语音识别失败，请重试'));
    stopVoiceInput();
  };

  recognition.onend = () => {
    // 识别结束后延迟关闭面板（让用户看到结果）
    setTimeout(() => {
      $('voice-panel').classList.add('hidden');
    }, 1200);
  };

  recognition.start();
}

function stopVoiceInput() {
  if (recognition) {
    recognition.stop();
    recognition = null;
  }
  $('voice-panel').classList.add('hidden');
}

/**
 * 解析语音识别文本，提取血压三项数值
 * 支持格式：
 *   "高压130低压85心率72"
 *   "收缩压135 舒张压82 脉搏75"
 *   "130 85 72"（三个数字）
 *   "一百三十 八十五 七十二"（中文数字）
 */
function parseSpeechInput(text) {
  // 第一步：中文数字转阿拉伯数字
  const normalized = convertChineseNumbers(text);
  console.log('[语音] 归一化后:', normalized);

  let sys = null, dia = null, pulse = null;

  // 关键词匹配（优先，准确率最高）
  const sysMatch   = normalized.match(/(?:高压|收缩压|上压)[^\d]*(\d{2,3})/);
  const diaMatch   = normalized.match(/(?:低压|舒张压|下压)[^\d]*(\d{2,3})/);
  const pulseMatch = normalized.match(/(?:心率|脉搏|脉|搏)[^\d]*(\d{2,3})/);

  if (sysMatch)   sys   = parseInt(sysMatch[1]);
  if (diaMatch)   dia   = parseInt(diaMatch[1]);
  if (pulseMatch) pulse = parseInt(pulseMatch[1]);

  // 如果关键词没匹配到，尝试按顺序提取所有2~3位数字（高压>低压>心率 的常见说法顺序）
  if (!sys || !dia) {
    const allNums = [...normalized.matchAll(/\d{2,3}/g)].map(m => parseInt(m[0]));
    const validSys   = allNums.filter(n => n >= 90  && n <= 220);
    const validDia   = allNums.filter(n => n >= 50  && n <= 130);
    const validPulse = allNums.filter(n => n >= 45  && n <= 130);

    if (!sys   && validSys.length   > 0) sys   = validSys[0];
    if (!dia   && validDia.length   > 0) dia   = validDia.find(n => n !== sys) ?? null;
    if (!pulse && validPulse.length > 0) pulse = validPulse.find(n => n !== sys && n !== dia) ?? null;
  }

  // 验证
  if (sys && dia && sys > dia && sys >= 90 && dia >= 50) {
    return { sys, dia, pulse };
  }
  return null;
}

/**
 * 中文数字转阿拉伯数字
 * 支持："一百三十" → 130，"八十五" → 85，"七十二" → 72
 */
function convertChineseNumbers(text) {
  const CN_NUM  = { '零':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9 };
  const CN_UNIT = { '十':10,'百':100 };

  return text.replace(/[一二三四五六七八九零十百]+/g, (match) => {
    let result = 0, cur = 0;
    for (const ch of match) {
      if (ch in CN_NUM) {
        cur = CN_NUM[ch];
      } else if (ch in CN_UNIT) {
        const unit = CN_UNIT[ch];
        if (unit === 10 && cur === 0) cur = 1; // "十五" → 15（十前省略一）
        result += cur * unit;
        cur = 0;
      }
    }
    return String(result + cur);
  });
}

// 将语音解析结果填入表单
function fillFormFromVoice({ sys, dia, pulse }) {
  if (sys)   inputSys.value   = sys;
  if (dia)   inputDia.value   = dia;
  if (pulse) inputPulse.value = pulse;

  const msg = `✅ ${sys}/${dia}` + (pulse ? ` 心率${pulse}` : '');
  $('voice-result').textContent = msg;
  showToast('✅ 语音识别成功，请确认数值');
}

// =========================================================
// ===== 拍照 OCR
// =========================================================
async function onPhotoSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  $('voice-panel').classList.add('hidden');
  const url = URL.createObjectURL(file);
  previewImg.src = url;
  photoPreview.classList.remove('hidden');
  ocrStatus.className = 'ocr-status';
  ocrStatus.textContent = '⏳ 正在识别数据...';

  previewImg.onload = async () => {
    try {
      const result = await OCR.recognize(previewImg);
      if (result) {
        if (result.sys)   inputSys.value   = result.sys;
        if (result.dia)   inputDia.value   = result.dia;
        if (result.pulse) inputPulse.value = result.pulse;
        ocrStatus.className = 'ocr-status success';
        ocrStatus.textContent = `✅ 识别成功：${result.sys}/${result.dia}` + (result.pulse ? ` 心率${result.pulse}` : '');
      } else {
        ocrStatus.className = 'ocr-status error';
        ocrStatus.textContent = '⚠️ 识别不准确，请手动填写或改用语音输入';
      }
    } catch {
      ocrStatus.className = 'ocr-status error';
      ocrStatus.textContent = '⚠️ 识别失败，请手动填写或改用语音输入';
    }
    cameraInput.value = '';
  };
}

// =========================================================
// ===== 保存记录
// =========================================================
function onSave() {
  const sys   = parseInt(inputSys.value);
  const dia   = parseInt(inputDia.value);
  const pulse = inputPulse.value ? parseInt(inputPulse.value) : null;
  const time  = inputTime.value;
  const note  = inputNote.value.trim();

  if (!sys || !dia)  { showToast('⚠️ 请填写收缩压和舒张压'); return; }
  if (sys <= dia)    { showToast('⚠️ 收缩压应大于舒张压');   return; }
  if (!time)         { showToast('⚠️ 请选择测量时间');       return; }

  Storage.save({ sys, dia, pulse, time, note });
  showToast('✅ 记录已保存');

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
  const records = Storage.getByRange(currentRange);
  Charts.render(records, currentRange);
}

// ===== 渲染历史记录列表 =====
function renderHistory() {
  const records = Storage.getAll();
  const list    = $('record-list');
  const noData  = $('no-data-history');

  if (records.length === 0) {
    list.innerHTML = '';
    noData.classList.remove('hidden');
    return;
  }

  noData.classList.add('hidden');
  list.innerHTML = records.map(r => buildRecordHTML(r)).join('');

  list.querySelectorAll('.record-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      pendingDeleteId = btn.dataset.id;
      $('confirm-modal').classList.remove('hidden');
    });
  });
}

// 构建单条记录的 HTML
function buildRecordHTML(r) {
  const tag      = getBPTag(r.sys, r.dia);
  const timeStr  = formatRecordTime(r.time);
  const pulseStr = r.pulse ? `心率 ${r.pulse} 次/分` : '';
  const noteStr  = r.note  ? `· ${r.note}` : '';

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
        ${noteStr  ? `<div class="record-note">${escapeHTML(noteStr)}</div>` : ''}
      </div>
      <span class="record-tag ${tag.cls}">${tag.label}</span>
      <button class="record-delete-btn" data-id="${r.id}" title="删除">×</button>
    </div>
  `;
}

function getBPTag(sys, dia) {
  if (sys < 90 || dia < 60)  return { cls: 'tag-low',    label: '偏低' };
  if (sys < 120 && dia < 80) return { cls: 'tag-normal',  label: '正常' };
  if (sys < 130 && dia < 80) return { cls: 'tag-high-1',  label: '偏高' };
  if (sys < 140 && dia < 90) return { cls: 'tag-high-1',  label: '高压前期' };
  return                             { cls: 'tag-high-2',  label: '高血压' };
}

function formatRecordTime(isoStr) {
  const d = new Date(isoStr);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function escapeHTML(str) {
  return str.replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
  );
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
