/**
 * app.js - 主逻辑
 * 语音输入 / 手动填写 / 保存 / 图表 / 历史
 */

let currentView  = 'add';
let currentRange = 'day';
let pendingDeleteId = null;
let recognition  = null;

const $ = id => document.getElementById(id);

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
  setDefaultTime();
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

// 设置当前时间为默认值
function setDefaultTime() {
  const now = new Date();
  $('input-time').value = new Date(now - now.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 16);
}

// ===== 导航 =====
function bindNav() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
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

  // 图表时间范围
  document.querySelectorAll('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRange = btn.dataset.range;
      renderChart();
    });
  });

  // 保存
  $('save-btn').addEventListener('click', onSave);

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
  const time  = $('input-time').value;
  const note  = $('input-note').value.trim();

  if (!sys || !dia)  { toast('⚠️ 请填写收缩压和舒张压'); return; }
  if (sys <= dia)    { toast('⚠️ 收缩压应大于舒张压');   return; }
  if (!time)         { toast('⚠️ 请选择测量时间');       return; }

  Storage.save({ sys, dia, pulse, time, note });
  toast('✅ 已保存');

  $('input-sys').value = $('input-dia').value = $('input-pulse').value = $('input-note').value = '';
  setDefaultTime();
}

// ===== 图表 =====
function renderChart() {
  Charts.render(Storage.getByRange(currentRange), currentRange);
}

// ===== 历史记录 =====
function bindHistory() {
  $('export-btn').addEventListener('click', () => {
    toast(Storage.exportCSV() ? '✅ 已导出 CSV' : '⚠️ 暂无数据');
  });
}

function renderHistory() {
  const records = Storage.getAll();
  const list    = $('record-list');
  const empty   = $('no-data-history');

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
