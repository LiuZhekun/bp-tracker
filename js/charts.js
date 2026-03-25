/**
 * charts.js - 血压趋势折线图
 * 使用 Chart.js 渲染收缩压、舒张压、心率随时间变化的曲线
 */

const Charts = (() => {
  let chartInstance = null; // Chart.js 实例，复用避免重复创建

  /**
   * 渲染或刷新图表
   * @param {Array} records - 血压记录数组
   */
  function render(records) {
    const canvas = document.getElementById('bp-chart');
    const noData = document.getElementById('no-data-chart');
    const statsCard = document.getElementById('latest-stats');

    // 无数据时显示提示
    if (!records || records.length === 0) {
      noData.classList.remove('hidden');
      canvas.parentElement.classList.add('hidden');
      statsCard.classList.add('hidden');
      return;
    }

    noData.classList.add('hidden');
    canvas.parentElement.classList.remove('hidden');

    // 按时间升序排列（图表从左到右是时间增长方向）
    const sorted = [...records].sort((a, b) => new Date(a.time) - new Date(b.time));

    // 格式化 X 轴标签
    const labels = sorted.map(r => formatAxisTime(r.time));

    // 三条折线数据
    const sysData = sorted.map(r => r.sys);
    const diaData = sorted.map(r => r.dia);
    const pulseData = sorted.map(r => r.pulse); // 可能含 null

    // 参考线：正常血压 120/80（用独立 dataset 画水平虚线）
    const refSysData = sorted.map(() => 120);
    const refDiaData = sorted.map(() => 80);

    // 销毁旧实例，避免内存泄漏和重叠渲染
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    chartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          // 收缩压（红色实线）
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
          // 舒张压（蓝色实线）
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
          // 心率（绿色虚线）
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
            spanGaps: true, // 跳过 null 值
          },
          // 正常收缩压参考线（浅红虚线，不在图例中显示）
          {
            label: '参考120',
            data: refSysData,
            borderColor: 'rgba(229,62,62,0.25)',
            borderWidth: 1,
            borderDash: [4, 6],
            pointRadius: 0,
            pointHoverRadius: 0,
            tension: 0,
            fill: false,
          },
          // 正常舒张压参考线（浅蓝虚线，不在图例中显示）
          {
            label: '参考80',
            data: refDiaData,
            borderColor: 'rgba(49,130,206,0.25)',
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
        interaction: {
          // 悬停时同时显示所有数据集的值
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: false, // 使用 HTML 自定义图例，不用默认图例
          },
          tooltip: {
            callbacks: {
              // 自定义 tooltip 过滤掉参考线数据
              label(ctx) {
                if (ctx.dataset.label.startsWith('参考')) return null;
                if (ctx.parsed.y === null) return null;
                const unit = ctx.dataset.label === '心率' ? ' 次/分' : ' mmHg';
                return ` ${ctx.dataset.label}: ${ctx.parsed.y}${unit}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              maxTicksLimit: 6,
              font: { size: 10 },
              color: '#718096',
            },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
          y: {
            min: 40, // 舒张压最低不会低于40
            ticks: {
              font: { size: 10 },
              color: '#718096',
            },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
        },
      },
    });

    // 更新最新一次统计卡片
    updateStatsCard(sorted[sorted.length - 1]);
  }

  // 更新顶部统计数字（显示最新一条记录）
  function updateStatsCard(latest) {
    const statsCard = document.getElementById('latest-stats');
    if (!latest) { statsCard.classList.add('hidden'); return; }

    document.getElementById('stat-sys').textContent = latest.sys;
    document.getElementById('stat-dia').textContent = latest.dia;
    document.getElementById('stat-pulse').textContent = latest.pulse ?? '--';
    document.getElementById('stat-time').textContent = formatFullTime(latest.time);
    statsCard.classList.remove('hidden');
  }

  // X 轴时间格式：短格式 "3/25 08:30"
  function formatAxisTime(isoStr) {
    const d = new Date(isoStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  // 完整时间格式："2026年3月25日 08:30"
  function formatFullTime(isoStr) {
    const d = new Date(isoStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  return { render };
})();
