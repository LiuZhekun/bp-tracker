/** 中文数字 → 阿拉伯数字 */
export function cnToNum(text: string) {
  const N: Record<string, number> = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
  const U: Record<string, number> = { 十: 10, 百: 100 }
  return text.replace(/[一二三四五六七八九零十百]+/g, (m) => {
    let r = 0
    let cur = 0
    for (const c of m) {
      if (c in N) {
        cur = N[c]!
      } else if (c in U) {
        r += (cur || (U[c] === 10 ? 1 : 0)) * U[c]!
        cur = 0
      }
    }
    return String(r + cur)
  })
}

export type ParsedVoice = { sys: number; dia: number; pulse: number | null }

export function parseSpeech(text: string): ParsedVoice | null {
  const s = cnToNum(text)

  const sysM = s.match(/(?:高压|收缩压|上压)\D*?(\d{2,3})/)
  const diaM = s.match(/(?:低压|舒张压|下压)\D*?(\d{2,3})/)
  const pulseM = s.match(/(?:心率|脉搏|脉)\D*?(\d{2,3})/)

  let sys = sysM ? +sysM[1]! : null
  let dia = diaM ? +diaM[1]! : null
  let pulse = pulseM ? +pulseM[1]! : null

  if (!sys || !dia) {
    const nums = [...s.matchAll(/\d{2,3}/g)].map((m) => +m[0]!)
    const sArr = nums.filter((n) => n >= 90 && n <= 210)
    const dArr = nums.filter((n) => n >= 50 && n <= 130)
    const pArr = nums.filter((n) => n >= 45 && n <= 130)
    if (!sys && sArr.length) sys = sArr[0]!
    if (!dia && dArr.length) dia = dArr.find((n) => n !== sys) ?? null
    if (!pulse && pArr.length) pulse = pArr.find((n) => n !== sys && n !== dia) ?? null
  }

  if (sys && dia && sys > dia && sys >= 90 && dia >= 50) {
    return { sys, dia, pulse }
  }
  return null
}
