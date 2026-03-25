/**
 * app.js - 主逻辑
 * 语音输入 / 手动填写 / 保存 / 图表 / 历史
 */

let currentView      = 'add';
let currentRange     = 'week7';
let pendingDeleteId  = null;
let recognition      = null;
let timeUserEdited   = false; // 用户是否手动修改了时间字段

const $ = id => document.getElementById(id);

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
  // 不预填时间，保持折叠状态，保存时自动取当前时刻
  bindNav();
  bindAdd();
  bindHistory();
  checkVoiceSupport();
  registerSW();
});

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

// 检测语音支持；不支持则隐藏麦克风按钮
function checkVoiceSupport() {
  if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
    $('voice-btn').style.display = 'none';
  }
}

// 返回本地时间的 ISO 字符串（YYYY-MM-DDTHH:mm）
function nowLocalISO() {
  const now = new Date();
  return new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// 设置当前时间为默认值
function setDefaultTime() {
  $('input-time').value = nowLocalISO();
}

// 展开时间输入面板
function toggleTimeInput() {
  const wrap = $('time-input-wrap');
  const row  = $('time-toggle-row');
  const isHidden = wrap.classList.contains('hidden');
  if (isHidden) {
    wrap.classList.remove('hidden');
    // 展开时预填当前时间，方便用户微调
    if (!$('input-time').value) setDefaultTime();
    row.querySelector('.form-time-hint').textContent = '不填则自动记录当前时间 ▾';
  } else {
    collapseTimeInput();
  }
}

// 收起时间面板
function collapseTimeInput() {
  $('time-input-wrap').classList.add('hidden');
  const hint = document.querySelector('#time-toggle-row .form-time-hint');
  if (hint) hint.textContent = '不填则自动记录当前时间 ▸';
}

// ===== 导航 =====
function bindNav() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  // 图例按钮：点击切换单条数据线
  document.querySelectorAll('.l-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const hidden = Charts.toggleSeries(btn.dataset.series);
      btn.classList.toggle('inactive', hidden);
    });
  });
}

function switchView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.view === view)
  );
  currentView = view;
  if (view === 'chart')   renderChart();
  if (view === 'history') renderHistory();
}

// ===== 录入页事件 =====
function bindAdd() {
  // 语音
  $('voice-btn').addEventListener('click', startVoice);
  $('voice-stop-btn').addEventListener('click', stopVoice);

  // 图表时间范围（含自定义）
  document.querySelectorAll('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRange = btn.dataset.range;
      // 选中"自定义"时展开日期面板，其他时收起
      $('custom-range-panel').classList.toggle('hidden', currentRange !== 'custom');
      if (currentRange !== 'custom') renderChart();
    });
  });

  // 自定义日期变更时刷新图表
  ['chart-date-start', 'chart-date-end'].forEach(id => {
    $(id).addEventListener('change', () => {
      if (currentRange === 'custom') renderChart();
    });
  });

  // 保存
  $('save-btn').addEventListener('click', onSave);

  // 监听时间字段：用户手动修改时置标志位
  $('input-time').addEventListener('change', () => { timeUserEdited = true; });

  // 删除确认
  $('confirm-ok').addEventListener('click', () => {
    if (pendingDeleteId) {
      Storage.remove(pendingDeleteId);
      pendingDeleteId = null;
      $('confirm-modal').classList.add('hidden');
      renderHistory();
      toast('已删除');
    }
  });
  $('confirm-cancel').addEventListener('click', () => {
    pendingDeleteId = null;
    $('confirm-modal').classList.add('hidden');
  });
}

// ===== 语音输入 =====
function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('⚠️ 请使用 Safari 浏览器'); return; }

  // 切换 UI 状态
  $('voice-idle').classList.add('hidden');
  $('voice-recording').classList.remove('hidden');
  $('voice-interim').textContent = '';

  recognition = new SR();
  recognition.lang = 'zh-CN';
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onresult = e => {
    const text = Array.from(e.results).map(r => r[0].transcript).join('');
    $('voice-interim').textContent = text;

    if (e.results[e.results.length - 1].isFinal) {
      const parsed = parseSpeech(text);
      stopVoice();
      if (parsed) {
        fillForm(parsed);
        toast('✅ 识别成功，请确认数值');
      } else {
        toast('⚠️ 未识别到血压数值，请重试或手动填写');
      }
    }
  };

  recognition.onerror = e => {
    stopVoice();
    const map = { 'not-allowed': '请允许麦克风权限', 'no-speech': '未检测到声音' };
    toast('⚠️ ' + (map[e.error] || '语音识别失败'));
  };

  recognition.onend = stopVoice;
  recognition.start();
}

