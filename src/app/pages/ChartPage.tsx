import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { mountTrendChart, rangeTitle, type ChartRangeUi, type TrendChartApi } from '../../lib/trendChartEngine'
import { Storage, type BpRecord, type RangeKey } from '../../lib/storage'
import { BP_DIST_UI_ORDER, bpLevel } from '../../utils/bp'
import { RangeDateInput } from '../../components/RangeDateInput'

type Props = {
  refreshTick: number
}

export function ChartPage({ refreshTick }: Props) {
  void refreshTick
  const [currentRange, setCurrentRange] = useState<RangeKey | 'custom'>('week7')
  const [chartStart, setChartStart] = useState('')
  const [chartEnd, setChartEnd] = useState('')

  const onChartRangeChange = (s: string, e: string) => {
    setChartStart(s)
    setChartEnd(e)
  }

  const records = useMemo(() => {
    if (currentRange === 'custom') {
      return Storage.getByDateRange(chartStart, chartEnd)
    }
    return Storage.getByRange(currentRange)
  }, [refreshTick, currentRange, chartStart, chartEnd])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scrollWrapRef = useRef<HTMLDivElement>(null)
  const scrollInnerRef = useRef<HTMLDivElement>(null)
  const chartApiRef = useRef<TrendChartApi | null>(null)

  const [legendHidden, setLegendHidden] = useState({ sys: false, dia: false, pulse: false })

  const rangeUi: ChartRangeUi = currentRange === 'custom' ? 'custom' : (currentRange as ChartRangeUi)

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !records.length) {
      chartApiRef.current?.destroy()
      chartApiRef.current = null
      return
    }
    chartApiRef.current?.destroy()
    const api = mountTrendChart(
      canvas,
      scrollWrapRef.current,
      scrollInnerRef.current,
      records,
      rangeUi
    )
    chartApiRef.current = api
    setLegendHidden(api.getHidden())
    return () => {
      api.destroy()
      chartApiRef.current = null
    }
  }, [records, rangeUi])

  const hasData = records.length > 0
  const stats = hasData ? Storage.calcStats(records) : null
  const dist = hasData ? Storage.calcDistribution(records) : null

  const dateRangeLabel = useMemo(() => {
    if (!records.length) return ''
    const sorted = [...records].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    const first = sorted[0]!.time.slice(0, 10)
    const last = sorted[sorted.length - 1]!.time.slice(0, 10)
    const fmt = (dateStr: string) => {
      const d = new Date(dateStr + 'T12:00:00')
      return `${d.getMonth() + 1}/${d.getDate()}`
    }
    return first === last ? fmt(first) : `${fmt(first)} - ${fmt(last)}`
  }, [records])

  const isRaw = currentRange === 'week7'
  const improving = stats ? stats.targetRate >= 70 : false

  const weeklyChange = useMemo(() => {
    if (!records.length) return { icon: 'trending_flat', title: '周期对比', desc: '持续记录后，可对比本周与上周平均收缩压。' }
    const sorted = [...records].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    const now = Date.now()
    const ms = 86400000
    const cutoff = now - 7 * ms
    const prevCutoff = now - 14 * ms
    const thisWeek = sorted.filter((r) => new Date(r.time).getTime() >= cutoff)
    const prevWeek = sorted.filter((r) => {
      const t = new Date(r.time).getTime()
      return t >= prevCutoff && t < cutoff
    })
    const avgSys = (arr: BpRecord[]) =>
      arr.length ? Math.round(arr.reduce((s, r) => s + r.sys, 0) / arr.length) : null
    const aThis = avgSys(thisWeek)
    const aPrev = avgSys(prevWeek)
    let icon: string = 'trending_flat'
    let title = '周期对比'
    let desc = '持续记录后，可对比本周与上周平均收缩压。'
    if (thisWeek.length && prevWeek.length && aPrev != null && aThis != null && aPrev > 0) {
      const pct = Math.round((Math.abs(aThis - aPrev) / aPrev) * 100)
      const lower = aThis < aPrev
      icon = lower ? 'trending_down' : 'trending_up'
      title = lower ? `约 ${pct}% 更低` : `约 ${pct}% 更高`
      desc = lower
        ? '本周平均收缩压较上周有所降低，继续保持。'
        : '本周平均收缩压较上周偏高，注意放松与规律作息。'
    } else if (thisWeek.length && aThis != null) {
      title = '本周平均'
      desc = `收缩压约 ${aThis} mmHg，坚持测量更易发现规律。`
    }
    return { icon, title, desc }
  }, [records])

  const insightBody = useMemo(() => {
    if (!stats) return ''
    const level = bpLevel(stats.avgSys, stats.avgDia)
    if (level.cls === 'tag-red' || level.cls === 'tag-orange') {
      return '近期平均偏高，建议关注饮食与休息，必要时咨询医生。'
    }
    if (level.cls === 'tag-green') return '整体控制良好，继续保持测量习惯。'
    if (level.cls === 'tag-yellow') return '处于正常高值区间，可适当减少盐摄入并保持运动。'
    return '规律测量能帮助医生更了解您的血压变化。'
  }, [stats])

  const distItems = useMemo(() => {
    if (!dist || !records.length) return []
    const total = records.length
    return BP_DIST_UI_ORDER.map((def) => ({
      ...def,
      count: dist[def.key],
      pct: Math.round((dist[def.key] / total) * 100),
    }))
  }, [dist, records.length])

  const toggleLegend = (name: 'sys' | 'dia' | 'pulse') => {
    const api = chartApiRef.current
    if (!api) return
    api.toggleSeries(name)
    setLegendHidden(api.getHidden())
  }

  return (
    <main className="page-main page-main--trend">
      <div id="no-data-chart" className={'empty-state' + (hasData ? ' hidden' : '')}>
        <span className="empty-state__icon material-symbols-outlined">bar_chart</span>
        <p className="empty-state__title">暂无数据</p>
        <p className="empty-sub">请先在录入页添加记录</p>
      </div>

      <div id="chart-dashboard" className={'trend-dashboard' + (hasData ? '' : ' hidden')}>
        <header className="trend-page-head trend-page-head--hero">
          <div className="trend-page-head__left">
            <span className="trend-page-head__eyebrow">分析</span>
            <h2 className="trend-page-head__title">统计趋势</h2>
            <p id="chart-period-title" className="trend-page-head__sub">{rangeTitle(rangeUi)}</p>
          </div>
          <div
            id="chart-status-pill"
            className={'chart-status-pill' + (improving ? ' chart-status-pill--ok' : ' chart-status-pill--warn')}
            role="status"
          >
            {stats ? (
              improving ? (
                <>
                  <span className="material-symbols-outlined chart-status-pill__icon">check_circle</span>
                  <span className="chart-status-pill__text">整体向好</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined chart-status-pill__icon">info</span>
                  <span className="chart-status-pill__text">需关注</span>
                </>
              )
            ) : null}
          </div>
        </header>

        <div className="trend-range-wrap card card--inset" id="trend-range-control">
          <div className="range-pill-group" role="tablist" aria-label="周期选择">
            {(['week7', 'month30', 'month90', 'all', 'custom'] as const).map((r) => (
              <button
                key={r}
                type="button"
                className={'range-pill' + (currentRange === r ? ' active' : '')}
                onClick={() => setCurrentRange(r)}
              >
                {r === 'week7' ? '近7天' : r === 'month30' ? '近30天' : r === 'month90' ? '近90天' : r === 'all' ? '全部' : '自定义'}
              </button>
            ))}
          </div>
        </div>
        <div id="custom-range-panel" className={'custom-range-panel card' + (currentRange === 'custom' ? '' : ' hidden')}>
          <div className="form-row">
            <span className="form-label">时间范围</span>
            <RangeDateInput placeholder="请选择起止日期" onRangeChange={onChartRangeChange} className="date-range-input" />
          </div>
        </div>

        <div id="chart-section">
          <div className="card card--elevated trend-chart-card">
            <div className="trend-chart-card__top">
              <div className="trend-inline-legend" aria-hidden="true">
                <span className="til til-sys">
                  <i className="til-dot"></i>收缩压
                </span>
                <span className="til til-dia">
                  <i className="til-dot til-dot--dia"></i>舒张压
                </span>
                <span className="til til-pulse">
                  <i className="til-dot til-dot--pulse"></i>心率
                </span>
              </div>
              <span id="chart-date-range-label" className="chart-date-range-label">
                {dateRangeLabel}
              </span>
            </div>
            <p id="chart-hint" className="chart-hint">
              {isRaw ? '每个点代表一次测量' : '折线为每日均值，阴影为当日波动范围'}
            </p>
            <div id="chart-scroll-wrap" ref={scrollWrapRef} className="chart-scroll-wrap">
              <div id="chart-scroll-inner" ref={scrollInnerRef} className="chart-scroll-inner">
                <canvas id="bp-chart" ref={canvasRef}></canvas>
              </div>
            </div>
            <div className="chart-legend">
              <button
                type="button"
                className={'l-toggle l-sys' + (legendHidden.sys ? ' inactive' : '')}
                onClick={() => toggleLegend('sys')}
              >
                <span className="l-dot"></span>收缩压
              </button>
              <button
                type="button"
                className={'l-toggle l-dia' + (legendHidden.dia ? ' inactive' : '')}
                onClick={() => toggleLegend('dia')}
              >
                <span className="l-dot"></span>舒张压
              </button>
              <button
                type="button"
                className={'l-toggle l-pulse' + (legendHidden.pulse ? ' inactive' : '')}
                onClick={() => toggleLegend('pulse')}
              >
                <span className="l-dot"></span>心率
              </button>
            </div>
          </div>

          <div className="card card--tonal trend-avg-panel">
            <h3 className="trend-avg-panel__title">周期平均</h3>
            <p id="trend-avg-range-label" className="trend-avg-panel__sub">
              {rangeTitle(rangeUi)}
            </p>
            <div className="trend-avg-grid">
              <div className="trend-avg-cell">
                <span className="trend-avg-cell__label">收缩压</span>
                <span id="trend-avg-sys" className="trend-avg-cell__val trend-avg-cell__val--sys">
                  {stats ? stats.avgSys : '—'}
                </span>
                <span className="trend-avg-cell__unit">mmHg</span>
              </div>
              <div className="trend-avg-cell">
                <span className="trend-avg-cell__label">舒张压</span>
                <span id="trend-avg-dia" className="trend-avg-cell__val trend-avg-cell__val--dia">
                  {stats ? stats.avgDia : '—'}
                </span>
                <span className="trend-avg-cell__unit">mmHg</span>
              </div>
              <div className="trend-avg-cell">
                <span className="trend-avg-cell__label">心率</span>
                <span id="trend-avg-pulse" className="trend-avg-cell__val trend-avg-cell__val--pulse">
                  {stats?.avgPulse ? stats.avgPulse : '—'}
                </span>
                <span className="trend-avg-cell__unit">BPM</span>
              </div>
            </div>
          </div>

          <div className="trend-bento">
            <div className="card trend-week-card" id="trend-week-change-card">
              <div className="trend-week-card__inner">
                <div className="trend-week-card__icon-wrap">
                  <span className="material-symbols-outlined trend-week-card__icon">{weeklyChange.icon}</span>
                </div>
                <div className="trend-week-card__copy">
                  <p className="trend-week-card__label">周期变化</p>
                  <p className="trend-week-card__title">{weeklyChange.title}</p>
                </div>
              </div>
              <p className="trend-week-card__desc">{weeklyChange.desc}</p>
            </div>
            <div className="card card--elevated trend-dist-card">
              <p className="trend-dist-card__title">血压分布</p>
              <div className="trend-dist-stack" aria-hidden="true">
                {distItems
                  .filter((item) => item.count > 0)
                  .map((item) => (
                    <span
                      key={item.key}
                      className={`trend-dist-stack__seg ${item.cls}`}
                      style={{ width: `${Math.max(item.pct, 6)}%` }}
                    ></span>
                  ))}
              </div>
              <div id="dist-bars" className="trend-dist-legend">
                {distItems
                  .filter((item) => item.count > 0)
                  .map((item) => (
                    <div key={item.key} className="trend-dist-legend__row">
                      <div className="trend-dist-legend__left">
                        <i className={`trend-dist-legend__dot ${item.cls}`}></i>
                        <span className="trend-dist-legend__label">{item.label}</span>
                      </div>
                      <div className="trend-dist-legend__right">
                        <span className="trend-dist-legend__main">{item.count}次 ({item.pct}%)</span>
                        <span className="trend-dist-legend__sub">{item.sub}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="trend-insight card" id="trend-insight">
            <span className="material-symbols-outlined trend-insight__icon">medical_information</span>
            <div className="trend-insight__text">
              <h4 className="trend-insight__title">健康提示</h4>
              <p className="trend-insight__body">{insightBody}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
