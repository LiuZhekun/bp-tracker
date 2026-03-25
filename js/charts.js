/**
 * charts.js - 血压趋势图 + 统计渲染
 *
 * 功能：
 * 1. 带色带的折线图（绿/黄/橙/红区间）
 * 2. 4张统计卡片（平均值/达标率/峰值/脉压差）
 * 3. 血压分布进度条
 */

const Charts = (() => {
  let trendChart = null;

  // ===== 血压区间色带插件（Chart.js 内联插件，无需外部库）=====
  const bpZonePlugin = {
    id: 'bpZones',
    beforeDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea) return;
      const y = scales.y;
      const { left, right, top, bottom } = chartArea;
      const px = v => Math.max(top, Math.min(bottom, y.getPixelForValue(v)));

      // 从上到下绘制色带区间
      const zones = [
        { max: 220, min: 160, color: 'rgba(215,0,21,0.10)' },    // 2级高血压以上 红
        { max: 160, min: 140, color: 'rgba(255,149,0,0.10)' },   // 1级高血压 橙
        { max: 140, min: 130, color: 'rgba(255,204,0,0.10)' },   // 正常高值 黄
        { max: 130, min: 90,  color: 'rgba(52,199,89,0.07)' },   // 正常范围 绿
        { max: 90,  min: 50,  color: 'rgba(0,122,255,0.07)' },   // 偏低 蓝
      ];

      ctx.save();
      ctx.beginPath();
      ctx.rect(left, top, right - left, bottom - top);
      ctx.clip();
      zones.forEach(({ max, min, color }) => {
        ctx.fillStyle = color;
        ctx.fillRect(left, px(max), right - left, px(min) - px(max));
      });
      ctx.restore();
    },
  };

  /**
   * 渲染整个图表视图
   * @param {Array}  records
   * @param {string} range - 'week7' | 'month30' | 'month90' | 'all'
   */
  function render(records, range) {
    const hasData = records && records.length > 0;

    // 空状态处理
    document.getElementById('no-data-chart').classList.toggle('hidden', hasData);
    document.getElementById('chart-section').classList.toggle('hidden', !hasData);
    document.getElementById('stats-section').classList.toggle('hidden', !hasData);

    if (!hasData) return;

    renderTrend(records, range);
    renderStats(records);
    renderDistribution(records);
  }

  // ===== 折线图（带色带）=====
  function renderTrend(records, range) {
    const sorted = [...records].sort((a, b) => new Date(a.time) - new Date(b.time));

    const labels   = sorted.map(r => fmtAxis(r.time, range));
    const sysData  = sorted.map(r => r.sys);
    const diaData  = sorted.map(r => r.dia);
    const pulseData = sorted.map(r => r.pulse);

    if (trendChart) { trendChart.destroy(); trendChart = null; }

    trendChart = new Chart(document.getElementById('bp-chart'), {
      type: 'line',
      plugins: [bpZonePlugin],  // 注入色带插件
      data: {
        labels,
        datasets: [
          {
            label: '收缩压',
            data: sysData,
            borderColor: '#FF3B30',
            backgroundColor: 'rgba(255,59,48,0.06)',
            borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 6,
            tension: 0.3, fill: false,
          },
          {
            label: '舒张压',
            data: diaData,
            borderColor: '#007AFF',
            backgroundColor: 'rgba(0,122,255,0.06)',
            borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 6,
            tension: 0.3, fill: false,
          },
          {
            label: '心率',
            data: pulseData,
            borderColor: '#34C759',
            backgroundColor: 'transparent',
            borderWidth: 2, borderDash: [5, 4],
            pointRadius: 3, pointHoverRadius: 5,
            tension: 0.3, fill: false, spanGaps: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                if (ctx.parsed.y == null) return null;
                const u = ctx.dataset.label === '心率' ? '次/分' : 'mmHg';
                return ` ${ctx.dataset.label}: ${ctx.parsed.y} ${u}`;
              },
            },
          },
        },
        scales: {
          x: { ticks: { maxTicksLimit: 6, font: { size: 10 }, color: 'rgba(60,60,67,.6)' }, grid: { color: 'rgba(0,0,0,.04)' } },
          y: { min: 50, max: 200, ticks: { font: { size: 10 }, color: 'rgba(60,60,67,.6)' }, grid: { color: 'rgba(0,0,0,.04)' } },
        },
      },
    });
  }

  // ===== 统计卡片 =====
  function renderStats(records) {
    const s = Storage.calcStats(records);
    if (!s) return;

    // 卡片1：平均血压
    const avgLevel = bpLevel(s.avgSys, s.avgDia);
    setCard('stat-avg', {
      title: '平均血压',
      main: `${s.avgSys}<small>/</small>${s.avgDia}`,
      sub: s.avgPulse ? `心率 ${s.avgPulse} 次/分` : `共 ${s.count} 次测量`,
      badge: avgLevel.label,
      badgeCls: avgLevel.cls,
    });

    // 卡片2：达标率（家测标准 <135/85）
    const rateColor = s.targetRate >= 80 ? 'green' : s.targetRate >= 60 ? 'orange' : 'red';
    setCard('stat-target', {
      title: '达标率',
      main: `${s.targetRate}<small>%</small>`,
      sub: `共 ${s.count} 次（标准<135/85）`,
      badge: s.targetRate >= 80 ? '良好' : s.targetRate >= 60 ? '一般' : '偏低',
      badgeCls: `tag-${rateColor}`,
    });

    // 卡片3：峰值预警
    setCard('stat-peak', {
      title: '高值次数',
      main: `${s.highCount}<small>次</small>`,
      sub: `收缩压最高 ${s.maxSys} mmHg`,
      badge: s.highCount === 0 ? '无异常' : `占比${Math.round(s.highCount/s.count*100)}%`,
      badgeCls: s.highCount === 0 ? 'tag-green' : s.highCount > 3 ? 'tag-red' : 'tag-orange',
    });

    // 卡片4：脉压差
    const ppStatus = s.pp < 25 ? '偏小' : s.pp <= 60 ? '正常' : '偏大';
    const ppCls    = s.pp < 25 ? 'tag-blue' : s.pp <= 60 ? 'tag-green' : 'tag-orange';
    setCard('stat-pp', {
      title: '脉压差',
      main: `${s.pp}<small>mmHg</small>`,
      sub: '正常范围 30~60',
      badge: ppStatus,
      badgeCls: ppCls,
    });
  }

  function setCard(id, { title, main, sub, badge, badgeCls }) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `
      <div class="sc-header">
        <span class="sc-title">${title}</span>
        <span class="sc-badge ${badgeCls}">${badge}</span>
      </div>
      <div class="sc-main">${main}</div>
      <div class="sc-sub">${sub}</div>`;
  }

  // ===== 血压分布进度条 =====
  function renderDistribution(records) {
    const d = Storage.calcDistribution(records);
    const total = records.length;
    const pct = n => Math.round(n / total * 100);

    const rows = [
      { label: '正常',     count: d.normal,   pct: pct(d.normal),   cls: 'dist-green'  },
      { label: '正常高值', count: d.elevated,  pct: pct(d.elevated), cls: 'dist-yellow' },
      { label: '1级高血压',count: d.high1,    pct: pct(d.high1),    cls: 'dist-orange' },
      { label: '2级及以上',count: d.high2,    pct: pct(d.high2),    cls: 'dist-red'    },
      { label: '偏低',     count: d.low,      pct: pct(d.low),      cls: 'dist-blue'   },
    ].filter(r => r.count > 0);

    document.getElementById('dist-bars').innerHTML = rows.map(r => `
      <div class="dist-row">
        <span class="dist-label">${r.label}</span>
        <div class="dist-bar-wrap">
          <div class="dist-bar ${r.cls}" style="width:${Math.max(r.pct, 4)}%"></div>
        </div>
        <span class="dist-val">${r.count}次 <em>${r.pct}%</em></span>
      </div>`).join('');
  }

  // X 轴时间格式
  function fmtAxis(iso, range) {
    const d = new Date(iso);
    const hm = `${p(d.getHours())}:${p(d.getMinutes())}`;
    if (range === 'week7') return `${d.getMonth()+1}/${d.getDate()} ${hm}`;
    if (range === 'month90' || range === 'all') return `${d.getMonth()+1}/${d.getDate()}`;
    return `${d.getMonth()+1}/${d.getDate()} ${hm}`;
  }

  // 根据血压值判断等级
  function bpLevel(sys, dia) {
    if (sys < 90  || dia < 60)  return { label: '偏低',     cls: 'tag-blue'   };
    if (sys < 130 && dia < 85)  return { label: '正常',     cls: 'tag-green'  };
    if (sys < 140 && dia < 90)  return { label: '正常高值', cls: 'tag-yellow' };
    if (sys < 160 && dia < 100) return { label: '1级高血压',cls: 'tag-orange' };
    return                             { label: '2级以上',   cls: 'tag-red'    };
  }

  function p(n) { return String(n).padStart(2, '0'); }

  return { render };
})();
