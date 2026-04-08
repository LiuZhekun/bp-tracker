import { useCallback, useEffect, useRef, useState } from 'react'
import { nowLocalISO } from '../../utils/bp'
import { parseSpeech } from '../../utils/voice'
import { Storage } from '../../lib/storage'

type Props = {
  onSaved: () => void
  showToast: (msg: string) => void
  fabVoiceGen?: number
}

/** ui参考/首页记录页/stitch/_3 — 录入页布局 */
export function AddPage({ onSaved, showToast, fabVoiceGen = 0 }: Props) {
  const [sys, setSys] = useState('')
  const [dia, setDia] = useState('')
  const [pulse, setPulse] = useState('')
  const [note, setNote] = useState('')
  const [timeExpanded, setTimeExpanded] = useState(false)
  const [inputTime, setInputTime] = useState('')
  const timeUserEdited = useRef(false)

  const [voiceIdle, setVoiceIdle] = useState(true)
  const [interim, setInterim] = useState('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const voiceSupported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  const setDefaultTime = () => setInputTime(nowLocalISO())

  const toggleTimeInput = () => {
    if (!timeExpanded) {
      setTimeExpanded(true)
      if (!inputTime) setDefaultTime()
    } else {
      setTimeExpanded(false)
    }
  }

  const stopVoice = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        /* */
      }
      recognitionRef.current = null
    }
    setVoiceIdle(true)
  }, [])

  const startVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      showToast('⚠️ 请使用支持语音识别的浏览器')
      return
    }
    setVoiceIdle(false)
    setInterim('')
    const recognition = new SR()
    recognition.lang = 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const text = Array.from(e.results).map((r) => r[0].transcript).join('')
      setInterim(text)
      const last = e.results[e.results.length - 1]
      if (last?.isFinal) {
        const parsed = parseSpeech(text)
        stopVoice()
        if (parsed) {
          if (parsed.sys) setSys(String(parsed.sys))
          if (parsed.dia) setDia(String(parsed.dia))
          if (parsed.pulse) setPulse(String(parsed.pulse))
          showToast('✅ 识别成功，请确认数值')
        } else {
          showToast('⚠️ 未识别到血压数值，请重试或手动填写')
        }
      }
    }
    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      stopVoice()
      const map: Record<string, string> = { 'not-allowed': '请允许麦克风权限', 'no-speech': '未检测到声音' }
      showToast('⚠️ ' + (map[e.error] || '语音识别失败'))
    }
    recognition.onend = stopVoice
    recognition.start()
    recognitionRef.current = recognition
  }, [showToast, stopVoice])

  const lastFabGen = useRef(0)
  useEffect(() => {
    if (fabVoiceGen <= 0 || fabVoiceGen === lastFabGen.current) return
    lastFabGen.current = fabVoiceGen
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      showToast('当前浏览器不支持语音识别，请手动填写')
      return
    }
    requestAnimationFrame(() => startVoice())
  }, [fabVoiceGen, showToast, startVoice])

  const onSave = () => {
    const s = +sys
    const di = +dia
    const pu = pulse ? +pulse : null
    const n = note.trim()
    const time = timeUserEdited.current && inputTime ? inputTime : nowLocalISO()

    if (!s || !di) {
      showToast('⚠️ 请填写收缩压和舒张压')
      return
    }
    if (s <= di) {
      showToast('⚠️ 收缩压应大于舒张压')
      return
    }

    Storage.save({ sys: s, dia: di, pulse: pu, time, note: n })
    showToast('✅ 已保存')
    onSaved()
    setSys('')
    setDia('')
    setPulse('')
    setNote('')
    timeUserEdited.current = false
    setInputTime('')
    setTimeExpanded(false)
  }

  return (
    <main className="page-main page-main--record page-main--record-ref">
      <div className="record-ref-stack">
        {voiceSupported ? (
          <section className="record-ref-voice">
            {voiceIdle ? (
              <>
                <div className="record-ref-voice__head">
                  <h2 className="record-ref-voice__title">语音录入</h2>
                  <p className="record-ref-voice__sub">点击麦克风，试着说出血压数值</p>
                </div>
                <div className="record-ref-mic-wrap">
                  <div className="record-ref-pulse record-ref-pulse--outer" aria-hidden="true"></div>
                  <div className="record-ref-pulse record-ref-pulse--inner" aria-hidden="true"></div>
                  <button type="button" className="record-ref-mic-btn" aria-label="开始语音识别" onClick={startVoice}>
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                      mic
                    </span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="record-ref-voice__head">
                  <h2 className="record-ref-voice__title">正在聆听</h2>
                  <p className="record-ref-voice__sub">请说出您的血压数值</p>
                </div>
                <div className="record-ref-mic-wrap">
                  <div className="record-ref-pulse record-ref-pulse--outer" aria-hidden="true"></div>
                  <div className="record-ref-pulse record-ref-pulse--inner" aria-hidden="true"></div>
                  <button type="button" className="record-ref-mic-btn" aria-label="停止" onClick={stopVoice}>
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                      mic
                    </span>
                  </button>
                </div>
                <button type="button" className="record-ref-stop" onClick={stopVoice}>
                  停止
                </button>
              </>
            )}
            <div className="record-ref-transcript">
              {voiceIdle ? (
                <span className="record-ref-transcript__placeholder">
                  试着说出「高压120，低压80，心率72」
                </span>
              ) : (
                <span>{interim || '请说出您的血压数值'}</span>
              )}
            </div>
          </section>
        ) : null}

        <section className="record-ref-panel card card--elevated">
          <p className="record-ref-panel__eyebrow">手动输入</p>
          <div className="record-ref-grid3">
            <div className="record-ref-field">
              <label className="record-ref-field__label" htmlFor="input-sys">
                收缩压
              </label>
              <div className="record-ref-field__box">
                <input
                  type="number"
                  id="input-sys"
                  min={60}
                  max={260}
                  inputMode="numeric"
                  className="record-ref-field__input"
                  value={sys}
                  onChange={(e) => setSys(e.target.value)}
                />
                <span className="record-ref-field__unit">mmHg</span>
              </div>
            </div>
            <div className="record-ref-field">
              <label className="record-ref-field__label" htmlFor="input-dia">
                舒张压
              </label>
              <div className="record-ref-field__box">
                <input
                  type="number"
                  id="input-dia"
                  min={40}
                  max={150}
                  inputMode="numeric"
                  className="record-ref-field__input"
                  value={dia}
                  onChange={(e) => setDia(e.target.value)}
                />
                <span className="record-ref-field__unit">mmHg</span>
              </div>
            </div>
            <div className="record-ref-field">
              <label className="record-ref-field__label" htmlFor="input-pulse">
                脉搏
              </label>
              <div className="record-ref-field__box">
                <input
                  type="number"
                  id="input-pulse"
                  min={30}
                  max={220}
                  inputMode="numeric"
                  className="record-ref-field__input"
                  value={pulse}
                  onChange={(e) => setPulse(e.target.value)}
                />
                <span className="record-ref-field__unit">bpm</span>
              </div>
            </div>
          </div>

          <details className="record-ref-more">
            <summary className="record-ref-more__summary">
              <span className="material-symbols-outlined">tune</span>
              更多选项（时间、备注）
            </summary>
            <div className="record-ref-more__body">
              <div
                className="record-ref-row"
                role="button"
                tabIndex={0}
                onClick={toggleTimeInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggleTimeInput()
                  }
                }}
              >
                <span className="record-ref-row__label">
                  <span className="material-symbols-outlined">schedule</span>
                  测量时间
                </span>
                <span className="record-ref-row__hint">{timeExpanded ? '▼' : '▶'}</span>
              </div>
              <div className={timeExpanded ? 'record-ref-row-inset' : 'hidden'}>
                <span className="record-ref-row__label">选择时间</span>
                <input
                  type="datetime-local"
                  className="record-ref-datetime"
                  value={inputTime}
                  onChange={(e) => {
                    timeUserEdited.current = true
                    setInputTime(e.target.value)
                  }}
                />
              </div>
              <div className="record-ref-row">
                <label className="record-ref-row__label" htmlFor="input-note">
                  <span className="material-symbols-outlined">edit_note</span>
                  备注
                </label>
                <input
                  type="text"
                  id="input-note"
                  className="record-ref-note"
                  maxLength={30}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>
          </details>

          <button type="button" id="save-btn" className="record-ref-save" onClick={onSave}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              check_circle
            </span>
            保存记录
          </button>
        </section>
      </div>
    </main>
  )
}
