import { bpTag, formatYMD, p } from '../../utils/bp'
import { Storage } from '../../lib/storage'

type Props = {
  refreshTick: number
}

export function HomePage({ refreshTick }: Props) {
  void refreshTick
  const all = Storage.getAll()
  const empty = !all.length

  if (empty) {
    return (
      <main className="page-main page-main--home">
        <div id="home-empty" className="home-empty card card--elevated">
          <span className="material-symbols-outlined home-empty__icon">favorite</span>
          <p className="home-empty__title">还没有测量记录</p>
          <p className="home-empty__sub">点击下方按钮开始第一次录入</p>
        </div>
      </main>
    )
  }

  const latest = all[0]!
  const week = Storage.getByRange('week7')
  const st = Storage.calcStats(week)
  const ymd = formatYMD(new Date())
  const todayN = all.filter((r) => r.time.slice(0, 10) === ymd).length

  const d = new Date(latest.time)
  const nowDay = new Date()
  const isToday = formatYMD(d) === formatYMD(nowDay)
  const timeLabel = isToday
    ? `今天，${p(d.getHours())}:${p(d.getMinutes())}`
    : `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`

  const tag = bpTag(latest.sys, latest.dia)
  const ok = tag.cls === 'tag-normal' || tag.cls === 'tag-low'
  const icon = ok ? 'check_circle' : tag.cls === 'tag-high' ? 'warning' : 'error'

  return (
    <main className="page-main page-main--home">
      <div id="home-main" className="home-main">
          <section className="home-section">
            <h2 className="home-section__label">最近读数</h2>
            <div className="home-latest">
              <div className="home-latest__glow" aria-hidden="true"></div>
              <div className="home-latest__inner">
                <div className="home-latest__main-col">
                  <div className="home-latest__bp-row">
                    <div className="home-latest__col">
                      <span className="home-latest__label">收缩压（高压）</span>
                      <div className="home-latest__value-row">
                        <span id="home-sys" className="home-latest__num">
                          {latest.sys}
                        </span>
                        <span className="home-latest__unit">mmHg</span>
                      </div>
                    </div>
                    <div className="home-latest__vsep" aria-hidden="true"></div>
                    <div className="home-latest__col">
                      <span className="home-latest__label">舒张压（低压）</span>
                      <div className="home-latest__value-row">
                        <span id="home-dia" className="home-latest__num">
                          {latest.dia}
                        </span>
                        <span className="home-latest__unit">mmHg</span>
                      </div>
                    </div>
                  </div>
                  <p id="home-latest-time" className="home-latest__time">
                    {timeLabel}
                  </p>
                </div>
                <div className="home-latest__aside">
                  <div id="home-status-badge" className={`home-status-badge ${tag.cls}`}>
                    <span className="material-symbols-outlined home-status-badge__icon">{icon}</span>
                    <span>{tag.label}</span>
                  </div>
                  <div className={'home-pulse-row' + (latest.pulse ? '' : ' hidden')}>
                    <span className="material-symbols-outlined home-pulse-row__icon">favorite</span>
                    <span id="home-pulse" className="home-pulse-row__num">
                      {latest.pulse ?? '—'}
                    </span>
                    <span className="home-pulse-row__unit">BPM</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="home-stats-block">
            <div className="home-stats-row">
              <div className="home-stat-card home-stat-card--avg">
                <p className="home-stat-card__title">周期平均</p>
                <div className="home-stat-card__split">
                  <div className="home-stat-card__split-left">
                    <span className="home-stat-card__hint">近 7 天 · 收缩/舒张</span>
                    <p id="home-avg-bp" className="home-stat-card__main">
                      {st ? (
                        <>
                          {st.avgSys}
                          <span className="home-stat-slash">/</span>
                          {st.avgDia}
                          <span className="home-stat-card__unit-inline"> mmHg</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </p>
                  </div>
                  <div className={'home-stat-card__split-right' + (st?.avgPulse ? '' : ' hidden')}>
                    <span className="home-stat-card__hint home-stat-card__hint--right">心率</span>
                    <p className="home-stat-card__pulse-line">
                      <span className="material-symbols-outlined home-stat-card__heart">favorite</span>
                      <span id="home-avg-pulse" className="home-stat-card__pulse-num">
                        {st?.avgPulse ?? '—'}
                      </span>
                      <span className="home-stat-card__pulse-unit">次/分</span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="home-stat-card home-stat-card--entries">
                <p className="home-stat-card__title">今日录入</p>
                <p id="home-today-count" className="home-stat-card__entries-val">
                  <span id="home-today-num">{todayN}</span>
                  <span className="home-stat-card__entries-suffix"> 次</span>
                </p>
              </div>
            </div>

            <div className="home-ritual">
              <div className="home-ritual__icon-wrap">
                <span className="material-symbols-outlined">lightbulb</span>
              </div>
              <div className="home-ritual__copy">
                <p className="home-ritual__title">晨间小习惯</p>
                <p className="home-ritual__text">测量前安静休息约 5 分钟，数值更稳定、更有参考价值。</p>
              </div>
            </div>
          </section>
        </div>
    </main>
  )
}
