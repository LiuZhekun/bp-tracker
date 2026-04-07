/**
 * 血压数据本地存储 + 统计计算（由 js/storage.js 迁移）
 */

import { classifyBpDistribution } from '../utils/bp'

export type BpRecord = {
  id: string
  time: string
  sys: number
  dia: number
  pulse: number | null
  note: string
}

export type RangeKey = 'week7' | 'month30' | 'month90' | 'all'

const KEY = 'bp_records'
const KEY_MIRROR_JSON = 'bp_records_mirror'
const KEY_MIRROR_CSV = 'bp_records_export_mirror'

function buildCSVString(records: BpRecord[]) {
  if (!records.length) return '\uFEFF'
  const headers = ['时间', '收缩压(mmHg)', '舒张压(mmHg)', '心率(次/分)', '备注']
  const rows = records.map((r) => [r.time, r.sys, r.dia, r.pulse ?? '', r.note])
  return (
    '\uFEFF' +
    [headers, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  )
}

function writeAll(records: BpRecord[]) {
  const json = JSON.stringify(records)
  try {
    localStorage.setItem(KEY, json)
  } catch (e) {
    console.warn('[bp-tracker] 主库存储失败', e)
    throw e
  }
  try {
    localStorage.setItem(KEY_MIRROR_JSON, json)
  } catch (e) {
    console.warn('[bp-tracker] JSON 镜像写入失败（可能超出配额）', e)
  }
  try {
    localStorage.setItem(KEY_MIRROR_CSV, buildCSVString(records))
  } catch (e) {
    console.warn('[bp-tracker] CSV 镜像写入失败（可能超出配额）', e)
  }
}

function getAll(): BpRecord[] {
  const tryParse = (raw: string | null): BpRecord[] | null => {
    if (!raw) return null
    try {
      const arr = JSON.parse(raw) as unknown
      return Array.isArray(arr) ? (arr as BpRecord[]) : null
    } catch {
      return null
    }
  }

  try {
    const main = tryParse(localStorage.getItem(KEY))
    if (main) {
      if (!localStorage.getItem(KEY_MIRROR_JSON)) {
        try {
          localStorage.setItem(KEY_MIRROR_JSON, JSON.stringify(main))
          localStorage.setItem(KEY_MIRROR_CSV, buildCSVString(main))
        } catch {
          /* quota */
        }
      }
      return main
    }
  } catch {
    /* 主库损坏 */
  }

  try {
    const bak = tryParse(localStorage.getItem(KEY_MIRROR_JSON))
    if (bak) {
      try {
        localStorage.setItem(KEY, JSON.stringify(bak))
      } catch {
        /* */
      }
      return bak
    }
  } catch {
    /* */
  }

  return []
}

function save(record: { time: string; sys: number; dia: number; pulse: number | null; note: string }) {
  const records = getAll()
  const r: BpRecord = {
    id: Date.now().toString(),
    time: record.time,
    sys: Number(record.sys),
    dia: Number(record.dia),
    pulse: record.pulse ? Number(record.pulse) : null,
    note: record.note || '',
  }
  records.unshift(r)
  writeAll(records)
  return r
}

function remove(id: string) {
  writeAll(getAll().filter((r) => r.id !== id))
}

function updateNote(id: string, note: string) {
  const records = getAll()
  const i = records.findIndex((r) => r.id === id)
  if (i === -1) return false
  records[i] = { ...records[i], note: String(note || '').trim().slice(0, 30) }
  writeAll(records)
  return true
}

function getByRange(range: RangeKey): BpRecord[] {
  const all = getAll()
  const now = new Date()
  const daysAgo = (d: number) => {
    const c = new Date(now)
    c.setDate(c.getDate() - d)
    return c
  }
  if (range === 'week7') return all.filter((r) => new Date(r.time) >= daysAgo(7))
  if (range === 'month30') return all.filter((r) => new Date(r.time) >= daysAgo(30))
  if (range === 'month90') return all.filter((r) => new Date(r.time) >= daysAgo(90))
  return all
}

export type CalcStats = {
  count: number
  avgSys: number
  avgDia: number
  avgPulse: number | null
  maxSys: number
  minSys: number
  targetRate: number
  highCount: number
  pp: number
}

function calcStats(records: BpRecord[]): CalcStats | null {
  if (!records.length) return null
  const avg = (a: number[]) => Math.round(a.reduce((s, v) => s + v, 0) / a.length)

  const sysList = records.map((r) => r.sys)
  const diaList = records.map((r) => r.dia)
  const pulseList = records.filter((r) => r.pulse).map((r) => r.pulse as number)

  const avgSys = avg(sysList)
  const avgDia = avg(diaList)

  const targetCount = records.filter((r) => classifyBpDistribution(r.sys, r.dia) === 'normal').length
  const highCount = records.filter((r) => {
    const b = classifyBpDistribution(r.sys, r.dia)
    return b === 'high1' || b === 'high2'
  }).length

  return {
    count: records.length,
    avgSys,
    avgDia,
    avgPulse: pulseList.length ? avg(pulseList) : null,
    maxSys: Math.max(...sysList),
    minSys: Math.min(...sysList),
    targetRate: Math.round((targetCount / records.length) * 100),
    highCount,
    pp: avgSys - avgDia,
  }
}

export type Distribution = {
  low: number
  normal: number
  elevated: number
  high1: number
  high2: number
}

function calcDistribution(records: BpRecord[]): Distribution {
  const dist: Distribution = { low: 0, normal: 0, elevated: 0, high1: 0, high2: 0 }
  records.forEach((r) => {
    dist[classifyBpDistribution(r.sys, r.dia)]++
  })
  return dist
}

type ImportRow = { time: string; sys: string; dia: string; pulse: string; note: string }

function importRecords(incoming: ImportRow[]) {
  const existing = getAll()
  const byTime: Record<string, BpRecord> = {}
  existing.forEach((r) => {
    byTime[r.time] = r
  })

  let added = 0
  let updated = 0

  incoming.forEach((r) => {
    if (!r.time || !r.sys || !r.dia) return
    if (byTime[r.time]) {
      Object.assign(byTime[r.time], {
        sys: Number(r.sys),
        dia: Number(r.dia),
        pulse: r.pulse ? Number(r.pulse) : null,
        note: r.note || '',
      })
      updated++
    } else {
      byTime[r.time] = {
        id: String(Date.now()) + Math.random().toString(36).slice(2),
        time: r.time,
        sys: Number(r.sys),
        dia: Number(r.dia),
        pulse: r.pulse ? Number(r.pulse) : null,
        note: r.note || '',
      }
      added++
    }
  })

  const sorted = Object.values(byTime).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  writeAll(sorted)
  return { added, updated }
}

function exportCSV() {
  const records = getAll()
  if (!records.length) return false
  const csv = buildCSVString(records)
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = '血压记录.csv'
  a.click()
  URL.revokeObjectURL(url)
  return true
}

function localDayStart(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

function localDayEnd(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59, 999)
}

function getByDateRange(start: string, end: string): BpRecord[] {
  const all = getAll()
  const s = start ? localDayStart(start) : null
  const e = end ? localDayEnd(end) : null
  return all.filter((r) => {
    const t = new Date(r.time)
    if (s && t < s) return false
    if (e && t > e) return false
    return true
  })
}

export const Storage = {
  getAll,
  save,
  remove,
  updateNote,
  getByRange,
  getByDateRange,
  calcStats,
  calcDistribution,
  exportCSV,
  importRecords,
}
