/**
 * charts.js - 血压趋势图 + 统计
 *
 * 聚合策略：
 * - 近7天：原始点（每次测量）
 * - 其他：按天聚合，均值线 + 手动绘制高低范围阴影
 *
 * 交互：点击图例按钮可切换单条数据线的显示/隐藏
 */

const Charts = (() => {
  let trendChart  = null;
  let bandsConfig = null; // 供手动绘制插件使用的区间数据

  // ===== 色带背景插件（绿/黄/橙/红分级区间）=====
  const bpZonePlugin = {
    id: 'bpZones',
    beforeDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea) return;
      const y = scales.y;
      const { left, right, top, bottom } = chartArea;
      const px = v => Math.max(top, Math.min(bottom, y.getPixelForValue(v)));

      ctx.save();
      ctx.beginPath();
      ctx.rect(left, top, right - left, bottom - top);
      ctx.clip();

      [
        { max: 220, min: 160, color: 'rgba(215,0,21,0.09)'   },  // 2级+
        { max: 160, min: 140, color: 'rgba(255,149,0,0.09)'  },  // 1级
        { max: 140, min: 130, color: 'rgba(255,204,0,0.10)'  },  // 正常高值
        { max: 130, min: 90,  color: 'rgba(52,199,89,0.07)'  },  // 正常
        { max: 90,  min: 50,  color: 'rgba(0,122,255,0.07)'  },  // 偏低
      ].forEach(({ max, min, color }) => {
        ctx.fillStyle = color;
        ctx.fillRect(left, px(max), right - left, px(min) - px(max));
      });
      ctx.restore();
    },
  };

  // ===== 高低区间阴影插件（手动绘路径，兼容性最好）=====
  const rangeBandPlugin = {
    id: 'rangeBands',
    afterDatasetsDraw(chart) {
      if (!bandsConfig) return;
      const { ctx, chartArea, scales } = chart;
      if (!chartArea) return;

      // 从"收缩压"数据集的 meta 获取每个点的 x 像素坐标
      const sysIdx = chart.data.datasets.findIndex(d => d.label === '收缩压');
      if (sysIdx < 0) return;
      const meta = chart.getDatasetMeta(sysIdx);

      ctx.save();
      ctx.beginPath();
      ctx.rect(chartArea.left, chartArea.top,
               chartArea.right  - chartArea.left,
               chartArea.bottom - chartArea.top);
      ctx.clip();

      bandsConfig.forEach(({ maxData, minData, color, hidden }) => {
        if (hidden) return;
        const n = Math.min(maxData.length, minData.length, meta.data.length);
        if (n < 2) return;

        ctx.beginPath();
        ctx.fillStyle = color;

        // 上边缘（maxData 从左到右）
        for (let i = 0; i < n; i++) {
          const x = meta.data[i].x;
          const y = scales.y.getPixelForValue(maxData[i]);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        // 下边缘（minData 从右到左）
        for (let i = n - 1; i >= 0; i--) {
          ctx.lineTo(meta.data[i].x, scales.y.getPixelForValue(minData[i]));
        }

        ctx.closePath();
        ctx.fill();
      });

      ctx.restore();
    },
  };

  // ===== 主入口 =====
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

  // ===== 折线图 =====
  function renderTrend(records, range) {
    const sorted = [...records].sort((a, b) => new Date(a.time) - new Date(b.time));
    const isRaw  = range === 'week7';
    const data   = isRaw ? buildRawData(sorted) : buildDailyData(sorted);

    // 更新说明文字
    const hint = document.getElementById('chart-hint');
    if (hint) hint.textContent = isRaw
      ? '每个点代表一次测量'
      : '折线为每日均值，阴影为当日波动范围';

    if (trendChart) { trendChart.destroy(); trendChart = null; }

    // 动态调整图表宽度：数据点多时横向扩展，防止拥挤
    // offsetWidth 触发同步重排；首次渲染 chart-section 刚取消 hidden 时可能仍为 0，跳过等 responsive 处理
    const scrollWrap  = document.getElementById('chart-scroll-wrap');
    const scrollInner = document.getElementById('chart-scroll-inner');
    if (scrollWrap && scrollInner) {
      const containerW = scrollWrap.offsetWidth;
      if (containerW > 0) {
        const ptW = isRaw ? 30 : 34;
        const minW = Math.max(containerW, data.labels.length * ptW);
        scrollInner.style.width = minW + 'px';
      } else {
        scrollInner.style.width = ''; // 宽度未就绪，清空交给 responsive 处理
      }
    }

    // 设置区间阴影数据（供 rangeBandPlugin 使用）
    bandsConfig = isRaw ? null : [
      { maxData: data.sysMax, minData: data.sysMin, color: 'rgba(255,59,48,0.13)',  hidden: false },
      { maxData: data.diaMax, minData: data.diaMin, color: 'rgba(0,122,255,0.10)', hidden: false },
    ];

    trendChart = new Chart(document.getElementById('bp-chart'), {
      type: 'line',
      plugins: [bpZonePlugin, rangeBandPlugin],
      data: {
        labels: data.labels,
        datasets: [
          {
            label: '收缩压',
            data: data.sys,
            borderColor: '#FF3B30', backgroundColor: 'transparent',
            borderWidth: 2.5, pointRadius: isRaw ? 4 : 3, pointHoverRadius: 6,
            tension: 0.3, fill: false,
          },
          {
            label: '舒张压',
            data: data.dia,
            borderColor: '#007AFF', backgroundColor: 'transparent',
            borderWidth: 2.5, pointRadius: isRaw ? 4 : 3, pointHoverRadius: 6,
            tension: 0.3, fill: false,
          },
          {
            label: '心率',
            data: data.pulse,
            borderColor: '#34C759', backgroundColor: 'transparent',
            borderWidth: 2, borderDash: [5, 4],
            pointRadius: isRaw ? 3 : 2, pointHoverRadius: 5,
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
              title: items => {
                const label = items[0]?.label || '';
                const cnt   = data.counts?.[items[0]?.dataIndex];
                return (cnt > 1) ? `${label}（${cnt}次均值）` : label;
              },
              label: ctx => {
                if (ctx.parsed.y == null) return null;
                const u = ctx.dataset.label === '心率' ? '次/分' : 'mmHg';
                return ` ${ctx.dataset.label}: ${ctx.parsed.y} ${u}`;
              },
            },
          },
        },
        scales: {
          x: { ticks: { maxTicksLimit: Math.min(data.labels.length, 12), font: { size: 10 }, color: 'rgba(60,60,67,.6)' }, grid: { color: 'rgba(0,0,0,.04)' } },
          y: { min: 50, max: 200, ticks: { font: { size: 10 }, color: 'rgba(60,60,67,.6)' }, grid: { color: 'rgba(0,0,0,.04)' } },
        },
      },
    });

    // 恢复图例按钮状态（切换视图再回来时同步）
    syncLegendBtns();
  }

  // ===== 切换数据线显示/隐藏（由图例按钮调用）=====
  function toggleSeries(name) {
    if (!trendChart) return false;
    const labelMap = { sys: '收缩压', dia: '舒张压', pulse: '心率' };
    const ds = trendChart.data.datasets.find(d => d.label === labelMap[name]);
    if (!ds) return false;

    ds.hidden = !ds.hidden;
    const nowHidden = ds.hidden;

    // 同步隐藏对应的区间阴影
    if (bandsConfig) {
      if (name === 'sys') bandsConfig[0].hidden = nowHidden;
      if (name === 'dia') bandsConfig[1].hidden = nowHidden;
    }

    trendChart.update();
    return nowHidden;
  }

  // 同步图例按钮高亮状态
  function syncLegendBtns() {
    if (!trendChart) return;
    const labelMap = { sys: '收缩压', dia: '舒张压', pulse: '心率' };
    document.querySelectorAll('.l-toggle').forEach(btn => {
      const ds = trendChart.data.datasets.find(d => d.label === labelMap[btn.dataset.series]);
      btn.classList.toggle('inactive', !!ds?.hidden);
    });
  }

  // ===== 数据构建 =====
  function buildRawData(sorted) {
    return {
      labels: sorted.map(r => fmtRaw(r.time)),
      sys:    sorted.map(r => r.sys),
      dia:    sorted.map(r => r.dia),
      pulse:  sorted.map(r => r.pulse),
      counts: sorted.map(() => 1),
    };
  }

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
      labels:  days.map(fmtDay),
      sys:     days.map(d => avg(map[d].sys)),
      sysMax:  days.map(d => Math.max(...map[d].sys)),
      sysMin:  days.map(d => Math.min(...map[d].sys)),
      dia:     days.map(d => avg(map[d].dia)),
      diaMax:  days.map(d => Math.max(...map[d].dia)),
      diaMin:  days.map(d => Math.min(...map[d].dia)),
      pulse:   days.map(d => map[d].pulse.length ? avg(map[d].pulse) : null),
      counts:  days.map(d => map[d].sys.length),
    };
  }

  // ===== 统计卡片 =====
  function renderStats(records) {
    const s = Storage.calcStats(records);
    if (!s) return;

    const avgLevel  = bpLevel(s.avgSys, s.avgDia);
    const rateColor = s.targetRate >= 80 ? 'green' : s.targetRate >= 60 ? 'yellow' : 'red';

    setCard('stat-avg', {
      title: '平均血压', badge: avgLevel.label, badgeCls: avgLevel.cls,
      main: `${s.avgSys}<small>/</small>${s.avgDia}`,
      sub:  s.avgPulse ? `心率 ${s.avgPulse} 次/分` : `共 ${s.count} 次`,
    });
    setCard('stat-target', {
      title: '达标率', badge: s.targetRate >= 80 ? '良好' : s.targetRate >= 60 ? '一般' : '偏低',
      badgeCls: `tag-${rateColor}`,
      main: `${s.targetRate}<small>%</small>`,
      sub:  `标准 <135/85（共${s.count}次）`,
    });
    setCard('stat-peak', {
      title: '高值次数',
      badge: s.highCount === 0 ? '无异常' : `占比${Math.round(s.highCount/s.count*100)}%`,
      badgeCls: s.highCount === 0 ? 'tag-green' : s.highCount > 3 ? 'tag-red' : 'tag-orange',
      main: `${s.highCount}<small>次</small>`,
      sub:  `收缩压最高 ${s.maxSys} mmHg`,
    });
    setCard('stat-pp', {
      title: '脉压差',
      badge: s.pp < 25 ? '偏小' : s.pp <= 60 ? '正常' : '偏大',
      badgeCls: s.pp < 25 ? 'tag-blue' : s.pp <= 60 ? 'tag-green' : 'tag-orange',
      main: `${s.pp}<small>mmHg</small>`,
      sub:  '正常范围 30~60',
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

  // ===== 血压分布 =====
  function renderDistribution(records) {
    const d = Storage.calcDistribution(records);
    const total = records.length;
    const pct   = n => Math.round(n / total * 100);

    document.getElementById('dist-bars').innerHTML = [
      { label: '正常',      count: d.normal,   cls: 'dist-green'  },
      { label: '正常高值',  count: d.elevated,  cls: 'dist-yellow' },
      { label: '1级高血压', count: d.high1,    cls: 'dist-orange' },
      { label: '2级以上',   count: d.high2,    cls: 'dist-red'    },
      { label: '偏低',      count: d.low,      cls: 'dist-blue'   },
    ].filter(r => r.count > 0).map(r => `
      <div class="dist-row">
        <span class="dist-label">${r.label}</span>
        <div class="dist-bar-wrap">
          <div class="dist-bar ${r.cls}" style="width:${Math.max(pct(r.count), 4)}%"></div>
        </div>
        <span class="dist-val">${r.count}次 <em>${pct(r.count)}%</em></span>
      </div>`).join('');
  }

  // ===== 工具函数 =====
  function bpLevel(sys, dia) {
    if (sys < 90  || dia < 60)  return { label: '偏低',     cls: 'tag-blue'   };
    if (sys < 130 && dia < 85)  return { label: '正常',     cls: 'tag-green'  };
    if (sys < 140 && dia < 90)  return { label: '正常高值', cls: 'tag-yellow' };
    if (sys < 160 && dia < 100) return { label: '1级高血压',cls: 'tag-orange' };
    return                             { label: '2级以上',   cls: 'tag-red'    };
  }

  function fmtRaw(iso) {
    const d = new Date(iso);
    return `${d.getMonth()+1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function fmtDay(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getMonth()+1}/${d.getDate()}`;
  }
  function p(n) { return String(n).padStart(2, '0'); }

  return { render, toggleSeries };
})();
