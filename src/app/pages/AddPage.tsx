import { useCallback, useEffect, useRef, useState } from 'react'
import { nowLocalISO } from '../../utils/bp'
import { parseSpeech } from '../../utils/voice'
import { Storage } from '../../lib/storage'

type Props = {
  onSaved: () => void
  showToast: (msg: string) => void
  /** 每次点击首页 FAB 递增，用于触发自动开始语音识别 */
  fabVoiceGen?: number
}

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
    <main className="page-main page-main--record">
      <div className="voice-card card card--elevated">
        {voiceSupported ? (
          <>
            <div id="voice-idle" className={'voice-idle' + (voiceIdle ? '' : ' hidden')}>
              <button type="button" id="voice-btn" className="mic-btn" aria-label="语音输入血压" onClick={startVoice}>
                <span className="mic-btn__glow" aria-hidden="true"></span>
                <span className="material-symbols-outlined mic-btn__icon">mic</span>
              </button>
              <p className="voice-desc">点击说出血压数值</p>
              <p className="voice-example">
                试着说：<strong className="voice-kw">高压</strong>、<strong className="voice-kw">低压</strong>与
                <strong className="voice-kw">心率</strong>
              </p>
            </div>

            <div id="voice-recording" className={'voice-recording' + (voiceIdle ? ' hidden' : '')}>
              <div className="voice-pulse-ring" aria-hidden="true"></div>
              <div className="voice-wave">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p className="recording-label">正在聆听…</p>
              <p id="voice-interim" className="voice-interim">
                {interim}
              </p>
              <button type="button" id="voice-stop-btn" className="stop-btn" onClick={stopVoice}>
                停止
              </button>
            </div>
          </>
        ) : null}
      </div>

      <p className="manual-divider">
        <span className="manual-divider__line"></span>
        <span className="manual-divider__text">或手动填写</span>
        <span className="manual-divider__line"></span>
      </p>

      <div className="form-grid">
        <div className="field-card card">
          <label className="field-card__label" htmlFor="input-sys">
            收缩压（高压）
          </label>
          <div className="field-card__row">
            <input
              type="number"
              id="input-sys"
              min={60}
              max={260}
              placeholder="120"
              inputMode="numeric"
              className="field-card__input"
              value={sys}
              onChange={(e) => setSys(e.target.value)}
            />
            <span className="field-card__unit">mmHg</span>
          </div>
        </div>
        <div className="field-card card">
          <label className="field-card__label" htmlFor="input-dia">
            舒张压（低压）
          </label>
          <div className="field-card__row">
            <input
              type="number"
              id="input-dia"
              min={40}
              max={150}
              placeholder="80"
              inputMode="numeric"
              className="field-card__input"
              value={dia}
              onChange={(e) => setDia(e.target.value)}
            />
            <span className="field-card__unit">mmHg</span>
          </div>
        </div>
        <div className="field-card card field-card--wide">
          <div className="field-card__head">
            <label className="field-card__label" htmlFor="input-pulse">
              心率
            </label>
            <span className="field-card__hint">BPM</span>
          </div>
          <input
            type="number"
            id="input-pulse"
            min={30}
            max={220}
            placeholder="72"
            inputMode="numeric"
            className="field-card__input field-card__input--block"
            value={pulse}
            onChange={(e) => setPulse(e.target.value)}
          />
        </div>
      </div>

      <details className="more-fields card card--tonal">
        <summary className="more-fields__summary">
          <span className="material-symbols-outlined">tune</span>
          更多选项（时间、备注）
        </summary>
        <div className="more-fields__body">
          <div
            className="form-row time-toggle-row"
            id="time-toggle-row"
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
            <span className="form-label">
              <span className="material-symbols-outlined form-label__icon">schedule</span>
              测量时间
            </span>
            <span className="form-time-hint">{timeExpanded ? '不填则使用当前时间 ▾' : '不填则使用当前时间 ▸'}</span>
          </div>
          <div id="time-input-wrap" className={'time-input-wrap' + (timeExpanded ? '' : ' hidden')}>
            <div className="form-row form-row--inset">
              <span className="form-label">选择时间</span>
              <input
                type="datetime-local"
                id="input-time"
                className="form-input-right"
                value={inputTime}
                onChange={(e) => {
                  timeUserEdited.current = true
                  setInputTime(e.target.value)
                }}
              />
            </div>
          </div>
          <div className="form-row form-row--note">
            <label className="form-label" htmlFor="input-note">
              <span className="material-symbols-outlined form-label__icon">edit_note</span>
              备注
            </label>
            <input
              type="text"
              id="input-note"
              className="form-input-right"
              placeholder="可选"
              maxLength={30}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
      </details>

      <div className="tip-banner tip-banner--record">
        <span className="material-symbols-outlined tip-banner__icon">info</span>
        <p className="tip-banner__text">测量前请放松静坐约 5 分钟，有助于提高准确度。</p>
      </div>

      <button type="button" id="save-btn" className="save-btn save-btn--plain" onClick={onSave}>
        保存测量
      </button>
    </main>
  )
}
