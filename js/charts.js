/**
 * charts.js - 血压趋势折线图
 * 支持四种时间维度：按天(HH:mm) / 最近一月(M/D) / 按月(M/D) / 按年(M月)
 */

const Charts = (() => {
  let chartInstance = null;

  /**
   * 渲染或刷新图表
   * @param {Array}  records  - 血压记录数组
   * @param {string} range    - 'day' | 'month30' | 'month' | 'year'
   */
  function render(records, range = 'day') {
    const canvas  = document.getElementById('bp-chart');
    const noData  = document.getElementById('no-data-chart');
    const statsCard = document.getElementById('latest-stats');

    if (!records || records.length === 0) {
      noData.classList.remove('hidden');
      canvas.parentElement.classList.add('hidden');
      statsCard.classList.add('hidden');
      return;
    }

    noData.classList.add('hidden');
    canvas.parentElement.classList.remove('hidden');

    // 按时间升序排列
    const sorted = [...records].sort((a, b) => new Date(a.time) - new Date(b.time));

    // X 轴标签格式：按天只显示 HH:mm，其他显示日期
    const labels   = sorted.map(r => formatAxisTime(r.time, range));
    const sysData  = sorted.map(r => r.sys);
    const diaData  = sorted.map(r => r.dia);
    const pulseData = sorted.map(r => r.pulse);
    const refSys   = sorted.map(() => 120);
    const refDia   = sorted.map(() => 80);

    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

    chartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: '收缩压',
            data: sysData,
            borderColor: '#E53E3E',
            backgroundColor: 'rgba(229,62,62,0.08)',
            borderWidth: 2.5,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.3,
            fill: false,
          },
          {
            label: '舒张压',
            data: diaData,
            borderColor: '#3182CE',
            backgroundColor: 'rgba(49,130,206,0.08)',
            borderWidth: 2.5,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.3,
            fill: false,
          },
          {
            label: '心率',
            data: pulseData,
            borderColor: '#38A169',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [6, 4],
            pointRadius: 3,
            pointHoverRadius: 5,
            tension: 0.3,
            fill: false,
            spanGaps: true,
          },
          // 参考线：120（浅红虚线）
          {
            label: '参考120',
            data: refSys,
            borderColor: 'rgba(229,62,62,0.22)',
            borderWidth: 1,
            borderDash: [4, 6],
            pointRadius: 0,
            pointHoverRadius: 0,
            tension: 0,
            fill: false,
          },
          // 参考线：80（浅蓝虚线）
          {
            label: '参考80',
            data: refDia,
            borderColor: 'rgba(49,130,206,0.22)',
            borderWidth: 1,
            borderDash: [4, 6],
            pointRadius: 0,
            pointHoverRadius: 0,
            tension: 0,
            fill: false,
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
              label(ctx) {
                if (ctx.dataset.label.startsWith('参考')) return null;
                if (ctx.parsed.y === null || ctx.parsed.y === undefined) return null;
                const unit = ctx.dataset.label === '心率' ? ' 次/分' : ' mmHg';
                return ` ${ctx.dataset.label}: ${ctx.parsed.y}${unit}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { maxTicksLimit: 6, font: { size: 10 }, color: '#718096' },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
          y: {
            min: 40,
            ticks: { font: { size: 10 }, color: '#718096' },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
        },
      },
    });

    // 更新最新一条统计卡片
    updateStatsCard(sorted[sorted.length - 1]);
  }

  // 更新统计数字卡片
  function updateStatsCard(latest) {
    const statsCard = document.getElementById('latest-stats');
    if (!latest) { statsCard.classList.add('hidden'); return; }
    document.getElementById('stat-sys').textContent   = latest.sys;
    document.getElementById('stat-dia').textContent   = latest.dia;
    document.getElementById('stat-pulse').textContent = latest.pulse ?? '--';
    document.getElementById('stat-time').textContent  = formatFullTime(latest.time);
    statsCard.classList.remove('hidden');
  }

  // X 轴标签：按天只显示 HH:mm，其他显示 M/D 或 M月
  function formatAxisTime(isoStr, range) {
    const d = new Date(isoStr);
    const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (range === 'day') return hm;
    if (range === 'year') return `${d.getMonth() + 1}月`;
    return `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
  }

  // 完整时间
  function formatFullTime(isoStr) {
    const d = new Date(isoStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  return { render };
})();
