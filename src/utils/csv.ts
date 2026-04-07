export type CsvRow = { time: string; sys: string; dia: string; pulse: string; note: string }

export function parseCSV(text: string): CsvRow[] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim())
  if (lines.length < 2) return []

  return lines
    .slice(1)
    .map((line) => {
      const fields = splitCSVLine(line)
      return {
        time: fields[0] || '',
        sys: fields[1] || '',
        dia: fields[2] || '',
        pulse: fields[3] || '',
        note: fields[4] || '',
      }
    })
    .filter((r) => r.time && r.sys && r.dia)
}

function splitCSVLine(line: string) {
  const fields: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') inQ = false
      else cur += c
    } else {
      if (c === '"') inQ = true
      else if (c === ',') {
        fields.push(cur.trim())
        cur = ''
      } else cur += c
    }
  }
  fields.push(cur.trim())
  return fields
}
