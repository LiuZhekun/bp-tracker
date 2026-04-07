/**
 * 血压趋势图（由 js/charts.js 迁移，Chart.js ESM）
 */
import { Chart, registerables, type ChartConfiguration } from 'chart.js'
import type { BpRecord } from './storage'

Chart.register(...registerables)

export type ChartRangeUi = 'week7' | 'month30' | 'month90' | 'all' | 'custom'

type BandCfg = { maxData: number[]; minData: number[]; color: string; hidden: boolean }

let bandsConfig: BandCfg[] | null = null

const rangeBandPlugin = {
  id: 'rangeBands',
  afterDatasetsDraw(chart: Chart) {
    if (!bandsConfig) return
    const { ctx, chartArea, scales } = chart
    if (!chartArea) return

    const sysIdx = chart.data.datasets.findIndex((d) => d.label === '收缩压')
    if (sysIdx < 0) return
    const meta = chart.getDatasetMeta(sysIdx)

    ctx.save()
    ctx.beginPath()
    ctx.rect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top)
    ctx.clip()

    const yScale = scales['y']
    if (!yScale) {
      ctx.restore()
      return
    }

    bandsConfig.forEach(({ maxData, minData, color, hidden }) => {
      if (hidden) return
      const n = Math.min(maxData.length, minData.length, meta.data.length)
      if (n < 2) return

      ctx.beginPath()
      ctx.fillStyle = color

      for (let i = 0; i < n; i++) {
        const x = meta.data[i]!.x
        const y = yScale.getPixelForValue(maxData[i]!)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      for (let i = n - 1; i >= 0; i--) {
        ctx.lineTo(meta.data[i]!.x, yScale.getPixelForValue(minData[i]!))
      }

      ctx.closePath()
      ctx.fill()
    })

    ctx.restore()
  },
}

export function rangeTitle(range: ChartRangeUi) {
  const map: Record<ChartRangeUi, string> = {
    week7: '近 7 天',
    month30: '近 30 天',
    month90: '近 90 天',
    all: '全部记录',
    custom: '自选区间',
  }
  return map[range] || '统计'
}

function p(n: number) {
  return String(n).padStart(2, '0')
}

