/** 血压分级（参考中国高血压指南，与统计分布、达标率同源） */

export type BpDistBucket = 'low' | 'normal' | 'elevated' | 'high1' | 'high2'

/** 单条记录归入分布桶（与 Storage.calcDistribution 逻辑一致，唯一数据源） */
export function classifyBpDistribution(sys: number, dia: number): BpDistBucket {
  if (sys < 90 || dia < 60) return 'low'
  if (sys < 130 && dia < 85) return 'normal'
  if (sys < 140 && dia < 90) return 'elevated'
  if (sys < 160 && dia < 100) return 'high1'
  return 'high2'
}

/** 统计页「血压分布」图例顺序与展示字段 */
export const BP_DIST_UI_ORDER: {
  key: BpDistBucket
  label: string
  sub: string
  cls: string
}[] = [
  { key: 'normal', label: '正常', sub: '理想', cls: 'dist-green' },
  { key: 'elevated', label: '正常高值', sub: '轻度', cls: 'dist-yellow' },
  { key: 'high1', label: '1级高血压', sub: '关注', cls: 'dist-orange' },
  { key: 'high2', label: '2级以上', sub: '注意', cls: 'dist-red' },
  { key: 'low', label: '偏低', sub: '观察', cls: 'dist-blue' },
]

/** 首页/历史列表简显：与分布分级同源 */
export function bpTag(sys: number, dia: number) {
  const b = classifyBpDistribution(sys, dia)
  if (b === 'low') return { cls: 'tag-low', label: '偏低' }
  if (b === 'normal') return { cls: 'tag-normal', label: '正常' }
  if (b === 'elevated') return { cls: 'tag-warn', label: '正常高值' }
  return { cls: 'tag-high', label: '高血压' }
}

/** 详细分级（图表洞察等） */
export function bpLevel(sys: number, dia: number) {
  const b = classifyBpDistribution(sys, dia)
  const map: Record<BpDistBucket, { label: string; cls: string }> = {
    low: { label: '偏低', cls: 'tag-blue' },
    normal: { label: '正常', cls: 'tag-green' },
    elevated: { label: '正常高值', cls: 'tag-yellow' },
    high1: { label: '1级高血压', cls: 'tag-orange' },
    high2: { label: '2级以上', cls: 'tag-red' },
  }
  return map[b]
}

export function p(n: number) {
  return String(n).padStart(2, '0')
}

export function formatYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function fmtDateTimeParts(iso: string) {
  const d = new Date(iso)
  return {
    dateStr: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    timeStr: `${p(d.getHours())}:${p(d.getMinutes())}`,
  }
}

export function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export function escAttr(s: string) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function nowLocalISO() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