function stopVoice() {
  if (recognition) { try { recognition.stop(); } catch (_) {} recognition = null; }
  $('voice-idle').classList.remove('hidden');
  $('voice-recording').classList.add('hidden');
}

/**
 * 解析语音文本，支持：
 * "高压130低压85心率72"
 * "收缩压135舒张压82脉搏75"
 * "130 85 72"（按顺序三个数）
 * "一百三十 八十五 七十二"（中文数字）
 */
function parseSpeech(text) {
  const s = cnToNum(text); // 中文数字转阿拉伯
  console.log('[Voice] 归一化:', s);

  // 关键词优先匹配
  const sysM   = s.match(/(?:高压|收缩压|上压)\D*?(\d{2,3})/);
  const diaM   = s.match(/(?:低压|舒张压|下压)\D*?(\d{2,3})/);
  const pulseM = s.match(/(?:心率|脉搏|脉)\D*?(\d{2,3})/);

  let sys   = sysM   ? +sysM[1]   : null;
  let dia   = diaM   ? +diaM[1]   : null;
  let pulse = pulseM ? +pulseM[1] : null;

  // 关键词未匹配则按数字顺序分配
  if (!sys || !dia) {
    const nums = [...s.matchAll(/\d{2,3}/g)].map(m => +m[0]);
    const sArr = nums.filter(n => n >= 90  && n <= 210);
    const dArr = nums.filter(n => n >= 50  && n <= 130);
    const pArr = nums.filter(n => n >= 45  && n <= 130);
    if (!sys && sArr.length)               sys   = sArr[0];
    if (!dia && dArr.length)               dia   = dArr.find(n => n !== sys)  ?? null;
    if (!pulse && pArr.length)             pulse = pArr.find(n => n !== sys && n !== dia) ?? null;
  }

  if (sys && dia && sys > dia && sys >= 90 && dia >= 50) {
    return { sys, dia, pulse };
  }
  return null;
}

// 中文数字 → 阿拉伯数字（支持：一百三十、八十五 等）
function cnToNum(text) {
  const N = { 零:0,一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9 };
  const U = { 十:10, 百:100 };
  return text.replace(/[一二三四五六七八九零十百]+/g, m => {
    let r = 0, cur = 0;
    for (const c of m) {
      if (c in N) { cur = N[c]; }
      else if (c in U) {
        r += (cur || (U[c] === 10 ? 1 : 0)) * U[c];
        cur = 0;
      }
    }
    return String(r + cur);
  });
}

function fillForm({ sys, dia, pulse }) {
  if (sys)   $('input-sys').value   = sys;
  if (dia)   $('input-dia').value   = dia;
  if (pulse) $('input-pulse').value = pulse;
}

// ===== 保存 =====
function onSave() {
  const sys   = +$('input-sys').value;
  const dia   = +$('input-dia').value;
  const pulse = $('input-pulse').value ? +$('input-pulse').value : null;
  const note  = $('input-note').value.trim();

  // 时间：用户手动改过就用输入框的值，否则用点击保存时的当前时刻
  const time = timeUserEdited ? $('input-time').value : nowLocalISO();

  if (!sys || !dia)  { toast('⚠️ 请填写收缩压和舒张压'); return; }
  if (sys <= dia)    { toast('⚠️ 收缩压应大于舒张压');   return; }

  Storage.save({ sys, dia, pulse, time, note });
  toast('✅ 已保存');

  $('input-sys').value = $('input-dia').value = $('input-pulse').value = $('input-note').value = '';
  timeUserEdited = false; // 重置标志，下次保存再用当前时刻
  // 保存后清空时间输入框并收起时间面板
  $('input-time').value = '';
  collapseTimeInput();
}

// ===== 图表 =====
function renderChart() {
  let data;
  if (currentRange === 'custom') {
    // 自定义模式：用起止日期筛选
    const s = $('chart-date-start').value;
    const e = $('chart-date-end').value;
    data = Storage.getByDateRange(s, e);
  } else {
    data = Storage.getByRange(currentRange);
  }
  Charts.render(data, currentRange);
}

