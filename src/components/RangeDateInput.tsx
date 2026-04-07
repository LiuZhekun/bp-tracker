import { useEffect, useRef } from 'react'
import flatpickr from 'flatpickr'
import { Mandarin } from 'flatpickr/dist/l10n/zh.js'
import 'flatpickr/dist/flatpickr.min.css'

type Props = {
  placeholder: string
  onRangeChange: (start: string, end: string) => void
  className?: string
  /** 递增以触发清空 */
  clearToken?: number
}

function formatYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function RangeDateInput({ placeholder, onRangeChange, className, clearToken }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const fpRef = useRef<flatpickr.Instance | null>(null)
  const cbRef = useRef(onRangeChange)
  cbRef.current = onRangeChange

  useEffect(() => {
    const el = inputRef.current
    if (!el) return

    const fp = flatpickr(el, {
      locale: Mandarin,
      mode: 'range',
      dateFormat: 'Y-m-d',
      allowInput: false,
      disableMobile: true,
      appendTo: document.body,
      onChange(selectedDates) {
        if (!selectedDates.length) {
          cbRef.current('', '')
        } else if (selectedDates.length === 1) {
          const v = formatYMD(selectedDates[0]!)
          cbRef.current(v, v)
        } else {
          const t0 = selectedDates[0]!.getTime()
          const t1 = selectedDates[1]!.getTime()
          const lo = t0 <= t1 ? selectedDates[0]! : selectedDates[1]!
          const hi = t0 <= t1 ? selectedDates[1]! : selectedDates[0]!
          cbRef.current(formatYMD(lo), formatYMD(hi))
        }
      },
    })
    fpRef.current = fp
    return () => {
      fp.destroy()
      fpRef.current = null
    }
  }, [])

  useEffect(() => {
    if (clearToken !== undefined && clearToken > 0 && fpRef.current) {
      fpRef.current.clear()
    }
  }, [clearToken])

  return (
    <input
      ref={inputRef}
      type="text"
      className={className ?? 'date-range-input'}
      placeholder={placeholder}
      readOnly
      autoComplete="off"
      inputMode="none"
    />
  )
}
