import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { bpTag, fmtDateTimeParts } from '../../utils/bp'
import { parseCSV } from '../../utils/csv'
import { Storage } from '../../lib/storage'
import { RangeDateInput } from '../../components/RangeDateInput'

type Props = {
  refreshTick: number
  onRefresh: () => void
  showToast: (msg: string) => void
  onRequestDelete: (id: string) => void
}

export function HistoryPage({ refreshTick, onRefresh, showToast, onRequestDelete }: Props) {
  void refreshTick
  const [histStart, setHistStart] = useState('')
  const [histEnd, setHistEnd] = useState('')
  const [clearToken, setClearToken] = useState(0)

  const onHistRangeChange = useCallback((s: string, e: string) => {
    setHistStart(s)
    setHistEnd(e)
  }, [])

  const records = useMemo(() => {
    return histStart || histEnd ? Storage.getByDateRange(histStart, histEnd) : Storage.getAll()
  }, [refreshTick, histStart, histEnd])

  const filtered = !!(histStart || histEnd)

  const importRef = useRef<HTMLInputElement>(null)

  const onExport = () => {
    showToast(Storage.exportCSV() ? '✅ 已导出 CSV' : '⚠️ 暂无数据')
  }

  const onImportClick = () => importRef.current?.click()

  const onImport: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const rows = parseCSV(text)
      if (!rows.length) {
        showToast('⚠️ 未找到有效数据')
        return
      }
      const { added, updated } = Storage.importRecords(rows)
      showToast(`✅ 新增 ${added} 条，更新 ${updated} 条`)
      onRefresh()
    } catch {
      showToast('⚠️ 文件读取失败')
    } finally {
      e.target.value = ''
    }
  }

  const clearFilter = () => {
    setHistStart('')
    setHistEnd('')
    setClearToken((x) => x + 1)
  }

  return (
    <>
      <div className="history-screen-head">
        <div className="history-screen-head__text">
          <h2 className="history-screen-head__title">历史记录</h2>
          <p className="history-screen-head__sub">过往测量</p>
        </div>
        <div className="history-screen-head__actions">
          <input ref={importRef} type="file" id="import-input" accept=".csv" hidden onChange={onImport} />
          <button type="button" id="export-btn" className="history-export-btn" title="导出 CSV" onClick={onExport}>
            <span className="material-symbols-outlined">ios_share</span>
            导出
          </button>
          <button type="button" id="import-btn" className="history-import-icon" title="导入 CSV" aria-label="导入" onClick={onImportClick}>
            <span className="material-symbols-outlined">publish</span>
          </button>
        </div>
      </div>
      <main className="page-main history-page-main">
        <div className="history-filter card card--inset">
          <span className="filter-label">
            <span className="material-symbols-outlined filter-label__icon">calendar_month</span>
            时间筛选
          </span>
          <RangeDateInput
            placeholder="选择日期范围"
            onRangeChange={onHistRangeChange}
            className="date-range-input"
            clearToken={clearToken}
          />
          <button
            type="button"
            id="hist-filter-clear"
            className={'filter-clear' + (histStart || histEnd ? '' : ' hidden')}
            aria-label="清除筛选"
            onClick={clearFilter}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="history-list-scroll">
          <div id="record-list" className="record-list">
            {records.map((r) => (
              <RecordRow key={r.id} record={r} onChange={onRefresh} onRequestDelete={() => onRequestDelete(r.id)} />
            ))}
          </div>
          <p id="hist-list-footer" className={'hist-list-footer' + (records.length ? '' : ' hidden')}>
            {filtered ? `当前为日期筛选结果 · 共 ${records.length} 条` : `共 ${records.length} 条记录`}
          </p>
          <div id="no-data-history" className={'empty-state' + (records.length ? ' hidden' : '')}>
            <span className="empty-state__icon material-symbols-outlined">assignment</span>
            <p className="empty-state__title">暂无记录</p>
            <p className="empty-sub">请先在录入页添加记录</p>
          </div>
        </div>
      </main>
    </>
  )
}

function RecordRow({
  record: r,
  onChange,
  onRequestDelete,
}: {
  record: import('../../lib/storage').BpRecord
  onChange: () => void
  onRequestDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState(r.note || '')
  useEffect(() => {
    setNote(r.note || '')
  }, [r.id, r.note])

  const tag = bpTag(r.sys, r.dia)
  const { dateStr, timeStr } = fmtDateTimeParts(r.time)
  const metaAlert = tag.cls === 'tag-high' || tag.cls === 'tag-warn'

  return (
    <div className="record-item" data-id={r.id}>
      <div className="record-row-main record-row-main--ref">
        <div className="record-block-bp">
          <div className="record-bp-one-line">
            <span className="record-bp-sys">{r.sys}</span>
            <span className="record-bp-slash">/</span>
            <span className="record-bp-dia">{r.dia}</span>
          </div>
          <span className={`r-tag ${tag.cls}`}>{tag.label}</span>
        </div>
        <div className="record-vsep" aria-hidden="true"></div>
        <div className="record-meta-block">
          <div className={'record-meta-line' + (metaAlert ? ' record-meta-line--alert' : '')}>
            <span className="material-symbols-outlined record-meta-line__icon">calendar_today</span>
            {dateStr}
          </div>
          <div className="record-meta-line">
            <span className="material-symbols-outlined record-meta-line__icon">schedule</span>
            {timeStr}
          </div>
          {r.pulse ? (
            <div className="record-meta-line record-meta-line--pulse">
              <span className="material-symbols-outlined record-meta-line__icon">favorite</span>
              {r.pulse} 次/分
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="r-del r-del--icon"
          data-id={r.id}
          aria-label="删除"
          onClick={onRequestDelete}
        >
          <span className="material-symbols-outlined">delete</span>
        </button>
      </div>
      <div className="r-note-area">
        {!editing && r.note ? (
          <div className="r-note-static">
            <span className="r-note-text">{r.note}</span>
            <button type="button" className="r-note-edit-btn" aria-label="编辑备注" onClick={() => setEditing(true)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </div>
        ) : null}
        {!editing && !r.note ? (
          <button type="button" className="r-note-add-btn" onClick={() => setEditing(true)}>
            ＋ 添加备注
          </button>
        ) : null}
        <input
          type="text"
          className={'r-note-input' + (editing ? '' : ' hidden')}
          data-id={r.id}
          value={note}
          placeholder="添加备注…"
          maxLength={30}
          autoComplete="off"
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            setEditing(false)
            const v = note.trim()
            setNote(v)
            Storage.updateNote(r.id, v)
            onChange()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            }
          }}
        />
      </div>
    </div>
  )
}