function fmtRaw(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function fmtDay(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

type BuiltData = {
  labels: string[]
  sys: (number | null)[]
  dia: (number | null)[]
  pulse: (number | null)[]
  counts?: number[]
  sysMax?: number[]
  sysMin?: number[]
  diaMax?: number[]
  diaMin?: number[]
}

function buildRawData(sorted: BpRecord[]): BuiltData {
  return {
    labels: sorted.map((r) => fmtRaw(r.time)),
    sys: sorted.map((r) => r.sys),
    dia: sorted.map((r) => r.dia),
    pulse: sorted.map((r) => r.pulse),
    counts: sorted.map(() => 1),
  }
}

function buildDailyData(sorted: BpRecord[]): BuiltData {
  const map: Record<string, { sys: number[]; dia: number[]; pulse: number[] }> = {}
  sorted.forEach((r) => {
    const day = r.time.slice(0, 10)
    if (!map[day]) map[day] = { sys: [], dia: [], pulse: [] }
    map[day]!.sys.push(r.sys)
    map[day]!.dia.push(r.dia)
    if (r.pulse) map[day]!.pulse.push(r.pulse)
  })

  const days = Object.keys(map).sort()
  const avg = (a: number[]) => Math.round(a.reduce((s, v) => s + v, 0) / a.length)

  return {
    labels: days.map(fmtDay),
    sys: days.map((d) => avg(map[d]!.sys)),
    sysMax: days.map((d) => Math.max(...map[d]!.sys)),
    sysMin: days.map((d) => Math.min(...map[d]!.sys)),
    dia: days.map((d) => avg(map[d]!.dia)),
    diaMax: days.map((d) => Math.max(...map[d]!.dia)),
    diaMin: days.map((d) => Math.min(...map[d]!.dia)),
    pulse: days.map((d) => (map[d]!.pulse.length ? avg(map[d]!.pulse) : null)),
    counts: days.map((d) => map[d]!.sys.length),
  }
}

export type TrendChartApi = {
  destroy: () => void
  toggleSeries: (name: 'sys' | 'dia' | 'pulse') => boolean
  getHidden: () => { sys: boolean; dia: boolean; pulse: boolean }
}

export function mountTrendChart(
  canvas: HTMLCanvasElement,
  scrollWrap: HTMLElement | null,
  scrollInner: HTMLElement | null,
  records: BpRecord[],
  range: ChartRangeUi
): TrendChartApi {
  const sorted = [...records].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
  const isRaw = range === 'week7'
  const data = isRaw ? buildRawData(sorted) : buildDailyData(sorted)

  if (scrollWrap && scrollInner) {
    const containerW = scrollWrap.offsetWidth
    if (containerW > 0) {
      const ptW = isRaw ? 30 : 34
      const minW = Math.max(containerW, data.labels.length * ptW)
      scrollInner.style.width = `${minW}px`
    } else {
      scrollInner.style.width = ''
    }
  }

  bandsConfig = isRaw
    ? null
    : [
        { maxData: data.sysMax!, minData: data.sysMin!, color: 'rgba(182,23,30,0.14)', hidden: false },
        { maxData: data.diaMax!, minData: data.diaMin!, color: 'rgba(0,88,188,0.12)', hidden: false },
      ]

  const config: ChartConfiguration<'line'> = {
    type: 'line',
    plugins: [rangeBandPlugin],
    data: {
      labels: data.labels,
      datasets: [
        {
          label: '收缩压',
          data: data.sys,
          borderColor: '#b6171e',
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointRadius: isRaw ? 4 : 3,
          pointHoverRadius: 6,
          tension: 0.3,
          fill: false,
        },
        {
          label: '舒张压',
          data: data.dia,
          borderColor: '#0058bc',
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointRadius: isRaw ? 4 : 3,
          pointHoverRadius: 6,
          tension: 0.3,
          fill: false,
        },
        {
          label: '心率',
          data: data.pulse,
          borderColor: '#1b6d24',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: isRaw ? 3 : 2,
          pointHoverRadius: 5,
          tension: 0.3,
          fill: false,
          spanGaps: true,
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
            title: (items) => {
              const label = items[0]?.label || ''
              const cnt = data.counts?.[items[0]?.dataIndex ?? 0]
              return cnt != null && cnt > 1 ? `${label}（${cnt}次均值）` : label
            },
            label: (ctx) => {
              if (ctx.parsed.y == null) return ''
              const u = ctx.dataset.label === '心率' ? '次/分' : 'mmHg'
              return ` ${ctx.dataset.label}: ${ctx.parsed.y} ${u}`
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            maxTicksLimit: Math.min(data.labels.length, 12),
            font: { size: 10, family: 'Inter' },
            color: '#6b7280',
          },
          grid: { color: 'rgba(25,28,30,0.06)' },
        },
        y: {
          min: 50,
          max: 200,
          ticks: { font: { size: 10, family: 'Inter' }, color: '#6b7280' },
          grid: { color: 'rgba(25,28,30,0.06)' },
        },
      },
    },
  }

  const trendChart = new Chart(canvas, config)

  const labelMap: Record<'sys' | 'dia' | 'pulse', string> = {
    sys: '收缩压',
    dia: '舒张压',
    pulse: '心率',
  }

  function toggleSeries(name: 'sys' | 'dia' | 'pulse') {
    const ds = trendChart.data.datasets.find((d) => d.label === labelMap[name])
    if (!ds) return false
    ds.hidden = !ds.hidden
    const nowHidden = !!ds.hidden
    if (bandsConfig) {
      if (name === 'sys') bandsConfig[0]!.hidden = nowHidden
      if (name === 'dia') bandsConfig[1]!.hidden = nowHidden
    }
    trendChart.update()
    return nowHidden
  }

  function getHidden() {
    const find = (lab: string) => !!trendChart.data.datasets.find((d) => d.label === lab)?.hidden
    return {
      sys: find('收缩压'),
      dia: find('舒张压'),
      pulse: find('心率'),
    }
  }

  return {
    destroy() {
      trendChart.destroy()
      bandsConfig = null
    },
    toggleSeries,
    getHidden,
  }
}