// ===== 历史记录 =====
function bindHistory() {
  $('export-btn').addEventListener('click', () => {
    toast(Storage.exportCSV() ? '✅ 已导出 CSV' : '⚠️ 暂无数据');
  });

  // 导入：点击按钮触发隐藏的 file input
  $('import-btn').addEventListener('click', () => $('import-input').click());
  $('import-input').addEventListener('change', onImportCSV);

  // 历史页日期筛选：输入后即时刷新
  ['hist-date-start', 'hist-date-end'].forEach(id => {
    $(id).addEventListener('change', renderHistory);
  });

  // 清除筛选按钮
  $('hist-filter-clear').addEventListener('click', () => {
    $('hist-date-start').value = '';
    $('hist-date-end').value   = '';
    renderHistory();
  });
}

// ===== CSV 导入 =====
async function onImportCSV(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const records = parseCSV(text);
    if (!records.length) { toast('⚠️ 未找到有效数据'); return; }
    const { added, updated } = Storage.importRecords(records);
    toast(`✅ 新增 ${added} 条，更新 ${updated} 条`);
    renderHistory();
  } catch (_) {
    toast('⚠️ 文件读取失败');
  } finally {
    e.target.value = ''; // 重置，允许重复导入同一文件
  }
}

// 解析 CSV 文本，返回记录数组（跳过首行表头）
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
                    .split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  return lines.slice(1).map(line => {
    const fields = splitCSVLine(line);
    return {
      time:  fields[0] || '',
      sys:   fields[1] || '',
      dia:   fields[2] || '',
      pulse: fields[3] || '',
      note:  fields[4] || '',
    };
  }).filter(r => r.time && r.sys && r.dia);
}

// 处理 CSV 单行，支持带引号的字段（含逗号/换行）
function splitCSVLine(line) {
  const fields = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { fields.push(cur.trim()); cur = ''; }
      else cur += c;
    }
  }
  fields.push(cur.trim());
  return fields;
}

function renderHistory() {
  const s = $('hist-date-start').value;
  const e = $('hist-date-end').value;
  // 有日期筛选时用自定义范围，否则取全部
  const records = (s || e) ? Storage.getByDateRange(s, e) : Storage.getAll();
  // 有筛选条件时显示清除按钮
  $('hist-filter-clear').classList.toggle('hidden', !s && !e);

  const list  = $('record-list');
  const empty = $('no-data-history');

  if (!records.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.innerHTML = records.map(r => {
    const tag    = bpTag(r.sys, r.dia);
    const time   = fmtTime(r.time);
    const pulse  = r.pulse ? `❤️ 心率 ${r.pulse} 次/分` : '';
    const note   = r.note  ? esc(r.note) : '';
    return `
      <div class="record-item">
        <div class="record-bp">
          <span class="r-sys">${r.sys}</span>
          <span class="r-slash">/</span>
          <span class="r-dia">${r.dia}</span>
        </div>
        <div class="record-info">
          <div class="r-time">${time}</div>
          ${pulse ? `<div class="r-pulse">${pulse}</div>` : ''}
          ${note  ? `<div class="r-note">${note}</div>`  : ''}
        </div>
        <span class="r-tag ${tag.cls}">${tag.label}</span>
        <button class="r-del" data-id="${r.id}">×</button>
      </div>`;
  }).join('');

  list.querySelectorAll('.r-del').forEach(btn => {
    btn.addEventListener('click', () => {
      pendingDeleteId = btn.dataset.id;
      $('confirm-modal').classList.remove('hidden');
    });
  });
}

// 血压分级（参考中国高血压指南）
function bpTag(sys, dia) {
  if (sys < 90 || dia < 60)  return { cls: 'tag-low',  label: '偏低' };
  if (sys < 120 && dia < 80) return { cls: 'tag-normal', label: '正常' };
  if (sys < 140 && dia < 90) return { cls: 'tag-warn',  label: '偏高' };
  return                             { cls: 'tag-high',  label: '高血压' };
}

function fmtTime(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function p(n) { return String(n).padStart(2, '0'); }
function esc(s) { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ===== Toast =====
let _tt = null;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(_tt);
  _tt = setTimeout(() => el.classList.add('hidden'), 2400);
}
