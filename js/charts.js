/**
 * charts.js - 血压趋势图 + 统计渲染
 *
 * 聚合策略：
 * - 近7天：原始数据点（每次测量单独显示）
 * - 近30天/近3月/全部：按天聚合 → 均值线 + 当日最高/最低阴影区间
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
    document.getElementById('no-data-chart').classList.toggle('hidden', hasData);
    document.getElementById('chart-section').classList.toggle('hidden', !hasData);
    document.getElementById('stats-section').classList.toggle('hidden', !hasData);
    if (!hasData) return;

    renderTrend(records, range);
    renderStats(records);
    renderDistribution(records);
  }

  // ===== 折线图（带色带 + 智能聚合）=====
  function renderTrend(records, range) {
    const sorted = [...records].sort((a, b) => new Date(a.time) - new Date(b.time));

    // 近7天：原始点；其他：按天聚合
    const isRaw  = range === 'week7';
    const data   = isRaw ? buildRawData(sorted) : buildDailyData(sorted);

    if (trendChart) { trendChart.destroy(); trendChart = null; }

    // 更新聚合说明文字
    const hint = document.getElementById('chart-hint');
    if (hint) hint.textContent = isRaw ? '每个点代表一次测量' : '折线为每日均值，阴影为当日波动范围';

    trendChart = new Chart(document.getElementById('bp-chart'), {
      type: 'line',
      plugins: [bpZonePlugin],
      data: { labels: data.labels, datasets: buildDatasets(data, isRaw) },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const label = items[0]?.label || '';
                // 显示当天测量次数
                const idx = items[0]?.dataIndex;
                const cnt = data.counts?.[idx];
                return cnt > 1 ? `${label}（${cnt}次均值）` : label;
              },
              label: ctx => {
                if (ctx.dataset.hidden || ctx.parsed.y == null) return null;
                // 隐藏区间辅助线的 tooltip
                if (ctx.dataset.label.startsWith('_')) return null;
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

  // 原始数据（近7天：每次测量一个点）
  function buildRawData(sorted) {
    return {
      labels:  sorted.map(r => fmtRaw(r.time)),
      sys:     sorted.map(r => r.sys),
      dia:     sorted.map(r => r.dia),
      pulse:   sorted.map(r => r.pulse),
      counts:  sorted.map(() => 1),
    };
  }

  // 按天聚合数据（均值 + 最高/最低）
  function buildDailyData(sorted) {
    const map = {};
    sorted.forEach(r => {
      const day = r.time.slice(0, 10);
      if (!map[day]) map[day] = { sys: [], dia: [], pulse: [] };
      map[day].sys.push(r.sys);
      map[day].dia.push(r.dia);
      if (r.pulse) map[day].pulse.push(r.pulse);
    });

    const days = Object.keys(map).sort();
    const avg  = a => Math.round(a.reduce((s, v) => s + v, 0) / a.length);

    return {
      labels:   days.map(fmtDay),
      sys:      days.map(d => avg(map[d].sys)),
      sysMax:   days.map(d => Math.max(...map[d].sys)),
      sysMin:   days.map(d => Math.min(...map[d].sys)),
      dia:      days.map(d => avg(map[d].dia)),
      diaMax:   days.map(d => Math.max(...map[d].dia)),
      diaMin:   days.map(d => Math.min(...map[d].dia)),
      pulse:    days.map(d => map[d].pulse.length ? avg(map[d].pulse) : null),
      counts:   days.map(d => map[d].sys.length),
    };
  }

  // 构建 Chart.js datasets
  function buildDatasets(data, isRaw) {
    const sets = [];

    if (!isRaw) {
      // 收缩压区间（上边界，填充到下边界）
      sets.push({
        label: '_sysMax', data: data.sysMax,
        borderColor: 'transparent', backgroundColor: 'rgba(255,59,48,0.12)',
        borderWidth: 0, pointRadius: 0, fill: '+1', tension: 0.3,
      });
      // 收缩压区间（下边界）
      sets.push({
        label: '_sysMin', data: data.sysMin,
        borderColor: 'transparent', backgroundColor: 'transparent',
        borderWidth: 0, pointRadius: 0, fill: false, tension: 0.3,
      });
      // 舒张压区间
      sets.push({
        label: '_diaMax', data: data.diaMax,
        borderColor: 'transparent', backgroundColor: 'rgba(0,122,255,0.10)',
        borderWidth: 0, pointRadius: 0, fill: '+1', tension: 0.3,
      });
      sets.push({
        label: '_diaMin', data: data.diaMin,
        borderColor: 'transparent', backgroundColor: 'transparent',
        borderWidth: 0, pointRadius: 0, fill: false, tension: 0.3,
      });
    }

    // 收缩压均值线
    sets.push({
      label: '收缩压',
      data: data.sys,
      borderColor: '#FF3B30', backgroundColor: 'transparent',
      borderWidth: 2.5, pointRadius: isRaw ? 4 : 3,
      pointHoverRadius: 6, tension: 0.3, fill: false,
    });
    // 舒张压均值线
    sets.push({
      label: '舒张压',
      data: data.dia,
      borderColor: '#007AFF', backgroundColor: 'transparent',
      borderWidth: 2.5, pointRadius: isRaw ? 4 : 3,
      pointHoverRadius: 6, tension: 0.3, fill: false,
    });
    // 心率
    sets.push({
      label: '心率',
      data: data.pulse,
      borderColor: '#34C759', backgroundColor: 'transparent',
      borderWidth: 2, borderDash: [5, 4],
      pointRadius: isRaw ? 3 : 2, pointHoverRadius: 5,
      tension: 0.3, fill: false, spanGaps: true,
    });

    return sets;
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

  // 原始点时间标签：M/D HH:mm
  function fmtRaw(iso) {
    const d = new Date(iso);
    return `${d.getMonth()+1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  // 按天聚合时间标签：M/D
  function fmtDay(dateStr) {
    const d = new Date(dateStr);
    return `${d.getMonth()+1}/${d.getDate()}`;
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
