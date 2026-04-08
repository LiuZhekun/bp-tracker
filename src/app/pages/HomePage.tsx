import { bpTag, formatYMD, p } from '../../utils/bp'
import type { BpRecord } from '../../lib/storage'
import { Storage } from '../../lib/storage'

type Props = {
  refreshTick: number
  onOpenRecord: () => void
  onOpenHistory: () => void
}

function filterLast24h(records: BpRecord[]) {
  const since = Date.now() - 24 * 60 * 60 * 1000
  return records.filter((r) => new Date(r.time).getTime() >= since)
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return '早上好'
  if (h < 18) return '下午好'
  return '晚上好'
}

function formatTimeLabel(d: Date, isToday: boolean) {
  return isToday
    ? `今天，${p(d.getHours())}:${p(d.getMinutes())}`
    : `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** ui参考/首页记录页/stitch/_1 — 今日已测量 */
function HomeMeasuredToday({
  latestToday,
  st24,
  todayN,
}: {
  latestToday: BpRecord
  st24: ReturnType<typeof Storage.calcStats>
  todayN: number
}) {
  const tag = bpTag(latestToday.sys, latestToday.dia)
  return (
    <div className="home-ref-measured">
      <section className="home-hero-today" aria-label="今日测量概要">
        <div className="home-hero-today__watermark" aria-hidden="true">
          <span className="material-symbols-outlined">check_circle</span>
        </div>
        <div className="home-hero-today__badge-row">
          <span className="material-symbols-outlined home-hero-today__verified" style={{ fontVariationSettings: "'FILL' 1" }}>
            verified
          </span>
          <span className="home-hero-today__label">今日已测量</span>
        </div>
        <div className="home-hero-today__bp-block">
          <div className="home-hero-today__bp">
            {latestToday.sys}/{latestToday.dia}
          </div>
          <span className="home-hero-today__unit">mmHg</span>
        </div>
        <div className="home-hero-today__level">{tag.label}</div>
      </section>

      <div className="home-bento-grid">
        <div className="home-bento-cell">
          <div className="home-bento-cell__head">
            <span className="material-symbols-outlined">analytics</span>
            <span>平均值</span>
          </div>
          <div>
            <p className="home-bento-cell__main">
              {st24 ? (
                <>
                  {st24.avgSys}/{st24.avgDia}
                </>
              ) : (
                '—'
              )}
            </p>
            <p className="home-bento-cell__sub">近 24 小时</p>
          </div>
        </div>
        <div className="home-bento-cell">
          <div className="home-bento-cell__head">
            <span className="material-symbols-outlined">format_list_numbered</span>
            <span>记录次数</span>
          </div>
          <div>
            <p className="home-bento-cell__main">{todayN}</p>
            <p className="home-bento-cell__sub">今日记录</p>
          </div>
        </div>
      </div>

      <section className="home-ritual-ref">
        <div className="home-ritual-ref__icon">
          <span className="material-symbols-outlined">lightbulb</span>
        </div>
        <div className="home-ritual-ref__copy">
          <h3 className="home-ritual-ref__title">晨间习惯</h3>
          <p className="home-ritual-ref__text">
            测量前请安静休息约 5 分钟，手臂与心脏同高、双脚平放，早晨读数更准确。
          </p>
        </div>
      </section>
    </div>
  )
}

/** ui参考/首页记录页/stitch/_2 — 今日未测量 */
function HomeNotMeasuredToday({
  latest,
  onOpenRecord,
  onOpenHistory,
}: {
  latest: BpRecord | undefined
  onOpenRecord: () => void
  onOpenHistory: () => void
}) {
  const ymd = formatYMD(new Date())
  const lastTag = latest ? bpTag(latest.sys, latest.dia) : null
  const lastTime =
    latest &&
    formatTimeLabel(new Date(latest.time), formatYMD(new Date(latest.time)) === ymd)

  return (
    <div className="home-ref-notoday">
      <header className="home-wellness-head">
        <p className="home-wellness-head__greet">{greeting()}</p>
        <h2 className="home-wellness-head__title">每日健康打卡</h2>
      </header>

      <div className="home-ref-notoday__stack">
        <div className="home-alert-today">
          <div className="home-alert-today__glow" aria-hidden="true"></div>
          <span className="material-symbols-outlined home-alert-today__icon">warning</span>
          <h3 className="home-alert-today__title">今日尚未测量</h3>
          <p className="home-alert-today__sub">关爱心脏健康，现在就测一次吧。</p>
          <button type="button" className="home-alert-today__mic" aria-label="语音录入" onClick={onOpenRecord}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              mic
            </span>
          </button>
          <p className="home-alert-today__mic-hint">点击语音录入</p>
        </div>

        <div className="home-last-reading">
          <div className="home-last-reading__top">
            <span className="home-last-reading__label">
              <span className="material-symbols-outlined">history</span>
              上次读数
            </span>
            {lastTag ? <span className={`home-last-reading__pill ${lastTag.cls}`}>{lastTag.label}</span> : null}
          </div>
          {latest ? (
            <>
              <div className="home-last-reading__bp-row">
                <div className="home-last-reading__col">
                  <span className="home-last-reading__nums">
                    {latest.sys}/{latest.dia}
                  </span>
                  <span className="home-last-reading__meta">mmHg · 血压</span>
                </div>
                <div className="home-last-reading__vsep" aria-hidden="true"></div>
                <div className="home-last-reading__col">
                  <span className="home-last-reading__nums home-last-reading__nums--pulse">
                    {latest.pulse ?? '—'}
                  </span>
                  <span className="home-last-reading__meta">BPM · 心率</span>
                </div>
              </div>
              <div className="home-last-reading__footer">
                <span className="home-last-reading__time">{lastTime}</span>
                <button type="button" className="home-last-reading__link" onClick={onOpenHistory}>
                  查看详情
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
            </>
          ) : (
            <p className="home-last-reading__empty">暂无记录，请先录入一次血压。</p>
          )}
        </div>
      </div>
    </div>
  )
}

export function HomePage({ refreshTick, onOpenRecord, onOpenHistory }: Props) {
  void refreshTick
  const all = Storage.getAll()
  const ymd = formatYMD(new Date())
  const todayRecords = all.filter((r) => r.time.slice(0, 10) === ymd)
  const latestToday = todayRecords[0]
  const todayN = todayRecords.length
  const st24 = Storage.calcStats(filterLast24h(all))

  if (latestToday) {
    return (
      <main className="page-main page-main--home">
        <HomeMeasuredToday latestToday={latestToday} st24={st24} todayN={todayN} />
      </main>
    )
  }

  return (
    <main className="page-main page-main--home">
      <HomeNotMeasuredToday latest={all[0]} onOpenRecord={onOpenRecord} onOpenHistory={onOpenHistory} />
    </main>
  )
}
