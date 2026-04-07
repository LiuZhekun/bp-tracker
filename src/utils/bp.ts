/** 血压分级（参考中国高血压指南） */
export function bpTag(sys: number, dia: number) {
  if (sys < 90 || dia < 60) return { cls: 'tag-low', label: '偏低' }
  if (sys < 120 && dia < 80) return { cls: 'tag-normal', label: '正常' }
  if (sys < 140 && dia < 90) return { cls: 'tag-warn', label: '偏高' }
  return { cls: 'tag-high', label: '高血压' }
}

export function bpLevel(sys: number, dia: number) {
  if (sys < 90 || dia < 60) return { label: '偏低', cls: 'tag-blue' }
  if (sys < 130 && dia < 85) return { label: '正常', cls: 'tag-green' }
  if (sys < 140 && dia < 90) return { label: '正常高值', cls: 'tag-yellow' }
  if (sys < 160 && dia < 100) return { label: '1级高血压', cls: 'tag-orange' }
  return { label: '2级以上', cls: 'tag-red' }
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
